import type { UIMatch } from 'react-router-dom'
import { ROUTES } from './constant'
import type { RouteHandle } from './model'

export const to = {
  scanAuto: (): string => `${ROUTES.scan}?auto=1`,
  scanSuccess: (id: string): string => `${ROUTES.scanSuccess}?id=${encodeURIComponent(id)}`,
} as const

export function shouldShowNav(matches: UIMatch[]): boolean {
  return !matches.some((match) => (match.handle as RouteHandle | undefined)?.hideNav === true)
}
