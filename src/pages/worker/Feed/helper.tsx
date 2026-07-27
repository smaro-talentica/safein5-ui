import type { AudioUploadRecord, UploadSession } from '@/pages/worker/Capture/model'

export function sortNewestFirst<T extends { createdAt: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.createdAt - a.createdAt)
}

export function formatRecordedAt(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function formatUploadStatus(session: UploadSession | undefined): string | null {
  if (!session) return null
  const done = session.chunks.filter((chunk) => chunk.status === 'done').length

  switch (session.status) {
    case 'pending':
      return 'Upload queued…'
    case 'uploading':
      return `Uploading… ${done}/${session.chunkCount} chunks`
    case 'error':
      return 'Upload failed'
    case 'completed':
      return null
  }
}

export function formatAudioUploadStatus(record: AudioUploadRecord | undefined): string | null {
  if (!record) return null

  switch (record.status) {
    case 'pending':
      return 'Upload queued…'
    case 'uploading':
      return 'Uploading…'
    case 'error':
      return 'Upload failed'
    case 'completed':
      return null
  }
}
