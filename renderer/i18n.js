const i18n = (() => {
  let translations = {}
  let currentLang = 'en'

  const fallback = {
    'tab.home': 'Home',
    'tab.newTerminal': 'New Terminal',
    'dashboard.title': 'OpenCode Launcher',
    'dashboard.noDirs': 'No directories yet',
    'dashboard.noDirsHint': 'Click <strong>+ Add Directory</strong>',
    'dashboard.addDirectory': '+ Add Directory',
    'actions.title': 'Actions',
    'actions.reloadModels': '\u{21BB} Reload Models',
    'actions.restartLauncher': '\u{21BB} Restart OpenCode Launcher',
    'actions.settings': '\u{2699} Settings',
    'loading.models': '\u{21BB} Loading...',
    'models.lastLoaded': 'Last loaded:',
    'models.noSelection': '\u2014 No model selected \u2014',
    'models.provider': 'Provider:',
    'models.preferred': 'Preferred Model',
    'preview.title': 'Running Terminals',
    'preview.running': '\u25cf Running',
    'ctx.rename': 'Rename',
    'ctx.changeDir': 'Change Directory',
    'ctx.restart': 'Restart',
    'ctx.closeTab': 'Close Tab',
    'ctx.removeCard': 'Remove Card',
    'saveDialog.title': 'Save Directory?',
    'saveDialog.name': 'Name:',
    'saveDialog.saveAndOpen': 'Save & Open',
    'saveDialog.saveOnly': 'Save Only',
    'saveDialog.openOnly': 'Open Only',
    'saveDialog.cancel': 'Cancel',
    'settings.title': 'Default Startup Tab',
    'settings.homeSubtitle': 'Dashboard view',
    'settings.save': 'Save',
    'settings.cancel': 'Cancel',
    'settings.language': 'Language',
    'editor.name': 'Name',
    'editor.description': 'Description',
    'editor.descriptionPlaceholder': 'optional\u2026',
    'editor.startOnLaunch': 'Start on launch',
    'editor.continueSession': 'Continue session on open',
    'editor.save': 'Save',
    'editor.cancel': 'Cancel',
    'card.noDescription': 'No description',
    'card.btn.settings': 'Settings',
    'card.btn.play': 'Start terminal',
    'card.btn.stop': 'Stop & close',
    'card.btn.restart': 'Restart',
    'terminal.processExited': '[Process exited with code {code}]',
    'terminal.error': '[Error: {message}]',
    'dialog.selectDirectory': 'Select Directory',
    'restartDialog.title': 'Change Language',
    'restartDialog.message': 'The language will take effect after restart.<br>Restart now?',
    'restartDialog.restart': 'Restart',
    'restartDialog.later': 'Later',
  }

  function detectLanguage() {
    const navLang = (navigator.language || '').toLowerCase()
    return navLang.startsWith('de') ? 'de' : 'en'
  }

  function setLanguage(lang) {
    currentLang = lang
  }

  function getLanguage() {
    return currentLang
  }

  function t(key) {
    return translations[key] !== undefined ? translations[key] : (fallback[key] || key)
  }

  async function loadTranslations(lang) {
    try {
      const data = await window.api.loadI18n(lang)
      if (data) translations = data
    } catch (e) {
      translations = {}
    }
  }

  function applyTranslations() {
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

  return { loadTranslations, setLanguage, getLanguage, t, applyTranslations, detectLanguage }
})()
