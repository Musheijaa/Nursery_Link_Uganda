/** Recursively turns Date values into ISO strings (raw SQL rows → API JSON). */
export type IsoDates<T> = T extends Date ? string : T extends (infer U)[] ? IsoDates<U>[] : T extends object ? { [K in keyof T]: IsoDates<T[K]> } : T;

export const toIsoDates = <T>(value: T): IsoDates<T> => {
  if (value instanceof Date) return value.toISOString() as IsoDates<T>;
  if (Array.isArray(value)) return value.map(toIsoDates) as IsoDates<T>;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toIsoDates(v)])) as IsoDates<T>;
  }
  return value as IsoDates<T>;
};
