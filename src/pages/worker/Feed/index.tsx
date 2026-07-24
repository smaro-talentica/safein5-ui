import { Button } from '@/components/ui/button'
import { formatBytes } from '@/components/feature/VideoRecorder/helper'
import { Film, Trash2, X } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import type { StoredVideo } from '@/pages/worker/Capture/model'
import { formatRecordedAt, formatUploadStatus } from './helper'
import {
  useCancelUploadMutation,
  useDeleteVideoMutation,
  useUploadSessionQuery,
  useVideosQuery,
} from './query'

function VideoCard({ video, url }: { video: StoredVideo; url: string }) {
  const deleteVideo = useDeleteVideoMutation()
  const cancelUpload = useCancelUploadMutation()
  const { data: uploadSession } = useUploadSessionQuery(video.id)
  const uploadStatus = formatUploadStatus(uploadSession)
  const isUploadInProgress =
    uploadSession?.status === 'pending' || uploadSession?.status === 'uploading'

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 p-3">
      <div className="overflow-hidden rounded-lg bg-black">
        <video src={url} controls className="aspect-9/16 w-full object-contain" />
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">{video.name}</p>
          <p className="text-xs text-slate-500">
            {formatBytes(video.size)} · {formatRecordedAt(video.createdAt)}
          </p>
          {uploadStatus && (
            <p
              className={
                uploadSession?.status === 'error'
                  ? 'text-xs text-red-600'
                  : 'text-xs text-slate-500'
              }
            >
              {uploadStatus}
            </p>
          )}
        </div>
        {isUploadInProgress ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Cancel upload"
            disabled={cancelUpload.isPending}
            onClick={() => cancelUpload.mutate(video.id)}
          >
            <X className="size-4 text-red-600" aria-hidden />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete video"
            disabled={deleteVideo.isPending}
            onClick={() => deleteVideo.mutate(video.id)}
          >
            <Trash2 className="size-4 text-red-600" aria-hidden />
          </Button>
        )}
      </div>
    </div>
  )
}

export function Feed() {
  const { data: videos, isPending, isError } = useVideosQuery()

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
          <VideoCard key={video.id} video={video} url={urls.get(video.id) ?? ''} />
        ))}
    </div>
  )
}
