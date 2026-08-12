export interface RetryOptions {
  attempts?: number;
  delayMs?: number;
  backoffFactor?: number;
}

const wait = (delayMs: number) =>
  new Promise((resolve) => globalThis.setTimeout(resolve, delayMs));

export const retryAsync = async <T>(
  task: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> => {
  const attempts = Math.max(1, options.attempts ?? 3);
  const delayMs = Math.max(0, options.delayMs ?? 600);
  const backoffFactor = Math.max(1, options.backoffFactor ?? 1.8);
  let nextDelay = delayMs;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      await wait(nextDelay);
      nextDelay = Math.round(nextDelay * backoffFactor);
    }
  }

  throw lastError;
};
