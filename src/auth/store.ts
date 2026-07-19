import type { AuthUser } from './model'
import { decodeJwt, isExpired } from './jwt'

const TOKEN_KEY = 'safein5-token'

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // ignore write failures (private mode, quota)
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // ignore
  }
}

export function readUser(nowMs: number): AuthUser | null {
  const token = getToken()
  if (!token) return null

  const claims = decodeJwt(token)
  if (!claims || isExpired(claims, nowMs)) {
    clearToken()
    return null
  }

  return {
    id: claims.sub,
    name: claims.name,
    email: claims.email,
    role: claims.role,
    orgId: claims.orgId,
    orgName: claims.orgName,
    siteId: claims.siteId,
    siteName: claims.siteName,
  }
}
