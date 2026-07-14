import type { UploadJobStatus } from '@/utils/upload/types'

function statusLabel(status: UploadJobStatus): string {
  switch (status) {
    case 'queued':
      return 'Queued…'
    case 'uploading':
      return 'Uploading…'
    case 'completing':
      return 'Finishing…'
    case 'completed':
      return 'Complete'
    case 'paused':
      return navigatorOnline() ? 'Paused' : 'Waiting for network…'
    case 'error':
      return 'Failed'
    case 'canceled':
      return 'Canceled'
  }
}

function navigatorOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

const dashedBorder = (color: string) =>
  `url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' rx='16' ry='16' stroke='${encodeURIComponent(
    color,
  )}' stroke-width='3' stroke-dasharray='6%2c 6' stroke-linecap='square'/%3e%3c/svg%3e")`

export { statusLabel, navigatorOnline, dashedBorder }
