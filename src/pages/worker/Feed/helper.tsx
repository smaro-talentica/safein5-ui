import type { StoredVideo } from '@/pages/worker/Capture/model'

export function sortNewestFirst(videos: StoredVideo[]): StoredVideo[] {
  return [...videos].sort((a, b) => b.createdAt - a.createdAt)
}

export function formatRecordedAt(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
