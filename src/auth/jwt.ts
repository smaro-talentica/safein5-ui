import type { JwtClaims } from './model'
import { ROLES } from './model'

function base64UrlEncode(input: string): string {
  const base64 = btoa(unescape(encodeURIComponent(input)))
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(input: string): string {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  return decodeURIComponent(escape(atob(padded)))
}

export function encodeJwt(claims: JwtClaims): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'none', typ: 'JWT' }))
  const payload = base64UrlEncode(JSON.stringify(claims))
  return `${header}.${payload}.`
}

function isValidClaims(value: unknown): value is JwtClaims {
  if (typeof value !== 'object' || value === null) return false
  const c = value as Record<string, unknown>
  return (
    typeof c.sub === 'string' &&
    typeof c.name === 'string' &&
    typeof c.email === 'string' &&
    typeof c.role === 'string' &&
    (ROLES as readonly string[]).includes(c.role) &&
    typeof c.orgId === 'string' &&
    typeof c.orgName === 'string' &&
    typeof c.siteId === 'string' &&
    typeof c.siteName === 'string' &&
    typeof c.iat === 'number' &&
    typeof c.exp === 'number'
  )
}

export function decodeJwt(token: string): JwtClaims | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(base64UrlDecode(parts[1]))
  } catch {
    return null
  }

  if (!isValidClaims(parsed)) return null
  return parsed
}

export function isExpired(claims: JwtClaims, nowMs: number): boolean {
  return claims.exp * 1000 <= nowMs
}
