import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  InstallPromptContext,
  type InstallPromptBucket,
  type InstallPromptValue,
} from './installPromptContext'

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  prompt: () => Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const iOsDevice = /iPhone|iPad|iPod/.test(ua)
  const iPadOs = ua.includes('Macintosh') && navigator.maxTouchPoints > 1
  return iOsDevice || iPadOs
}

// Every non-Safari iOS browser is required by Apple to run on WebKit, but each still
// stamps its own stable UA token (Apple-enforced, used so servers can tell them apart).
// Only these carry an "Add to Home Screen" option in their Safari-equivalent UI; none
// of the wrappers below expose it, so they need to be told to switch to Safari instead.
function isIosOtherWebkitBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /CriOS|EdgiOS|OPT|FxiOS/.test(ua)
}

function isAndroidFirefoxBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /Android/i.test(ua) && /Firefox/i.test(ua)
}

// Opera Mobile is Chromium-based but does not reliably fire beforeinstallprompt
// (reported on Opera's own forums). Unlike Firefox, which has no install path at all,
// Opera IS PWA-capable — so it gets an optimistic Install button with a manual
// fallback decided at click-time, rather than being told it's unsupported.
function isAndroidOperaBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /Android/i.test(ua) && /(OPR\/|Opera)/i.test(ua)
}

export function InstallPromptProvider({ children }: { children: ReactNode }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState<boolean>(isStandalone)

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
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

  const bucket = useMemo<InstallPromptBucket>(() => {
    if (installed) return 'installed'
    if (isAndroidFirefoxBrowser()) return 'firefox-android-unsupported'
    if (isAndroidOperaBrowser()) return 'opera-android'
    if (isIosDevice()) return isIosOtherWebkitBrowser() ? 'ios-other-webkit' : 'ios-safari'
    return 'chromium-standard'
  }, [installed])

  const value = useMemo<InstallPromptValue>(
    () => ({
      bucket,
      installed,
      canInstall:
        !installed &&
        (bucket === 'opera-android' || (bucket === 'chromium-standard' && deferred !== null)),
      promptInstall: async () => {
        if (!deferred) return bucket === 'opera-android' ? 'manual-fallback' : 'unavailable'
        await deferred.prompt()
        const { outcome } = await deferred.userChoice
        setDeferred(null)
        return outcome
      },
    }),
    [bucket, installed, deferred],
  )

  return <InstallPromptContext.Provider value={value}>{children}</InstallPromptContext.Provider>
}
