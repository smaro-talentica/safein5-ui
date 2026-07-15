import { afterEach, describe, expect, it } from 'vitest'
import { formatBytes, pickMimeType } from './helper'
import { PREFERRED_MIME_TYPES } from './constant'

describe('formatBytes', () => {
  it('reports raw bytes below 1 KB', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1023)).toBe('1023 B')
  })

  it('crosses into KB at exactly 1024', () => {
    expect(formatBytes(1024)).toBe('1.0 KB')
  })

  it('rounds to one decimal place', () => {
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(2048)).toBe('2.0 KB')
  })

  it('scales up through MB and GB', () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
    expect(formatBytes(1.5 * 1024 * 1024 * 1024)).toBe('1.5 GB')
  })

  it('clamps at GB and does not roll past the largest unit', () => {
    expect(formatBytes(1024 ** 4)).toBe('1024.0 GB')
    expect(formatBytes(5 * 1024 ** 4)).toBe('5120.0 GB')
  })
})

describe('pickMimeType', () => {
  const original = globalThis.MediaRecorder

  afterEach(() => {
    globalThis.MediaRecorder = original
  })

  it('returns undefined when MediaRecorder is unavailable', () => {
    globalThis.MediaRecorder = undefined as unknown as typeof MediaRecorder
    expect(pickMimeType()).toBeUndefined()
  })

  it('returns undefined when isTypeSupported is missing', () => {
    globalThis.MediaRecorder = {} as unknown as typeof MediaRecorder
    expect(pickMimeType()).toBeUndefined()
  })

  it('returns the first supported type in preference order', () => {
    globalThis.MediaRecorder = {
      isTypeSupported: (type: string) => type === 'video/mp4',
    } as unknown as typeof MediaRecorder
    expect(pickMimeType()).toBe('video/mp4')
  })

  it('prefers vp9 when several types are supported', () => {
    globalThis.MediaRecorder = {
      isTypeSupported: () => true,
    } as unknown as typeof MediaRecorder
    expect(pickMimeType()).toBe(PREFERRED_MIME_TYPES[0])
  })

  it('returns undefined when no preferred type is supported', () => {
    globalThis.MediaRecorder = {
      isTypeSupported: () => false,
    } as unknown as typeof MediaRecorder
    expect(pickMimeType()).toBeUndefined()
  })
})
