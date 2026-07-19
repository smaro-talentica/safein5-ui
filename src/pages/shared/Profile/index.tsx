import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/AppRoute/constant'
import { ROLE_LABELS } from '@/auth/accounts'

export function Profile() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) return null

  const handleLogout = () => {
    logout()
    navigate(ROUTES.login, { replace: true })
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-6">
      <div className="rounded-xl border border-slate-200 p-4">
        <p className="text-lg font-semibold text-slate-900">{user.name}</p>
        <p className="text-sm text-slate-500">{user.email}</p>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <dt className="text-slate-400">Role</dt>
          <dd className="text-slate-700">{ROLE_LABELS[user.role]}</dd>
          <dt className="text-slate-400">Organisation</dt>
          <dd className="text-slate-700">{user.orgName}</dd>
          <dt className="text-slate-400">Site</dt>
          <dd className="text-slate-700">{user.siteName}</dd>
        </dl>
      </div>
      <Button variant="outline" className="w-full" onClick={handleLogout}>
        Sign out
      </Button>
    </div>
  )
}
