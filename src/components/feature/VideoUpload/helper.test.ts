import { afterEach, describe, expect, it, vi } from 'vitest'
import { dashedBorder, navigatorOnline, statusLabel } from './helper'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('statusLabel', () => {
  it('maps each non-paused status to its label', () => {
    expect(statusLabel('queued')).toBe('Queued…')
    expect(statusLabel('uploading')).toBe('Uploading…')
    expect(statusLabel('completing')).toBe('Finishing…')
    expect(statusLabel('completed')).toBe('Complete')
    expect(statusLabel('error')).toBe('Failed')
    expect(statusLabel('canceled')).toBe('Canceled')
  })

  it('labels paused as "Paused" when online', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    expect(statusLabel('paused')).toBe('Paused')
  })

  it('labels paused as waiting-for-network when offline', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    expect(statusLabel('paused')).toBe('Waiting for network…')
  })
})

describe('navigatorOnline', () => {
  it('reflects navigator.onLine', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    expect(navigatorOnline()).toBe(false)
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    expect(navigatorOnline()).toBe(true)
  })
})

describe('dashedBorder', () => {
  it('builds an SVG data URL with the URL-encoded color', () => {
    const url = dashedBorder('#ff0000')
    expect(url.startsWith('url("data:image/svg+xml,')).toBe(true)
    // '#' must be percent-encoded inside the SVG stroke attribute.
    expect(url).toContain(encodeURIComponent('#ff0000'))
    expect(url).not.toContain("stroke='#ff0000'")
  })

  it('encodes colors with parentheses/spaces (e.g. rgb())', () => {
    const url = dashedBorder('rgb(0, 0, 0)')
    expect(url).toContain(encodeURIComponent('rgb(0, 0, 0)'))
  })
})
