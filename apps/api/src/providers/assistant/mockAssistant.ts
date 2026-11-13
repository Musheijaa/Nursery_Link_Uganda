import type { AssistantProvider, AssistantRequest, AssistantResult } from './assistant.js';

/** Words that say nothing about which tree or nursery is meant. */
const STOP_WORDS = new Set(
  'a an and any are buy can do does find for from get grow have how i in is it me my near nearest nursery nurseries of on plant please seedling seedlings sell sells selling the there to tree trees what when where which who with you your'.split(' ')
);

interface Linked {
  name?: unknown;
  title?: unknown;
  link?: unknown;
}

const asRecord = (value: unknown): Record<string, unknown> => (typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {});

/** The list of things a tool found, each with a name and a link on the site. */
const linkedItems = (result: unknown): { name: string; link: string }[] => {
  const items = asRecord(result).results;
  if (!Array.isArray(items)) return [];
  return items.flatMap(item => {
    const { name, title, link } = asRecord(item) as Linked;
    const label = typeof name === 'string' ? name : typeof title === 'string' ? title : null;
    return label && typeof link === 'string' ? [{ name: label, link }] : [];
  });
};

/**
 * Development and test stand-in for the AI assistant. It has no language model: it picks one
 * look-up from keywords in the question, runs it through the real tools, and lists what it found,
 * clearly labelled as the test assistant. Deterministic, so tests can rely on it.
 */
export class MockAssistant implements AssistantProvider {
  readonly name = 'mock' as const;

  async respond(request: AssistantRequest): Promise<AssistantResult> {
    const question = request.history.at(-1)?.content.toLowerCase() ?? '';
    const has = (name: string) => request.tools.some(t => t.name === name);
    const words = question.replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
    const query = words.slice(0, 3).join(' ');

    const [tool, input]: [string, Record<string, unknown>] =
      /\b(free|campaign|bure)\b/.test(question) ? ['list_free_seedling_campaigns', {}]
      : /\b(when|season|rain|rains|calendar)\b/.test(question) ? ['planting_calendar', {}]
      : /\border/.test(question) && has('my_orders') ? ['my_orders', {}]
      : /\b(advice|news|tips?)\b/.test(question) ? ['latest_advice', {}]
      : /\b(nursery|nurseries|near|nearest|buy|where)\b/.test(question) ? ['search_nurseries', query ? { query } : {}]
      : ['search_trees', query ? { query } : {}];

    const outcome = await request.callTool(tool, input);
    const write = (text: string) => {
      // In small pieces, like a model's stream
      for (const piece of text.match(/.{1,40}/gsu) ?? []) request.onText(piece);
    };
    write('_Test assistant: no AI model is connected, so this is a keyword look-up._\n\n');
    if (!outcome.ok) {
      write(`I couldn’t look that up: ${outcome.error}`);
      return { stop: 'complete' };
    }
    const advice = asRecord(outcome.result).advice;
    if (typeof advice === 'string') {
      write(advice);
      return { stop: 'complete' };
    }
    const items = linkedItems(outcome.result);
    write(items.length === 0 ? 'I didn’t find anything for that. Try other words, or browse [Find nurseries](/nurseries).' : `Here is what I found:\n\n${items.map(i => `- [${i.name}](${i.link})`).join('\n')}`);
    return { stop: 'complete' };
  }
}
