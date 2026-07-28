export type TrimRange = {
  start: number
  end: number
}

export type VideoTrimmerProps = {
  file: Blob
  /** Full duration of the source file, in seconds (from loaded metadata). */
  duration: number
  /**
   * Called the moment the selected range has been queued for background trimming (immediately,
   * not once trimming finishes) — the caller should navigate away right away, e.g. to Feed, where
   * a "Processing…" placeholder tracks the job until it completes.
   */
  onQueued: (range: TrimRange) => void
  onCancel: () => void
  className?: string
}

export type TrimStatus = 'idle' | 'processing' | 'error'

/** Which part of the filmstrip scrubber a pointer-drag is currently manipulating. */
export type DragHandle = 'start' | 'end' | 'window' | null

/** Range + pointer ratio captured at the moment a whole-window drag begins. */
export type DragAnchor = {
  range: TrimRange
  ratio: number
}
