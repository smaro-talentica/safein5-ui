import { SCAN_SEGMENTS } from '@/AppRoute/constant'
import type { ScanResult } from './model'

const RESERVED_SCAN_CODES: string[] = [SCAN_SEGMENTS.success, SCAN_SEGMENTS.fail]

export function resolveScanTarget(text: string): ScanResult {
  const value = text.trim()
  if (!value) return { kind: 'invalid' }

  let url: URL
  try {
    url = new URL(value)
  } catch {
    return { kind: 'invalid' }
  }

  const segments = url.pathname.split('/').filter(Boolean)
  if (segments.length !== 2 || segments[0] !== SCAN_SEGMENTS.scan) return { kind: 'invalid' }

  const id = decodeURIComponent(segments[1])
  if (!id.trim() || RESERVED_SCAN_CODES.includes(id)) return { kind: 'invalid' }

  return { kind: 'ok', id }
}
