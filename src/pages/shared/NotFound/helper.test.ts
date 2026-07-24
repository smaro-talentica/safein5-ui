import { describe, expect, it } from 'vitest'
import { resolveVariant } from './helper'

describe('resolveVariant', () => {
  it('treats no error (the * catch-all route) as not-found', () => {
    expect(resolveVariant(undefined)).toBe('not-found')
  })

  it('treats a 404 route error response as not-found', () => {
    expect(
      resolveVariant({ status: 404, statusText: 'Not Found', internal: false, data: null }),
    ).toBe('not-found')
  })

  it('treats a non-404 route error response as error', () => {
    expect(
      resolveVariant({ status: 500, statusText: 'Server Error', internal: false, data: null }),
    ).toBe('error')
  })

  it('treats a thrown JS error as error', () => {
    expect(resolveVariant(new Error('boom'))).toBe('error')
  })

  it('treats an arbitrary non-error value as error', () => {
    expect(resolveVariant('something')).toBe('error')
  })
})
