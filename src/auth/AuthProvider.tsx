import { useCallback, useMemo, useState, type ReactNode } from 'react'
import type { AuthUser } from './model'
import { buildClaims, findAccount } from './accounts'
import { AuthContext, type AuthContextValue, type LoginResult } from './context'
import { encodeJwt } from './jwt'
import { clearToken, readUser, setToken } from './store'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => readUser(Date.now()))

  const login = useCallback((email: string, password: string): LoginResult => {
    const account = findAccount(email, password)
    if (!account) return { ok: false, error: 'Invalid email or password.' }

    const token = encodeJwt(buildClaims(account, Date.now()))
    setToken(token)
    const nextUser = readUser(Date.now())
    setUser(nextUser)
    if (!nextUser) return { ok: false, error: 'Could not establish a session.' }
    return { ok: true, user: nextUser }
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, isAuthenticated: user !== null, login, logout }),
    [user, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
