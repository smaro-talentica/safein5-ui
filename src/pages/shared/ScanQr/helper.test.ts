import { describe, expect, it } from 'vitest'
import { resolveScanTarget } from './helper'

describe('resolveScanTarget', () => {
  it('resolves a QR deep link URL of the form /scan/:code', () => {
    expect(resolveScanTarget('https://app.safein5.com/scan/abc123')).toEqual({
      kind: 'ok',
      id: 'abc123',
    })
  })

  it('trims surrounding whitespace before parsing', () => {
    expect(resolveScanTarget('  https://app.safein5.com/scan/abc123  ')).toEqual({
      kind: 'ok',
      id: 'abc123',
    })
  })

  it('decodes a URL-encoded id in a QR deep link', () => {
    expect(resolveScanTarget('https://app.safein5.com/scan/abc%20123')).toEqual({
      kind: 'ok',
      id: 'abc 123',
    })
  })

  it('is invalid for empty or whitespace-only input', () => {
    expect(resolveScanTarget('')).toEqual({ kind: 'invalid' })
    expect(resolveScanTarget('   ')).toEqual({ kind: 'invalid' })
  })

  it('is invalid for non-URL text', () => {
    expect(resolveScanTarget('not a url')).toEqual({ kind: 'invalid' })
    expect(resolveScanTarget('{"id":"abc123"}')).toEqual({ kind: 'invalid' })
  })

  it('is invalid for a deep link with an empty code segment', () => {
    expect(resolveScanTarget('https://app.safein5.com/scan/')).toEqual({ kind: 'invalid' })
  })

  it('is invalid for a deep link with a whitespace-only code segment', () => {
    expect(resolveScanTarget('https://app.safein5.com/scan/%20')).toEqual({ kind: 'invalid' })
  })

  it('is invalid for a code that collides with a reserved scan segment', () => {
    expect(resolveScanTarget('https://app.safein5.com/scan/success')).toEqual({ kind: 'invalid' })
    expect(resolveScanTarget('https://app.safein5.com/scan/fail')).toEqual({ kind: 'invalid' })
  })

  it('is invalid for a URL that is not a /scan/:code deep link', () => {
    expect(resolveScanTarget('https://app.safein5.com/qr/abc123')).toEqual({ kind: 'invalid' })
    expect(resolveScanTarget('https://app.safein5.com/scan/abc/extra')).toEqual({ kind: 'invalid' })
    expect(resolveScanTarget('https://app.safein5.com/')).toEqual({ kind: 'invalid' })
  })
})
