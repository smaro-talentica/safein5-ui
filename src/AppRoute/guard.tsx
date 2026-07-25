import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { Role } from '@/auth/model'
import { useAuth } from '@/hooks/useAuth'
import { ROLE_HOME, ROUTES } from './constant'
import type { LoginLocationState } from './model'

export function RoleGuard({ allow }: { allow: Role[] }) {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    const from = `${location.pathname}${location.search}`
    const state: LoginLocationState = { from }
    return <Navigate to={ROUTES.login} state={state} replace />
  }
  if (!allow.includes(user.role)) return <Navigate to={ROLE_HOME[user.role]} replace />

  return <Outlet />
}

export function AuthedRedirect() {
  const { user } = useAuth()
  if (user) return <Navigate to={ROLE_HOME[user.role]} replace />
  return <Navigate to={ROUTES.login} replace />
}
