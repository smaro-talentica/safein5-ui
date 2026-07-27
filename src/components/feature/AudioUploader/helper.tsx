import type { CancelAudioUpload, AudioUploadTrigger } from './model'

let trigger: AudioUploadTrigger | null = null
let cancel: CancelAudioUpload | null = null

export function registerAudioUploadTrigger(cb: AudioUploadTrigger): void {
  trigger = cb
}

export function unregisterAudioUploadTrigger(): void {
  trigger = null
}

export function notifyAudioUploadPending(): void {
  trigger?.()
}

export function registerCancelAudioUpload(cb: CancelAudioUpload): void {
  cancel = cb
}

export function unregisterCancelAudioUpload(): void {
  cancel = null
}

export function cancelAudioUpload(audioId: string): void {
  cancel?.(audioId)
}
