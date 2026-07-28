import { afterEach, describe, expect, it, vi } from 'vitest'
import { notifyTrimJobPending, registerTrimJobTrigger, unregisterTrimJobTrigger } from './helper'

describe('trim job trigger registration', () => {
  afterEach(() => {
    unregisterTrimJobTrigger()
  })

  it('calls the registered callback when notified', () => {
    const cb = vi.fn()
    registerTrimJobTrigger(cb)

    notifyTrimJobPending()

    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('is a no-op when nothing is registered', () => {
    expect(() => notifyTrimJobPending()).not.toThrow()
  })

  it('stops calling the callback after it is unregistered', () => {
    const cb = vi.fn()
    registerTrimJobTrigger(cb)
    unregisterTrimJobTrigger()

    notifyTrimJobPending()

    expect(cb).not.toHaveBeenCalled()
  })

  it('only keeps the most recently registered callback', () => {
    const first = vi.fn()
    const second = vi.fn()
    registerTrimJobTrigger(first)
    registerTrimJobTrigger(second)

    notifyTrimJobPending()

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })
})
