function num(value: string | undefined, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export const env = {
  appEnv: import.meta.env.VITE_APP_ENV,
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
  /** Bytes per multipart part. Default 6 MiB (S3 requires >= 5 MiB per non-final part). */
  uploadPartSize: num(import.meta.env.VITE_UPLOAD_PART_SIZE, 6 * 1024 * 1024),
  /** Number of parts uploaded in parallel. */
  uploadConcurrency: num(import.meta.env.VITE_UPLOAD_CONCURRENCY, 4),
  /** Hard cap on video duration, in seconds. */
  uploadMaxDurationSec: num(import.meta.env.VITE_UPLOAD_MAX_DURATION_SEC, 30),
} as const

export const isDevelopment = env.appEnv === 'development'
export const isStaging = env.appEnv === 'staging'
export const isProduction = env.appEnv === 'production'
