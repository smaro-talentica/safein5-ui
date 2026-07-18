import { BookOpen, CirclePlus, Home, Rss, ScanQrCode, User } from 'lucide-react'
import { ROUTES } from '@/AppRoute/constant'
import type { NavItem } from './model'

export const items: NavItem[] = [
  { to: ROUTES.home, label: 'Home', icon: Home },
  { to: ROUTES.scan, label: 'Scan', icon: ScanQrCode },
  { to: ROUTES.feed, label: 'Feed', icon: Rss },
  { to: ROUTES.capture, label: 'Capture', icon: CirclePlus },
  { to: ROUTES.learn, label: 'Learn', icon: BookOpen },
  { to: ROUTES.profile, label: 'Profile', icon: User },
]
