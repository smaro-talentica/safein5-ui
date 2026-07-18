import type { ScanResult } from './model'

export function resolveScanTarget(text: string): ScanResult {
  const value = text.trim()
  if (!value) return { kind: 'invalid' }

  let payload: unknown
  try {
    payload = JSON.parse(value)
  } catch {
    return { kind: 'invalid' }
  }

  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('id' in payload) ||
    typeof (payload as { id: unknown }).id !== 'string' ||
    !(payload as { id: string }).id.trim()
  ) {
    return { kind: 'invalid' }
  }

  return { kind: 'ok', id: (payload as { id: string }).id }
}
