import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/utils/cn'

/**
 * VideoUpload — a mobile-friendly video upload screen.
 *
 * Converted from the Stitch "Video Upload" design into a self-contained React
 * feature component (styling + logic). It uses a real <input type="file">,
 * drag & drop, a thumbnail preview generated from the selected file, and a
 * mocked upload-progress simulation.
 *
 * Wire `onUpload` to your real upload API — it receives the selected File.
 * The design tokens (indigo primary #4f46e5, green progress #10b981, Inter)
 * are applied via inline styles so the component renders correctly regardless
 * of the global Tailwind theme.
 */

const ACCEPT = 'video/mp4,video/quicktime,video/*'
const MAX_BYTES = 500 * 1024 * 1024 // 500MB

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

type UploadStatus = 'idle' | 'ready' | 'uploading' | 'done' | 'error'

interface SelectedVideo {
  file: File
  previewUrl: string
}

export interface VideoUploadProps {
  /** Called with the selected file when the user taps Upload. */
  onUpload?: (file: File) => Promise<void> | void
  className?: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  return `${(mb / 1024).toFixed(2)} GB`
}

export function VideoUpload({ onUpload, className }: VideoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [selected, setSelected] = useState<SelectedVideo | null>(null)
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Revoke object URLs to avoid memory leaks.
  useEffect(() => {
    return () => {
      if (selected) URL.revokeObjectURL(selected.previewUrl)
    }
  }, [selected])

  const acceptFile = useCallback((file: File | undefined | null) => {
    if (!file) return
    if (!file.type.startsWith('video/')) {
      setError('Please choose a video file (MP4, MOV).')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('File is larger than the 500MB limit.')
      return
    }
    setError(null)
    setSelected((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl)
      return { file, previewUrl: URL.createObjectURL(file) }
    })
    setProgress(0)
    setStatus('ready')
  }, [])

  const openFilePicker = () => inputRef.current?.click()

  const clearSelection = () => {
    setSelected((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl)
      return null
    })
    setStatus('idle')
    setProgress(0)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleUpload = async () => {
    if (!selected || status === 'uploading') return
    setStatus('uploading')
    setProgress(0)

    // Simulated progress. Replace with real XHR/fetch progress events.
    await new Promise<void>((resolve) => {
      const timer = window.setInterval(() => {
        setProgress((p) => {
          const next = Math.min(100, p + Math.random() * 12 + 4)
          if (next >= 100) {
            window.clearInterval(timer)
            resolve()
          }
          return next
        })
      }, 250)
    })

    try {
      await onUpload?.(selected.file)
      setStatus('done')
    } catch {
      setStatus('error')
      setError('Upload failed. Please try again.')
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    acceptFile(e.dataTransfer.files?.[0])
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
        <h1 className="text-xl font-semibold" style={{ color: COLORS.onSurface }}>
          Upload Video
        </h1>
      </nav>

      <main className="mx-auto max-w-lg space-y-8 px-5 pt-24 pb-36">
        {/* Hidden native file input */}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(e) => acceptFile(e.target.files?.[0])}
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
            MP4, MOV up to 500MB
          </span>
        </button>

        {error && (
          <p className="text-sm font-medium" role="alert" style={{ color: COLORS.error }}>
            {error}
          </p>
        )}

        {/* Selection buttons */}
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={openFilePicker}
            className="w-full rounded-2xl py-4 text-base font-semibold transition-transform hover:brightness-110 active:scale-95"
            style={{ background: COLORS.primary, color: COLORS.primaryText }}
          >
            Choose from Gallery
          </button>
        </div>

        {/* Preview / active upload card */}
        {selected && (
          <section className="space-y-4">
            <h2
              className="text-xs font-semibold tracking-wider uppercase"
              style={{ color: COLORS.outline }}
            >
              {status === 'done' ? 'Uploaded' : 'Active Uploads'}
            </h2>
            <div
              className="relative flex items-start gap-4 rounded-2xl border p-4"
              style={{
                background: COLORS.card,
                borderColor: COLORS.outlineVariant,
                boxShadow: '0px 4px 12px rgba(0,0,0,0.05)',
              }}
            >
              <div
                className="h-20 w-20 shrink-0 overflow-hidden rounded-xl"
                style={{ background: COLORS.track }}
              >
                <video
                  src={selected.previewUrl}
                  className="h-full w-full object-cover"
                  muted
                  playsInline
                  preload="metadata"
                />
              </div>

              <div className="min-w-0 flex-1 pr-6">
                <div className="mb-2 flex flex-col">
                  <span
                    className="truncate text-base font-semibold"
                    style={{ color: COLORS.onSurface }}
                  >
                    {selected.file.name}
                  </span>
                  <span className="text-sm" style={{ color: COLORS.onSurfaceVariant }}>
                    {formatBytes(selected.file.size)}
                  </span>
                </div>

                {status !== 'ready' && (
                  <div className="space-y-1">
                    <div
                      className="flex items-center justify-between text-xs font-semibold"
                      style={{ color: status === 'error' ? COLORS.error : COLORS.progress }}
                    >
                      <span>
                        {status === 'uploading' && 'Uploading…'}
                        {status === 'done' && 'Complete'}
                        {status === 'error' && 'Failed'}
                      </span>
                      <span>{Math.floor(progress)}%</span>
                    </div>
                    <div
                      className="h-1.5 w-full overflow-hidden rounded-full"
                      style={{ background: COLORS.track }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${progress}%`,
                          background: status === 'error' ? COLORS.error : COLORS.progress,
                          transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                aria-label="Remove video"
                onClick={clearSelection}
                className="absolute top-4 right-4 transition-all active:scale-90"
                style={{ color: COLORS.onSurfaceVariant }}
              >
                <CloseIcon />
              </button>
            </div>
          </section>
        )}
      </main>

      {/* Sticky bottom action */}
      <footer
        className="fixed bottom-0 left-0 z-50 w-full px-5 pt-4 pb-6"
        style={{ background: COLORS.surface, boxShadow: '0px -4px 12px rgba(0,0,0,0.05)' }}
      >
        <button
          type="button"
          disabled={!selected || status === 'uploading' || status === 'done'}
          onClick={handleUpload}
          className="mx-auto flex w-full max-w-lg items-center justify-center gap-2 rounded-xl py-4 text-base font-semibold transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: COLORS.primary, color: COLORS.primaryText }}
        >
          <PublishIcon />
          {status === 'uploading' ? 'Uploading…' : status === 'done' ? 'Uploaded' : 'Upload'}
        </button>
      </footer>
    </div>
  )
}

/* --- Inline SVG icons (no external icon-font dependency) --- */

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

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M18 6L6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function PublishIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 20V9m0 0l-4 4m4-4l4 4M5 5h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
