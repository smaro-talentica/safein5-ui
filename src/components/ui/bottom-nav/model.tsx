import { type ScanQrCode } from 'lucide-react'

export type NavItem = {
  to: string
  label: string
  icon: typeof ScanQrCode
  /** Match only the exact path (used for the index-style route). */
  end?: boolean
}
