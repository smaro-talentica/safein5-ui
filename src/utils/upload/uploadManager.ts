/**
 * Upload manager — the framework-agnostic core that drives resumable video
 * uploads. Implemented as a module singleton (closure state + plain functions,
 * no class) so uploads keep running across route changes and can be resumed on
 * app open.
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
import { isRetryable, isUploadHttpError } from './uploadApi'
import * as db from './uploadDb'
import { withRetry } from './retry'
import type { UploadJob, UploadPart, UploadProgress } from './types'

type Listener = (progress: UploadProgress) => void

// --- Module singleton state -------------------------------------------------
/** In-memory abort controllers per running job, keyed by job id. */
const controllers: Record<string, AbortController> = {}
/** Progress subscribers. */
let listeners: Listener[] = []
let started = false

function uid(): string {
  // crypto.randomUUID is available in all target browsers and the SW.
  return crypto.randomUUID()
}

/** Abort a running job's controller (if any) and forget it. */
function stopController(id: string): void {
  controllers[id]?.abort()
  delete controllers[id]
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

function abortError(): DOMException {
  return new DOMException('Aborted', 'AbortError')
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

function emit(job: UploadJob): void {
  const p = toProgress(job)
  for (const listener of listeners) listener(p)
}

async function save(job: UploadJob): Promise<void> {
  job.updatedAt = Date.now()
  await db.putJob(job)
  emit(job)
}

// --- Public API -------------------------------------------------------------

export function subscribe(listener: Listener): () => void {
  listeners.push(listener)
  return () => {
    listeners = listeners.filter((l) => l !== listener)
  }
}

export function getJobs(): Promise<UploadJob[]> {
  return db.getAllJobs()
}

/**
 * Create and start an upload for a validated video blob. The byte transfer is
 * non-blocking (fire-and-forget); returns the new job id.
 */
export async function enqueue(input: {
  blob: Blob
  filename: string
  durationSec: number
}): Promise<string> {
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
  await save(job)
  void run(id)
  return id
}

/** Resume all unfinished jobs — call once on app open. */
export async function resumeAll(): Promise<void> {
  if (started) return
  started = true
  const jobs = await db.getResumableJobs()
  for (const job of jobs) void run(job.id)
}

export async function pause(id: string): Promise<void> {
  stopController(id)
  const job = await db.getJob(id)
  if (job && (job.status === 'uploading' || job.status === 'queued')) {
    job.status = 'paused'
    await save(job)
  }
}

export async function resume(id: string): Promise<void> {
  const job = await db.getJob(id)
  if (job && job.status !== 'completed' && job.status !== 'canceled') {
    void run(id)
  }
}

export async function cancel(id: string): Promise<void> {
  stopController(id)
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
  emit({ ...job, status: 'canceled' })
}

// --- Internals --------------------------------------------------------------

/** The main state machine for a single job. Guarded so it never runs twice. */
async function run(id: string): Promise<void> {
  if (controllers[id]) return // already running
  const controller = new AbortController()
  controllers[id] = controller
  const { signal } = controller

  try {
    let job = await db.getJob(id)
    if (!job || job.status === 'completed' || job.status === 'canceled') return

    // 1. Init the multipart upload if it hasn't been started yet.
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
      applyUrls(job.parts, init.parts)
    }
    job.status = 'uploading'
    await save(job)

    // 2. Upload all pending parts with a concurrency cap.
    await uploadParts(job, signal)

    // Re-read to pick up the freshest ETags before completing.
    const fresh = await db.getJob(id)
    if (!fresh || fresh.status === 'paused' || fresh.status === 'canceled') return
    job = fresh

    if (!job.parts.every((p) => p.status === 'done' && p.eTag)) {
      job.status = 'paused'
      await save(job)
      return
    }

    // 3. Complete.
    job.status = 'completing'
    await save(job)
    const result = await api.completeUpload(
      {
        uploadId: job.uploadId as string,
        key: job.key as string,
        parts: job.parts
          .slice()
          .sort((a, b) => a.partNumber - b.partNumber)
          .map((p) => ({ partNumber: p.partNumber, eTag: p.eTag as string })),
      },
      signal,
    )
    job.status = 'completed'
    job.videoId = result.videoId
    await save(job)
    // The upload is done; drop the heavy blob from storage.
    await db.deleteJob(id)
  } catch (err) {
    await handleError(id, err, signal)
  } finally {
    delete controllers[id]
  }
}

/** Copy presigned URLs from a server response onto the matching parts. */
function applyUrls(
  parts: UploadPart[],
  incoming: Array<{ partNumber: number; url: string }>,
): void {
  const byNumber: Record<number, UploadPart> = {}
  for (const part of parts) byNumber[part.partNumber] = part
  for (const { partNumber, url } of incoming) {
    const part = byNumber[partNumber]
    if (part) part.url = url
  }
}

/** Upload every pending part, `concurrency` at a time, each with retry + re-presign. */
async function uploadParts(job: UploadJob, signal: AbortSignal): Promise<void> {
  const concurrency = Math.max(1, env.uploadConcurrency)
  const pending = job.parts.filter((p) => p.status !== 'done')
  let cursor = 0

  const worker = async (): Promise<void> => {
    while (cursor < pending.length) {
      if (signal.aborted) throw abortError()
      const part = pending[cursor]
      cursor += 1
      await withRetry(() => uploadOnePart(job, part, signal), { signal, shouldRetry: isRetryable })
    }
  }

  const workerCount = Math.min(concurrency, pending.length)
  await Promise.all(Array.from({ length: workerCount }, worker))
}

/** Upload a single part once (retry/backoff is handled by the caller). */
async function uploadOnePart(job: UploadJob, part: UploadPart, signal: AbortSignal): Promise<void> {
  // Re-presign if we have no URL (resumed job with expired URLs).
  if (!part.url) await represign(job, [part.partNumber])

  const blobPart = job.blob.slice(part.start, part.end, job.mime)
  try {
    part.eTag = await api.putPart(part.url as string, blobPart, signal)
    part.status = 'done'
    await save(job)
  } catch (e) {
    // 403 usually means the presigned URL expired — drop it so the next retry
    // re-presigns, then rethrow to trigger backoff.
    if (isUploadHttpError(e) && e.status === 403) part.url = undefined
    throw e
  }
}

async function represign(job: UploadJob, partNumbers: number[]): Promise<void> {
  const res = await api.represignParts({
    uploadId: job.uploadId as string,
    key: job.key as string,
    partNumbers,
  })
  applyUrls(job.parts, res.parts)
  await save(job)
}

async function handleError(id: string, err: unknown, signal: AbortSignal): Promise<void> {
  // Aborts (pause/cancel) are not errors.
  if (signal.aborted || isAbortError(err)) return
  const job = await db.getJob(id)
  if (!job) return

  // 410 GONE — the multipart upload expired server-side; reset so it restarts fresh.
  if (isUploadHttpError(err) && err.status === 410) {
    job.uploadId = undefined
    job.key = undefined
    job.parts = buildParts(job.size, job.partSize)
    job.status = 'paused'
    await save(job)
    return
  }

  // Otherwise surface a recoverable error, or an offline pause if the network is down.
  job.status = navigator.onLine ? 'error' : 'paused'
  job.error = err instanceof Error ? err.message : 'Upload failed.'
  await save(job)
}

// Resume when connectivity returns.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void db.getResumableJobs().then((jobs) => {
      for (const job of jobs) void resume(job.id)
    })
  })
}

/**
 * Namespaced accessor mirroring the previous singleton API, so existing imports
 * (`uploadManager.enqueue(...)`, etc.) keep working. These are plain functions.
 */
export const uploadManager = {
  subscribe,
  getJobs,
  enqueue,
  resumeAll,
  pause,
  resume,
  cancel,
}
