import type { z } from 'zod';
import type { AssistantStop } from '@nurserylink/shared';

/** A message of the conversation so far, as plain text (the server keeps no conversation). */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Something the assistant can look up. Tools only read: the site's public catalogue, or the
 * signed-in buyer's own records. `run` receives input already checked against `input`.
 */
export interface AssistantTool<S extends z.ZodObject = z.ZodObject> {
  name: string;
  /** For the model: what the tool does and when to use it */
  description: string;
  input: S;
  /** For people, while it runs: "Looking up nurseries…" */
  label: string;
  run(input: z.output<S>): Promise<unknown>;
}

/** The outcome of one tool call, as the model sees it. */
export type ToolOutcome = { ok: true; result: unknown } | { ok: false; error: string };

export interface AssistantRequest {
  /** Fixed instructions (identical on every request, so providers can cache them) */
  system: string;
  /** Facts about this request: today's date, the page, whether the person is signed in */
  context: string;
  history: ChatMessage[];
  tools: AssistantTool[];
  /** Runs a tool by name with the model's raw input, validating it first */
  callTool(name: string, input: unknown): Promise<ToolOutcome>;
  /** Each piece of answer text, as it is written */
  onText(text: string): void;
  signal: AbortSignal;
}

export interface AssistantResult {
  stop: AssistantStop;
}

/**
 * The model behind the site assistant. Implementations: AnthropicAssistant (Claude) and
 * MockAssistant (keyword matching, for development and tests).
 *
 * Throws ProviderUnavailableError when the model service cannot answer.
 */
export interface AssistantProvider {
  readonly name: 'mock' | 'anthropic';
  respond(request: AssistantRequest): Promise<AssistantResult>;
}
