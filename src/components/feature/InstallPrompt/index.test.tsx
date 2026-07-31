import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { InstallPromptBucket } from '@/hooks/installPromptContext'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'
import { useIsMobile } from '@/hooks/useIsMobile'
import { InstallPrompt } from './index'
import { isPromptDismissed } from './helper'

vi.mock('@/hooks/useInstallPrompt')
vi.mock('@/hooks/useIsMobile')
vi.mock('./helper', () => ({
  isPromptDismissed: vi.fn().mockReturnValue(false),
  setPromptDismissed: vi.fn(),
}))

const mockUseInstallPrompt = vi.mocked(useInstallPrompt)
const mockUseIsMobile = vi.mocked(useIsMobile)
const mockIsPromptDismissed = vi.mocked(isPromptDismissed)

function mockPrompt(
  bucket: InstallPromptBucket,
  overrides: Partial<ReturnType<typeof useInstallPrompt>> = {},
) {
  mockUseInstallPrompt.mockReturnValue({
    bucket,
    installed: bucket === 'installed',
    canInstall: bucket === 'chromium-standard' || bucket === 'opera-android',
    promptInstall: vi.fn().mockResolvedValue('unavailable'),
    ...overrides,
  })
}

describe('InstallPrompt', () => {
  beforeEach(() => {
    mockUseIsMobile.mockReturnValue(true)
    mockIsPromptDismissed.mockReturnValue(false)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing on desktop', () => {
    mockUseIsMobile.mockReturnValue(false)
    mockPrompt('chromium-standard')
    const { container } = render(<InstallPrompt />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when already installed', () => {
    mockPrompt('installed')
    const { container } = render(<InstallPrompt />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when dismissed', () => {
    mockIsPromptDismissed.mockReturnValue(true)
    mockPrompt('chromium-standard')
    const { container } = render(<InstallPrompt />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows a working Install button for chromium-standard', () => {
    mockPrompt('chromium-standard')
    render(<InstallPrompt />)
    expect(screen.getByRole('button', { name: 'Install' })).toBeInTheDocument()
  })

  it('shows "No PWA Support" with no button for firefox-android-unsupported', () => {
    mockPrompt('firefox-android-unsupported')
    render(<InstallPrompt />)
    expect(screen.getByText(/No PWA Support/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Install' })).not.toBeInTheDocument()
  })

  it('shows Safari Share instructions for ios-safari', () => {
    mockPrompt('ios-safari')
    render(<InstallPrompt />)
    expect(screen.getByText(/Add to Home Screen/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Install' })).not.toBeInTheDocument()
  })

  it('shows "open in Safari" message for ios-other-webkit', () => {
    mockPrompt('ios-other-webkit')
    render(<InstallPrompt />)
    expect(screen.getByText(/Open this site in Safari to install/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Install' })).not.toBeInTheDocument()
  })

  it('shows an Install button for opera-android and falls back to manual instructions in place when no deferred event exists', async () => {
    const promptInstall = vi.fn().mockResolvedValue('manual-fallback')
    mockPrompt('opera-android', { promptInstall })

    render(<InstallPrompt />)
    const button = screen.getByRole('button', { name: 'Install' })

    fireEvent.click(button)
    await screen.findByText(/Add to Home screen/i)

    expect(promptInstall).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Install' })).not.toBeInTheDocument()
  })

  it('performs a real install for opera-android when a deferred event exists', async () => {
    const promptInstall = vi.fn().mockResolvedValue('accepted')
    mockPrompt('opera-android', { promptInstall })

    render(<InstallPrompt />)
    fireEvent.click(screen.getByRole('button', { name: 'Install' }))

    await vi.waitFor(() => expect(promptInstall).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('button', { name: 'Install' })).toBeInTheDocument()
  })

  it('dismisses the prompt when the close button is clicked', () => {
    mockPrompt('chromium-standard')
    render(<InstallPrompt />)

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByText('Install Safe in 5')).not.toBeInTheDocument()
  })
})
