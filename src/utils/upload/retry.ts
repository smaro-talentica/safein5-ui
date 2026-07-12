/**
 * Exponential backoff with jitter. This is the mechanism behind the
 * "upload should not fail" requirement: a transient failure retries with
 * increasing delay rather than giving up. Callers decide which errors are
 * retryable via `shouldRetry`.
 */
export interface RetryOptions {
  /** Max attempts including the first. Default 8. */
  maxAttempts?: number
  /** Base delay in ms. Default 500. */
  baseDelayMs?: number
  /** Cap on any single delay. Default 30_000. */
  maxDelayMs?: number
  /** Return false to stop retrying a given error (e.g. 4xx). */
  shouldRetry?: (error: unknown, attempt: number) => boolean
  /** Abort signal to cancel between attempts. */
  signal?: AbortSignal
  /** Injectable sleep + jitter for tests. */
  sleep?: (ms: number) => Promise<void>
  random?: () => number
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export function backoffDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  random: () => number,
): number {
  const exp = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1))
  // Full jitter: pick a random point in [0, exp] to avoid thundering herds.
  return Math.round(exp * random())
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const {
    maxAttempts = 8,
    baseDelayMs = 500,
    maxDelayMs = 30_000,
    shouldRetry = () => true,
    signal,
    sleep = defaultSleep,
    random = Math.random,
  } = opts

  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt >= maxAttempts || !shouldRetry(error, attempt)) throw error
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      await sleep(backoffDelay(attempt, baseDelayMs, maxDelayMs, random))
    }
  }
  throw lastError
}
