export const ROLES = ['worker', 'supervisor', 'admin'] as const

export type Role = (typeof ROLES)[number]

export type JwtClaims = {
  sub: string
  name: string
  email: string
  role: Role
  orgId: string
  orgName: string
  siteId: string
  siteName: string
  iat: number
  exp: number
}

export type AuthUser = {
  id: string
  name: string
  email: string
  role: Role
  orgId: string
  orgName: string
  siteId: string
  siteName: string
}
