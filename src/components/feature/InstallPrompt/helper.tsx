const DISMISSED_KEY = 'safein5-install-prompt-dismissed'

export function isPromptDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === 'true'
  } catch {
    return false
  }
}

export function setPromptDismissed(): void {
  try {
    localStorage.setItem(DISMISSED_KEY, 'true')
  } catch {
    // ignore write failures (private mode, quota)
  }
}
