import { About } from '@/pages/About'
import { Home } from '@/pages/Home'
import { UploadVideo } from '@/pages/UploadVideo'
import { RouterProvider } from 'react-router-dom'
import { createBrowserRouter, Link, Outlet } from 'react-router-dom'

function RootLayout() {
  return (
    <div>
      <nav>
        <Link to="/">Home</Link> | <Link to="/about">About</Link> | <Link to="/upload">Upload</Link>
      </nav>
      <Outlet />
    </div>
  )
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'about', element: <About /> },
      { path: 'upload', element: <UploadVideo /> },
    ],
  },
])

export default function AppRoute() {
  return <RouterProvider router={router} />
}
