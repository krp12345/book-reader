/** Whether a fetcher's result is a promise (async) vs an immediate value. */
export const isThenable = <T>(value: T | Promise<T>): value is Promise<T> =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { then?: unknown }).then === 'function';
