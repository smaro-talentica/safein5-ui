import { BottomNav } from '@/components/ui/bottom-nav'
import { InstallPrompt } from '@/components/feature/InstallPrompt'
import { ScanFail } from '@/pages/ScanQr/sub-pages/ScanFail'
import { ScanSuccess } from '@/pages/ScanQr/sub-pages/ScanSuccess'
import { ScanQr } from '@/pages/ScanQr'
import { UploadVideo } from '@/pages/UploadVideo'
import { Navigate, RouterProvider, useMatches } from 'react-router-dom'
import { createBrowserRouter, Outlet } from 'react-router-dom'
import { cn } from '@/utils/cn'
import { ROUTES, SCAN_SEGMENTS, UPLOAD_VIDEO_SEGMENT } from './constant'
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
        path: UPLOAD_VIDEO_SEGMENT,
        element: <UploadVideo />,
      },
    ],
  },
])

export default function AppRoute() {
  return <RouterProvider router={router} />
}
