import { describe, expect, it, vi } from 'vitest'
import { backoffDelay, withRetry } from './retry'

const noSleep = () => Promise.resolve()

describe('backoffDelay', () => {
  it('grows exponentially before jitter (random = 1 gives the full window)', () => {
    const one = () => 1
    expect(backoffDelay(1, 500, 30_000, one)).toBe(500)
    expect(backoffDelay(2, 500, 30_000, one)).toBe(1000)
    expect(backoffDelay(3, 500, 30_000, one)).toBe(2000)
  })

  it('caps the delay at maxDelayMs', () => {
    expect(backoffDelay(20, 500, 30_000, () => 1)).toBe(30_000)
  })

  it('applies full jitter (random = 0 gives zero delay)', () => {
    expect(backoffDelay(5, 500, 30_000, () => 0)).toBe(0)
  })
})

describe('withRetry', () => {
  it('returns the result on first success without retrying', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    await expect(withRetry(fn, { sleep: noSleep })).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries until it succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('ok')
    await expect(withRetry(fn, { sleep: noSleep, random: () => 0 })).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('gives up after maxAttempts and throws the last error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always'))
    await expect(
      withRetry(fn, { maxAttempts: 3, sleep: noSleep, random: () => 0 }),
    ).rejects.toThrow('always')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('stops immediately when shouldRetry returns false', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fatal'))
    await expect(withRetry(fn, { sleep: noSleep, shouldRetry: () => false })).rejects.toThrow(
      'fatal',
    )
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('throws AbortError when the signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const fn = vi.fn()
    await expect(withRetry(fn, { sleep: noSleep, signal: controller.signal })).rejects.toThrow(
      /abort/i,
    )
    expect(fn).not.toHaveBeenCalled()
  })
})
