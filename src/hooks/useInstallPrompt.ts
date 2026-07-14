import { useEffect, useState } from 'react'

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

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const iOsDevice = /iPhone|iPad|iPod/.test(ua)
  const iPadOs = ua.includes('Macintosh') && navigator.maxTouchPoints > 1
  return iOsDevice || iPadOs
}

export type InstallPrompt = {
  canInstall: boolean
  installed: boolean
  isIos: boolean
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>
}

export function useInstallPrompt(): InstallPrompt {
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

  const promptInstall = async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferred) return 'unavailable'
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
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
