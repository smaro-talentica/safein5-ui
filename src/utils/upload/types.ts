/**
 * Shared types for the resumable video upload feature.
 *
 * The full request/response contract these mirror is documented in
 * docs/BACKEND_UPLOAD_SPEC.md. Keep the two in sync.
 */

export type UploadJobStatus =
  | 'queued' // created, not started yet
  | 'uploading' // parts in flight
  | 'paused' // stopped (offline / app closed / user paused)
  | 'completing' // all parts done, calling /uploads/complete
  | 'completed' // finished successfully
  | 'error' // terminal failure the user must act on
  | 'canceled' // aborted by the user

export type PartStatus = 'pending' | 'uploading' | 'done'

export interface UploadPart {
  partNumber: number
  /** Byte offset range within the source blob: [start, end). */
  start: number
  end: number
  status: PartStatus
  /** Presigned PUT URL. May expire; re-fetched via /uploads/parts on resume. */
  url?: string
  /** S3 ETag returned after a successful PUT — required to complete the upload. */
  eTag?: string
  /**
   * Set when the part was uploaded via Background Fetch (app was closed), where
   * the ETag is not readable. The manager re-verifies these on reopen.
   */
  bgUploaded?: boolean
}

/**
 * One persisted upload. The `blob` is stored so the upload can resume after the
 * app is closed and reopened. Everything here is written to IndexedDB.
 */
export interface UploadJob {
  id: string
  blob: Blob
  filename: string
  mime: string
  size: number
  durationSec: number
  partSize: number
  parts: UploadPart[]
  status: UploadJobStatus
  /** S3 multipart identifiers, set after /uploads/init. */
  uploadId?: string
  key?: string
  /** Canonical id from the backend after completion. */
  videoId?: string
  /** Last user-facing error message, if status === 'error'. */
  error?: string
  createdAt: number
  updatedAt: number
}

/** Progress snapshot emitted to UI subscribers. */
export interface UploadProgress {
  id: string
  status: UploadJobStatus
  /** Bytes confirmed uploaded (sum of completed parts). */
  uploadedBytes: number
  totalBytes: number
  /** 0..100 */
  percent: number
  error?: string
  videoId?: string
}

/** Response shape of POST /uploads/init. */
export interface InitResponse {
  uploadId: string
  key: string
  partSize: number
  partCount: number
  parts: Array<{ partNumber: number; url: string }>
  urlExpiresInSec: number
}

/** Response shape of POST /uploads/parts. */
export interface PartsResponse {
  parts: Array<{ partNumber: number; url: string }>
  urlExpiresInSec: number
}

/** Response shape of POST /uploads/complete. */
export interface CompleteResponse {
  videoId: string
  key: string
  location?: string
  status: 'completed'
}
