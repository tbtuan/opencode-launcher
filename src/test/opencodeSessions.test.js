import { describe, it, expect } from 'vitest'
import { createOpencodeSessions, psQuote } from '../../opencodeSessions'

const { parseModelRef, defaultOpencodeCommand, buildOpencodeLaunch } = createOpencodeSessions()

describe('opencodeSessions', () => {
  describe('psQuote', () => {
    it('wraps values in single quotes', () => {
      expect(psQuote('abc')).toBe("'abc'")
    })

    it('escapes embedded single quotes', () => {
      expect(psQuote("it's")).toBe("'it''s'")
    })
  })

  describe('parseModelRef', () => {
    it('splits provider and model id', () => {
      expect(parseModelRef('github-copilot/gemini-3.8-flash')).toEqual({
        providerID: 'github-copilot',
        id: 'gemini-3.8-flash',
      })
    })

    it('preserves a variant suffix', () => {
      expect(parseModelRef('openai/gpt-5#high')).toEqual({
        providerID: 'openai',
        id: 'gpt-5',
        variant: 'high',
      })
    })

    it.each([undefined, null, '', 'no-slash', '/missing-provider', 'missing-model/'])(
      'rejects %p',
      value => {
        expect(parseModelRef(value)).toBeNull()
      },
    )

    it('accepts model ids with nested slashes', () => {
      expect(parseModelRef('provider/some/model')).toEqual({
        providerID: 'provider',
        id: 'some/model',
      })
      expect(parseModelRef('provider/some/model#variant')).toEqual({
        providerID: 'provider',
        id: 'some/model',
        variant: 'variant',
      })
    })
  })

  describe('defaultOpencodeCommand', () => {
    it('launches plain opencode without args', () => {
      expect(defaultOpencodeCommand('')).toBe('opencode')
      expect(defaultOpencodeCommand()).toBe('opencode')
    })

    it('forwards args', () => {
      expect(defaultOpencodeCommand('--continue')).toBe('opencode --continue')
    })
  })

  describe('buildOpencodeLaunch', () => {
    it('falls back to the plain command when no model is selected', async () => {
      await expect(buildOpencodeLaunch('C:\\work', '', '')).resolves.toBe('opencode')
      await expect(buildOpencodeLaunch('C:\\work', '--continue', '')).resolves.toBe(
        'opencode --continue',
      )
    })

    it('falls back when the model reference is malformed', async () => {
      await expect(buildOpencodeLaunch('C:\\work', '', 'not-a-model')).resolves.toBe('opencode')
    })
  })
})
