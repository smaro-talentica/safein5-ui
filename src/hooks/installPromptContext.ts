import { createContext } from 'react'

export type InstallPromptBucket =
  | 'installed'
  | 'firefox-android-unsupported'
  | 'opera-android'
  | 'ios-safari'
  | 'ios-other-webkit'
  | 'chromium-standard'

export type InstallPromptValue = {
  bucket: InstallPromptBucket
  canInstall: boolean
  installed: boolean
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable' | 'manual-fallback'>
}

export const InstallPromptContext = createContext<InstallPromptValue | null>(null)
