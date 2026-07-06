import { UploadVideo } from '@/pages/UploadVideo'
import { RouterProvider } from 'react-router-dom'
import { createBrowserRouter, Outlet } from 'react-router-dom'

function RootLayout() {
  return <Outlet />
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <UploadVideo /> },
      { path: 'upload', element: <UploadVideo /> },
    ],
  },
])

export default function AppRoute() {
  return <RouterProvider router={router} />
}
