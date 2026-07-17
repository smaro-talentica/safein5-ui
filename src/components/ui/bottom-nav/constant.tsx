import { Film, ScanQrCode, Upload } from 'lucide-react'
import { ROUTES } from '@/AppRoute/constant'
import type { NavItem } from './model'

export const items: NavItem[] = [
  { to: ROUTES.scan, label: 'Scan', icon: ScanQrCode },
  { to: ROUTES.uploadVideo, label: 'Upload Video', icon: Upload },
  { to: ROUTES.videos, label: 'Video', icon: Film },
]
