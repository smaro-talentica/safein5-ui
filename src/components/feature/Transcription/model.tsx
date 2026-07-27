/**
 * Provider-agnostic speech-to-text contract. Swapping the backend/vendor (self-hosted Whisper,
 * Deepgram, Azure/AWS/GCP STT, ...) means implementing this interface — nothing else in the app
 * should depend on a specific provider's request/response shape.
 */
export type TranscribeOptions = {
  /** BCP-47 language hint (e.g. "en-GB", "en-US", "es"). Omit to let the backend auto-detect. */
  languageHint?: string
}

export type TranscriptionResult = {
  text: string
  /** BCP-47 language the backend detected/used, when it reports one. */
  language?: string
  /** 0-1 confidence score, when the backend reports one. */
  confidence?: number
}

export type TranscriptionClient = {
  transcribe: (audio: Blob, options?: TranscribeOptions) => Promise<TranscriptionResult>
}

export type TranscriptionStatus = 'idle' | 'transcribing' | 'done' | 'error'
