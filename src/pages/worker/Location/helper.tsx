import type { LocationFix, LocationStatus, PermissionState } from './model'

// The raw status values are internal state names; label them for the panel.
// 'waiting' deliberately reads as still-working rather than failed — permission
// is granted and the watch is alive, the device just has no fix yet.
export function describeStatus(status: LocationStatus): string {
  switch (status) {
    case 'watching':
      return 'live — tracking'
    case 'locating':
      return 'starting…'
    case 'waiting':
      return 'waiting for a fix'
    case 'error':
      return 'error'
    default:
      return 'idle'
  }
}

// Geolocation, like the camera, is gated behind a secure context — it silently
// never resolves on plain HTTP. Treat "no navigator.geolocation" as unsupported
// rather than letting the call hang.
export function isGeolocationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator
}

// GeolocationPositionError codes are numeric; map them to something a person on a
// phone can act on. PERMISSION_DENIED is by far the most common in practice.
export function describeGeolocationError(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Permission denied — enable location access for this site in your browser settings.'
    case error.POSITION_UNAVAILABLE:
      return 'Position unavailable — the device could not get a fix. Try again outdoors.'
    case error.TIMEOUT:
      return 'Timed out before getting a fix. Try again.'
    default:
      return error.message || 'Could not get your location.'
  }
}

export function toLocationFix(position: GeolocationPosition): LocationFix {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    timestamp: position.timestamp,
    heading: position.coords.heading,
    speed: position.coords.speed,
  }
}

// Safari does not implement navigator.permissions.query() for geolocation (it
// rejects rather than returning a state), so the answer there is genuinely
// unknowable up front — report 'unknown' and let the UI fall back to showing
// the approve button until a real call proves otherwise.
export async function queryGeolocationPermission(): Promise<PermissionState> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) return 'unknown'
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
    return status.state as PermissionState
  } catch {
    return 'unknown'
  }
}

// A heading is only meaningful while actually moving; browsers report null (or
// NaN) when stationary or when positioning came from wifi/cell rather than GPS.
export function formatHeading(heading: number | null): string {
  if (heading === null || Number.isNaN(heading)) return '—'
  const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  const point = points[Math.round(heading / 45) % 8]
  return `${Math.round(heading)}° ${point}`
}

export function formatSpeed(metresPerSecond: number | null): string {
  if (metresPerSecond === null || Number.isNaN(metresPerSecond)) return '—'
  return `${(metresPerSecond * 3.6).toFixed(1)} km/h`
}

// Six decimal places ≈ 0.11 m at the equator — well past what consumer GPS resolves,
// and enough that the trailing digits stay meaningful rather than noise.
export function formatCoordinate(value: number): string {
  return value.toFixed(6)
}

export function formatAccuracy(metres: number): string {
  return metres >= 1000 ? `±${(metres / 1000).toFixed(1)} km` : `±${Math.round(metres)} m`
}

export function formatFixedAt(timestamp: number | null): string {
  if (timestamp === null) return '—'
  return new Date(timestamp).toLocaleTimeString()
}
