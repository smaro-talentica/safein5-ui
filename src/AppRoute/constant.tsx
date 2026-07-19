import type { Role } from '@/auth/model'

export const ROUTES = {
  root: '/',
  login: '/login',
  home: '/home',
  scan: '/scan',
  scanSuccess: '/scan/success',
  scanFail: '/scan/fail',
  capture: '/capture',
  feed: '/feed',
  learn: '/learn',
  profile: '/profile',
  dashboard: '/dashboard',
  signals: '/signals',
  analytics: '/analytics',
  tenants: '/tenants',
} as const

export const SCAN_SEGMENTS = {
  scan: 'scan',
  success: 'success',
  fail: 'fail',
} as const

export const LOGIN_SEGMENT = 'login'

export const HOME_SEGMENT = 'home'

export const CAPTURE_SEGMENT = 'capture'

export const FEED_SEGMENT = 'feed'

export const LEARN_SEGMENT = 'learn'

export const PROFILE_SEGMENT = 'profile'

export const DASHBOARD_SEGMENT = 'dashboard'

export const SIGNALS_SEGMENT = 'signals'

export const ANALYTICS_SEGMENT = 'analytics'

export const TENANTS_SEGMENT = 'tenants'

export const ROLE_HOME: Record<Role, string> = {
  worker: ROUTES.home,
  supervisor: ROUTES.dashboard,
  admin: ROUTES.analytics,
}
