/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV: 'development' | 'staging' | 'production'
  readonly VITE_API_BASE_URL: string
  readonly VITE_STT_ENDPOINT_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Build-time constants injected via `define` in vite.config.ts.
declare const __APP_VERSION__: string
declare const __APP_COMMIT__: string
declare const __APP_BUILD_TIME__: string
