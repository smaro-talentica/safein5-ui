import type { JwtClaims, Role } from './model'

export type DemoAccount = {
  email: string
  password: string
  claims: Omit<JwtClaims, 'iat' | 'exp'>
}

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: 'worker@demo',
    password: 'demo',
    claims: {
      sub: 'user-worker-1',
      name: 'Alex Worker',
      email: 'worker@demo',
      role: 'worker',
      orgId: 'org-1',
      orgName: 'Yorkshire Stone Ltd',
      siteId: 'site-1',
      siteName: 'Leeds Quarry',
    },
  },
  {
    email: 'supervisor@demo',
    password: 'demo',
    claims: {
      sub: 'user-supervisor-1',
      name: 'Sam Supervisor',
      email: 'supervisor@demo',
      role: 'supervisor',
      orgId: 'org-1',
      orgName: 'Yorkshire Stone Ltd',
      siteId: 'site-1',
      siteName: 'Leeds Quarry',
    },
  },
  {
    email: 'admin@demo',
    password: 'demo',
    claims: {
      sub: 'user-admin-1',
      name: 'Robin Admin',
      email: 'admin@demo',
      role: 'admin',
      orgId: 'org-1',
      orgName: 'Yorkshire Stone Ltd',
      siteId: 'site-1',
      siteName: 'Leeds Quarry',
    },
  },
]

export function findAccount(email: string, password: string): DemoAccount | null {
  const normalized = email.trim().toLowerCase()
  return DEMO_ACCOUNTS.find((a) => a.email === normalized && a.password === password) ?? null
}

export function buildClaims(account: DemoAccount, nowMs: number): JwtClaims {
  const iat = Math.floor(nowMs / 1000)
  const exp = Math.floor((nowMs + TOKEN_TTL_MS) / 1000)
  return { ...account.claims, iat, exp }
}

export const ROLE_LABELS: Record<Role, string> = {
  worker: 'Worker',
  supervisor: 'Supervisor',
  admin: 'Admin',
}
