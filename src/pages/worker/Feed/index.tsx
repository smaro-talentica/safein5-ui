import { Button } from '@/components/ui/button'
import { formatBytes } from '@/components/feature/VideoRecorder/helper'
import { useQueryClient } from '@tanstack/react-query'
import { FileText, Inbox, Trash2, Video, X } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import type {
  StoredAudio,
  StoredTextEntry,
  StoredVideo,
  TrimJob,
} from '@/pages/worker/Capture/model'
import { formatAudioUploadStatus, formatRecordedAt, formatUploadStatus } from './helper'
import {
  useAudioClipsQuery,
  useAudioUploadRecordQuery,
  useCancelAudioUploadMutation,
  useCancelUploadMutation,
  useDeleteAudioMutation,
  useDeleteTextEntryMutation,
  useDeleteTrimJobMutation,
  useDeleteVideoMutation,
  usePlaybackUrlQuery,
  useTextEntriesQuery,
  useTrimJobsQuery,
  useUploadSessionQuery,
  useVideosQuery,
  videosQueryKeys,
} from './query'

type FeedItem =
  | { kind: 'video'; item: StoredVideo }
  | { kind: 'audio'; item: StoredAudio }
  | { kind: 'text'; item: StoredTextEntry }
  | { kind: 'trim-job'; item: TrimJob }

function VideoCard({ video, url }: { video: StoredVideo; url: string }) {
  const deleteVideo = useDeleteVideoMutation()
  const cancelUpload = useCancelUploadMutation()
  const { data: uploadSession } = useUploadSessionQuery(video.id)
  const uploadStatus = formatUploadStatus(uploadSession)
  const isUploadInProgress =
    uploadSession?.status === 'pending' || uploadSession?.status === 'uploading'
  const isUploaded = uploadSession?.status === 'completed' && Boolean(uploadSession.sessionId)

  // Once uploaded, poll for the backend's streamable (H.264/+faststart) rendition and play it —
  // falling back to the local blob as an instant preview until the transcode is ready.
  const { data: playback } = usePlaybackUrlQuery(uploadSession?.sessionId, isUploaded)
  const streamableUrl = playback?.url
  const videoSrc = streamableUrl ?? url

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 p-3">
      <div className="overflow-hidden rounded-lg bg-black">
        <video src={videoSrc} controls className="aspect-9/16 w-full object-contain" />
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
          {isUploaded && (
            <p className={streamableUrl ? 'text-xs text-emerald-600' : 'text-xs text-slate-500'}>
              {streamableUrl ? 'Streamable ✓ (playing server version)' : 'Preparing streamable video…'}
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

/**
 * Shown while TrimRunner is working through a queued trim in the background. Once it succeeds,
 * this job is deleted and the video appears as a normal VideoCard (via useVideosQuery) instead —
 * so this card disappearing while the video shows up is the expected, successful transition.
 */
function TrimJobCard({ job }: { job: TrimJob }) {
  const deleteTrimJob = useDeleteTrimJobMutation()

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Video className="size-4 shrink-0 text-slate-400" aria-hidden />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900">{job.name}</p>
            <p
              className={job.status === 'error' ? 'text-xs text-red-600' : 'text-xs text-slate-500'}
            >
              {job.status === 'error' ? (job.error ?? 'Trimming failed') : 'Processing…'}
            </p>
          </div>
        </div>
        {job.status === 'error' && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Dismiss failed trim"
            disabled={deleteTrimJob.isPending}
            onClick={() => deleteTrimJob.mutate(job.id)}
          >
            <Trash2 className="size-4 text-red-600" aria-hidden />
          </Button>
        )}
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
  const { data: trimJobs, isPending: trimJobsPending, isError: trimJobsError } = useTrimJobsQuery()

  // useVideosQuery has no polling of its own — TrimRunner writes the trimmed video straight to
  // IndexedDB in the background, bypassing TanStack Query entirely, so nothing tells that query
  // to refetch on its own. Watch for a previously-seen "processing" trim job disappearing (the
  // signal that TrimRunner just finished it) and invalidate the videos query at that point, so
  // the new video actually appears instead of the job simply vanishing with nothing to show for it.
  const seenProcessingJobIds = useRef<Set<string>>(new Set())
  const queryClient = useQueryClient()
  useEffect(() => {
    if (!trimJobs) return
    const currentIds = new Set(
      trimJobs.filter((job) => job.status === 'processing').map((job) => job.id),
    )
    const completed = [...seenProcessingJobIds.current].some((id) => !currentIds.has(id))
    if (completed) {
      void queryClient.invalidateQueries({ queryKey: videosQueryKeys.all })
    }
    seenProcessingJobIds.current = currentIds
  }, [trimJobs, queryClient])

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

  const isPending = videosPending || clipsPending || textEntriesPending || trimJobsPending
  const isError = videosError || clipsError || textEntriesError || trimJobsError

  const items = useMemo<FeedItem[]>(() => {
    if (isPending || isError) return []
    const all: FeedItem[] = [
      ...(videos ?? []).map((item): FeedItem => ({ kind: 'video', item })),
      ...(clips ?? []).map((item): FeedItem => ({ kind: 'audio', item })),
      ...(textEntries ?? []).map((item): FeedItem => ({ kind: 'text', item })),
      ...(trimJobs ?? []).map((item): FeedItem => ({ kind: 'trim-job', item })),
    ]
    return all.sort((a, b) => b.item.createdAt - a.item.createdAt)
  }, [videos, clips, textEntries, trimJobs, isPending, isError])

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
          if (entry.kind === 'trim-job') {
            return <TrimJobCard key={entry.item.id} job={entry.item} />
          }
          return <TextCard key={entry.item.id} entry={entry.item} />
        })}
    </div>
  )
}
