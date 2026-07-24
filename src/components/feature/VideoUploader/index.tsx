import { useEffect, useRef } from 'react'
import { listPendingUploadSessions, listVideosFromIndexedDb } from '@/pages/worker/Capture/action'
import type { StoredVideo } from '@/pages/worker/Capture/model'
import { runUploadSession } from './action'
import {
  registerCancelUpload,
  registerUploadTrigger,
  unregisterCancelUpload,
  unregisterUploadTrigger,
} from './helper'

export function VideoUploader() {
  const inFlight = useRef<Map<string, AbortController>>(new Map())

  useEffect(() => {
    const resumeAll = () => {
      void (async () => {
        const [sessions, videos] = await Promise.all([
          listPendingUploadSessions(),
          listVideosFromIndexedDb(),
        ])
        const videosById = new Map<string, StoredVideo>(videos.map((video) => [video.id, video]))

        for (const session of sessions) {
          if (inFlight.current.has(session.id)) continue
          const video = videosById.get(session.id)
          if (!video) continue

          const controller = new AbortController()
          inFlight.current.set(session.id, controller)
          void runUploadSession(video, session, controller.signal)
            .catch(() => {
              // Error state is already persisted to the session record by runUploadSession.
            })
            .finally(() => {
              inFlight.current.delete(session.id)
            })
        }
      })()
    }

    const cancel = (videoId: string) => {
      inFlight.current.get(videoId)?.abort()
    }

    registerUploadTrigger(resumeAll)
    registerCancelUpload(cancel)
    resumeAll()

    return () => {
      unregisterUploadTrigger()
      unregisterCancelUpload()
    }
  }, [])

  return null
}
