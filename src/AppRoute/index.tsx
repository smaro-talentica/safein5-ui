import { BottomNav } from '@/components/ui/bottom-nav'
import { InstallPrompt } from '@/components/feature/InstallPrompt'
import { VideoUploader } from '@/components/feature/VideoUploader'
import { ScanFail } from '@/pages/shared/ScanQr/sub-pages/ScanFail'
import { ScanSuccess } from '@/pages/shared/ScanQr/sub-pages/ScanSuccess'
import { ScanQr } from '@/pages/shared/ScanQr'
import { Login } from '@/pages/shared/Login'
import { Profile } from '@/pages/shared/Profile'
import { Home } from '@/pages/worker/Home'
import { Capture } from '@/pages/worker/Capture'
import { Feed } from '@/pages/worker/Feed'
import { Learn } from '@/pages/worker/Learn'
import { Dashboard } from '@/pages/supervisor/Dashboard'
import { Signals } from '@/pages/supervisor/Signals'
import { Analytics } from '@/pages/admin/Analytics'
import { Tenants } from '@/pages/admin/Tenants'
import { RouterProvider, useMatches } from 'react-router-dom'
import { createBrowserRouter, Outlet } from 'react-router-dom'
import { cn } from '@/utils/cn'
import { AuthProvider } from '@/auth/AuthProvider'
import { InstallPromptProvider } from '@/hooks/InstallPromptProvider'
import { AuthedRedirect, RoleGuard } from './guard'
import {
  ANALYTICS_SEGMENT,
  CAPTURE_SEGMENT,
  DASHBOARD_SEGMENT,
  FEED_SEGMENT,
  HOME_SEGMENT,
  LEARN_SEGMENT,
  PROFILE_SEGMENT,
  ROUTES,
  SCAN_SEGMENTS,
  SIGNALS_SEGMENT,
  TENANTS_SEGMENT,
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
    path: ROUTES.login,
    element: <Login />,
    handle: { hideNav: true } satisfies RouteHandle,
  },
  {
    path: ROUTES.root,
    element: <RootLayout />,
    children: [
      { index: true, element: <AuthedRedirect /> },
      {
        element: <RoleGuard allow={['worker', 'supervisor', 'admin']} />,
        children: [
          { path: PROFILE_SEGMENT, element: <Profile /> },
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
        ],
      },
      {
        element: <RoleGuard allow={['worker']} />,
        children: [
          { path: HOME_SEGMENT, element: <Home /> },
          { path: FEED_SEGMENT, element: <Feed /> },
          { path: CAPTURE_SEGMENT, element: <Capture /> },
          { path: LEARN_SEGMENT, element: <Learn /> },
        ],
      },
      {
        element: <RoleGuard allow={['supervisor']} />,
        children: [
          { path: DASHBOARD_SEGMENT, element: <Dashboard /> },
          { path: SIGNALS_SEGMENT, element: <Signals /> },
        ],
      },
      {
        element: <RoleGuard allow={['admin']} />,
        children: [
          { path: ANALYTICS_SEGMENT, element: <Analytics /> },
          { path: TENANTS_SEGMENT, element: <Tenants /> },
        ],
      },
    ],
  },
])

export default function AppRoute() {
  return (
    <AuthProvider>
      <InstallPromptProvider>
        <VideoUploader />
        <RouterProvider router={router} />
      </InstallPromptProvider>
    </AuthProvider>
  )
}
