import { BottomNav } from '@/components/ui/bottom-nav'
import { InstallPrompt } from '@/components/feature/InstallPrompt'
import { ScanFail } from '@/pages/ScanFail'
import { ScanSuccess } from '@/pages/ScanSuccess'
import { ScanQr } from '@/pages/ScanQr'
import { Navigate, RouterProvider } from 'react-router-dom'
import { createBrowserRouter, Outlet } from 'react-router-dom'
import { cn } from '@/utils/cn'

function RootLayout() {
  return (
    <div className={cn('flex h-dvh flex-col overflow-hidden bg-background')}>
      <main className={cn('min-h-0 flex-1 overflow-y-auto')}>
        <Outlet />
      </main>
      <InstallPrompt />
      <BottomNav />
    </div>
  )
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <Navigate to="/scan" replace /> },
      {
        path: 'scan',
        children: [
          { index: true, element: <ScanQr /> },
          { path: 'success', element: <ScanSuccess /> },
          { path: 'fail', element: <ScanFail /> },
        ],
      },
    ],
  },
])

export default function AppRoute() {
  return <RouterProvider router={router} />
}
