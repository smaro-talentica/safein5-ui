export const env = {
  appEnv: import.meta.env.VITE_APP_ENV,
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
  sttEndpointUrl: import.meta.env.VITE_STT_ENDPOINT_URL,
} as const

export const isDevelopment = env.appEnv === 'development'
export const isStaging = env.appEnv === 'staging'
export const isProduction = env.appEnv === 'production'
