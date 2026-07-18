import { BottomNav } from '@/components/ui/bottom-nav'
import { InstallPrompt } from '@/components/feature/InstallPrompt'
import { ScanFail } from '@/pages/shared/ScanQr/sub-pages/ScanFail'
import { ScanSuccess } from '@/pages/shared/ScanQr/sub-pages/ScanSuccess'
import { ScanQr } from '@/pages/shared/ScanQr'
import { Home } from '@/pages/worker/Home'
import { Capture } from '@/pages/worker/Capture'
import { Feed } from '@/pages/worker/Feed'
import { Learn } from '@/pages/worker/Learn'
import { Profile } from '@/pages/worker/Profile'
import { Navigate, RouterProvider, useMatches } from 'react-router-dom'
import { createBrowserRouter, Outlet } from 'react-router-dom'
import { cn } from '@/utils/cn'
import {
  CAPTURE_SEGMENT,
  FEED_SEGMENT,
  HOME_SEGMENT,
  LEARN_SEGMENT,
  PROFILE_SEGMENT,
  ROUTES,
  SCAN_SEGMENTS,
} from './constant'
import { shouldShowNav } from './helper'
import type { RouteHandle } from './model'

function RootLayout() {
  const matches = useMatches()
  const showNav = shouldShowNav(matches)

  return (
    <div className={cn('flex h-dvh flex-col overflow-hidden bg-background')}>
      <main className={cn('min-h-0 flex-1 overflow-y-auto')}>
        <Outlet />
      </main>
      <InstallPrompt />
      {showNav && <BottomNav />}
    </div>
  )
}

const router = createBrowserRouter([
  {
    path: ROUTES.root,
    element: <RootLayout />,
    children: [
      { index: true, element: <Navigate to={ROUTES.scan} replace /> },
      {
        path: HOME_SEGMENT,
        element: <Home />,
      },
      {
        path: SCAN_SEGMENTS.scan,
        children: [
          { index: true, element: <ScanQr /> },
          {
            path: SCAN_SEGMENTS.success,
            element: <ScanSuccess />,
            handle: { hideNav: true } satisfies RouteHandle,
          },
          {
            path: SCAN_SEGMENTS.fail,
            element: <ScanFail />,
            handle: { hideNav: true } satisfies RouteHandle,
          },
        ],
      },
      {
        path: FEED_SEGMENT,
        element: <Feed />,
      },
      {
        path: CAPTURE_SEGMENT,
        element: <Capture />,
      },
      {
        path: LEARN_SEGMENT,
        element: <Learn />,
      },
      {
        path: PROFILE_SEGMENT,
        element: <Profile />,
      },
    ],
  },
])

export default function AppRoute() {
  return <RouterProvider router={router} />
}
