import Anthropic from '@anthropic-ai/sdk';
import type * as Beta from '@anthropic-ai/sdk/resources/beta/messages/messages';
import type { Logger } from 'pino';
import { z } from 'zod';
import { ProviderUnavailableError } from '../../lib/errors.js';
import type { AssistantProvider, AssistantRequest, AssistantResult, AssistantTool } from './assistant.js';

export interface AnthropicAssistantOptions {
  apiKey: string;
  model: string;
  effort: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  logger: Logger;
  /** Look-ups the model may make for one answer before it must reply with what it has */
  maxToolRounds?: number;
  /** Tests pass a fake fetch that replays recorded API responses */
  fetch?: typeof fetch;
  baseURL?: string;
}

/** A chat answer is short; this ceiling only stops a runaway reply from running up the bill. */
const MAX_TOKENS = 16_000;
/** Bytes of one tool result passed back to the model (a nursery's full stock list fits easily) */
const MAX_TOOL_RESULT_CHARS = 24_000;

const toolDefinition = (tool: AssistantTool): Beta.BetaTool => {
  const { $schema: _ignored, ...schema } = z.toJSONSchema(tool.input, { io: 'input' }) as Record<string, unknown>;
  return {
    name: tool.name,
    description: tool.description,
    input_schema: { ...schema, type: 'object' },
    // Stream inputs as written; they are small, and checked against the Zod schema before running
    eager_input_streaming: true,
  };
};

const resultContent = (value: unknown): string => {
  const text = JSON.stringify(value);
  return text.length > MAX_TOOL_RESULT_CHARS ? `${text.slice(0, MAX_TOOL_RESULT_CHARS)}… (cut short)` : text;
};

/**
 * The site assistant on Claude (Anthropic Messages API), streaming, with the site's look-ups as
 * tools. The tool loop runs here: each round streams the model's text to the person, then runs
 * every look-up it asked for (in parallel) and sends the results back, until it answers.
 *
 * - The fixed instructions and tool list come first and are cached (top-level cache_control);
 *   the per-request facts go in a system message at the end of the conversation, after the cache.
 * - If the model declines for policy reasons, the API retries on its default fallback model.
 */
export class AnthropicAssistant implements AssistantProvider {
  readonly name = 'anthropic' as const;
  private readonly client: Anthropic;
  private readonly maxToolRounds: number;

  constructor(private readonly options: AnthropicAssistantOptions) {
    this.client = new Anthropic({
      apiKey: options.apiKey,
      maxRetries: 2,
      timeout: 60_000,
      ...(options.fetch ? { fetch: options.fetch } : {}),
      ...(options.baseURL ? { baseURL: options.baseURL } : {}),
    });
    this.maxToolRounds = options.maxToolRounds ?? 6;
  }

  async respond(request: AssistantRequest): Promise<AssistantResult> {
    const tools = request.tools.map(toolDefinition);
    const messages: Beta.BetaMessageParam[] = [
      ...request.history.map(m => ({ role: m.role, content: m.content })),
      { role: 'system', content: request.context },
    ];
    let wroteText = false;
    let unparseableInputs = 0;

    for (let round = 0; round <= this.maxToolRounds; round++) {
      // The last round offers no tools, so the model must answer with what it has found
      const offerTools = round < this.maxToolRounds;
      let separated = !wroteText;
      const stream = this.client.beta.messages.stream(
        {
          model: this.options.model,
          max_tokens: MAX_TOKENS,
          system: request.system,
          ...(offerTools ? { tools } : {}),
          messages,
          output_config: { effort: this.options.effort },
          cache_control: { type: 'ephemeral' },
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
        },
        { signal: request.signal }
      );
      stream.on('text', delta => {
        // Text from an earlier round ("Let me check…") stays a paragraph of its own
        if (!separated) {
          request.onText('\n\n');
          separated = true;
        }
        wroteText = true;
        request.onText(delta);
      });

      let message: Beta.BetaMessage;
      try {
        message = await stream.finalMessage();
      } catch (err) {
        // A tool input that isn't valid JSON fails the stream (not an API error): ask once more
        if (err instanceof Anthropic.AnthropicError && !(err instanceof Anthropic.APIError) && unparseableInputs++ < 1) {
          this.options.logger.warn({ err }, 'Assistant: unparseable tool input, asking again');
          round--;
          continue;
        }
        throw this.unavailable(err);
      }
      this.logUsage(message);

      if (message.stop_reason === 'refusal') return { stop: 'declined' };
      const calls = message.content.filter((b): b is Beta.BetaToolUseBlock => b.type === 'tool_use');
      // A look-up cut off at the token limit may parse as a valid but truncated input: never run it
      if (message.stop_reason === 'max_tokens') return { stop: 'limit' };
      if (calls.length === 0 || message.stop_reason !== 'tool_use') return { stop: 'complete' };

      messages.push({ role: 'assistant', content: message.content });
      const results = await Promise.all(
        calls.map(async (call): Promise<Beta.BetaToolResultBlockParam> => {
          const outcome = await request.callTool(call.name, call.input);
          return outcome.ok
            ? { type: 'tool_result', tool_use_id: call.id, content: resultContent(outcome.result) }
            : { type: 'tool_result', tool_use_id: call.id, content: outcome.error, is_error: true };
        })
      );
      // Every result in one message, so the model keeps asking for look-ups in parallel
      messages.push({ role: 'user', content: results });
    }
    return { stop: 'limit' };
  }

  private logUsage(message: Beta.BetaMessage): void {
    const u = message.usage;
    this.options.logger.info(
      {
        assistant: {
          model: message.model,
          stop: message.stop_reason,
          input_tokens: u.input_tokens,
          output_tokens: u.output_tokens,
          cache_read_input_tokens: u.cache_read_input_tokens,
          cache_creation_input_tokens: u.cache_creation_input_tokens,
        },
      },
      'Assistant: model round'
    );
  }

  /** Maps SDK failures to the API's own error, without passing on the provider's wording. */
  private unavailable(err: unknown): Error {
    if (err instanceof Anthropic.APIUserAbortError) return err;
    if (err instanceof Anthropic.RateLimitError) {
      this.options.logger.warn({ err }, 'Assistant: rate limited by the model provider');
      return new ProviderUnavailableError('The assistant is very busy right now. Please try again in a minute.');
    }
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError || err instanceof Anthropic.BadRequestError) {
      // Our configuration or request is wrong: an operator must look at it
      this.options.logger.error({ err }, 'Assistant: the model provider refused the request');
      return new ProviderUnavailableError('The assistant isn’t available right now.');
    }
    this.options.logger.error({ err }, 'Assistant: the model provider failed');
    return new ProviderUnavailableError('The assistant couldn’t answer just now. Please try again.');
  }
}
