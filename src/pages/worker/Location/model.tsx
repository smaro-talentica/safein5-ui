// 'waiting' is distinct from 'error': the watch is alive and permission is fine,
// the device just hasn't produced a fix yet (indoors, cold GPS start, tunnel).
// Collapsing it into 'error' wrongly implies the permission was refused.
export type LocationStatus = 'idle' | 'locating' | 'watching' | 'waiting' | 'error'

// 'unknown' covers Safari, which does not implement
// navigator.permissions.query({ name: 'geolocation' }) — the state is only
// discoverable there by actually calling the geolocation API.
export type PermissionState = 'unknown' | 'prompt' | 'granted' | 'denied'

export type LocationFix = {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: number
  // Present only when the device reports movement; null on a stationary fix
  // and on desktop/wifi positioning, which never populate them.
  heading: number | null
  speed: number | null
}

export type LocationDiagnostics = {
  supported: boolean
  permission: PermissionState
  status: LocationStatus
  fix: LocationFix | null
  updateCount: number
  error: string | null
}
