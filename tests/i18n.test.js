import { describe, it, expect, beforeEach } from 'vitest'
import { t, setLanguage, getLanguage, detectLanguage, applyTranslations } from '../src/i18n/index'

describe('t', () => {
  beforeEach(() => {
    setLanguage('en')
  })

  it('returns English translation by default', () => {
    expect(t('preview.title')).toBe('Running Terminals')
  })

  it('returns German translation after setLanguage("de")', () => {
    setLanguage('de')
    expect(t('preview.title')).toBe('Laufende Terminals')
  })

  it('falls back to English when German key is missing', () => {
    expect(t('preview.title')).toBe('Running Terminals')
  })

  it('returns the key itself for nonexistent key', () => {
    expect(t('nonexistent.key')).toBe('nonexistent.key')
  })
})

describe('setLanguage / getLanguage', () => {
  beforeEach(() => {
    setLanguage('en')
  })

  it('getLanguage returns "en" initially', () => {
    expect(getLanguage()).toBe('en')
  })

  it('setLanguage("de") changes language to "de"', () => {
    setLanguage('de')
    expect(getLanguage()).toBe('de')
  })

  it('setLanguage with unknown code falls back to "en"', () => {
    setLanguage('fr')
    expect(getLanguage()).toBe('en')
  })

  it('setLanguage("de") then setLanguage("en") toggles back', () => {
    setLanguage('de')
    setLanguage('en')
    expect(getLanguage()).toBe('en')
  })
})

describe('detectLanguage', () => {
  it('returns a string', () => {
    expect(typeof detectLanguage()).toBe('string')
  })

  it('returns "de" when navigator.language starts with "de"', () => {
    const original = navigator.language
    Object.defineProperty(navigator, 'language', {
      value: 'de-DE',
      configurable: true,
    })
    expect(detectLanguage()).toBe('de')
    Object.defineProperty(navigator, 'language', {
      value: original,
      configurable: true,
    })
  })

  it('returns "en" when navigator.language starts with "en"', () => {
    const original = navigator.language
    Object.defineProperty(navigator, 'language', {
      value: 'en-US',
      configurable: true,
    })
    expect(detectLanguage()).toBe('en')
    Object.defineProperty(navigator, 'language', {
      value: original,
      configurable: true,
    })
  })

  it('returns "en" for unknown language', () => {
    const original = navigator.language
    Object.defineProperty(navigator, 'language', {
      value: 'fr-FR',
      configurable: true,
    })
    expect(detectLanguage()).toBe('en')
    Object.defineProperty(navigator, 'language', {
      value: original,
      configurable: true,
    })
  })
})

describe('applyTranslations', () => {
  beforeEach(() => {
    setLanguage('en')
    document.body.innerHTML = ''
  })

  it('runs without error', () => {
    expect(() => applyTranslations()).not.toThrow()
  })

  it('sets document.documentElement.lang', () => {
    setLanguage('de')
    applyTranslations()
    expect(document.documentElement.lang).toBe('de')
  })

  it('translates elements with data-i18n attribute', () => {
    document.body.innerHTML = '<span data-i18n="preview.title"></span>'
    applyTranslations()
    expect(document.querySelector('[data-i18n]').textContent).toBe('Running Terminals')
  })

  it('translates elements with data-i18n-title attribute', () => {
    document.body.innerHTML = '<span data-i18n-title="preview.title"></span>'
    applyTranslations()
    expect(document.querySelector('[data-i18n-title]').title).toBe('Running Terminals')
  })

  it('translates elements with data-i18n-placeholder attribute', () => {
    document.body.innerHTML = '<input data-i18n-placeholder="preview.title">'
    applyTranslations()
    expect(document.querySelector('[data-i18n-placeholder]').placeholder).toBe('Running Terminals')
  })

  it('translates elements with data-i18n-html attribute', () => {
    document.body.innerHTML = '<div data-i18n-html="dashboard.noDirsHint"></div>'
    applyTranslations()
    expect(document.querySelector('[data-i18n-html]').innerHTML).toBe('Click <strong>+ Add Directory</strong>')
  })
})
