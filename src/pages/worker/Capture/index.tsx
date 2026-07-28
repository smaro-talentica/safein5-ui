import { Button } from '@/components/ui/button'
import { VideoRecorder } from '@/components/feature/VideoRecorder'
import { formatBytes } from '@/components/feature/VideoRecorder/helper'
import { VideoTrimmer } from '@/components/feature/VideoTrimmer'
import { AudioRecorder } from '@/components/feature/AudioRecorder'
import { transcribeAudio } from '@/components/feature/Transcription/action'
import { cn } from '@/utils/cn'
import { FileText, Mic, PenLine, Upload, Video, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/AppRoute/constant'
import { saveAudioAndQueueUpload, saveTextEntry, saveVideoAndQueueUpload } from './action'
import { isVideoFile, readVideoDuration } from './helper'
import type { CaptureSection, PendingTrim, SelectedVideo, TextMode, VideoMode } from './model'

const SECTIONS = [
  { value: 'video', label: 'Video', icon: Video },
  { value: 'audio', label: 'Audio', icon: Mic },
  { value: 'text', label: 'Text', icon: FileText },
] as const satisfies ReadonlyArray<{ value: CaptureSection; label: string; icon: typeof Video }>

const VIDEO_MODES = [
  { value: 'record', label: 'Record', icon: Video },
  { value: 'choose', label: 'Choose file', icon: Upload },
] as const satisfies ReadonlyArray<{ value: VideoMode; label: string; icon: typeof Video }>

const TEXT_MODES = [
  { value: 'write', label: 'Write', icon: PenLine },
  { value: 'record', label: 'Transcribe', icon: Mic },
] as const satisfies ReadonlyArray<{ value: TextMode; label: string; icon: typeof PenLine }>

function TabGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<{ value: T; label: string; icon: typeof Video }>
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div
      className="grid gap-2 rounded-lg bg-slate-100 p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map(({ value: optionValue, label, icon: Icon }) => (
        <button
          key={optionValue}
          type="button"
          onClick={() => onChange(optionValue)}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium transition-colors',
            value === optionValue
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700',
          )}
        >
          <Icon className="size-4" aria-hidden />
          {label}
        </button>
      ))}
    </div>
  )
}

export function Capture() {
  const navigate = useNavigate()
  const [section, setSection] = useState<CaptureSection>('video')
  const [videoMode, setVideoMode] = useState<VideoMode>('record')
  const [textMode, setTextMode] = useState<TextMode>('write')

  const [selected, setSelected] = useState<SelectedVideo | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingTrim, setPendingTrim] = useState<PendingTrim | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [recordedAudio, setRecordedAudio] = useState<{ blob: Blob; url: string } | null>(null)
  const [savingAudio, setSavingAudio] = useState(false)
  const [audioError, setAudioError] = useState<string | null>(null)

  const [writtenText, setWrittenText] = useState('')
  const [savingWrittenText, setSavingWrittenText] = useState(false)
  const [writtenTextError, setWrittenTextError] = useState<string | null>(null)

  const [voiceAudio, setVoiceAudio] = useState<{ blob: Blob; url: string } | null>(null)
  const [transcript, setTranscript] = useState('')
  const [transcribing, setTranscribing] = useState(false)
  const [transcribeError, setTranscribeError] = useState<string | null>(null)
  const [savingTranscript, setSavingTranscript] = useState(false)
  const [transcriptSaveError, setTranscriptSaveError] = useState<string | null>(null)

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
    setPendingTrim(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  useEffect(() => {
    return () => {
      if (selected) URL.revokeObjectURL(selected.url)
      if (recordedAudio) URL.revokeObjectURL(recordedAudio.url)
      if (voiceAudio) URL.revokeObjectURL(voiceAudio.url)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!isVideoFile(file)) {
      setError('Please choose a video file.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setError(null)
    readVideoDuration(file)
      .then((duration) => {
        setPendingTrim({ blob: file, duration })
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Please choose a video file.')
        if (fileInputRef.current) fileInputRef.current.value = ''
      })
  }

  const handleQueued = useCallback(() => {
    setPendingTrim(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    navigate(ROUTES.feed)
  }, [navigate])

  const handleCancelTrim = useCallback(() => {
    setPendingTrim(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

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
      await saveVideoAndQueueUpload(selected.blob, selected.name)
      clearVideo()
      navigate(ROUTES.feed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the video locally.')
      setUploading(false)
    }
  }

  const handleAudioRecorded = useCallback((blob: Blob) => {
    setRecordedAudio((prev) => {
      if (prev) URL.revokeObjectURL(prev.url)
      return { blob, url: URL.createObjectURL(blob) }
    })
    setAudioError(null)
  }, [])

  const clearRecordedAudio = useCallback(() => {
    setRecordedAudio((prev) => {
      if (prev) URL.revokeObjectURL(prev.url)
      return null
    })
    setAudioError(null)
  }, [])

  const handleAudioUpload = async () => {
    if (!recordedAudio) return
    setSavingAudio(true)
    setAudioError(null)
    try {
      await saveAudioAndQueueUpload(recordedAudio.blob, `audio-${recordedAudio.blob.size}.webm`)
      clearRecordedAudio()
      navigate(ROUTES.feed)
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : 'Could not save the recording locally.')
      setSavingAudio(false)
    }
  }

  const handleSaveWrittenText = async () => {
    if (!writtenText.trim()) return
    setSavingWrittenText(true)
    setWrittenTextError(null)
    try {
      await saveTextEntry(writtenText, 'written')
      setWrittenText('')
      navigate(ROUTES.feed)
    } catch (err) {
      setWrittenTextError(err instanceof Error ? err.message : 'Could not save the text locally.')
      setSavingWrittenText(false)
    }
  }

  const handleVoiceRecorded = useCallback((blob: Blob) => {
    setVoiceAudio((prev) => {
      if (prev) URL.revokeObjectURL(prev.url)
      return { blob, url: URL.createObjectURL(blob) }
    })
    setTranscript('')
    setTranscribeError(null)
    setTranscriptSaveError(null)
    setTranscribing(true)
    transcribeAudio(blob)
      .then((result) => setTranscript(result.text))
      .catch((err) => {
        setTranscribeError(err instanceof Error ? err.message : 'Could not transcribe the memo.')
      })
      .finally(() => setTranscribing(false))
  }, [])

  const clearVoiceMemo = useCallback(() => {
    setVoiceAudio((prev) => {
      if (prev) URL.revokeObjectURL(prev.url)
      return null
    })
    setTranscript('')
    setTranscribeError(null)
    setTranscribing(false)
    setTranscriptSaveError(null)
  }, [])

  const handleConfirmTranscript = async () => {
    if (!transcript.trim()) return
    setSavingTranscript(true)
    setTranscriptSaveError(null)
    try {
      await saveTextEntry(transcript, 'transcribed')
      clearVoiceMemo()
      navigate(ROUTES.feed)
    } catch (err) {
      setTranscriptSaveError(
        err instanceof Error ? err.message : 'Could not save the text locally.',
      )
      setSavingTranscript(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-6">
      <TabGroup options={SECTIONS} value={section} onChange={setSection} />

      {section === 'video' && (
        <div className="flex flex-col gap-4">
          {!selected && (
            <TabGroup
              options={VIDEO_MODES}
              value={videoMode}
              onChange={(mode) => {
                setVideoMode(mode)
                handleCancelTrim()
              }}
            />
          )}

          {!selected && videoMode === 'choose' && !pendingTrim && (
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
              {error && (
                <p className="w-full rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </p>
              )}
              <p className="text-xs text-slate-400">Trim the video before uploading it.</p>
            </div>
          )}

          {!selected && videoMode === 'choose' && pendingTrim && (
            <VideoTrimmer
              file={pendingTrim.blob}
              duration={pendingTrim.duration}
              onQueued={handleQueued}
              onCancel={handleCancelTrim}
            />
          )}

          {!selected && videoMode === 'record' && (
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
              {error && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
              )}
              <Button className="w-full" onClick={() => void handleUpload()} disabled={uploading}>
                {uploading ? 'Saving…' : 'Upload'}
              </Button>
            </div>
          )}
        </div>
      )}

      {section === 'audio' && (
        <div className="flex flex-col gap-4">
          {!recordedAudio && <AudioRecorder onRecorded={handleAudioRecorded} className="mx-auto" />}
          {recordedAudio && (
            <div className="space-y-3 rounded-xl border border-slate-200 p-3">
              <audio src={recordedAudio.url} controls className="w-full" />
              {audioError && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{audioError}</p>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={clearRecordedAudio}
                  disabled={savingAudio}
                >
                  Discard
                </Button>
                <Button
                  className="w-full"
                  onClick={() => void handleAudioUpload()}
                  disabled={savingAudio}
                >
                  {savingAudio ? 'Saving…' : 'Confirm'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {section === 'text' && (
        <div className="flex flex-col gap-4">
          {!voiceAudio && <TabGroup options={TEXT_MODES} value={textMode} onChange={setTextMode} />}

          {textMode === 'write' && !voiceAudio && (
            <div className="space-y-3 rounded-xl border border-slate-200 p-3">
              <textarea
                value={writtenText}
                onChange={(event) => setWrittenText(event.target.value)}
                rows={6}
                className="w-full rounded-lg border border-slate-200 p-3 text-sm text-slate-900"
                placeholder="Write your report…"
              />
              {writtenTextError && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                  {writtenTextError}
                </p>
              )}
              <Button
                className="w-full"
                onClick={() => void handleSaveWrittenText()}
                disabled={savingWrittenText || !writtenText.trim()}
              >
                {savingWrittenText ? 'Saving…' : 'Save'}
              </Button>
            </div>
          )}

          {textMode === 'record' && (
            <>
              {!voiceAudio && (
                <AudioRecorder onRecorded={handleVoiceRecorded} className="mx-auto" />
              )}
              {voiceAudio && (
                <div className="space-y-3 rounded-xl border border-slate-200 p-3">
                  <audio src={voiceAudio.url} controls className="w-full" />
                  {transcribing && <p className="text-sm text-slate-500">Transcribing…</p>}
                  {transcribeError && (
                    <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                      {transcribeError}
                    </p>
                  )}
                  {!transcribing && !transcribeError && (
                    <textarea
                      value={transcript}
                      onChange={(event) => setTranscript(event.target.value)}
                      rows={5}
                      className="w-full rounded-lg border border-slate-200 p-3 text-sm text-slate-900"
                      placeholder="Transcript will appear here…"
                    />
                  )}
                  {transcriptSaveError && (
                    <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                      {transcriptSaveError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={clearVoiceMemo}
                      disabled={savingTranscript}
                    >
                      Discard
                    </Button>
                    <Button
                      className="w-full"
                      onClick={() => void handleConfirmTranscript()}
                      disabled={transcribing || savingTranscript || !transcript.trim()}
                    >
                      {savingTranscript ? 'Saving…' : 'Confirm'}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
