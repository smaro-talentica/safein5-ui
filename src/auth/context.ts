import { createContext } from 'react'
import type { AuthUser } from './model'

export type LoginResult = { ok: true; user: AuthUser } | { ok: false; error: string }

export type AuthContextValue = {
  user: AuthUser | null
  isAuthenticated: boolean
  login: (email: string, password: string) => LoginResult
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
