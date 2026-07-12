import { cn } from '@/utils/cn'
import { ScanQrCode, Upload } from 'lucide-react'
import { NavLink } from 'react-router-dom'

type NavItem = {
  to: string
  label: string
  icon: typeof Upload
  /** Match only the exact path (used for the index-style route). */
  end?: boolean
}

const items: NavItem[] = [
  { to: '/upload', label: 'Upload', icon: Upload },
  { to: '/scan', label: 'Scan', icon: ScanQrCode },
]

/**
 * Fixed bottom navigation bar for the app's top-level screens. Presentational
 * only — navigation is delegated to React Router's NavLink.
 */
export function BottomNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
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
