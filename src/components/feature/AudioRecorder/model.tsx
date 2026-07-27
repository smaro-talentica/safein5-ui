export type AudioRecorderProps = {
  onRecorded: (blob: Blob) => void
  className?: string
}

export type RecorderStatus = 'idle' | 'recording' | 'error'
