export type RunStatus = 'stopped' | 'running' | 'permission-denied'

export type AlertDiagnostics = {
  supported: boolean
  permission: NotificationPermission | 'unsupported'
  status: RunStatus
  fireCount: number
  lastFiredAt: number | null
  lastError: string | null
}
