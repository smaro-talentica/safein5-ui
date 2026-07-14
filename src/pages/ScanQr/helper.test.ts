import { describe, expect, it } from 'vitest'
import { resolveScanTarget } from './helper'

describe('resolveScanTarget', () => {
  it('resolves a valid JSON payload with a string id', () => {
    expect(resolveScanTarget('{"id":"abc123"}')).toEqual({ kind: 'ok', id: 'abc123' })
  })

  it('trims surrounding whitespace before parsing', () => {
    expect(resolveScanTarget('  {"id":"abc123"}  ')).toEqual({ kind: 'ok', id: 'abc123' })
  })

  it('keeps a valid id verbatim (no inner trimming of the id value)', () => {
    expect(resolveScanTarget('{"id":" spaced "}')).toEqual({ kind: 'ok', id: ' spaced ' })
  })

  it('is invalid for empty or whitespace-only input', () => {
    expect(resolveScanTarget('')).toEqual({ kind: 'invalid' })
    expect(resolveScanTarget('   ')).toEqual({ kind: 'invalid' })
  })

  it('is invalid for non-JSON text', () => {
    expect(resolveScanTarget('not json')).toEqual({ kind: 'invalid' })
  })

  it('is invalid when the payload is not an object', () => {
    expect(resolveScanTarget('"just-a-string"')).toEqual({ kind: 'invalid' })
    expect(resolveScanTarget('42')).toEqual({ kind: 'invalid' })
  })

  it('is invalid when the payload is null', () => {
    expect(resolveScanTarget('null')).toEqual({ kind: 'invalid' })
  })

  it('is invalid when the id key is missing', () => {
    expect(resolveScanTarget('{"foo":"bar"}')).toEqual({ kind: 'invalid' })
  })

  it('is invalid when id is not a string', () => {
    expect(resolveScanTarget('{"id":123}')).toEqual({ kind: 'invalid' })
  })

  it('is invalid when id is an empty or whitespace-only string', () => {
    expect(resolveScanTarget('{"id":""}')).toEqual({ kind: 'invalid' })
    expect(resolveScanTarget('{"id":"   "}')).toEqual({ kind: 'invalid' })
  })
})
