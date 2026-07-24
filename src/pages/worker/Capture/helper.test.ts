import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildChunks,
  clampChunkSize,
  isIndexedDbAvailable,
  makeVideoId,
  nextRetryDelay,
} from './helper'
import { CHUNK_RETRY_BASE_DELAY_MS, MIN_CHUNK_SIZE } from './constant'

describe('makeVideoId', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('joins timestamp, size, and a scaled random into a stable shape', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000)
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    expect(makeVideoId(42)).toBe('1000-42-500000000')
  })

  it('matches the timestamp-size-random format for arbitrary inputs', () => {
    expect(makeVideoId(0)).toMatch(/^\d+-0-\d+$/)
    expect(makeVideoId(123456)).toMatch(/^\d+-123456-\d+$/)
  })

  it('rounds the random segment and never exceeds 1e9', () => {
    vi.spyOn(Date, 'now').mockReturnValue(7)
    vi.spyOn(Math, 'random').mockReturnValue(0.9999999999)
    expect(makeVideoId(3)).toBe('7-3-1000000000')
  })
})

describe('isIndexedDbAvailable', () => {
  const original = globalThis.indexedDB

  afterEach(() => {
    globalThis.indexedDB = original
  })

  it('is true when indexedDB exists on the global', () => {
    globalThis.indexedDB = {} as unknown as IDBFactory
    expect(isIndexedDbAvailable()).toBe(true)
  })

  it('is false when indexedDB is undefined', () => {
    globalThis.indexedDB = undefined as unknown as IDBFactory
    expect(isIndexedDbAvailable()).toBe(false)
  })
})

describe('buildChunks', () => {
  it('returns no chunks for a zero or negative size', () => {
    expect(buildChunks(0, 10)).toEqual([])
    expect(buildChunks(-5, 10)).toEqual([])
  })

  it('throws when chunkSize is not positive', () => {
    expect(() => buildChunks(10, 0)).toThrow('chunkSize must be > 0')
    expect(() => buildChunks(10, -1)).toThrow('chunkSize must be > 0')
  })

  it('splits an exact multiple into equal chunks', () => {
    expect(buildChunks(20, 10)).toEqual([
      { chunkNumber: 1, start: 0, end: 10, status: 'pending' },
      { chunkNumber: 2, start: 10, end: 20, status: 'pending' },
    ])
  })

  it('gives the remainder to a final, smaller chunk', () => {
    expect(buildChunks(25, 10)).toEqual([
      { chunkNumber: 1, start: 0, end: 10, status: 'pending' },
      { chunkNumber: 2, start: 10, end: 20, status: 'pending' },
      { chunkNumber: 3, start: 20, end: 25, status: 'pending' },
    ])
  })

  it('produces a single chunk when size is smaller than chunkSize', () => {
    expect(buildChunks(5, 10)).toEqual([{ chunkNumber: 1, start: 0, end: 5, status: 'pending' }])
  })
})

describe('clampChunkSize', () => {
  it('returns the file size when it is at or below the minimum chunk floor', () => {
    expect(clampChunkSize(1024, MIN_CHUNK_SIZE)).toBe(MIN_CHUNK_SIZE)
    expect(clampChunkSize(1024, MIN_CHUNK_SIZE - 1)).toBe(MIN_CHUNK_SIZE - 1)
  })

  it('returns the file size when the requested chunk size already covers it whole', () => {
    const size = MIN_CHUNK_SIZE * 3
    expect(clampChunkSize(size, size)).toBe(size)
  })

  it('raises a too-small requested chunk size up to the minimum floor', () => {
    const size = MIN_CHUNK_SIZE * 4
    expect(clampChunkSize(1024, size)).toBe(MIN_CHUNK_SIZE)
  })

  it('keeps a requested chunk size that already respects the floor', () => {
    const size = MIN_CHUNK_SIZE * 4
    const requested = MIN_CHUNK_SIZE * 2
    expect(clampChunkSize(requested, size)).toBe(requested)
  })
})

describe('nextRetryDelay', () => {
  it('doubles the base delay for each attempt', () => {
    expect(nextRetryDelay(0)).toBe(CHUNK_RETRY_BASE_DELAY_MS)
    expect(nextRetryDelay(1)).toBe(CHUNK_RETRY_BASE_DELAY_MS * 2)
    expect(nextRetryDelay(2)).toBe(CHUNK_RETRY_BASE_DELAY_MS * 4)
  })
})
