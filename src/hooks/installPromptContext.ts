import { createContext } from 'react'

export type InstallPromptValue = {
  canInstall: boolean
  installed: boolean
  isIos: boolean
  isAndroidManualInstall: boolean
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>
}

export const InstallPromptContext = createContext<InstallPromptValue | null>(null)
