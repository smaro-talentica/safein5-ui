import { useContext } from 'react'
import { InstallPromptContext, type InstallPromptValue } from './installPromptContext'

export type InstallPrompt = InstallPromptValue

export function useInstallPrompt(): InstallPrompt {
  const ctx = useContext(InstallPromptContext)
  if (!ctx) throw new Error('useInstallPrompt must be used within an InstallPromptProvider')
  return ctx
}
