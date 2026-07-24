import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteVideoFromIndexedDb,
  getUploadSession,
  listVideosFromIndexedDb,
} from '@/pages/worker/Capture/action'
import { cancelUpload } from '@/components/feature/VideoUploader/helper'
import { sortNewestFirst } from './helper'

export const videosQueryKeys = {
  all: ['videos'] as const,
}

export const uploadSessionQueryKeys = {
  byVideoId: (videoId: string) => ['upload-session', videoId] as const,
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
