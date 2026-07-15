export type VideoRecorderProps = {
  onRecorded: (blob: Blob) => void
  className?: string
}

export type RecorderStatus = 'idle' | 'ready' | 'recording' | 'error'
