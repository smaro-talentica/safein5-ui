import { describe, expect, it } from 'vitest'
import { formatBuildTime } from './helper'

describe('formatBuildTime', () => {
  it('formats a valid ISO timestamp to minute precision', () => {
    const result = formatBuildTime('2026-08-19T14:35:09.123Z')
    // Locale/timezone-dependent, so assert on shape rather than an exact string:
    // the year must survive and the discarded seconds must not appear.
    expect(result).toContain('2026')
    expect(result).not.toContain('09')
    expect(result).not.toMatch(/\.\d{3}/)
  })

  it('returns the input unchanged when it is not a parseable date', () => {
    expect(formatBuildTime('unknown')).toBe('unknown')
    expect(formatBuildTime('')).toBe('')
  })
})
