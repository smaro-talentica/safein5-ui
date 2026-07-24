import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cancelUpload,
  notifyUploadPending,
  registerCancelUpload,
  registerUploadTrigger,
  unregisterCancelUpload,
  unregisterUploadTrigger,
} from './helper'

describe('upload trigger registration', () => {
  afterEach(() => {
    unregisterUploadTrigger()
  })

  it('calls the registered callback when notified', () => {
    const cb = vi.fn()
    registerUploadTrigger(cb)

    notifyUploadPending()

    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('is a no-op when nothing is registered', () => {
    expect(() => notifyUploadPending()).not.toThrow()
  })

  it('stops calling the callback after it is unregistered', () => {
    const cb = vi.fn()
    registerUploadTrigger(cb)
    unregisterUploadTrigger()

    notifyUploadPending()

    expect(cb).not.toHaveBeenCalled()
  })

  it('only keeps the most recently registered callback', () => {
    const first = vi.fn()
    const second = vi.fn()
    registerUploadTrigger(first)
    registerUploadTrigger(second)

    notifyUploadPending()

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })
})

describe('cancel upload registration', () => {
  afterEach(() => {
    unregisterCancelUpload()
  })

  it('calls the registered callback with the video id', () => {
    const cb = vi.fn()
    registerCancelUpload(cb)

    cancelUpload('video-1')

    expect(cb).toHaveBeenCalledWith('video-1')
  })

  it('is a no-op when nothing is registered', () => {
    expect(() => cancelUpload('video-1')).not.toThrow()
  })

  it('stops calling the callback after it is unregistered', () => {
    const cb = vi.fn()
    registerCancelUpload(cb)
    unregisterCancelUpload()

    cancelUpload('video-1')

    expect(cb).not.toHaveBeenCalled()
  })
})
