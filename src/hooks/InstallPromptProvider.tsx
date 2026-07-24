import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { InstallPromptContext, type InstallPromptValue } from './installPromptContext'

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

function isAndroidFirefoxBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /Android/i.test(ua) && /Firefox/i.test(ua)
}

// Opera Mobile is Chromium-based but does not reliably fire beforeinstallprompt
// (reported on Opera's own forums), so it needs the same manual-instructions fallback
// as Firefox rather than relying on the native prompt.
function isAndroidOperaBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /Android/i.test(ua) && /(OPR\/|Opera)/i.test(ua)
}

// Edge Android also does not reliably fire beforeinstallprompt (reported on Microsoft's
// own community/Q&A forums) and its "..." menu install often just creates a shortcut
// rather than a true install, so it gets the same manual-instructions fallback.
function isAndroidEdgeBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /Android/i.test(ua) && /EdgA/i.test(ua)
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

  const value = useMemo<InstallPromptValue>(
    () => ({
      canInstall: !installed && deferred !== null,
      installed,
      isIos: !installed && isIosDevice(),
      isAndroidManualInstall:
        !installed &&
        deferred === null &&
        (isAndroidFirefoxBrowser() || isAndroidOperaBrowser() || isAndroidEdgeBrowser()),
      promptInstall: async () => {
        if (!deferred) return 'unavailable'
        await deferred.prompt()
        const { outcome } = await deferred.userChoice
        setDeferred(null)
        return outcome
      },
    }),
    [installed, deferred],
  )

  return <InstallPromptContext.Provider value={value}>{children}</InstallPromptContext.Provider>
}
