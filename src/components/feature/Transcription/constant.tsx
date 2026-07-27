export const MOCK_TRANSCRIPT =
  '[Mock transcript] This is a placeholder transcription — no speech-to-text backend is wired up yet.'

export const MOCK_TRANSCRIBE_DELAY_MS = 1200

// AWS Transcribe runs as an async job — the client polls for completion rather than getting the
// transcript back in the initial response. These control that polling once the real backend
// (see BACKEND_SPEECH_TO_TEXT_SPEC.md) is wired up.
export const TRANSCRIPTION_JOB_POLL_INTERVAL_MS = 2000
export const TRANSCRIPTION_JOB_POLL_TIMEOUT_MS = 60_000
