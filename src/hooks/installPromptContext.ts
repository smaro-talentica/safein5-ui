import { createContext } from 'react'

export type InstallPromptValue = {
  canInstall: boolean
  installed: boolean
  isIos: boolean
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>
}

export const InstallPromptContext = createContext<InstallPromptValue | null>(null)
