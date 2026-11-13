import type { Logger } from 'pino';
import { z } from 'zod';
import type { AssistantEvent, Role } from '@nurserylink/shared';
import type { Config } from '../../config.js';
import { AppError, ProviderUnavailableError, RateLimitedError } from '../../lib/errors.js';
import type { LatLng } from '../../lib/geo.js';
import type { AssistantProvider, ChatMessage, ToolOutcome } from '../../providers/assistant/assistant.js';
import { assistantContext, assistantSystemPrompt } from './assistant.prompt.js';
import { assistantTools, seasonNow, type ToolDeps } from './assistant.tools.js';

export interface ChatRequest {
  messages: ChatMessage[];
  location?: LatLng | undefined;
  page?: string | undefined;
}

export interface Viewer {
  id: string;
  role: Role;
}

/** A question accepted for answering: run it to stream the answer. */
export interface PreparedChat {
  run(emit: (event: AssistantEvent) => void, signal: AbortSignal): Promise<void>;
}

/**
 * The site assistant: answers questions about trees, nurseries and the site by letting a language
 * model look things up through read-only tools (see assistant.tools.ts).
 *
 * The conversation is not stored: each request carries its recent history. Answers are counted
 * per day across everyone (ASSISTANT_DAILY_LIMIT), as a ceiling on the model provider's bill.
 */
export class AssistantService {
  private readonly system: string;
  private budget = { day: '', used: 0 };

  constructor(
    private readonly deps: {
      provider: AssistantProvider | null;
      tools: ToolDeps;
      config: Pick<Config, 'PAYMENTS' | 'PHONE_VERIFICATION' | 'DEMO_NOTICE' | 'ASSISTANT_DAILY_LIMIT'>;
      logger: Logger;
      now?: () => Date;
    }
  ) {
    this.system = assistantSystemPrompt(deps.config);
  }

  /**
   * Checks the assistant can take the question now, and reserves one of today's answers.
   * Throws before anything is streamed, so the caller can still answer with a plain error.
   */
  prepare(request: ChatRequest, viewer: Viewer | null): PreparedChat {
    const { provider, logger } = this.deps;
    if (!provider) throw new ProviderUnavailableError('The assistant is switched off.');
    const now = this.now();
    this.reserveAnswer(now);

    const buyerId = viewer?.role === 'buyer' ? viewer.id : null;
    const tools = assistantTools(this.deps.tools, { buyerId, location: request.location ?? null, now });
    const context = assistantContext({
      now,
      page: request.page,
      signedIn: viewer?.role ?? null,
      hasLocation: request.location !== undefined,
      season: seasonNow(now),
    });

    return {
      run: async (emit, signal) => {
        const callTool = async (name: string, raw: unknown): Promise<ToolOutcome> => {
          const tool = tools.find(t => t.name === name);
          if (!tool) return { ok: false, error: `There is no tool called ${name}.` };
          const input = tool.input.safeParse(raw ?? {});
          if (!input.success) return { ok: false, error: `The input is not valid:\n${z.prettifyError(input.error)}` };
          emit({ type: 'status', tool: name, label: tool.label });
          try {
            return { ok: true, result: await tool.run(input.data) };
          } catch (err) {
            // Expected outcomes (not found, bad place) go back to the model to explain; others are bugs
            if (err instanceof AppError && err.status < 500) return { ok: false, error: err.message };
            logger.error({ err, tool: name }, 'Assistant: a tool failed');
            return { ok: false, error: 'This look-up failed. Tell the person it isn’t working right now.' };
          }
        };

        try {
          const result = await provider.respond({
            system: this.system,
            context,
            history: request.messages,
            tools,
            callTool,
            onText: text => { emit({ type: 'text', text }); },
            signal,
          });
          emit({ type: 'done', stop: result.stop });
        } catch (err) {
          // The person closed the chat or asked a new question: nobody is listening
          if (signal.aborted) {
            logger.debug('Assistant: answer stopped by the person');
            return;
          }
          if (err instanceof AppError) {
            emit({ type: 'error', code: err.code, message: err.message });
            return;
          }
          logger.error({ err }, 'Assistant: answering failed');
          emit({ type: 'error', code: 'internal_error', message: 'Something went wrong while answering. Please try again.' });
        }
      },
    };
  }

  private now(): Date {
    return this.deps.now?.() ?? new Date();
  }

  private reserveAnswer(now: Date): void {
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala' }).format(now);
    if (this.budget.day !== day) this.budget = { day, used: 0 };
    if (this.budget.used >= this.deps.config.ASSISTANT_DAILY_LIMIT) {
      this.deps.logger.warn({ limit: this.deps.config.ASSISTANT_DAILY_LIMIT }, 'Assistant: daily answer limit reached');
      throw new RateLimitedError('The assistant has answered all the questions it can for today. Please try again tomorrow, or browse the site.');
    }
    this.budget.used++;
  }
}
