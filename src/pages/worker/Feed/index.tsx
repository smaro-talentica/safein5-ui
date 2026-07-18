import { Button } from '@/components/ui/button'
import { formatBytes } from '@/components/feature/VideoRecorder/helper'
import { Film, Trash2 } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { formatRecordedAt } from './helper'
import { useDeleteVideoMutation, useVideosQuery } from './query'

export function Feed() {
  const { data: videos, isPending, isError } = useVideosQuery()
  const deleteVideo = useDeleteVideoMutation()

  const urls = useMemo(() => {
    const map = new Map<string, string>()
    videos?.forEach((video) => map.set(video.id, URL.createObjectURL(video.blob)))
    return map
  }, [videos])

  useEffect(() => {
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [urls])

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-6">
      <h1 className="text-lg font-semibold text-slate-900">Recorded videos</h1>

      {isPending && <p className="text-sm text-slate-500">Loading…</p>}

      {isError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Could not load saved videos.
        </p>
      )}

      {!isPending && !isError && videos.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 py-12 text-center text-slate-400">
          <Film className="size-8" aria-hidden />
          <p className="text-sm">No videos saved yet.</p>
        </div>
      )}

      {!isPending &&
        !isError &&
        videos.map((video) => (
          <div key={video.id} className="space-y-3 rounded-xl border border-slate-200 p-3">
            <div className="overflow-hidden rounded-lg bg-black">
              <video
                src={urls.get(video.id)}
                controls
                className="aspect-9/16 w-full object-contain"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{video.name}</p>
                <p className="text-xs text-slate-500">
                  {formatBytes(video.size)} · {formatRecordedAt(video.createdAt)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete video"
                disabled={deleteVideo.isPending}
                onClick={() => deleteVideo.mutate(video.id)}
              >
                <Trash2 className="size-4 text-red-600" aria-hidden />
              </Button>
            </div>
          </div>
        ))}
    </div>
  )
}
