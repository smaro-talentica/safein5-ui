export const DB_NAME = 'safein5-videos'
export const DB_VERSION = 4
export const STORE_NAME = 'videos'
export const MAX_STORED_VIDEOS = 5

export const UPLOAD_SESSIONS_STORE_NAME = 'upload-sessions'
export const DEFAULT_CHUNK_SIZE = 6 * 1024 * 1024
export const MIN_CHUNK_SIZE = 5 * 1024 * 1024 // S3 hard floor for non-final parts
export const MAX_CHUNK_RETRIES = 3
export const CHUNK_RETRY_BASE_DELAY_MS = 1000

export const AUDIO_STORE_NAME = 'audio'
export const MAX_STORED_AUDIO = 10
export const AUDIO_UPLOAD_RECORDS_STORE_NAME = 'audio-upload-records'
export const MAX_AUDIO_UPLOAD_RETRIES = 3
export const AUDIO_UPLOAD_RETRY_BASE_DELAY_MS = 1000

export const TEXT_ENTRIES_STORE_NAME = 'text-entries'
export const MAX_STORED_TEXT_ENTRIES = 50
