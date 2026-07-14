export interface VideoRecorderProps {
  onCapture: (result: { blob: Blob; filename: string; durationSec: number }) => void
  onClose: () => void
  className?: string
}

export type RecState = 'idle' | 'requesting' | 'ready' | 'recording' | 'error'
