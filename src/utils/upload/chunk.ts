import type { UploadPart } from './types'

/**
 * Split a file of `size` bytes into part descriptors of `partSize` bytes each.
 *
 * S3 multipart rules: every part except the last must be >= 5 MiB, and there can
 * be at most 10,000 parts. A file smaller than one part becomes a single part,
 * which is valid. Part numbers are 1-based (S3 requirement).
 */
export function buildParts(size: number, partSize: number): UploadPart[] {
  if (size <= 0) return []
  if (partSize <= 0) throw new Error('partSize must be > 0')

  const parts: UploadPart[] = []
  let start = 0
  let partNumber = 1
  while (start < size) {
    const end = Math.min(start + partSize, size)
    parts.push({ partNumber, start, end, status: 'pending' })
    start = end
    partNumber += 1
  }
  return parts
}

/** Bytes confirmed uploaded = sum of the sizes of parts with an ETag. */
export function uploadedBytes(parts: UploadPart[]): number {
  return parts.reduce((sum, p) => (p.status === 'done' ? sum + (p.end - p.start) : sum), 0)
}

export function percentComplete(parts: UploadPart[], total: number): number {
  if (total <= 0) return 0
  return Math.min(100, Math.round((uploadedBytes(parts) / total) * 100))
}
