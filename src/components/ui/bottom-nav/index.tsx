import { cn } from '@/utils/cn'
import { NavLink } from 'react-router-dom'
import { items } from './constant'

export function BottomNav() {
  return (
    <nav
      className="shrink-0 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      aria-label="Primary"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {items.map(({ to, label, icon: Icon, end }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors',
                  isActive ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600',
                )
              }
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
