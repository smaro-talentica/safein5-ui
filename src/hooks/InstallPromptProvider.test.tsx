import { act, render, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InstallPromptProvider } from './InstallPromptProvider'
import { useInstallPrompt } from './useInstallPrompt'

const CHROME_ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36'
const EDGE_ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0 EdgA/120.0 Mobile Safari/537.36'
const OPERA_ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0 OPR/80.0 Mobile Safari/537.36'
const FIREFOX_ANDROID_UA = 'Mozilla/5.0 (Android 14; Mobile) Gecko/120.0 Firefox/120.0'
const SAFARI_IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/605.1.15'
const CHROME_IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/120.0 Mobile Safari/605.1.15'
const EDGE_IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 EdgiOS/120.0 Mobile Safari/605.1.15'
const FIREFOX_IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 FxiOS/120.0 Mobile Safari/605.1.15'

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true })
}

function renderInstallPrompt() {
  return renderHook(() => useInstallPrompt(), { wrapper: InstallPromptProvider })
}

class FakeBeforeInstallPromptEvent extends Event {
  outcome: 'accepted' | 'dismissed' = 'accepted'
  prompt = vi.fn().mockResolvedValue(undefined)
  get userChoice() {
    return Promise.resolve({ outcome: this.outcome })
  }
  constructor() {
    super('beforeinstallprompt', { cancelable: true })
  }
}

describe('InstallPromptProvider', () => {
  const originalUa = window.navigator.userAgent

  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    })
  })

  afterEach(() => {
    setUserAgent(originalUa)
    vi.restoreAllMocks()
  })

  it('classifies Chrome-Android as chromium-standard, with canInstall gated on the deferred event', async () => {
    setUserAgent(CHROME_ANDROID_UA)
    const { result } = renderInstallPrompt()
    expect(result.current.bucket).toBe('chromium-standard')
    expect(result.current.canInstall).toBe(false)

    act(() => {
      window.dispatchEvent(new FakeBeforeInstallPromptEvent())
    })
    await waitFor(() => expect(result.current.canInstall).toBe(true))
  })

  it('classifies Edge-Android as chromium-standard', () => {
    setUserAgent(EDGE_ANDROID_UA)
    const { result } = renderInstallPrompt()
    expect(result.current.bucket).toBe('chromium-standard')
  })

  it('classifies Opera-Android as opera-android with canInstall true even with no deferred event', () => {
    setUserAgent(OPERA_ANDROID_UA)
    const { result } = renderInstallPrompt()
    expect(result.current.bucket).toBe('opera-android')
    expect(result.current.canInstall).toBe(true)
  })

  it('classifies Firefox-Android as firefox-android-unsupported', () => {
    setUserAgent(FIREFOX_ANDROID_UA)
    const { result } = renderInstallPrompt()
    expect(result.current.bucket).toBe('firefox-android-unsupported')
    expect(result.current.canInstall).toBe(false)
  })

  it('classifies Safari-iOS as ios-safari', () => {
    setUserAgent(SAFARI_IOS_UA)
    const { result } = renderInstallPrompt()
    expect(result.current.bucket).toBe('ios-safari')
  })

  it('classifies Chrome-iOS as ios-other-webkit', () => {
    setUserAgent(CHROME_IOS_UA)
    const { result } = renderInstallPrompt()
    expect(result.current.bucket).toBe('ios-other-webkit')
  })

  it('classifies Edge-iOS as ios-other-webkit', () => {
    setUserAgent(EDGE_IOS_UA)
    const { result } = renderInstallPrompt()
    expect(result.current.bucket).toBe('ios-other-webkit')
  })

  it('classifies Firefox-iOS as ios-other-webkit', () => {
    setUserAgent(FIREFOX_IOS_UA)
    const { result } = renderInstallPrompt()
    expect(result.current.bucket).toBe('ios-other-webkit')
  })

  it('classifies as installed when display-mode is standalone', () => {
    setUserAgent(CHROME_ANDROID_UA)
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    })
    const { result } = renderInstallPrompt()
    expect(result.current.bucket).toBe('installed')
    expect(result.current.installed).toBe(true)
  })

  it('chromium-standard calls the real deferred prompt and resolves its outcome', async () => {
    setUserAgent(CHROME_ANDROID_UA)
    const { result } = renderInstallPrompt()
    const event = new FakeBeforeInstallPromptEvent()

    act(() => {
      window.dispatchEvent(event)
    })
    await waitFor(() => expect(result.current.canInstall).toBe(true))

    const outcome = await act(() => result.current.promptInstall())
    expect(event.prompt).toHaveBeenCalledTimes(1)
    expect(outcome).toBe('accepted')
  })

  it('opera-android calls the real deferred prompt when it fired before click', async () => {
    setUserAgent(OPERA_ANDROID_UA)
    const { result } = renderInstallPrompt()
    const event = new FakeBeforeInstallPromptEvent()

    act(() => {
      window.dispatchEvent(event)
    })
    await waitFor(() => expect(event.prompt).not.toHaveBeenCalled())

    const outcome = await act(() => result.current.promptInstall())
    expect(event.prompt).toHaveBeenCalledTimes(1)
    expect(outcome).toBe('accepted')
  })

  it('opera-android returns manual-fallback when no deferred event ever fired', async () => {
    setUserAgent(OPERA_ANDROID_UA)
    const { result } = renderInstallPrompt()

    const outcome = await act(() => result.current.promptInstall())
    expect(outcome).toBe('manual-fallback')
  })

  it('chromium-standard returns unavailable when no deferred event exists', async () => {
    setUserAgent(CHROME_ANDROID_UA)
    const { result } = renderInstallPrompt()

    const outcome = await act(() => result.current.promptInstall())
    expect(outcome).toBe('unavailable')
  })

  it('marks installed and clears the deferred event on appinstalled', async () => {
    setUserAgent(CHROME_ANDROID_UA)
    const { result } = renderInstallPrompt()
    const event = new FakeBeforeInstallPromptEvent()

    act(() => {
      window.dispatchEvent(event)
    })
    await waitFor(() => expect(result.current.canInstall).toBe(true))

    act(() => {
      window.dispatchEvent(new Event('appinstalled'))
    })

    await waitFor(() => expect(result.current.bucket).toBe('installed'))
    expect(result.current.canInstall).toBe(false)
  })

  it('throws when useInstallPrompt is used without a provider', () => {
    const { result } = renderHook(() => {
      try {
        return useInstallPrompt()
      } catch (error) {
        return error
      }
    })
    expect(result.current).toBeInstanceOf(Error)
  })

  it('renders children', () => {
    const { getByText } = render(
      <InstallPromptProvider>
        <span>child</span>
      </InstallPromptProvider>,
    )
    expect(getByText('child')).toBeInTheDocument()
  })
})
