import { useCallback, useRef, useState } from 'react'
import { cn } from '@/utils/cn'
import { env } from '@/utils/env'
import { useUpload } from '@/hooks/useUpload'
import { VideoRecorder } from '@/components/feature/VideoRecorder'
import type { UploadJobStatus, UploadProgress } from '@/utils/upload/types'

/**
 * VideoUpload — mobile-friendly capture/upload screen.
 *
 * Users either record a clip in-app (hard-capped at the max duration) or pick a
 * video from the gallery (validated to the same limit). Uploads run through the
 * resumable upload manager: they are non-blocking, survive navigation, resume
 * after the app is reopened, and continue in the background on browsers that
 * support Background Fetch. Progress shown here is driven by that manager, so it
 * persists across route changes.
 */

const ACCEPT = 'video/mp4,video/quicktime,video/*'

const COLORS = {
  primary: '#4f46e5',
  primaryText: '#ffffff',
  primarySoft: '#e2dfff',
  progress: '#10b981',
  surface: '#f9f9ff',
  card: '#ffffff',
  onSurface: '#151c27',
  onSurfaceVariant: '#464555',
  outline: '#777587',
  outlineVariant: '#c7c4d8',
  track: '#e7eefe',
  error: '#ba1a1a',
} as const

export interface VideoUploadProps {
  className?: string
}

function statusLabel(status: UploadJobStatus): string {
  switch (status) {
    case 'queued':
      return 'Queued…'
    case 'uploading':
      return 'Uploading…'
    case 'completing':
      return 'Finishing…'
    case 'completed':
      return 'Complete'
    case 'paused':
      return navigatorOnline() ? 'Paused' : 'Waiting for network…'
    case 'error':
      return 'Failed'
    case 'canceled':
      return 'Canceled'
  }
}

function navigatorOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

export function VideoUpload({ className }: VideoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { uploads, startUpload, pause, resume, cancel } = useUpload()
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)

  const handleFile = useCallback(
    async (file: File | undefined | null) => {
      if (!file) return
      setError(null)
      const err = await startUpload(file, file.name)
      if (err) setError(err)
    },
    [startUpload],
  )

  const openFilePicker = () => inputRef.current?.click()

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    void handleFile(e.dataTransfer.files?.[0])
  }

  const dashedBorder = (color: string) =>
    `url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' rx='16' ry='16' stroke='${encodeURIComponent(
      color,
    )}' stroke-width='3' stroke-dasharray='6%2c 6' stroke-linecap='square'/%3e%3c/svg%3e")`

  return (
    <div
      className={cn('min-h-dvh w-full', className)}
      style={{
        background: COLORS.surface,
        color: COLORS.onSurface,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {recording && (
        <VideoRecorder
          onClose={() => setRecording(false)}
          onCapture={async ({ blob, filename, durationSec }) => {
            setRecording(false)
            setError(null)
            // Duration is already capped by the recorder; enqueue directly.
            const err = await startUpload(new File([blob], filename, { type: blob.type }), filename)
            if (err) setError(err)
            void durationSec
          }}
        />
      )}

      {/* Top app bar */}
      <nav
        className="fixed top-0 left-0 z-50 flex h-16 w-full items-center px-5"
        style={{ background: COLORS.surface }}
      >
        <button
          type="button"
          aria-label="Go back"
          className="mr-4 transition-transform active:scale-95"
          onClick={() => window.history.back()}
        >
          <ArrowBackIcon color={COLORS.primary} />
        </button>
        <h5 className="text-xl font-semibold" style={{ color: COLORS.onSurface }}>
          Upload Video
        </h5>
      </nav>

      <main className="mx-auto max-w-lg space-y-8 px-5 pt-24 pb-36">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        {/* Upload drop zone */}
        <button
          type="button"
          onClick={openFilePicker}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className="flex w-full flex-col items-center justify-center px-6 py-10 text-center transition-all duration-200 active:scale-[0.99]"
          style={{
            backgroundImage: dashedBorder(dragging ? COLORS.primary : COLORS.outlineVariant),
            borderRadius: 16,
            backgroundColor: dragging ? 'rgba(79,70,229,0.05)' : COLORS.card,
          }}
        >
          <span
            className="mb-4 flex h-20 w-20 items-center justify-center rounded-full"
            style={{ background: COLORS.primarySoft }}
          >
            <CloudUploadIcon color={COLORS.primary} />
          </span>
          <span className="mb-1 text-xl font-semibold" style={{ color: COLORS.onSurface }}>
            Tap to upload a video
          </span>
          <span className="text-sm" style={{ color: COLORS.onSurfaceVariant }}>
            MP4, MOV up to {env.uploadMaxDurationSec}s
          </span>
        </button>

        {error && (
          <p className="text-sm font-medium" role="alert" style={{ color: COLORS.error }}>
            {error}
          </p>
        )}

        {/* Capture / select actions */}
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => setRecording(true)}
            className="w-full rounded-2xl py-4 text-base font-semibold transition-transform hover:brightness-110 active:scale-95"
            style={{ background: COLORS.primary, color: COLORS.primaryText }}
          >
            Record a Video
          </button>
          <button
            type="button"
            onClick={openFilePicker}
            className="w-full rounded-2xl border py-4 text-base font-semibold transition-transform active:scale-95"
            style={{ borderColor: COLORS.outlineVariant, color: COLORS.primary }}
          >
            Choose from Gallery
          </button>
        </div>

        {/* Active / completed uploads (persist across navigation and reopen) */}
        {uploads.length > 0 && (
          <section className="space-y-4">
            <h2
              className="text-xs font-semibold tracking-wider uppercase"
              style={{ color: COLORS.outline }}
            >
              Uploads
            </h2>
            <ul className="space-y-3">
              {uploads.map((u) => (
                <UploadRow
                  key={u.id}
                  upload={u}
                  onPause={() => pause(u.id)}
                  onResume={() => resume(u.id)}
                  onCancel={() => cancel(u.id)}
                />
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  )
}

function UploadRow({
  upload,
  onPause,
  onResume,
  onCancel,
}: {
  upload: UploadProgress
  onPause: () => void
  onResume: () => void
  onCancel: () => void
}) {
  const { status, percent } = upload
  const isActive = status === 'uploading' || status === 'queued' || status === 'completing'
  const barColor = status === 'error' ? COLORS.error : COLORS.progress

  return (
    <li
      className="rounded-2xl border p-4"
      style={{
        background: COLORS.card,
        borderColor: COLORS.outlineVariant,
        boxShadow: '0px 4px 12px rgba(0,0,0,0.05)',
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span
          className="text-sm font-semibold"
          style={{ color: status === 'error' ? COLORS.error : COLORS.onSurface }}
        >
          {statusLabel(status)}
        </span>
        <span className="text-xs font-semibold" style={{ color: COLORS.onSurfaceVariant }}>
          {percent}%
        </span>
      </div>

      <div
        className="h-1.5 w-full overflow-hidden rounded-full"
        style={{ background: COLORS.track }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${percent}%`,
            background: barColor,
            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </div>

      {upload.error && (
        <p className="mt-2 text-xs" style={{ color: COLORS.error }}>
          {upload.error}
        </p>
      )}

      {status !== 'completed' && (
        <div className="mt-3 flex gap-3">
          {isActive && (
            <button
              type="button"
              onClick={onPause}
              className="text-xs font-semibold"
              style={{ color: COLORS.primary }}
            >
              Pause
            </button>
          )}
          {(status === 'paused' || status === 'error') && (
            <button
              type="button"
              onClick={onResume}
              className="text-xs font-semibold"
              style={{ color: COLORS.primary }}
            >
              Resume
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="text-xs font-semibold"
            style={{ color: COLORS.error }}
          >
            Cancel
          </button>
        </div>
      )}
    </li>
  )
}

/* --- Inline SVG icons --- */

function ArrowBackIcon({ color }: { color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M15 18l-6-6 6-6"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CloudUploadIcon({ color }: { color: string }) {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 18a4 4 0 01-.5-7.97 5.5 5.5 0 0110.9-1.2A4.5 4.5 0 0117 18h-3"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 21v-9m0 0l-3 3m3-3l3 3"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
