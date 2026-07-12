import { useState } from 'react'

/**
 * Detects whether the current device is a phone/tablet (touch-first) as
 * opposed to a laptop/desktop. Combines a UA-Client-Hints check (when
 * available) with a user-agent regex and a coarse-pointer media query so it
 * works on Android, iOS, and installed PWAs.
 */
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

  // iPadOS reports a desktop UA but is touch-first.
  const iPadOS = ua.includes('Macintosh') && navigator.maxTouchPoints > 1

  const coarsePointer =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches

  return uaMatch || iPadOS || (coarsePointer && navigator.maxTouchPoints > 0)
}

export function useIsMobile(): boolean {
  // Device class doesn't change within a session, so detect once on mount.
  const [isMobile] = useState<boolean>(detectMobile)
  return isMobile
}
