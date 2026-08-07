import { useCallback, useEffect, useRef, useState } from 'react'
import { AppProvider, useApp } from './store/AppContext'
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary'
import { TabBar } from './components/TabBar/TabBar'
import { Dashboard } from './components/Dashboard/Dashboard'
import { TerminalPane } from './components/Terminal/TerminalPane'
import { ConfigEditor } from './components/Editor/ConfigEditor'
import { ContextMenu } from './components/ContextMenu/ContextMenu'
import { SettingsDialog } from './components/Modals/SettingsDialog'
import { RestartDialog } from './components/Modals/RestartDialog'
import { RebuildOverlay } from './components/Modals/RebuildOverlay'
import { DevToolsApp } from './DevTools/DevToolsApp'
import { logger } from './services/logger'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useResizeObserver } from './hooks/useResizeObserver'
import { loadConfig, checkAndCleanDirectories, persistConfig, persistTabOrder, generateId } from './services/configService'
import { createPtySession, killPty, clearTerminalDimensions, getTerminalDimensions } from './services/terminalService'
import { api } from './services/api'
import { loadModels } from './services/modelService'
import { generateTabId } from './services/terminalService'
import { detectLanguage, setLanguage, applyTranslations, t, getLanguage } from './i18n'
import { getDirNameFromPath } from './utils/helpers'
import styles from './App.module.css'

function AppInner() {
  const {
    state, dispatch, setActiveTab, addTab, insertTab, removeTab, updateTab, moveTab,
    setDirectories, addDirectory, removeDirectory, updateDirectory,
    setModels, setDefaultTab, setEditorTab, setLanguage: setAppLang,
    setFlags, persist,
  } = useApp()

  const contentRef = useRef(null)
  const [contextMenu, setContextMenu] = useState({ x: 0, y: 0, visible: false, targetId: null, type: 'tab', hasSplits: false })
  const [showSettings, setShowSettings] = useState(false)
  const [showRestart, setShowRestart] = useState(false)
  const [nextLang, setNextLang] = useState(null)


  // Initialize
  useEffect(() => {
    async function init() {
      try {
        performance.mark('init:start')
        const config = await loadConfig()
        performance.mark('init:config:loaded')
        const { valid: dirs, removed } = await checkAndCleanDirectories(config.directories || [])
        if (removed.length > 0) {
          await api.saveConfig({ ...config, directories: dirs })
        }
        setDirectories(dirs)
        performance.mark('init:directories:loaded')

        const tabOrder = config.tabOrder || []
        const defaultTab = config.defaultTab || 'home'

        // Language
        let lang = config.language
        if (lang !== 'de' && lang !== 'en') {
          lang = detectLanguage()
        }
        setLanguage(lang)
        setAppLang(lang)
        applyTranslations()
        dispatch({ type: 'SET_LANGUAGE', payload: lang })
        performance.mark('init:language:set')

        // Flags
        try {
          const flagDe = await api.readResource('flag-de.svg')
          const flagEn = await api.readResource('flag-en.svg')
          setFlags(flagDe || '', flagEn || '')
          dispatch({ type: 'SET_FLAGS', payload: { flagDe: flagDe || '', flagEn: flagEn || '' } })
        } catch {}

        // Models
        try {
          const result = await loadModels()
          setModels(result.models, result.timestamp)
        } catch {}
        performance.mark('init:models:loaded')

        // Migration: old defaultTab format
        const oldDefault = dirs.find(d => d.defaultTab)
        let resolvedDefault = defaultTab
        if (oldDefault && !config.defaultTab) {
          resolvedDefault = oldDefault.path
          const cleaned = dirs.map(d => ({ ...d, defaultTab: undefined }))
          setDirectories(cleaned)
        }
        setDefaultTab(resolvedDefault)

        // Apply tab order
        if (tabOrder.length > 0) {
          dispatch({ type: 'SET_INITIAL_DATA', payload: { defaultTab: resolvedDefault, savedTabOrder: tabOrder } })
        }

        dispatch({ type: 'SET_INITIAL_DATA', payload: { isLoaded: true } })
        performance.mark('init:done')
        performance.measure('init:config', 'init:start', 'init:config:loaded')
        performance.measure('init:directories', 'init:start', 'init:directories:loaded')
        performance.measure('init:models', 'init:start', 'init:models:loaded')
        performance.measure('init:total', 'init:start', 'init:done')

        logger.info('App', 'Init complete', { timing: {
          config: Math.round(performance.getEntriesByName('init:config')[0]?.duration || 0),
          directories: Math.round(performance.getEntriesByName('init:directories')[0]?.duration || 0),
          models: Math.round(performance.getEntriesByName('init:models')[0]?.duration || 0),
          total: Math.round(performance.getEntriesByName('init:total')[0]?.duration || 0),
        }})
      } catch (e) {
        logger?.error?.('App', 'init', e?.stack || e?.message)
        dispatch({ type: 'SET_INITIAL_DATA', payload: { isLoaded: true } })
      }
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Global error handlers
  useEffect(() => {
    const onError = (e) => {
      logger.error('App', 'Uncaught error', e?.error?.stack || e?.message || String(e))
    }
    const onRejection = (e) => {
      logger.error('App', 'Unhandled rejection', e?.reason?.stack || e?.reason || String(e))
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  // Main process log forwarding
  useEffect(() => {
    const unsub = api.onMainLog?.((entry) => {
      logger.log(entry.component, entry.level, ...entry.args)
    })
    return () => unsub?.()
  }, [])

  // Auto-save logs to disk on error
  useEffect(() => {
    let lastSave = 0
    const unsub = logger.onError(() => {
      const now = Date.now()
      if (now - lastSave < 30000) return
      lastSave = now
      const content = logger.formatEntries(logger.getRecent(500))
      api.saveLogs(content).catch(() => {})
    })
    return unsub
  }, [])

  // Auto-launch directories
  const tabsRef = useRef(state.tabs)
  useEffect(() => { tabsRef.current = state.tabs }, [state.tabs])

  useEffect(() => {
    if (!state.isLoaded) return
    const autoLaunch = state.savedDirectories.filter(d => d.startOnLaunch)
    async function run() {
      for (const dir of autoLaunch) {
        const args = [
          dir.model ? `--model ${dir.model}` : '',
          dir.continueSession ? '--continue' : '',
        ].filter(Boolean).join(' ')
        await createTab(dir.name, dir.path, args, dir._id)
      }
      // Activate default tab
      const defaultDir = state.savedDirectories.find(d => d.path === state.defaultTab)
      if (state.defaultTab === 'home' || !state.defaultTab) {
        setActiveTab('home')
      } else if (defaultDir) {
        const existingTab = tabsRef.current.find(t => t.dirId === defaultDir._id)
        if (existingTab) {
          setActiveTab(existingTab.id)
        } else {
          const args = defaultDir.continueSession ? '--continue' : ''
          const id = await createTab(defaultDir.name, defaultDir.path, args, defaultDir._id)
          setActiveTab(id)
        }
      } else if (state.tabs.length > 0) {
        setActiveTab(state.tabs[state.tabs.length - 1].id)
      } else {
        setActiveTab('home')
      }

      // Restore saved tab order
      const savedOrder = state.savedTabOrder
      if (savedOrder?.length) {
        const currentTabs = tabsRef.current
        const reordered = []
        const remaining = [...currentTabs]
        for (const cwd of savedOrder) {
          const idx = remaining.findIndex(t => t.cwd === cwd)
          if (idx !== -1) {
            reordered.push(remaining[idx])
            remaining.splice(idx, 1)
          }
        }
        reordered.push(...remaining)
        dispatch({ type: 'SET_TABS', payload: reordered })
      }
    }
    run()
  }, [state.isLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

  // Tab creation
  const createTab = useCallback(async (name, cwd, args = '', dirId = null, insertIdx = -1) => {
    const id = generateTabId()
    const tab = {
      id,
      name,
      displayName: name,
      cwd,
      dirId,
      type: 'terminal',
      status: 'starting',
      isProcessing: () => false,
      isDirty: false,
    }
    if (insertIdx >= 0) {
      insertTab(tab, insertIdx)
    } else {
      addTab(tab)
    }

    try {
      const result = await createPtySession(id, cwd, args)
      if (result?.ok) {
        updateTab(id, { status: 'running', isProcessing: () => true })
        recalcDisplayNames(cwd)
        document.dispatchEvent(new CustomEvent('resize-active-tab'))
        logger.info('App', 'Create terminal OK', { id, name, cwd, dirId })
      } else {
        logger.warn('App', 'Create terminal failed', { id, name, cwd, result })
        updateTab(id, { status: 'error', spawnError: result?.error })
        // Write the error directly into the xterm so the user sees it
        document.dispatchEvent(new CustomEvent('pty-spawn-error', {
          detail: { tabId: id, error: result?.error || 'Shell konnte nicht gestartet werden.' }
        }))
      }
    } catch (e) {
      logger.error('App', 'Create terminal error', { id, name, cwd, error: e?.stack })
      updateTab(id, { status: 'error' })
      document.dispatchEvent(new CustomEvent('pty-spawn-error', {
        detail: { tabId: id, error: e?.message || 'Unbekannter Fehler beim Starten der Shell.' }
      }))
    }

    return id
  }, [addTab, insertTab, updateTab])

  // Track in-flight tab creations per directory (prevents double-open race)
  const creatingDirsRef = useRef(new Set())

  // Open terminal for directory
  const openTerminalForDir = useCallback(async (dir) => {
    if (creatingDirsRef.current.has(dir._id)) return
    const existing = state.tabs.find(t => t.dirId === dir._id)
    if (existing) { setActiveTab(existing.id); return }
    creatingDirsRef.current.add(dir._id)
    const args = [
      dir.model ? `--model ${dir.model}` : '',
      dir.continueSession ? '--continue' : '',
    ].filter(Boolean).join(' ')
    try {
      const id = await createTab(dir.name, dir.path, args, dir._id)
      logger.info('App', 'Open terminal for dir', { dirId: dir._id, name: dir.name, tabId: id })
      setActiveTab(id)
    } finally {
      creatingDirsRef.current.delete(dir._id)
    }
  }, [state.tabs, createTab, setActiveTab])

  // Close tab
  const closeTab = useCallback(async (id) => {
    try {
      const idx = state.tabs.findIndex(t => t.id === id)
      if (idx === -1) return
      const tab = state.tabs[idx]

      if (tab.type === 'editor') {
        if (state.editorTabId === id) setEditorTab(null)
        removeTab(id)
      } else {
        try { await killPty(id) } catch {}
        clearTerminalDimensions(id)
        const closedCwd = tab.cwd
        // Close child splits
        const childSplits = state.tabs.filter(t => t.parentId === id)
        for (const s of childSplits) {
          try { await killPty(s.id) } catch {}
          clearTerminalDimensions(s.id)
          removeTab(s.id)
        }
        removeTab(id)
        recalcDisplayNames(closedCwd)
        logger.info('App', 'Close tab', { id, name: tab.name })
      }

      if (state.activeId === id) {
        const remaining = state.tabs.filter(t => t.id !== id)
        if (remaining.length > 0) {
          setActiveTab(remaining[Math.min(idx, remaining.length - 1)].id)
        } else {
          setActiveTab('home')
        }
      }
    } catch (e) {
      logger.error('App', 'closeTab', e?.stack)
    }
  }, [state.tabs, state.activeId, state.editorTabId, setActiveTab, setEditorTab, removeTab, updateTab])

  // Split terminal
  const handleSplitTerminal = useCallback(async (tab) => {
    if (!tab || tab.type !== 'terminal') return
    const splitId = generateTabId()
    const splitTab = {
      id: splitId,
      parentId: tab.id,
      name: tab.name,
      displayName: tab.name,
      cwd: tab.cwd,
      dirId: null,
      type: 'terminal',
      isSplit: true,
      status: 'starting',
      isProcessing: () => false,
      isDirty: false,
    }
    addTab(splitTab)
    logger.info('App', 'Split terminal', { parentId: tab.id, splitId, name: tab.name })
    setTimeout(() => {
      document.dispatchEvent(new CustomEvent('resize-active-tab'))
    }, 0)
    try {
      const result = await createPtySession(splitId, tab.cwd, '', false)
      if (result?.ok) {
        updateTab(splitId, { status: 'running', isProcessing: () => true })
        document.dispatchEvent(new CustomEvent('resize-active-tab'))
      }
    } catch (e) {
      logger.error('App', 'Split terminal error', { splitId, error: e?.stack })
      updateTab(splitId, { status: 'error' })
    }
  }, [addTab, updateTab])

  // Restart terminal
  const restartTerminal = useCallback(async (dir, tab) => {
    if (!tab) return
    logger.info('App', 'Restart terminal', { tabId: tab.id, dirId: dir?._id, name: tab.name })
    const idx = state.tabs.indexOf(tab)
    const wasActive = tab.id === state.activeId
    await closeTab(tab.id)
    const args = [
      dir.model ? `--model ${dir.model}` : '',
      dir.continueSession ? '--continue' : '',
    ].filter(Boolean).join(' ')
    const newId = await createTab(dir.name, dir.path, args, dir._id, idx)
    if (wasActive) {
      setActiveTab(newId)
    }
  }, [state.activeId, state.tabs, closeTab, createTab, setActiveTab])

  // Display names
  const recalcDisplayNames = useCallback((cwd) => {
    const sameCwd = state.tabs.filter(t => t.cwd === cwd)
    const running = sameCwd.filter(t => t.status === 'running')
    running.sort((a, b) => {
      const na = parseInt(a.id.split('-')[1]), nb = parseInt(b.id.split('-')[1])
      return na - nb
    })
    running.forEach((t, i) => {
      updateTab(t.id, { displayName: i === 0 ? t.name : `${t.name} (${i})` })
    })
    sameCwd.filter(t => t.status !== 'running').forEach(t => {
      updateTab(t.id, { displayName: t.name })
    })
  }, [state.tabs, updateTab])

  // Tab resize observer
  useResizeObserver(contentRef, useCallback(() => {
    if (state.activeId === 'home') return
    const tab = state.tabs.find(t => t.id === state.activeId)
    if (tab && tab.type !== 'editor') {
      // The TerminalPane handles its own resize via the ResizeObserver on its container
      document.dispatchEvent(new CustomEvent('resize-active-tab'))
    }
  }, [state.activeId, state.tabs]))

  // Keyboard shortcuts
  const handleNewTerminal = useCallback(() => {
    logger.info('App', 'New terminal (add-directory)')
    document.dispatchEvent(new CustomEvent('add-directory'))
  }, [])

  useKeyboardShortcuts({
    onNewTerminal: handleNewTerminal,
    onCloseTab: closeTab,
    onCycleTab: setActiveTab,
    onSaveEditor: () => {
      document.dispatchEvent(new CustomEvent('save-editor'))
    },
    activeId: state.activeId,
    tabs: state.tabs,
    editorTabId: state.editorTabId,
  })

  // Context menu handler
  useEffect(() => {
    const handler = (e) => {
      const { x, y, targetId, type, hasSplits } = e.detail
      setContextMenu({ x, y, visible: true, targetId, type, hasSplits: !!hasSplits })
    }
    document.addEventListener('context-menu', handler)
    return () => document.removeEventListener('context-menu', handler)
  }, [])

  const handleContextClose = useCallback(() => {
    setContextMenu(prev => ({ ...prev, visible: false, targetId: null, hasSplits: false }))
  }, [])

  // Context menu actions
  const handleCtxSplitTerminal = useCallback(() => {
    const id = contextMenu.targetId
    const hasSplits = contextMenu.hasSplits
    handleContextClose()
    if (!id) return
    const tab = state.tabs.find(t => t.id === id)
    if (!tab) return
    if (hasSplits) {
      logger.info('App', 'Close split terminals', { parentId: id, name: tab.name, count: childSplits.length })
      const childSplits = state.tabs.filter(t => t.parentId === id)
      for (const s of childSplits) {
        killPty(s.id)
        clearTerminalDimensions(s.id)
        removeTab(s.id)
      }
      setTimeout(() => {
        document.dispatchEvent(new CustomEvent('resize-active-tab'))
        // Direct preview update with estimated dimensions (handles case where
        // parent terminal is hidden and fit() returns 0)
        const dims = getTerminalDimensions(id)
        if (dims && tab.splitRatio) {
          window.dispatchEvent(new CustomEvent('preview-resize', {
            detail: {
              tabId: id,
              cols: dims.cols,
              rows: Math.max(5, Math.round(dims.rows / tab.splitRatio)),
            }
          }))
        }
      }, 0)
    } else {
      logger.info('App', 'Open split terminal', { parentId: id, name: tab.name })
      handleSplitTerminal(tab)
    }
  }, [contextMenu.targetId, contextMenu.hasSplits, state.tabs, handleContextClose, handleSplitTerminal, killPty, clearTerminalDimensions, removeTab, getTerminalDimensions])

  // Preview update helper: dispatches resize-active-tab AND directly injects
  // preview-resize with container-based dimensions (works even when parent
  // terminal is not the active tab)
  useEffect(() => {
    const handler = (e) => {
      const { tabId } = e.detail
      const container = document.querySelector(`#pane-${tabId}`)
      if (!container) return
      const rect = container.getBoundingClientRect()
      const approxCols = Math.max(40, Math.floor(rect.width / 9.2))
      const approxRows = Math.max(5, Math.floor(rect.height / 18))
      window.dispatchEvent(new CustomEvent('preview-resize', {
        detail: { tabId, cols: approxCols, rows: approxRows }
      }))
    }
    document.addEventListener('split-closed', handler)
    return () => document.removeEventListener('split-closed', handler)
  }, [])

  const handleCtxRestart = useCallback(async () => {
    const id = contextMenu.targetId
    handleContextClose()
    if (!id) return
    const tab = state.tabs.find(t => t.id === id)
    if (!tab) return
    logger.info('App', 'Context restart', { id, name: tab.name })
    const dir = state.savedDirectories.find(d => d._id === tab.dirId)
    if (dir) {
      await restartTerminal(dir, tab)
    } else {
      const idx = state.tabs.indexOf(tab)
      const wasActive = tab.id === state.activeId
      await closeTab(tab.id)
      const newId = await createTab(tab.name, tab.cwd, '', null, idx)
      if (wasActive) setActiveTab(newId)
    }
  }, [contextMenu.targetId, state.tabs, state.savedDirectories, state.activeId, handleContextClose, closeTab, createTab, setActiveTab, restartTerminal])

  const handleCtxCloseTab = useCallback(() => {
    const id = contextMenu.targetId
    handleContextClose()
    logger.info('App', 'Context close tab', { id })
    if (id) closeTab(id)
  }, [contextMenu.targetId, handleContextClose, closeTab])

  const handleCtxSave = useCallback(() => {
    handleContextClose()
    logger.info('App', 'Context save editor')
    document.dispatchEvent(new CustomEvent('save-editor'))
  }, [handleContextClose])

  const handleCtxResetTerminal = useCallback(() => {
    const id = contextMenu.targetId
    handleContextClose()
    if (!id) return
    logger.info('App', 'Context reset terminal', { id })
    // Dispatch a Custom Event — TerminalPane listens and calls write(TERMINAL_RESET_SEQUENCE)
    // directly into its xterm instance. We must NOT write to PTY stdin here because
    // TUI programs (opencode Go binary) segfault when receiving unexpected escape sequences.
    const tabIds = [id, ...state.tabs.filter(t => t.parentId === id).map(t => t.id)]
    tabIds.forEach(tabId => {
      document.dispatchEvent(new CustomEvent('reset-terminal', { detail: { tabId } }))
    })
  }, [contextMenu.targetId, state.tabs, handleContextClose])

  const handleDeleteCard = useCallback(() => {
    const id = Number(contextMenu.targetId)
    handleContextClose()
    if (!id) return
    logger.info('App', 'Delete directory card', { dirId: id })
    removeDirectory(id)
    const tab = state.tabs.find(t => t.dirId === id)
    if (tab) closeTab(tab.id)
  }, [contextMenu.targetId, state.tabs, removeDirectory, closeTab, handleContextClose])

  const handleCtxSetDefaultTab = useCallback(() => {
    const id = contextMenu.targetId
    const type = contextMenu.type
    handleContextClose()

    let newDefault
    if (type === 'home' || id === 'home') {
      newDefault = 'home'
    } else if (type === 'card') {
      const dir = state.savedDirectories.find(d => d._id === Number(id))
      if (dir) newDefault = dir.path
    } else {
      const tab = state.tabs.find(t => t.id === id)
      if (tab?.cwd) newDefault = tab.cwd
    }

    if (!newDefault) return
    setDefaultTab(newDefault)
    persist(state.savedDirectories, newDefault, getLanguage())
    logger.info('App', 'Set default tab', { targetId: id, type, defaultTab: newDefault })
  }, [contextMenu.targetId, contextMenu.type, state.tabs, state.savedDirectories, handleContextClose, setDefaultTab, persist])

  // Tab drop event
  useEffect(() => {
    const handler = (e) => {
      const { fromId, toId } = e.detail
      const fromIdx = state.tabs.findIndex(t => t.id === fromId)
      const toIdx = state.tabs.findIndex(t => t.id === toId)
      if (fromIdx !== -1 && toIdx !== -1) {
        moveTab(fromIdx, toIdx)
        const reordered = [...state.tabs]
        const [moved] = reordered.splice(fromIdx, 1)
        reordered.splice(toIdx, 0, moved)
        persistTabOrder(reordered.map(t => t.cwd))
      }
    }
    document.addEventListener('tab-drop', handler)
    return () => document.removeEventListener('tab-drop', handler)
  }, [state.tabs, moveTab])

  // Save dialog result
  const handleSaveDialogResult = useCallback(async (e) => {
    const { action, name, folderPath, description, startOnLaunch, continueSession, model, setAsDefaultTab } = e.detail
    logger.info('App', 'Save dialog result', { action, name, folderPath })
    if (action === 'saveAndOpen') {
      const newId = generateId()
      const newDir = { _id: newId, name, path: folderPath, description, startOnLaunch, continueSession, model }
      addDirectory(newDir)
      if (setAsDefaultTab) {
        setDefaultTab(folderPath)
        persist([...state.savedDirectories, newDir], folderPath, getLanguage())
      }
      const args = [
        model ? `--model ${model}` : '',
        continueSession ? '--continue' : '',
      ].filter(Boolean).join(' ')
      const id = await createTab(name, folderPath, args, newId)
      setActiveTab(id)
    } else if (action === 'saveOnly') {
      const newId = generateId()
      const newDir = { _id: newId, name, path: folderPath, description, startOnLaunch, continueSession, model }
      addDirectory(newDir)
      if (setAsDefaultTab) {
        setDefaultTab(folderPath)
        persist([...state.savedDirectories, newDir], folderPath, getLanguage())
      }
    } else if (action === 'openOnly') {
      const id = await createTab(name, folderPath)
      setActiveTab(id)
    }
  }, [addDirectory, createTab, setActiveTab, setDefaultTab, persist, state.savedDirectories])

  useEffect(() => {
    document.addEventListener('save-dialog-result', handleSaveDialogResult)
    return () => document.removeEventListener('save-dialog-result', handleSaveDialogResult)
  }, [handleSaveDialogResult])

  // Open config editor
  useEffect(() => {
    const handler = async () => {
      if (state.editorTabId) {
        const existing = state.tabs.find(t => t.id === state.editorTabId)
        if (existing) { setActiveTab(state.editorTabId); return }
        setEditorTab(null)
      }
      const result = await api.readOpencodeConfig()
      if (!result) return
      const id = generateTabId()
      const tab = {
        id,
        name: 'opencode.json',
        displayName: 'opencode.json',
        type: 'editor',
        filePath: result.filePath,
        content: result.content,
        isDirty: false,
        status: 'running',
      }
      addTab(tab)
      setEditorTab(id)
      setActiveTab(id)
      logger.info('App', 'Open config editor', { tabId: id, filePath: result.filePath })
    }
    document.addEventListener('open-config-editor', handler)
    return () => document.removeEventListener('open-config-editor', handler)
  }, [state.editorTabId, state.tabs, addTab, setActiveTab, setEditorTab])

  // Open settings
  useEffect(() => {
    const handler = () => setShowSettings(true)
    document.addEventListener('open-settings', handler)
    return () => document.removeEventListener('open-settings', handler)
  }, [])

  // Add directory event from keyboard shortcut
  useEffect(() => {
    const handler = () => {
      document.dispatchEvent(new CustomEvent('open-add-directory'))
    }
    document.addEventListener('add-directory', handler)
    return () => document.removeEventListener('add-directory', handler)
  }, [])

  // Activate tab event (e.g. from preview card click)
  useEffect(() => {
    const handler = (e) => {
      setActiveTab(e.detail.id)
    }
    document.addEventListener('activate-tab', handler)
    return () => document.removeEventListener('activate-tab', handler)
  }, [setActiveTab])

  // Build status indicator — updates window title
  useEffect(() => {
    const unsub = api.onBuildStatus((data) => {
      if (data.status === 'needsBuild' || data.status === 'building') {
        document.title = '\u26A0 OpenCode Launcher'
      } else if (data.status === 'done') {
        document.title = 'OpenCode Launcher'
      }
    })
    return () => unsub?.()
  }, [])

  // Track split ratio changes
  useEffect(() => {
    const handler = (e) => {
      const { tabId, ratio } = e.detail
      // Find all split children of this tab and update their ratio
      const splits = state.tabs.filter(t => t.parentId === tabId)
      splits.forEach(s => updateTab(s.id, { splitRatio: ratio }))
    }
    document.addEventListener('split-ratio-change', handler)
    return () => document.removeEventListener('split-ratio-change', handler)
  }, [state.tabs, updateTab])

  // Render panes for tabs
  const terminalTabRefs = useRef({})
  const editorTabRefs = useRef({})

  const handleProcessingChange = useCallback((tabId, isProcessing, isStarting) => {
    logger.debug('App', 'Processing changed', { tabId, isProcessing, isStarting })
    updateTab(tabId, {
      isProcessing: () => isProcessing,
      status: 'running',
    })
  }, [updateTab])

  const handleStatusChange = useCallback((tabId, status) => {
    updateTab(tabId, { status })
    logger.info('App', 'Status changed', { tabId, status })
    const tab = state.tabs.find(t => t.id === tabId)
    if (tab) recalcDisplayNames(tab.cwd)
  }, [state.tabs, updateTab, recalcDisplayNames])

  const handleDirtyChange = useCallback((tabId, dirty) => {
    logger.debug('App', 'Dirty change', { tabId, dirty })
    updateTab(tabId, { isDirty: dirty })
  }, [updateTab])

  const handleEditorSave = useCallback(async (tabId, value) => {
    const tab = state.tabs.find(t => t.id === tabId)
    if (!tab || tab.type !== 'editor') return
    const result = await api.writeOpencodeConfig(value, tab.filePath)
    if (result?.ok) {
      updateTab(tabId, { isDirty: false, content: value })
      logger.info('App', 'Editor save OK', { tabId, filePath: tab.filePath })
    } else {
      logger.warn('App', 'Editor save failed', { tabId })
    }
  }, [state.tabs, updateTab])

  // Settings
  const handleSettingsSave = useCallback((selectedLang) => {
    const langChanged = selectedLang !== getLanguage()
    if (langChanged) {
      setAppLang(selectedLang)
      setLanguage(selectedLang)
    }
    persist(state.savedDirectories, state.defaultTab, selectedLang)
    setShowSettings(false)
    logger.info('App', 'Save settings', { language: selectedLang, langChanged })
    if (langChanged) {
      setNextLang(selectedLang)
      setShowRestart(true)
    } else {
      applyTranslations()
    }
  }, [state.savedDirectories, state.defaultTab, setAppLang, setLanguage, setNextLang, applyTranslations, persist])

  const handleSettingsCancel = useCallback(() => {
    logger.info('App', 'Cancel settings')
    setShowSettings(false)
  }, [])

  // DevTools separate window route (detected via URL hash)
  if (typeof window !== 'undefined' && window.location.hash === '#/devtools') {
    return <DevToolsApp />
  }

  return (
    <div className={styles.app}>
      <TabBar
        tabs={state.tabs}
        activeId={state.activeId}
        onActivate={setActiveTab}
        onCloseTab={closeTab}
        onAddTab={() => document.dispatchEvent(new CustomEvent('open-add-directory'))}
        onContextMenu={(x, y, id, type, hasSplits) => setContextMenu({ x, y, visible: true, targetId: id, type, hasSplits: !!hasSplits })}
      />

      <div ref={contentRef} className={styles.content} id="content-area">
        {/* Dashboard (Home) */}
        <div className={`${styles.contentPane} ${state.activeId === 'home' ? styles.active : ''}`}>
          <Dashboard
            onOpenTerminal={openTerminalForDir}
            onCloseTab={closeTab}
            onRestartTerminal={restartTerminal}
          />
        </div>

        {/* Terminal Panes */}
        {state.tabs.filter(t => t.type !== 'editor' && !t.isSplit).map(tab => (
          <div
            key={tab.id}
            className={`${styles.contentPane} ${tab.id === state.activeId ? styles.active : ''}`}
          >
            <TerminalPane
              tab={tab}
              isActive={tab.id === state.activeId}
              onProcessingChange={handleProcessingChange}
              onStatusChange={handleStatusChange}
              splits={state.tabs.filter(t => t.parentId === tab.id)}
            />
          </div>
        ))}

        {/* Editor Panes */}
        {state.tabs.filter(t => t.type === 'editor').map(tab => (
          <div
            key={tab.id}
            className={`${styles.contentPane} editorPane ${tab.id === state.activeId ? styles.active : ''}`}
          >
            <ConfigEditor
              tab={tab}
              isActive={tab.id === state.activeId}
              onDirtyChange={handleDirtyChange}
              onSave={handleEditorSave}
            />
          </div>
        ))}
      </div>

      {/* Context Menu */}
      <ContextMenu
        x={contextMenu.x}
        y={contextMenu.y}
        visible={contextMenu.visible}
        type={contextMenu.type}
        hasSplits={contextMenu.hasSplits}
        onClose={handleContextClose}
        onSplitTerminal={handleCtxSplitTerminal}
        onCloseSplitTerminal={handleCtxSplitTerminal}
        onRestart={handleCtxRestart}
        onCloseTab={handleCtxCloseTab}
        onSave={handleCtxSave}
        onDeleteCard={handleDeleteCard}
        onSetDefaultTab={handleCtxSetDefaultTab}
        onResetTerminal={handleCtxResetTerminal}
      />

      {/* Settings Dialog */}
      {showSettings && (
        <SettingsDialog
          flagDe={state.flagDe}
          flagEn={state.flagEn}
          onSave={handleSettingsSave}
          onCancel={handleSettingsCancel}
        />
      )}

      {/* Restart Dialog */}
      <RestartDialog
        visible={showRestart}
        onRestart={() => api.restartApp()}
        onLater={() => setShowRestart(false)}
      />

      {/* Rebuild Overlay */}
      <RebuildOverlay />
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppInner />
      </AppProvider>
    </ErrorBoundary>
  )
}
