import { describe, expect, it } from 'vitest'
import { buildParts, percentComplete, uploadedBytes } from './chunk'
import type { UploadPart } from './types'

const MB = 1024 * 1024

describe('buildParts', () => {
  it('splits a file into evenly sized parts with a smaller last part', () => {
    const parts = buildParts(14 * MB, 6 * MB)
    expect(parts).toHaveLength(3)
    expect(parts[0]).toMatchObject({ partNumber: 1, start: 0, end: 6 * MB })
    expect(parts[1]).toMatchObject({ partNumber: 2, start: 6 * MB, end: 12 * MB })
    expect(parts[2]).toMatchObject({ partNumber: 3, start: 12 * MB, end: 14 * MB })
  })

  it('uses 1-based part numbers', () => {
    const parts = buildParts(10 * MB, 6 * MB)
    expect(parts.map((p) => p.partNumber)).toEqual([1, 2])
  })

  it('produces a single part when the file is smaller than one part', () => {
    const parts = buildParts(2 * MB, 6 * MB)
    expect(parts).toHaveLength(1)
    expect(parts[0]).toMatchObject({ partNumber: 1, start: 0, end: 2 * MB })
  })

  it('produces a single full part when size is an exact multiple boundary', () => {
    const parts = buildParts(6 * MB, 6 * MB)
    expect(parts).toHaveLength(1)
    expect(parts[0].end).toBe(6 * MB)
  })

  it('returns no parts for an empty file', () => {
    expect(buildParts(0, 6 * MB)).toEqual([])
  })

  it('throws when partSize is not positive', () => {
    expect(() => buildParts(10, 0)).toThrow()
  })
})

describe('uploadedBytes / percentComplete', () => {
  const parts: UploadPart[] = [
    { partNumber: 1, start: 0, end: 6 * MB, status: 'done', eTag: 'a' },
    { partNumber: 2, start: 6 * MB, end: 12 * MB, status: 'uploading' },
    { partNumber: 3, start: 12 * MB, end: 14 * MB, status: 'pending' },
  ]

  it('counts only completed parts', () => {
    expect(uploadedBytes(parts)).toBe(6 * MB)
  })

  it('computes rounded percent against the total', () => {
    expect(percentComplete(parts, 14 * MB)).toBe(Math.round(((6 * MB) / (14 * MB)) * 100))
  })

  it('is 0% for a zero-size total', () => {
    expect(percentComplete(parts, 0)).toBe(0)
  })

  it('is 100% when all parts are done', () => {
    const done = parts.map((p) => ({ ...p, status: 'done' as const }))
    expect(percentComplete(done, 14 * MB)).toBe(100)
  })
})
