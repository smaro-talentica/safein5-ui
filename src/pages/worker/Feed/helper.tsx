import type { StoredVideo, UploadSession } from '@/pages/worker/Capture/model'

export function sortNewestFirst(videos: StoredVideo[]): StoredVideo[] {
  return [...videos].sort((a, b) => b.createdAt - a.createdAt)
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
