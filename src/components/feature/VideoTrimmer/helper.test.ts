import { afterEach, describe, expect, it } from 'vitest'
import {
  clampTrimRange,
  dragValueFromRatio,
  dragWindowFromRatio,
  formatClock,
  frameTimestamps,
  pickTrimMimeType,
} from './helper'
import { MAX_TRIM_SECONDS, PREFERRED_TRIM_MIME_TYPES } from './constant'

describe('clampTrimRange', () => {
  it('keeps a valid range unchanged', () => {
    expect(clampTrimRange({ start: 5, end: 30 }, 100)).toEqual({ start: 5, end: 30 })
  })

  it('clamps a negative start to zero', () => {
    expect(clampTrimRange({ start: -10, end: 20 }, 100)).toEqual({ start: 0, end: 20 })
  })

  it('clamps start and end to the source duration', () => {
    expect(clampTrimRange({ start: 90, end: 150 }, 100)).toEqual({ start: 90, end: 100 })
  })

  it('pushes end forward so the range is at least 1 second wide', () => {
    expect(clampTrimRange({ start: 10, end: 10 }, 100)).toEqual({ start: 10, end: 11 })
  })

  it('caps the range width at MAX_TRIM_SECONDS', () => {
    expect(clampTrimRange({ start: 0, end: 500 }, 500)).toEqual({
      start: 0,
      end: MAX_TRIM_SECONDS,
    })
  })

  it('caps width relative to a non-zero start', () => {
    expect(clampTrimRange({ start: 20, end: 200 }, 300)).toEqual({
      start: 20,
      end: 20 + MAX_TRIM_SECONDS,
    })
  })
})

describe('formatClock', () => {
  it('formats whole minutes and seconds', () => {
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(65)).toBe('1:05')
    expect(formatClock(600)).toBe('10:00')
  })

  it('rounds fractional seconds', () => {
    expect(formatClock(59.6)).toBe('1:00')
  })

  it('clamps negative values to zero', () => {
    expect(formatClock(-5)).toBe('0:00')
  })
})

describe('frameTimestamps', () => {
  it('returns an empty array for a zero or negative duration', () => {
    expect(frameTimestamps(0, 10)).toEqual([])
    expect(frameTimestamps(-5, 10)).toEqual([])
  })

  it('returns an empty array for a zero or negative count', () => {
    expect(frameTimestamps(100, 0)).toEqual([])
    expect(frameTimestamps(100, -1)).toEqual([])
  })

  it('returns a single timestamp at zero when count is 1', () => {
    expect(frameTimestamps(100, 1)).toEqual([0])
  })

  it('spreads timestamps evenly across the duration', () => {
    expect(frameTimestamps(100, 5)).toEqual([0, 20, 40, 60, 80])
  })

  it('never exceeds the duration', () => {
    const timestamps = frameTimestamps(10, 3)
    expect(timestamps.every((t) => t <= 10)).toBe(true)
  })
})

describe('dragValueFromRatio', () => {
  it('moves the start handle to the dragged position', () => {
    expect(dragValueFromRatio(0.2, 'start', { start: 0, end: 50 }, 100)).toEqual({
      start: 20,
      end: 50,
    })
  })

  it('moves the end handle to the dragged position', () => {
    expect(dragValueFromRatio(0.4, 'end', { start: 0, end: 20 }, 100)).toEqual({
      start: 0,
      end: 40,
    })
  })

  it('clamps the ratio to [0, 1] before converting to seconds', () => {
    expect(dragValueFromRatio(-0.5, 'start', { start: 20, end: 50 }, 100)).toEqual({
      start: 0,
      end: 50,
    })
    expect(dragValueFromRatio(1.5, 'end', { start: 20, end: 50 }, 100)).toEqual({
      start: 20,
      end: 80,
    })
  })

  it('keeps the anchor handle fixed while dragging the other', () => {
    const result = dragValueFromRatio(0.5, 'start', { start: 10, end: 60 }, 100)
    expect(result.end).toBe(60)
  })

  it('does not let the start handle cross past the end handle', () => {
    const result = dragValueFromRatio(0.9, 'start', { start: 10, end: 50 }, 100)
    expect(result.start).toBeLessThan(result.end)
  })

  it('does not let the end handle cross past the start handle', () => {
    const result = dragValueFromRatio(0.05, 'end', { start: 50, end: 80 }, 100)
    expect(result.end).toBeGreaterThan(result.start)
  })
})

describe('dragWindowFromRatio', () => {
  it('shifts the whole window by the pointer delta, preserving width', () => {
    const anchor = { range: { start: 10, end: 30 }, ratio: 0.1 }
    const result = dragWindowFromRatio(0.3, anchor, 100)
    expect(result).toEqual({ start: 30, end: 50 })
  })

  it('does not change width when dragging', () => {
    const anchor = { range: { start: 10, end: 40 }, ratio: 0.2 }
    const result = dragWindowFromRatio(0.5, anchor, 100)
    expect(result.end - result.start).toBe(30)
  })

  it('clamps the window to stay within [0, duration] at the start edge', () => {
    const anchor = { range: { start: 10, end: 30 }, ratio: 0.2 }
    const result = dragWindowFromRatio(-1, anchor, 100)
    expect(result).toEqual({ start: 0, end: 20 })
  })

  it('clamps the window to stay within [0, duration] at the end edge', () => {
    const anchor = { range: { start: 60, end: 80 }, ratio: 0.7 }
    const result = dragWindowFromRatio(2, anchor, 100)
    expect(result).toEqual({ start: 80, end: 100 })
  })

  it('clamps the pointer ratio to [0, 1] before computing the delta', () => {
    const anchor = { range: { start: 40, end: 60 }, ratio: 0.5 }
    const atZero = dragWindowFromRatio(-5, anchor, 100)
    const atNegativeOne = dragWindowFromRatio(-1, anchor, 100)
    expect(atZero).toEqual(atNegativeOne)
  })
})

describe('pickTrimMimeType', () => {
  const original = globalThis.MediaRecorder

  afterEach(() => {
    globalThis.MediaRecorder = original
  })

  it('returns undefined when MediaRecorder is unavailable', () => {
    globalThis.MediaRecorder = undefined as unknown as typeof MediaRecorder
    expect(pickTrimMimeType()).toBeUndefined()
  })

  it('returns the first supported type in preference order', () => {
    globalThis.MediaRecorder = {
      isTypeSupported: (type: string) => type === PREFERRED_TRIM_MIME_TYPES[1],
    } as unknown as typeof MediaRecorder
    expect(pickTrimMimeType()).toBe(PREFERRED_TRIM_MIME_TYPES[1])
  })

  it('returns undefined when no preferred type is supported', () => {
    globalThis.MediaRecorder = {
      isTypeSupported: () => false,
    } as unknown as typeof MediaRecorder
    expect(pickTrimMimeType()).toBeUndefined()
  })
})
