import de from './de.json'
import en from './en.json'

const translations = { de, en }
let currentLang = 'en'

export function detectLanguage() {
  const navLang = (navigator.language || '').toLowerCase()
  return navLang.startsWith('de') ? 'de' : 'en'
}

export function setLanguage(lang) {
  currentLang = lang === 'de' ? 'de' : 'en'
}

export function getLanguage() {
  return currentLang
}

export function t(key) {
  const dict = translations[currentLang] || en
  const fallback = en[key]
  return dict[key] !== undefined ? dict[key] : (fallback !== undefined ? fallback : key)
}

export function applyTranslations() {
  document.documentElement.lang = currentLang
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n)
  })
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle)
  })
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder)
  })
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    el.innerHTML = t(el.dataset.i18nHtml)
  })
}
