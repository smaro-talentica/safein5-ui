import { Button } from '@/components/ui/button'
import { InstallPrompt } from '@/components/feature/InstallPrompt'
import { useAuth } from '@/hooks/useAuth'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROLE_HOME } from '@/AppRoute/constant'
import { DEMO_ACCOUNTS } from '@/auth/accounts'
import { cn } from '@/utils/cn'

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const result = login(email, password)
    if (!result.ok) {
      setError(result.error)
      return
    }
    navigate(ROLE_HOME[result.user.role], { replace: true })
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 p-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-slate-900">SafeIn5</h1>
        <p className="text-sm text-slate-500">Sign in to continue</p>
      </div>

      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          autoComplete="username"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          autoComplete="current-password"
        />
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        <Button type="submit" className="w-full">
          Sign in
        </Button>
      </form>

      <div className="flex flex-col gap-2">
        <p className="text-center text-xs text-slate-400">Demo accounts (password: demo)</p>
        <div className="grid grid-cols-3 gap-2">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => {
                setEmail(account.email)
                setPassword(account.password)
                setError(null)
              }}
              className={cn(
                'rounded-lg border border-slate-200 px-2 py-2 text-xs font-medium text-slate-600',
                'hover:bg-slate-50',
              )}
            >
              {account.claims.role}
            </button>
          ))}
        </div>
      </div>

      <InstallPrompt />
    </div>
  )
}
