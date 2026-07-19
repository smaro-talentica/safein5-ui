import { Navigate, Outlet } from 'react-router-dom'
import type { Role } from '@/auth/model'
import { useAuth } from '@/hooks/useAuth'
import { ROLE_HOME, ROUTES } from './constant'

export function RoleGuard({ allow }: { allow: Role[] }) {
  const { user } = useAuth()

  if (!user) return <Navigate to={ROUTES.login} replace />
  if (!allow.includes(user.role)) return <Navigate to={ROLE_HOME[user.role]} replace />

  return <Outlet />
}

export function AuthedRedirect() {
  const { user } = useAuth()
  if (user) return <Navigate to={ROLE_HOME[user.role]} replace />
  return <Navigate to={ROUTES.login} replace />
}
