import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  describeGeolocationError,
  describeStatus,
  formatAccuracy,
  formatCoordinate,
  formatFixedAt,
  formatHeading,
  formatSpeed,
  queryGeolocationPermission,
  toLocationFix,
} from './helper'

// GeolocationPositionError isn't constructible in jsdom, and the code constants are
// read off the error instance itself — so the stub carries them alongside the code.
function positionError(code: number, message = ''): GeolocationPositionError {
  return {
    code,
    message,
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  } as GeolocationPositionError
}

describe('describeGeolocationError', () => {
  it('explains a denied permission with an actionable next step', () => {
    expect(describeGeolocationError(positionError(1))).toContain('Permission denied')
  })

  it('explains an unavailable position', () => {
    expect(describeGeolocationError(positionError(2))).toContain('Position unavailable')
  })

  it('explains a timeout', () => {
    expect(describeGeolocationError(positionError(3))).toContain('Timed out')
  })

  it('falls back to the error message for an unknown code', () => {
    expect(describeGeolocationError(positionError(99, 'kaput'))).toBe('kaput')
  })

  it('falls back to a generic message when an unknown code carries no message', () => {
    expect(describeGeolocationError(positionError(99))).toBe('Could not get your location.')
  })
})

describe('toLocationFix', () => {
  it('flattens a GeolocationPosition into the fields the page renders', () => {
    const position = {
      coords: { latitude: 12.9716, longitude: 77.5946, accuracy: 18, heading: 90, speed: 1.4 },
      timestamp: 1_700_000_000_000,
    } as GeolocationPosition

    expect(toLocationFix(position)).toEqual({
      latitude: 12.9716,
      longitude: 77.5946,
      accuracy: 18,
      timestamp: 1_700_000_000_000,
      heading: 90,
      speed: 1.4,
    })
  })

  it('carries through the nulls a stationary or wifi-positioned fix reports', () => {
    const position = {
      coords: { latitude: 1, longitude: 2, accuracy: 30, heading: null, speed: null },
      timestamp: 1,
    } as GeolocationPosition

    expect(toLocationFix(position)).toMatchObject({ heading: null, speed: null })
  })
})

describe('formatHeading', () => {
  it('renders an em dash when the device reports no heading', () => {
    expect(formatHeading(null)).toBe('—')
  })

  it('renders an em dash for NaN, which some browsers report while stationary', () => {
    expect(formatHeading(Number.NaN)).toBe('—')
  })

  it('labels cardinal directions', () => {
    expect(formatHeading(0)).toBe('0° N')
    expect(formatHeading(90)).toBe('90° E')
    expect(formatHeading(180)).toBe('180° S')
    expect(formatHeading(270)).toBe('270° W')
  })

  it('labels intercardinal directions', () => {
    expect(formatHeading(45)).toBe('45° NE')
    expect(formatHeading(225)).toBe('225° SW')
  })

  it('wraps back to north near 360 rather than running off the compass', () => {
    expect(formatHeading(359)).toBe('359° N')
  })
})

describe('formatSpeed', () => {
  it('renders an em dash when the device reports no speed', () => {
    expect(formatSpeed(null)).toBe('—')
  })

  it('renders an em dash for NaN', () => {
    expect(formatSpeed(Number.NaN)).toBe('—')
  })

  it('converts metres per second to km/h', () => {
    expect(formatSpeed(10)).toBe('36.0 km/h')
  })

  it('reports a stationary device as zero rather than blank', () => {
    expect(formatSpeed(0)).toBe('0.0 km/h')
  })
})

describe('formatCoordinate', () => {
  it('pads to six decimal places so the column width stays stable', () => {
    expect(formatCoordinate(12.5)).toBe('12.500000')
  })

  it('truncates beyond six decimal places', () => {
    expect(formatCoordinate(77.59456789)).toBe('77.594568')
  })

  it('keeps the sign for southern/western hemispheres', () => {
    expect(formatCoordinate(-33.8688)).toBe('-33.868800')
  })
})

describe('formatAccuracy', () => {
  it('rounds sub-kilometre accuracy to whole metres', () => {
    expect(formatAccuracy(18.4)).toBe('±18 m')
  })

  it('switches to kilometres at 1000 m', () => {
    expect(formatAccuracy(1000)).toBe('±1.0 km')
  })

  it('reports coarse fixes in kilometres', () => {
    expect(formatAccuracy(2500)).toBe('±2.5 km')
  })
})

describe('describeStatus', () => {
  it('labels an active watch as live', () => {
    expect(describeStatus('watching')).toBe('live — tracking')
  })

  it('reads a fixless watch as still working, not as a failure', () => {
    expect(describeStatus('waiting')).toBe('waiting for a fix')
  })

  it('labels the startup window', () => {
    expect(describeStatus('locating')).toBe('starting…')
  })

  it('labels a real error', () => {
    expect(describeStatus('error')).toBe('error')
  })

  it('labels the pre-probe state', () => {
    expect(describeStatus('idle')).toBe('idle')
  })
})

describe('queryGeolocationPermission', () => {
  const originalPermissions = navigator.permissions

  afterEach(() => {
    Object.defineProperty(navigator, 'permissions', {
      value: originalPermissions,
      configurable: true,
    })
  })

  function stubPermissions(value: unknown) {
    Object.defineProperty(navigator, 'permissions', { value, configurable: true })
  }

  it('reports the state the Permissions API returns', async () => {
    stubPermissions({ query: vi.fn().mockResolvedValue({ state: 'granted' }) })
    await expect(queryGeolocationPermission()).resolves.toBe('granted')
  })

  it("reports 'unknown' when the Permissions API is absent, as on Safari", async () => {
    stubPermissions(undefined)
    await expect(queryGeolocationPermission()).resolves.toBe('unknown')
  })

  it("reports 'unknown' when the query rejects rather than throwing", async () => {
    stubPermissions({ query: vi.fn().mockRejectedValue(new Error('unsupported')) })
    await expect(queryGeolocationPermission()).resolves.toBe('unknown')
  })
})

describe('formatFixedAt', () => {
  it('renders an em dash when there is no fix yet', () => {
    expect(formatFixedAt(null)).toBe('—')
  })

  it('renders a local time string for a timestamp', () => {
    const timestamp = 1_700_000_000_000
    expect(formatFixedAt(timestamp)).toBe(new Date(timestamp).toLocaleTimeString())
  })
})
