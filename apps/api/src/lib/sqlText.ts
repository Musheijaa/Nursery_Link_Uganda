/** Escapes %, _ and \ so user text is matched literally inside an ILIKE pattern. */
export const escapeLike = (text: string): string => text.replace(/[\\%_]/g, char => `\\${char}`);

/** An ILIKE pattern matching `text` anywhere, literally ('%…%'). */
export const containsPattern = (text: string): string => `%${escapeLike(text)}%`;
