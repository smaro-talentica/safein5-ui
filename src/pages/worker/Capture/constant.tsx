export const DB_NAME = 'safein5-videos'
export const DB_VERSION = 2
export const STORE_NAME = 'videos'
export const MAX_STORED_VIDEOS = 5

export const UPLOAD_SESSIONS_STORE_NAME = 'upload-sessions'
export const DEFAULT_CHUNK_SIZE = 6 * 1024 * 1024
export const MIN_CHUNK_SIZE = 5 * 1024 * 1024 // S3 hard floor for non-final parts
export const MAX_CHUNK_RETRIES = 3
export const CHUNK_RETRY_BASE_DELAY_MS = 1000
