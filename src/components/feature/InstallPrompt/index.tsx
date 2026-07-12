import { useInstallPrompt } from '@/hooks/useInstallPrompt'
import { cn } from '@/utils/cn'
import { Download, Share, X } from 'lucide-react'
import { useState } from 'react'

/**
 * App-wide "install this app" banner. Fixed above the bottom nav, it appears
 * whenever the app is installable but not yet installed:
 *  - Chromium (Android Chrome / desktop Chrome/Edge): a real install button that
 *    triggers the browser prompt via the captured `beforeinstallprompt` event.
 *  - iOS Safari: no prompt API exists, so it shows the manual Share → Add to
 *    Home Screen instructions instead.
 *
 * It reappears on every visit until the user installs (or dismisses for the
 * current session). Render it once, high in the tree (e.g. in RootLayout).
 */
export function InstallPrompt({ className }: { className?: string }) {
  const { canInstall, isIos, installed, promptInstall } = useInstallPrompt()
  // Let the user dismiss for this session so it isn't nagging within a visit;
  // it returns next visit (component remounts) until they install.
  const [dismissed, setDismissed] = useState(false)

  if (installed || dismissed) return null
  if (!canInstall && !isIos) return null

  return (
    <div className={cn('fixed inset-x-0 bottom-16 z-40 mx-auto max-w-sm px-4', className)}>
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
          <Download className="h-5 w-5 text-slate-700" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-800">Install Fast in 5</p>
          {isIos ? (
            <p className="text-xs text-slate-500">
              Tap <Share className="inline h-3 w-3 align-text-bottom" /> then{' '}
              <span className="font-medium">Add to Home Screen</span>.
            </p>
          ) : (
            <p className="text-xs text-slate-500">Add it to your home screen for quick access.</p>
          )}
        </div>

        {canInstall && (
          <button
            type="button"
            onClick={() => void promptInstall()}
            className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Install
          </button>
        )}

        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
