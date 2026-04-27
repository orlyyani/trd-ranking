import { describe, it, expect } from 'vitest'
import {
  isUuid,
  isValidSurface,
  isValidDate,
  isValidName,
  isValidAvatarUrl,
  VALID_SURFACES,
} from '../../server/utils/validate'

// ─── isUuid ──────────────────────────────────────────────────────────────────

describe('isUuid', () => {
  it('accepts a valid v4 UUID', () => {
    expect(isUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
  })

  it('accepts uppercase UUID', () => {
    expect(isUuid('550E8400-E29B-41D4-A716-446655440000')).toBe(true)
  })

  it('rejects an empty string', () => {
    expect(isUuid('')).toBe(false)
  })

  it('rejects a UUID with missing hyphens', () => {
    expect(isUuid('550e8400e29b41d4a716446655440000')).toBe(false)
  })

  it('rejects a UUID that is too short', () => {
    expect(isUuid('550e8400-e29b-41d4-a716')).toBe(false)
  })

  it('rejects non-string types', () => {
    expect(isUuid(null)).toBe(false)
    expect(isUuid(undefined)).toBe(false)
    expect(isUuid(12345)).toBe(false)
    expect(isUuid({})).toBe(false)
  })

  it('rejects a plain word', () => {
    expect(isUuid('not-a-uuid')).toBe(false)
  })
})

// ─── isValidSurface ──────────────────────────────────────────────────────────

describe('isValidSurface', () => {
  it.each(VALID_SURFACES)('accepts "%s"', (surface) => {
    expect(isValidSurface(surface)).toBe(true)
  })

  it('rejects an unknown surface', () => {
    expect(isValidSurface('astroturf')).toBe(false)
  })

  it('is case-sensitive — rejects "Clay"', () => {
    expect(isValidSurface('Clay')).toBe(false)
  })

  it('rejects null and undefined', () => {
    expect(isValidSurface(null)).toBe(false)
    expect(isValidSurface(undefined)).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(isValidSurface('')).toBe(false)
  })
})

// ─── isValidDate ─────────────────────────────────────────────────────────────

describe('isValidDate', () => {
  it('accepts YYYY-MM-DD', () => {
    expect(isValidDate('2024-06-15')).toBe(true)
  })

  it('rejects DD/MM/YYYY format', () => {
    expect(isValidDate('15/06/2024')).toBe(false)
  })

  it('rejects date with time component', () => {
    expect(isValidDate('2024-06-15T12:00:00')).toBe(false)
  })

  it('rejects single-digit month or day', () => {
    expect(isValidDate('2024-6-5')).toBe(false)
  })

  it('rejects non-string types', () => {
    expect(isValidDate(20240615)).toBe(false)
    expect(isValidDate(null)).toBe(false)
    expect(isValidDate(undefined)).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(isValidDate('')).toBe(false)
  })
})

// ─── isValidName ─────────────────────────────────────────────────────────────

describe('isValidName', () => {
  it('accepts a normal player name', () => {
    expect(isValidName('Roger Federer')).toBe(true)
  })

  it('accepts a single character name', () => {
    expect(isValidName('A')).toBe(true)
  })

  it('accepts a 100-character name', () => {
    expect(isValidName('A'.repeat(100))).toBe(true)
  })

  it('rejects a 101-character name', () => {
    expect(isValidName('A'.repeat(101))).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(isValidName('')).toBe(false)
  })

  it('rejects a string of only whitespace', () => {
    expect(isValidName('   ')).toBe(false)
  })

  it('rejects non-string types', () => {
    expect(isValidName(null)).toBe(false)
    expect(isValidName(undefined)).toBe(false)
    expect(isValidName(42)).toBe(false)
  })
})

// ─── isValidAvatarUrl ────────────────────────────────────────────────────────

describe('isValidAvatarUrl', () => {
  it('accepts null (no avatar)', () => {
    expect(isValidAvatarUrl(null)).toBe(true)
  })

  it('accepts undefined (no avatar)', () => {
    expect(isValidAvatarUrl(undefined)).toBe(true)
  })

  it('accepts a valid https URL', () => {
    expect(isValidAvatarUrl('https://res.cloudinary.com/demo/image/upload/sample.jpg')).toBe(true)
  })

  it('rejects an http URL', () => {
    expect(isValidAvatarUrl('http://example.com/photo.jpg')).toBe(false)
  })

  it('rejects a relative path', () => {
    expect(isValidAvatarUrl('/images/player.jpg')).toBe(false)
  })

  it('rejects a plain string that is not a URL', () => {
    expect(isValidAvatarUrl('not-a-url')).toBe(false)
  })

  it('rejects a number', () => {
    expect(isValidAvatarUrl(42)).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(isValidAvatarUrl('')).toBe(false)
  })
})
