import { BottomNav } from '@/components/ui/bottom-nav'
import { ScanFailed } from '@/pages/ScanFailed'
import { ScanLanding } from '@/pages/ScanLanding'
import { ScanQr } from '@/pages/ScanQr'
import { UploadVideo } from '@/pages/UploadVideo'
import { Navigate, RouterProvider } from 'react-router-dom'
import { createBrowserRouter, Outlet } from 'react-router-dom'

function RootLayout() {
  return (
    <div className="min-h-dvh pb-16">
      <Outlet />
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
      { path: 'upload', element: <UploadVideo /> },
      { path: 'scan', element: <ScanQr /> },
      { path: 'landing', element: <ScanLanding /> },
      { path: 'failed', element: <ScanFailed /> },
    ],
  },
])

export default function AppRoute() {
  return <RouterProvider router={router} />
}
