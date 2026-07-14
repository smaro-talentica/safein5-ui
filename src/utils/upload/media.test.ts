import { afterEach, describe, expect, it, vi } from 'vitest'
import { validateVideo } from './media'

/**
 * `validateVideo` reads duration via a hidden <video> element. jsdom never fires
 * `loadedmetadata`, so we install a fake element that reports a chosen duration
 * (or errors) on the next microtask, exercising validateVideo's branches without
 * a real media pipeline. URL.createObjectURL/revokeObjectURL are also stubbed —
 * jsdom does not implement them.
 */
function stubVideo(behavior: { duration?: number; error?: boolean }): void {
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

  const fakeVideo = {
    preload: '',
    muted: false,
    duration: behavior.duration ?? 0,
    onloadedmetadata: null as (() => void) | null,
    onerror: null as (() => void) | null,
    _src: '',
    set src(_v: string) {
      // Fire the outcome asynchronously, mirroring the real element.
      queueMicrotask(() => {
        if (behavior.error) this.onerror?.()
        else this.onloadedmetadata?.()
      })
    },
    removeAttribute: () => {},
    load: () => {},
  }

  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    if (tag === 'video') return fakeVideo as unknown as HTMLElement
    throw new Error(`unexpected createElement(${tag})`)
  }) as typeof document.createElement)
}

function videoBlob(): Blob {
  return new Blob(['x'], { type: 'video/mp4' })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('validateVideo', () => {
  it('rejects a non-video file before probing duration', async () => {
    const spy = vi.spyOn(document, 'createElement')
    const result = await validateVideo(new Blob(['x'], { type: 'image/png' }))
    expect(result).toEqual({
      ok: false,
      durationSec: 0,
      error: 'Please choose a video file.',
    })
    // Short-circuits: no probe, so no <video> is created.
    expect(spy).not.toHaveBeenCalled()
  })

  it('accepts a video within the max duration', async () => {
    stubVideo({ duration: 10 })
    await expect(validateVideo(videoBlob())).resolves.toEqual({ ok: true, durationSec: 10 })
  })

  it('accepts a video exactly at the 0.5s tolerance boundary', async () => {
    stubVideo({ duration: 30.5 })
    await expect(validateVideo(videoBlob())).resolves.toEqual({ ok: true, durationSec: 30.5 })
  })

  it('rejects a video longer than max + tolerance', async () => {
    stubVideo({ duration: 42 })
    const result = await validateVideo(videoBlob())
    expect(result.ok).toBe(false)
    expect(result.durationSec).toBe(42)
    expect(result.error).toBe('Video must be 30 seconds or less (this one is 42s).')
  })

  it('returns a read error when metadata cannot be read', async () => {
    stubVideo({ error: true })
    await expect(validateVideo(videoBlob())).resolves.toEqual({
      ok: false,
      durationSec: 0,
      error: 'Could not read the video. Try another file.',
    })
  })

  it('rejects a non-finite (Infinity) duration as over the limit', async () => {
    stubVideo({ duration: Number.POSITIVE_INFINITY })
    const result = await validateVideo(videoBlob())
    expect(result.ok).toBe(false)
    expect(result.durationSec).toBe(Number.POSITIVE_INFINITY)
  })
})
