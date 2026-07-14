export type QrScannerProps = {
  /**
   * Called for each decoded QR code. Fires repeatedly while scanning (throttled
   * to avoid spamming the same code), so the caller decides how to react — the
   * scanner keeps running so the user can retry after an invalid code.
   */
  onDecode: (text: string) => void
  className?: string
}
