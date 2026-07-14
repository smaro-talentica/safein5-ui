/**
 * Layout — primary app-shell for the SafeIn5 UI PWA.
 *
 * Source: textual UX description (no Stitch / image input).
 * Intended placement: app-shell. Either src/components/feature/Layout/ or wired
 *   directly into src/AppRoute/index.tsx as the RootLayout replacement (see report).
 * Assumed-but-existing shadcn/repo primitives: BottomNav from "@/components/ui/bottom-nav".
 *   No new shadcn primitives required.
 *
 * Behavior:
 *   - Two vertical sections in a flex column that fills the dynamic viewport height.
 *   - Top = main content (renders `children`); the ONLY scrollable region.
 *   - Bottom = navbar (optional via `showNavbar`, default true).
 *   - Outer shell never scrolls (overflow-hidden); only <main> scrolls on overflow.
 */
import * as React from 'react'
import { BottomNav } from '@/components/ui/bottom-nav'
import { cn } from '@/utils/cn'

export interface LayoutProps {
  /** Page content rendered in the scrollable main region (a page or <Outlet />). */
  children: React.ReactNode
  /** When true (default) the bottom navbar is rendered and pinned to the bottom. */
  showNavbar?: boolean
  /** Extra classes to extend the outer shell. */
  className?: string
}

export function Layout({ children, showNavbar = true, className }: LayoutProps) {
  return (
    <div className={cn('flex h-dvh flex-col overflow-hidden bg-background', className)}>
      <main className={cn('min-h-0 flex-1 overflow-y-auto')}>{children}</main>
      {showNavbar ? <BottomNav /> : null}
    </div>
  )
}

export default Layout
