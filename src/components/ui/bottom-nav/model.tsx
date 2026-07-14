import { type ScanQrCode } from 'lucide-react'

export type NavItem = {
  to: string
  label: string
  icon: typeof ScanQrCode
  end?: boolean
}
