import type { CancelUpload, UploadTrigger } from './model'

let trigger: UploadTrigger | null = null
let cancel: CancelUpload | null = null

export function registerUploadTrigger(cb: UploadTrigger): void {
  trigger = cb
}

export function unregisterUploadTrigger(): void {
  trigger = null
}

export function notifyUploadPending(): void {
  trigger?.()
}

export function registerCancelUpload(cb: CancelUpload): void {
  cancel = cb
}

export function unregisterCancelUpload(): void {
  cancel = null
}

export function cancelUpload(videoId: string): void {
  cancel?.(videoId)
}
