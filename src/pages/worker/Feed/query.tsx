import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteVideoFromIndexedDb, listVideosFromIndexedDb } from '@/pages/worker/Capture/action'
import { sortNewestFirst } from './helper'

export const videosQueryKeys = {
  all: ['videos'] as const,
}

export function useVideosQuery() {
  return useQuery({
    queryKey: videosQueryKeys.all,
    queryFn: async () => sortNewestFirst(await listVideosFromIndexedDb()),
  })
}

export function useDeleteVideoMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteVideoFromIndexedDb(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: videosQueryKeys.all }),
  })
}
