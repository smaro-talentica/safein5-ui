import {
  BarChart3,
  BookOpen,
  Building2,
  CirclePlus,
  Home,
  LayoutDashboard,
  Rss,
  ScanQrCode,
  Siren,
  User,
} from 'lucide-react'
import { ROUTES } from '@/AppRoute/constant'
import type { Role } from '@/auth/model'
import type { NavItem } from './model'

const worker: NavItem[] = [
  { to: ROUTES.home, label: 'Home', icon: Home },
  { to: ROUTES.scan, label: 'Scan', icon: ScanQrCode },
  { to: ROUTES.feed, label: 'Feed', icon: Rss },
  { to: ROUTES.capture, label: 'Capture', icon: CirclePlus },
  { to: ROUTES.learn, label: 'Learn', icon: BookOpen },
  { to: ROUTES.profile, label: 'Profile', icon: User },
]

const supervisor: NavItem[] = [
  { to: ROUTES.dashboard, label: 'Dashboard', icon: LayoutDashboard },
  { to: ROUTES.signals, label: 'Signals', icon: Siren },
  { to: ROUTES.profile, label: 'Profile', icon: User },
]

const admin: NavItem[] = [
  { to: ROUTES.analytics, label: 'Analytics', icon: BarChart3 },
  { to: ROUTES.tenants, label: 'Tenants', icon: Building2 },
  { to: ROUTES.profile, label: 'Profile', icon: User },
]

export const navItemsByRole: Record<Role, NavItem[]> = { worker, supervisor, admin }
