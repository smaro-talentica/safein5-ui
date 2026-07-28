import type { TrimJobTrigger } from './model'

let trigger: TrimJobTrigger | null = null

export function registerTrimJobTrigger(cb: TrimJobTrigger): void {
  trigger = cb
}

export function unregisterTrimJobTrigger(): void {
  trigger = null
}

export function notifyTrimJobPending(): void {
  trigger?.()
}
