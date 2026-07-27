import { Button } from '@/components/ui/button'
import { formatBytes } from '@/components/feature/VideoRecorder/helper'
import { FileText, Inbox, Trash2, X } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import type { StoredAudio, StoredTextEntry, StoredVideo } from '@/pages/worker/Capture/model'
import { formatAudioUploadStatus, formatRecordedAt, formatUploadStatus } from './helper'
import {
  useAudioClipsQuery,
  useAudioUploadRecordQuery,
  useCancelAudioUploadMutation,
  useCancelUploadMutation,
  useDeleteAudioMutation,
  useDeleteTextEntryMutation,
  useDeleteVideoMutation,
  useTextEntriesQuery,
  useUploadSessionQuery,
  useVideosQuery,
} from './query'

type FeedItem =
  | { kind: 'video'; item: StoredVideo }
  | { kind: 'audio'; item: StoredAudio }
  | { kind: 'text'; item: StoredTextEntry }

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

function AudioCard({ audio, url }: { audio: StoredAudio; url: string }) {
  const deleteAudio = useDeleteAudioMutation()
  const cancelUpload = useCancelAudioUploadMutation()
  const { data: uploadRecord } = useAudioUploadRecordQuery(audio.id)
  const uploadStatus = formatAudioUploadStatus(uploadRecord)
  const isUploadInProgress =
    uploadRecord?.status === 'pending' || uploadRecord?.status === 'uploading'

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 p-3">
      <audio src={url} controls className="w-full" />
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">{audio.name}</p>
          <p className="text-xs text-slate-500">
            {formatBytes(audio.size)} · {formatRecordedAt(audio.createdAt)}
          </p>
          {uploadStatus && (
            <p
              className={
                uploadRecord?.status === 'error' ? 'text-xs text-red-600' : 'text-xs text-slate-500'
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
            onClick={() => cancelUpload.mutate(audio.id)}
          >
            <X className="size-4 text-red-600" aria-hidden />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete recording"
            disabled={deleteAudio.isPending}
            onClick={() => deleteAudio.mutate(audio.id)}
          >
            <Trash2 className="size-4 text-red-600" aria-hidden />
          </Button>
        )}
      </div>
    </div>
  )
}

function TextCard({ entry }: { entry: StoredTextEntry }) {
  const deleteTextEntry = useDeleteTextEntryMutation()

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <FileText className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
          <div className="min-w-0">
            <p className="whitespace-pre-wrap text-sm text-slate-900">{entry.text}</p>
            <p className="mt-1 text-xs text-slate-500">
              {entry.source === 'transcribed' ? 'Transcribed' : 'Written'} ·{' '}
              {formatRecordedAt(entry.createdAt)}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Delete text entry"
          disabled={deleteTextEntry.isPending}
          onClick={() => deleteTextEntry.mutate(entry.id)}
        >
          <Trash2 className="size-4 text-red-600" aria-hidden />
        </Button>
      </div>
    </div>
  )
}

export function Feed() {
  const { data: videos, isPending: videosPending, isError: videosError } = useVideosQuery()
  const { data: clips, isPending: clipsPending, isError: clipsError } = useAudioClipsQuery()
  const {
    data: textEntries,
    isPending: textEntriesPending,
    isError: textEntriesError,
  } = useTextEntriesQuery()

  const videoUrls = useMemo(() => {
    const map = new Map<string, string>()
    videos?.forEach((video) => map.set(video.id, URL.createObjectURL(video.blob)))
    return map
  }, [videos])

  const audioUrls = useMemo(() => {
    const map = new Map<string, string>()
    clips?.forEach((clip) => map.set(clip.id, URL.createObjectURL(clip.blob)))
    return map
  }, [clips])

  useEffect(() => {
    return () => {
      videoUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [videoUrls])

  useEffect(() => {
    return () => {
      audioUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [audioUrls])

  const isPending = videosPending || clipsPending || textEntriesPending
  const isError = videosError || clipsError || textEntriesError

  const items = useMemo<FeedItem[]>(() => {
    if (isPending || isError) return []
    const all: FeedItem[] = [
      ...(videos ?? []).map((item): FeedItem => ({ kind: 'video', item })),
      ...(clips ?? []).map((item): FeedItem => ({ kind: 'audio', item })),
      ...(textEntries ?? []).map((item): FeedItem => ({ kind: 'text', item })),
    ]
    return all.sort((a, b) => b.item.createdAt - a.item.createdAt)
  }, [videos, clips, textEntries, isPending, isError])

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-6">
      <h1 className="text-lg font-semibold text-slate-900">Feed</h1>

      {isPending && <p className="text-sm text-slate-500">Loading…</p>}

      {isError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Could not load saved items.
        </p>
      )}

      {!isPending && !isError && items.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 py-12 text-center text-slate-400">
          <Inbox className="size-8" aria-hidden />
          <p className="text-sm">Nothing saved yet.</p>
        </div>
      )}

      {!isPending &&
        !isError &&
        items.map((entry) => {
          if (entry.kind === 'video') {
            return (
              <VideoCard
                key={entry.item.id}
                video={entry.item}
                url={videoUrls.get(entry.item.id) ?? ''}
              />
            )
          }
          if (entry.kind === 'audio') {
            return (
              <AudioCard
                key={entry.item.id}
                audio={entry.item}
                url={audioUrls.get(entry.item.id) ?? ''}
              />
            )
          }
          return <TextCard key={entry.item.id} entry={entry.item} />
        })}
    </div>
  )
}
