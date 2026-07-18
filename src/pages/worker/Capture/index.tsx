import { Button } from '@/components/ui/button'
import { VideoRecorder } from '@/components/feature/VideoRecorder'
import { formatBytes } from '@/components/feature/VideoRecorder/helper'
import { cn } from '@/utils/cn'
import { Upload, Video, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/AppRoute/constant'
import { saveVideoToIndexedDb } from './action'
import type { SelectedVideo, UploadMode } from './model'

export function Capture() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<UploadMode>('record')
  const [selected, setSelected] = useState<SelectedVideo | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const setVideo = useCallback((blob: Blob, name: string) => {
    setSelected((prev) => {
      if (prev) URL.revokeObjectURL(prev.url)
      return { blob, url: URL.createObjectURL(blob), name, size: blob.size }
    })
    setError(null)
  }, [])

  const clearVideo = useCallback(() => {
    setSelected((prev) => {
      if (prev) URL.revokeObjectURL(prev.url)
      return null
    })
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  useEffect(() => {
    return () => {
      if (selected) URL.revokeObjectURL(selected.url)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) setVideo(file, file.name)
  }

  const handleRecorded = useCallback(
    (blob: Blob) => {
      setVideo(blob, `recording-${blob.size}.webm`)
    },
    [setVideo],
  )

  const handleUpload = async () => {
    if (!selected) return
    setUploading(true)
    setError(null)
    try {
      await saveVideoToIndexedDb(selected.blob, selected.name)
      clearVideo()
      navigate(ROUTES.feed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the video locally.')
      setUploading(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 p-6">
      {!selected && (
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
          {(['record', 'choose'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium transition-colors',
                mode === m
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {m === 'choose' ? (
                <Upload className="size-4" aria-hidden />
              ) : (
                <Video className="size-4" aria-hidden />
              )}
              {m === 'choose' ? 'Choose file' : 'Record'}
            </button>
          ))}
        </div>
      )}

      {!selected && mode === 'choose' && (
        <div className="flex flex-col items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            variant="outline"
            className="w-full"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="size-4" aria-hidden />
            Choose a video
          </Button>
        </div>
      )}

      {!selected && mode === 'record' && (
        <VideoRecorder onRecorded={handleRecorded} className="mx-auto" />
      )}

      {selected && (
        <div className="space-y-3 rounded-xl border border-slate-200 p-3">
          <div className="overflow-hidden rounded-lg bg-black">
            <video src={selected.url} controls className="aspect-9/16 w-full object-contain" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{selected.name}</p>
              <p className="text-xs text-slate-500">{formatBytes(selected.size)}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={clearVideo} aria-label="Remove video">
              <X className="size-4" aria-hidden />
            </Button>
          </div>
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          <Button className="w-full" onClick={() => void handleUpload()} disabled={uploading}>
            {uploading ? 'Saving…' : 'Upload'}
          </Button>
        </div>
      )}
    </div>
  )
}
