import { lazy, Suspense } from 'react'
import { BottomNav } from '@/components/ui/bottom-nav'
import { InstallPrompt } from '@/components/feature/InstallPrompt'
import { VideoUploader } from '@/components/feature/VideoUploader'
import { AudioUploader } from '@/components/feature/AudioUploader'
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

const Login = lazy(() => import('@/pages/shared/Login').then((m) => ({ default: m.Login })))
const Profile = lazy(() => import('@/pages/shared/Profile').then((m) => ({ default: m.Profile })))
const ScanQr = lazy(() => import('@/pages/shared/ScanQr').then((m) => ({ default: m.ScanQr })))
const ScanSuccess = lazy(() =>
  import('@/pages/shared/ScanQr/sub-pages/ScanSuccess').then((m) => ({ default: m.ScanSuccess })),
)
const ScanFail = lazy(() =>
  import('@/pages/shared/ScanQr/sub-pages/ScanFail').then((m) => ({ default: m.ScanFail })),
)
const Home = lazy(() => import('@/pages/worker/Home').then((m) => ({ default: m.Home })))
const Feed = lazy(() => import('@/pages/worker/Feed').then((m) => ({ default: m.Feed })))
const Capture = lazy(() => import('@/pages/worker/Capture').then((m) => ({ default: m.Capture })))
const Learn = lazy(() => import('@/pages/worker/Learn').then((m) => ({ default: m.Learn })))
const Dashboard = lazy(() =>
  import('@/pages/supervisor/Dashboard').then((m) => ({ default: m.Dashboard })),
)
const Signals = lazy(() =>
  import('@/pages/supervisor/Signals').then((m) => ({ default: m.Signals })),
)
const Analytics = lazy(() =>
  import('@/pages/admin/Analytics').then((m) => ({ default: m.Analytics })),
)
const Tenants = lazy(() => import('@/pages/admin/Tenants').then((m) => ({ default: m.Tenants })))
const NotFound = lazy(() =>
  import('@/pages/shared/NotFound').then((m) => ({ default: m.NotFound })),
)

function PageFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center p-6">
      <p className="text-sm text-slate-500">Loading…</p>
    </div>
  )
}

function RootLayout() {
  const matches = useMatches()
  const showNav = shouldShowNav(matches)

  return (
    <div className={cn('flex h-dvh flex-col overflow-hidden bg-background')}>
      <main className={cn('min-h-0 flex-1 overflow-y-auto')}>
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
      </main>
      <InstallPrompt />
      {showNav && <BottomNav />}
    </div>
  )
}

const notFoundElement = (
  <Suspense fallback={<PageFallback />}>
    <NotFound />
  </Suspense>
)

const router = createBrowserRouter([
  {
    path: ROUTES.login,
    element: (
      <Suspense fallback={<PageFallback />}>
        <Login />
      </Suspense>
    ),
    errorElement: notFoundElement,
    handle: { hideNav: true } satisfies RouteHandle,
  },
  {
    path: ROUTES.root,
    element: <RootLayout />,
    errorElement: notFoundElement,
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
              {
                path: SCAN_SEGMENTS.code,
                element: <ScanQr />,
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
      {
        path: '*',
        element: notFoundElement,
        handle: { hideNav: true } satisfies RouteHandle,
      },
    ],
  },
])

export default function AppRoute() {
  return (
    <AuthProvider>
      <InstallPromptProvider>
        <VideoUploader />
        <AudioUploader />
        <RouterProvider router={router} />
      </InstallPromptProvider>
    </AuthProvider>
  )
}
