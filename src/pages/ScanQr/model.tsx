/** Outcome of resolving a scanned QR payload into a navigation target. */
export type ScanResult = { kind: 'ok'; id: string } | { kind: 'invalid' }
