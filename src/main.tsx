import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { registerSW } from 'virtual:pwa-register'
import AppRoute from './AppRoute'
import { uploadManager } from './utils/upload/uploadManager'
import './global.css'

const queryClient = new QueryClient()

// Register the service worker (precaching + Background Fetch upload support).
registerSW({ immediate: true })

// Resume any uploads that were in progress when the app was last closed.
void uploadManager.resumeAll()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppRoute />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>,
)
