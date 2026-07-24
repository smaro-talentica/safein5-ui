import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isPromptDismissed, setPromptDismissed } from './helper'

describe('install prompt dismissal', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('is not dismissed by default', () => {
    expect(isPromptDismissed()).toBe(false)
  })

  it('persists dismissal across reads', () => {
    setPromptDismissed()
    expect(isPromptDismissed()).toBe(true)
  })

  it('does not throw when localStorage is unavailable', () => {
    const original = globalThis.localStorage
    // @ts-expect-error simulating an unavailable localStorage (e.g. private mode)
    delete globalThis.localStorage
    try {
      expect(() => setPromptDismissed()).not.toThrow()
      expect(isPromptDismissed()).toBe(false)
    } finally {
      globalThis.localStorage = original
    }
  })
})
