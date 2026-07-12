/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV: 'development' | 'staging' | 'production'
  readonly VITE_API_BASE_URL: string
  /** Bytes per multipart upload part (default 6 MiB). */
  readonly VITE_UPLOAD_PART_SIZE?: string
  /** Max concurrent part uploads (default 4). */
  readonly VITE_UPLOAD_CONCURRENCY?: string
  /** Max video duration in seconds (default 30). */
  readonly VITE_UPLOAD_MAX_DURATION_SEC?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
