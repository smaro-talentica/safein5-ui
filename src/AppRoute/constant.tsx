export const ROUTES = {
  root: '/',
  home: '/home',
  scan: '/scan',
  scanSuccess: '/scan/success',
  scanFail: '/scan/fail',
  capture: '/capture',
  feed: '/feed',
  learn: '/learn',
  profile: '/profile',
} as const

export const SCAN_SEGMENTS = {
  scan: 'scan',
  success: 'success',
  fail: 'fail',
} as const

export const HOME_SEGMENT = 'home'

export const CAPTURE_SEGMENT = 'capture'

export const FEED_SEGMENT = 'feed'

export const LEARN_SEGMENT = 'learn'

export const PROFILE_SEGMENT = 'profile'
