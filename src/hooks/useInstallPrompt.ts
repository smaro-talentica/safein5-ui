import { useEffect, useState } from 'react'

/**
 * The `beforeinstallprompt` event (Chromium only). Not in the standard TS DOM
 * lib, so typed locally. Chrome fires it when the app meets its install
 * criteria (valid manifest + active service worker + user engagement); we
 * capture it and re-dispatch the prompt on demand from our own UI.
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  prompt: () => Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** True when the page is already running as an installed (standalone) PWA. */
function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari uses a non-standard navigator flag instead of display-mode.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/** True for iOS, where there is no `beforeinstallprompt` — install is manual. */
function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const iOsDevice = /iPhone|iPad|iPod/.test(ua)
  // iPadOS reports a desktop UA but is still an install-via-Share-sheet device.
  const iPadOs = ua.includes('Macintosh') && navigator.maxTouchPoints > 1
  return iOsDevice || iPadOs
}

export type InstallPrompt = {
  /** Chromium can show a native install prompt right now (call `promptInstall`). */
  canInstall: boolean
  /** The app is already installed / running standalone — don't nag the user. */
  installed: boolean
  /** iOS device: no programmatic prompt exists; show manual instructions. */
  isIos: boolean
  /**
   * Trigger the browser's install prompt. Resolves to the user's choice, or
   * `'unavailable'` if no captured prompt was available. Safe to call anytime.
   */
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>
}

/**
 * Drives a custom "install this app" affordance. Captures Chromium's
 * `beforeinstallprompt` so the app can offer installation on its own terms
 * (e.g. a banner shown on every visit until the user installs), rather than
 * relying on the browser's one-shot mini-infobar.
 *
 * Note: `canInstall` only becomes true once the browser fires the event, which
 * requires the PWA to be installable AND some user engagement — it will not be
 * true on the very first paint. iOS never fires it (`isIos` covers that case
 * with manual instructions).
 */
export function useInstallPrompt(): InstallPrompt {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState<boolean>(isStandalone)

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      // Prevent Chrome's own mini-infobar so ours is the only prompt.
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const promptInstall = async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferred) return 'unavailable'
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    // The event can only be used once; drop it so the button hides after use.
    setDeferred(null)
    return outcome
  }

  return {
    canInstall: !installed && deferred !== null,
    installed,
    isIos: !installed && isIos(),
    promptInstall,
  }
}
