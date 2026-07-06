import { useCallback, useEffect, useState } from 'react'
import { uploadManager } from '@/utils/upload/uploadManager'
import { validateVideo } from '@/utils/upload/media'
import type { UploadJob, UploadProgress } from '@/utils/upload/types'

function jobToProgress(job: UploadJob): UploadProgress {
  const uploaded = job.parts.reduce(
    (sum, p) => (p.status === 'done' ? sum + (p.end - p.start) : sum),
    0,
  )
  return {
    id: job.id,
    status: job.status,
    uploadedBytes: uploaded,
    totalBytes: job.size,
    percent: job.size ? Math.min(100, Math.round((uploaded / job.size) * 100)) : 0,
    error: job.error,
    videoId: job.videoId,
  }
}

/**
 * React binding for the upload manager. Exposes the live list of upload jobs
 * (progress that persists across navigation and app reopen) and actions to
 * start / control uploads. The heavy lifting stays in the singleton manager so
 * uploads are non-blocking and survive route changes.
 */
export function useUpload() {
  const [uploads, setUploads] = useState<UploadProgress[]>([])

  useEffect(() => {
    let mounted = true

    // Load persisted jobs once (async — reads IndexedDB), then rely on the
    // manager subscription to keep state current.
    const load = async () => {
      const jobs = await uploadManager.getJobs()
      if (mounted) setUploads(jobs.map(jobToProgress))
    }
    void load()

    const unsubscribe = uploadManager.subscribe((p) => {
      setUploads((prev) => {
        const idx = prev.findIndex((u) => u.id === p.id)
        if (p.status === 'canceled') return prev.filter((u) => u.id !== p.id)
        if (idx === -1) return [...prev, p]
        const next = prev.slice()
        next[idx] = p
        return next
      })
    })

    // A background-fetch completion in the SW pings us to reconcile + complete.
    const onSwMessage = (e: MessageEvent) => {
      if (e.data?.type === 'bg-upload-progress') void load()
    }
    navigator.serviceWorker?.addEventListener('message', onSwMessage)

    return () => {
      mounted = false
      unsubscribe()
      navigator.serviceWorker?.removeEventListener('message', onSwMessage)
    }
  }, [])

  /** Validate a video Blob/File and start uploading. Returns an error string or null. */
  const startUpload = useCallback(
    async (source: Blob, filename: string): Promise<string | null> => {
      const validation = await validateVideo(source)
      if (!validation.ok) return validation.error ?? 'Invalid video.'
      await uploadManager.enqueue({
        blob: source,
        filename,
        durationSec: validation.durationSec,
      })
      return null
    },
    [],
  )

  const pause = useCallback((id: string) => uploadManager.pause(id), [])
  const resume = useCallback((id: string) => uploadManager.resume(id), [])
  const cancel = useCallback((id: string) => uploadManager.cancel(id), [])

  return { uploads, startUpload, pause, resume, cancel }
}
