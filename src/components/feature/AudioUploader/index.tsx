import { useEffect, useRef } from 'react'
import {
  listAudioFromIndexedDb,
  listPendingAudioUploadRecords,
} from '@/pages/worker/Capture/action'
import type { StoredAudio } from '@/pages/worker/Capture/model'
import { runAudioUpload } from './action'
import {
  registerCancelAudioUpload,
  registerAudioUploadTrigger,
  unregisterCancelAudioUpload,
  unregisterAudioUploadTrigger,
} from './helper'

export function AudioUploader() {
  const inFlight = useRef<Map<string, AbortController>>(new Map())

  useEffect(() => {
    const resumeAll = () => {
      void (async () => {
        const [records, clips] = await Promise.all([
          listPendingAudioUploadRecords(),
          listAudioFromIndexedDb(),
        ])
        const clipsById = new Map<string, StoredAudio>(clips.map((clip) => [clip.id, clip]))

        for (const record of records) {
          if (inFlight.current.has(record.id)) continue
          const clip = clipsById.get(record.id)
          if (!clip) continue

          const controller = new AbortController()
          inFlight.current.set(record.id, controller)
          void runAudioUpload(clip, record, controller.signal)
            .catch(() => {
              // Error state is already persisted to the record by runAudioUpload.
            })
            .finally(() => {
              inFlight.current.delete(record.id)
            })
        }
      })()
    }

    const cancel = (audioId: string) => {
      inFlight.current.get(audioId)?.abort()
    }

    registerAudioUploadTrigger(resumeAll)
    registerCancelAudioUpload(cancel)
    resumeAll()

    return () => {
      unregisterAudioUploadTrigger()
      unregisterCancelAudioUpload()
    }
  }, [])

  return null
}
