import { ScanQrCode } from 'lucide-react'
import { ROUTES } from '@/AppRoute/constant'
import type { NavItem } from './model'

export const items: NavItem[] = [{ to: ROUTES.scan, label: 'Scan', icon: ScanQrCode }]
