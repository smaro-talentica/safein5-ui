import { useState } from 'react'

function detectMobile(): boolean {
  if (typeof navigator === 'undefined') return false

  const uaData = (
    navigator as Navigator & {
      userAgentData?: { mobile?: boolean }
    }
  ).userAgentData
  if (typeof uaData?.mobile === 'boolean') return uaData.mobile

  const ua = navigator.userAgent || ''
  const uaMatch = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)

  const iPadOS = ua.includes('Macintosh') && navigator.maxTouchPoints > 1

  const coarsePointer =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches

  return uaMatch || iPadOS || (coarsePointer && navigator.maxTouchPoints > 0)
}

export function useIsMobile(): boolean {
  const [isMobile] = useState<boolean>(detectMobile)
  return isMobile
}
