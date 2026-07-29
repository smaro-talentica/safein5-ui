import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteAudioFromIndexedDb,
  deleteTextEntryFromIndexedDb,
  deleteTrimJob,
  deleteVideoFromIndexedDb,
  getAudioUploadRecord,
  getUploadSession,
  listAudioFromIndexedDb,
  listTextEntriesFromIndexedDb,
  listTrimJobs,
  listVideosFromIndexedDb,
} from '@/pages/worker/Capture/action'
import { cancelUpload } from '@/components/feature/VideoUploader/helper'
import { fetchPlaybackUrl } from '@/components/feature/VideoUploader/action'
import { cancelAudioUpload } from '@/components/feature/AudioUploader/helper'
import { sortNewestFirst } from './helper'

export const videosQueryKeys = {
  all: ['videos'] as const,
}

export const uploadSessionQueryKeys = {
  byVideoId: (videoId: string) => ['upload-session', videoId] as const,
}

export const playbackUrlQueryKeys = {
  byToken: (token: string) => ['playback-url', token] as const,
}

export const audioClipsQueryKeys = {
  all: ['audio-clips'] as const,
}

export const audioUploadRecordQueryKeys = {
  byAudioId: (audioId: string) => ['audio-upload-record', audioId] as const,
}

export const textEntriesQueryKeys = {
  all: ['text-entries'] as const,
}

export const trimJobsQueryKeys = {
  all: ['trim-jobs'] as const,
}

export function useVideosQuery() {
  return useQuery({
    queryKey: videosQueryKeys.all,
    queryFn: async () => sortNewestFirst(await listVideosFromIndexedDb()),
  })
}

export function useUploadSessionQuery(videoId: string) {
  return useQuery({
    queryKey: uploadSessionQueryKeys.byVideoId(videoId),
    queryFn: () => getUploadSession(videoId),
    refetchInterval: (query) => (query.state.data?.status === 'uploading' ? 1500 : false),
  })
}

/**
 * Polls `GET /uploads/:token/playback` for a completed upload until the backend has produced the
 * streamable rendition. The endpoint 404s (fetch returns null) while it's still transcoding, so we
 * keep polling every 3s and stop once a URL comes back. `token` is the upload's sessionId.
 */
export function usePlaybackUrlQuery(token: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: playbackUrlQueryKeys.byToken(token ?? ''),
    queryFn: () => fetchPlaybackUrl(token as string),
    enabled: enabled && Boolean(token),
    refetchInterval: (query) => (query.state.data?.url ? false : 3000),
  })
}

export function useDeleteVideoMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteVideoFromIndexedDb(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: videosQueryKeys.all }),
  })
}

// Abort is async, so poll briefly for the session record to actually disappear before invalidating.
export function useCancelUploadMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (videoId: string) => {
      cancelUpload(videoId)
      for (let attempt = 0; attempt < 20; attempt++) {
        const session = await getUploadSession(videoId)
        if (!session) break
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
    },
    onSuccess: (_data, videoId) => {
      queryClient.invalidateQueries({ queryKey: videosQueryKeys.all })
      queryClient.invalidateQueries({ queryKey: uploadSessionQueryKeys.byVideoId(videoId) })
    },
  })
}

export function useAudioClipsQuery() {
  return useQuery({
    queryKey: audioClipsQueryKeys.all,
    queryFn: async () => sortNewestFirst(await listAudioFromIndexedDb()),
  })
}

export function useAudioUploadRecordQuery(audioId: string) {
  return useQuery({
    queryKey: audioUploadRecordQueryKeys.byAudioId(audioId),
    queryFn: () => getAudioUploadRecord(audioId),
    refetchInterval: (query) => (query.state.data?.status === 'uploading' ? 1500 : false),
  })
}

export function useDeleteAudioMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteAudioFromIndexedDb(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: audioClipsQueryKeys.all }),
  })
}

// Abort is async, so poll briefly for the record to actually disappear before invalidating.
export function useCancelAudioUploadMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (audioId: string) => {
      cancelAudioUpload(audioId)
      for (let attempt = 0; attempt < 20; attempt++) {
        const record = await getAudioUploadRecord(audioId)
        if (!record) break
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
    },
    onSuccess: (_data, audioId) => {
      queryClient.invalidateQueries({ queryKey: audioClipsQueryKeys.all })
      queryClient.invalidateQueries({ queryKey: audioUploadRecordQueryKeys.byAudioId(audioId) })
    },
  })
}

export function useTextEntriesQuery() {
  return useQuery({
    queryKey: textEntriesQueryKeys.all,
    queryFn: async () => sortNewestFirst(await listTextEntriesFromIndexedDb()),
  })
}

export function useDeleteTextEntryMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteTextEntryFromIndexedDb(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: textEntriesQueryKeys.all }),
  })
}

/**
 * Polls while any job is still `processing`: TrimRunner queues a video for background trimming
 * and then, on success, saves it as a real StoredVideo + upload session and removes the job — so
 * a job disappearing from this list (with the video now showing up in useVideosQuery) is the
 * normal, expected transition from "Processing…" to the regular upload-status flow.
 */
export function useTrimJobsQuery() {
  return useQuery({
    queryKey: trimJobsQueryKeys.all,
    queryFn: async () => sortNewestFirst(await listTrimJobs()),
    refetchInterval: (query) =>
      query.state.data?.some((job) => job.status === 'processing') ? 1500 : false,
  })
}

export function useDeleteTrimJobMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteTrimJob(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: trimJobsQueryKeys.all }),
  })
}
