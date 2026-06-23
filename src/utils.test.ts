import { describe, it, expect } from 'vitest'
import { cn } from './lib/utils'

describe('cn utility', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('deduplicates tailwind classes', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })
})
