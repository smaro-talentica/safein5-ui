import { cn } from '@/utils/cn'
import { formatBuildTime } from './helper'
import type { BuildStampProps } from './model'

/**
 * Shows which build is currently live. The commit SHA is the useful part when
 * checking "did my deploy land?" — package.json's version only changes when
 * someone bumps it by hand.
 */
export function BuildStamp({ className }: BuildStampProps) {
  return (
    <p className={cn('text-center text-[11px] text-slate-400', className)}>
      v{__APP_VERSION__} · {__APP_COMMIT__} · {formatBuildTime(__APP_BUILD_TIME__)}
    </p>
  )
}
