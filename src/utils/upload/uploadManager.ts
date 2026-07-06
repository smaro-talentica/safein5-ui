/**
 * Upload manager — the framework-agnostic core that drives resumable video
 * uploads. It is a singleton so that uploads keep running across route changes
 * and can be resumed on app open.
 *
 * Responsibilities:
 *  - Create a job (init multipart upload, chunk the blob), persist it to IndexedDB.
 *  - Upload parts directly to S3 with a concurrency cap and per-part retry.
 *  - Persist each part's ETag as soon as it lands, so a completed part is never
 *    re-uploaded — the basis for "never fails" + resume-after-close.
 *  - Finalize via /uploads/complete (idempotent), then clear the job.
 *  - Auto-resume unfinished jobs found in IndexedDB on startup.
 *  - Emit progress to UI subscribers.
 *
 * Background-across-app-close is layered on top of this by the service worker
 * (Background Fetch on Android/Chrome). Where that is unavailable (iOS), this
 * runs in-page and jobs resume the next time the app is opened.
 */
import { env } from '@/utils/env'
import { buildParts, percentComplete, uploadedBytes } from './chunk'
import * as api from './uploadApi'
import { UploadHttpError } from './uploadApi'
import * as db from './uploadDb'
import { withRetry } from './retry'
import type { UploadJob, UploadProgress } from './types'

type Listener = (progress: UploadProgress) => void

function uid(): string {
  // crypto.randomUUID is available in all target browsers and the SW.
  return crypto.randomUUID()
}

function toProgress(job: UploadJob): UploadProgress {
  return {
    id: job.id,
    status: job.status,
    uploadedBytes: uploadedBytes(job.parts),
    totalBytes: job.size,
    percent: percentComplete(job.parts, job.size),
    error: job.error,
    videoId: job.videoId,
  }
}

class UploadManager {
  /** In-memory abort controllers per running job. */
  private controllers = new Map<string, AbortController>()
  private listeners = new Set<Listener>()
  private started = false

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(job: UploadJob) {
    const p = toProgress(job)
    for (const l of this.listeners) l(p)
  }

  private async save(job: UploadJob) {
    job.updatedAt = Date.now()
    await db.putJob(job)
    this.emit(job)
  }

  async getJobs(): Promise<UploadJob[]> {
    return db.getAllJobs()
  }

  /**
   * Create and start an upload for a validated video blob. Returns the job id
   * immediately-ish (after init); the actual byte transfer is non-blocking.
   */
  async enqueue(input: { blob: Blob; filename: string; durationSec: number }): Promise<string> {
    const id = uid()
    const now = Date.now()
    const partSize = env.uploadPartSize
    const job: UploadJob = {
      id,
      blob: input.blob,
      filename: input.filename,
      mime: input.blob.type || 'video/mp4',
      size: input.blob.size,
      durationSec: input.durationSec,
      partSize,
      parts: buildParts(input.blob.size, partSize),
      status: 'queued',
      createdAt: now,
      updatedAt: now,
    }
    await this.save(job)
    // Fire-and-forget: keep the UI non-blocking.
    void this.run(id)
    return id
  }

  /** Resume all unfinished jobs — call once on app open. */
  async resumeAll(): Promise<void> {
    if (this.started) return
    this.started = true
    const jobs = await db.getResumableJobs()
    for (const job of jobs) void this.run(job.id)
  }

  async pause(id: string): Promise<void> {
    this.controllers.get(id)?.abort()
    this.controllers.delete(id)
    const job = await db.getJob(id)
    if (job && (job.status === 'uploading' || job.status === 'queued')) {
      job.status = 'paused'
      await this.save(job)
    }
  }

  async resume(id: string): Promise<void> {
    const job = await db.getJob(id)
    if (job && job.status !== 'completed' && job.status !== 'canceled') {
      void this.run(id)
    }
  }

  async cancel(id: string): Promise<void> {
    this.controllers.get(id)?.abort()
    this.controllers.delete(id)
    const job = await db.getJob(id)
    if (!job) return
    if (job.uploadId && job.key) {
      // Best-effort server cleanup; ignore failures.
      try {
        await api.abortUpload({ uploadId: job.uploadId, key: job.key })
      } catch {
        /* noop */
      }
    }
    await db.deleteJob(id)
    this.emit({ ...job, status: 'canceled' })
  }

  /** The main state machine for a single job. Safe to call concurrently-guarded. */
  private async run(id: string): Promise<void> {
    if (this.controllers.has(id)) return // already running
    const controller = new AbortController()
    this.controllers.set(id, controller)
    const { signal } = controller

    try {
      let job = await db.getJob(id)
      if (!job || job.status === 'completed' || job.status === 'canceled') return

      // 1. Init multipart upload if not done yet.
      if (!job.uploadId || !job.key) {
        const init = await api.initUpload(
          {
            filename: job.filename,
            size: job.size,
            mime: job.mime,
            partSize: job.partSize,
            durationSec: job.durationSec,
          },
          signal,
        )
        job.uploadId = init.uploadId
        job.key = init.key
        // Server is authoritative on part size — re-chunk if it differs.
        if (init.partSize !== job.partSize) {
          job.partSize = init.partSize
          job.parts = buildParts(job.size, init.partSize)
        }
        for (const p of init.parts) {
          const part = job.parts.find((x) => x.partNumber === p.partNumber)
          if (part) part.url = p.url
        }
        job.status = 'uploading'
        await this.save(job)
      } else {
        job.status = 'uploading'
        await this.save(job)
      }

      // 2. Upload all pending parts with a concurrency cap.
      await this.uploadParts(job, signal)

      // Re-read to get the freshest ETags before completing.
      job = (await db.getJob(id))!
      if (job.status === 'paused' || job.status === 'canceled') return

      const allDone = job.parts.every((p) => p.status === 'done' && p.eTag)
      if (!allDone) {
        job.status = 'paused'
        await this.save(job)
        return
      }

      // 3. Complete.
      job.status = 'completing'
      await this.save(job)
      const result = await api.completeUpload(
        {
          uploadId: job.uploadId!,
          key: job.key!,
          parts: job.parts
            .slice()
            .sort((a, b) => a.partNumber - b.partNumber)
            .map((p) => ({ partNumber: p.partNumber, eTag: p.eTag! })),
        },
        signal,
      )
      job.status = 'completed'
      job.videoId = result.videoId
      await this.save(job)
      // Keep the completed record briefly for UI, then drop the heavy blob.
      await db.deleteJob(id)
    } catch (err) {
      await this.handleError(id, err, signal)
    } finally {
      this.controllers.delete(id)
    }
  }

  /** Upload pending parts, `concurrency` at a time, each with retry + re-presign. */
  private async uploadParts(job: UploadJob, signal: AbortSignal): Promise<void> {
    const concurrency = Math.max(1, env.uploadConcurrency)
    const pending = job.parts.filter((p) => p.status !== 'done')
    let cursor = 0

    const worker = async () => {
      while (cursor < pending.length) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
        const part = pending[cursor]
        cursor += 1
        await withRetry(
          async () => {
            // Re-presign if we have no URL (resumed job with expired URLs).
            if (!part.url) await this.represign(job, [part.partNumber])

            const blobPart = job.blob.slice(part.start, part.end, job.mime)
            try {
              const eTag = await api.putPart(part.url!, blobPart, signal)
              part.eTag = eTag
              part.status = 'done'
              await this.save(job)
            } catch (e) {
              // 403 usually means the presigned URL expired — drop it so the
              // next retry re-presigns, then rethrow to trigger backoff.
              if (e instanceof UploadHttpError && e.status === 403) part.url = undefined
              throw e
            }
          },
          {
            signal,
            shouldRetry: (e) => {
              // Missing ETag = CORS misconfig; retrying won't help.
              if (e instanceof UploadHttpError && e.code === 'NO_ETAG') return false
              // Non-HTTP errors (network) are retryable; HTTP errors only if marked so.
              return !(e instanceof UploadHttpError) || e.retryable
            },
          },
        )
      }
    }

    const workers = Array.from({ length: Math.min(concurrency, pending.length) }, worker)
    await Promise.all(workers)
  }

  private async represign(job: UploadJob, partNumbers: number[]): Promise<void> {
    const res = await api.represignParts({
      uploadId: job.uploadId!,
      key: job.key!,
      partNumbers,
    })
    for (const p of res.parts) {
      const part = job.parts.find((x) => x.partNumber === p.partNumber)
      if (part) part.url = p.url
    }
    await this.save(job)
  }

  private async handleError(id: string, err: unknown, signal: AbortSignal): Promise<void> {
    // Aborts (pause/cancel) are not errors.
    if (signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) return
    const job = await db.getJob(id)
    if (!job) return

    // 410 GONE — the multipart upload expired server-side; reset so it restarts fresh.
    if (err instanceof UploadHttpError && err.status === 410) {
      job.uploadId = undefined
      job.key = undefined
      job.parts = buildParts(job.size, job.partSize)
      job.status = 'paused'
      await this.save(job)
      return
    }

    // Everything else: surface as a recoverable error the user can retry, or an
    // offline pause if the network is down.
    job.status = navigator.onLine ? 'error' : 'paused'
    job.error = err instanceof Error ? err.message : 'Upload failed.'
    await this.save(job)
  }
}

export const uploadManager = new UploadManager()

// Resume when connectivity returns.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void db.getResumableJobs().then((jobs) => {
      for (const j of jobs) void uploadManager.resume(j.id)
    })
  })
}
