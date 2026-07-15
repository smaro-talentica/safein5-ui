import { afterEach, describe, expect, it, vi } from 'vitest'
import { isIndexedDbAvailable, makeVideoId } from './helper'

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
