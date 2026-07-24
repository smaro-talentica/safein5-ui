export type UploadMode = 'choose' | 'record'

export type SelectedVideo = {
  blob: Blob
  url: string
  name: string
  size: number
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
