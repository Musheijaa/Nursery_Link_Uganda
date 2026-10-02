/** Escapes %, _ and \ so user text is matched literally inside ILIKE '%…%'. */
export const containsPattern = (text: string): string => `%${text.replace(/[\\%_]/g, char => `\\${char}`)}%`;
