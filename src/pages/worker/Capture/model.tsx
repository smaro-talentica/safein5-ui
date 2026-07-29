export type CaptureSection = 'video' | 'audio' | 'text'

export type VideoMode = 'record' | 'choose'

export type TextMode = 'write' | 'record'

export type SelectedVideo = {
  blob: Blob
  url: string
  name: string
  size: number
}

export type PendingTrim = {
  blob: Blob
  duration: number
}

export type TrimRange = {
  start: number
  end: number
}

export type TrimJobStatus = 'processing' | 'error'

/**
 * A queued-but-not-yet-trimmed video: tapping Upload in the trimmer saves one of these
 * immediately (so Feed can show a "Processing…" placeholder and the app can navigate to Feed
 * right away) rather than waiting for the — potentially multi-second — re-encode to finish.
 * `TrimRunner` (mirroring `VideoUploader`'s background-runner pattern) picks these up, runs the
 * trim, then replaces the job with a real `StoredVideo` + upload session on success.
 */
export type TrimJob = {
  id: string
  /** The original, untrimmed file the worker picked/recorded. */
  sourceBlob: Blob
  name: string
  range: TrimRange
  status: TrimJobStatus
  error?: string
  createdAt: number
  updatedAt: number
}

export type StoredVideo = {
  id: string
  blob: Blob
  name: string
  size: number
  type: string
  createdAt: number
}

export type UploadChunkStatus = 'pending' | 'done'

export type UploadChunk = {
  chunkNumber: number
  start: number
  end: number
  status: UploadChunkStatus
  eTag?: string
}

export type UploadSessionStatus = 'pending' | 'uploading' | 'completed' | 'error'

export type UploadSession = {
  /** Same id as the source StoredVideo. */
  id: string
  /** Backend session id, set once the first /uploads/next call succeeds. */
  sessionId?: string
  filename: string
  mime: string
  size: number
  chunkSize: number
  chunkCount: number
  chunks: UploadChunk[]
  status: UploadSessionStatus
  error?: string
  createdAt: number
  updatedAt: number
}

export type NextChunkResponse =
  | {
      sessionId: string
      status: 'in_progress'
      nextChunkNumber: number
      url: string
    }
  | {
      sessionId: string
      status: 'completed'
      videoId: string
    }

/**
 * Response from `GET /uploads/:sessionId/playback`: a short-lived presigned URL for the
 * backend's streamable (H.264/AAC +faststart) rendition of the uploaded video — playable on
 * all browsers/devices, unlike the raw upload. The endpoint 404s until the background transcode
 * finishes, so the client polls it (see `usePlaybackUrlQuery`).
 */
export type PlaybackUrlResponse = {
  url: string
}

export type StoredAudio = {
  id: string
  blob: Blob
  name: string
  size: number
  type: string
  createdAt: number
}

export type AudioUploadStatus = 'pending' | 'uploading' | 'completed' | 'error'

export type AudioUploadRecord = {
  /** Same id as the source StoredAudio. */
  id: string
  status: AudioUploadStatus
  /** S3 object key once presigned/uploaded, so a resumed upload can skip re-presigning. */
  s3Key?: string
  error?: string
  createdAt: number
  updatedAt: number
}

/**
 * Response from the backend when asking for a one-shot presigned S3 PUT URL for an audio clip.
 * Unlike the video flow's `NextChunkResponse`, this is a single URL for the whole file — no
 * multipart/chunking handshake, since audio clips are small (see BACKEND_AUDIO_UPLOAD_SPEC.md).
 */
export type AudioPresignResponse = {
  /** S3 object key the backend chose — echoed back on later calls (e.g. start-transcription). */
  s3Key: string
  /** Presigned PUT URL the client uploads the raw audio bytes to, directly, from the browser. */
  url: string
}

export type TranscriptionJobStatus = 'queued' | 'in_progress' | 'completed' | 'failed'

/**
 * Response from the backend after asking it to start an AWS Transcribe job against an
 * already-uploaded S3 audio object. The client polls `GET` on this job until it reaches a
 * terminal status (`completed` / `failed`).
 */
export type TranscriptionJobResponse = {
  jobId: string
  status: TranscriptionJobStatus
  /** Present only once status is `completed`. */
  text?: string
  /** Present only once status is `failed`. */
  error?: string
}

/**
 * A saved entry from the Capture "Text" tab — either typed directly, or transcribed from a
 * voice memo (the audio itself is discarded once the worker taps Confirm; only the resulting
 * text is kept). Local-only for now (IndexedDB) — no S3 upload, no backend call. See the
 * Capture "Text" tab: this is intentionally NOT a `StoredAudio`/`StoredVideo` — there is no
 * blob, no upload-status tracking, and no background uploader for it yet.
 */
export type StoredTextEntry = {
  id: string
  text: string
  /** How this entry was produced — informational, doesn't change how it's stored/displayed. */
  source: 'written' | 'transcribed'
  createdAt: number
}
