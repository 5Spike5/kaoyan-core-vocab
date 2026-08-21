import { describe, expect, it } from 'vitest'
import { validateAuthInput } from '../../../src/features/auth/authService'

describe('auth input validation', () => {
  it('requires a valid email and a password of at least eight characters', () => {
    expect(validateAuthInput({ email: 'bad', password: 'short' }).success).toBe(false)
    expect(validateAuthInput({ email: 'user@example.com', password: 'long-password' }).success).toBe(true)
  })

  it('rejects missing fields', () => {
    expect(validateAuthInput({}).success).toBe(false)
    expect(validateAuthInput({ email: 'user@example.com' }).success).toBe(false)
  })
})
