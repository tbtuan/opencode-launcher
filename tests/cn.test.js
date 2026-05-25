import { describe, it, expect } from 'vitest'
import { cn } from '../src/utils/cn'

describe('cn', () => {
  it('joins multiple class names', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('filters falsy values', () => {
    expect(cn('a', false && 'b', 'c')).toBe('a c')
  })

  it('filters null', () => {
    expect(cn('a', null, 'b')).toBe('a b')
  })

  it('filters undefined', () => {
    expect(cn('a', undefined, 'b')).toBe('a b')
  })

  it('returns empty string for no arguments', () => {
    expect(cn()).toBe('')
  })

  it('returns empty string for all falsy arguments', () => {
    expect(cn(false, null, undefined, '')).toBe('')
  })

  it('handles nested arrays', () => {
    expect(cn(['a', 'b'], 'c')).toBe('a b c')
  })

  it('handles nested arrays with falsy values', () => {
    expect(cn(['a', false && 'b'], 'c')).toBe('a c')
  })

  it('handles single argument', () => {
    expect(cn('a')).toBe('a')
  })
})
