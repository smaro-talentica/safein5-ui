export const ROUTES = {
  root: '/',
  scan: '/scan',
  scanSuccess: '/scan/success',
  scanFail: '/scan/fail',
  uploadVideo: '/upload-video',
} as const

export const SCAN_SEGMENTS = {
  scan: 'scan',
  success: 'success',
  fail: 'fail',
} as const

export const UPLOAD_VIDEO_SEGMENT = 'upload-video'
