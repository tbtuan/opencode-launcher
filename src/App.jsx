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
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useResizeObserver } from './hooks/useResizeObserver'
import { loadConfig, checkAndCleanDirectories, persistConfig, persistTabOrder, generateId } from './services/configService'
import { createPtySession, killPty, clearTerminalDimensions } from './services/terminalService'
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
  const [contextMenu, setContextMenu] = useState({ x: 0, y: 0, visible: false, targetId: null, type: 'tab' })
  const [showSettings, setShowSettings] = useState(false)
  const [showRestart, setShowRestart] = useState(false)
  const [nextLang, setNextLang] = useState(null)


  // Initialize
  useEffect(() => {
    async function init() {
      try {
        const config = await loadConfig()
        const { valid: dirs, removed } = await checkAndCleanDirectories(config.directories || [])
        if (removed.length > 0) {
          await api.saveConfig({ ...config, directories: dirs })
        }
        setDirectories(dirs)

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
          // Will be applied when tabs are created
          dispatch({ type: 'SET_INITIAL_DATA', payload: { defaultTab: resolvedDefault, savedTabOrder: tabOrder } })
        }

        dispatch({ type: 'SET_INITIAL_DATA', payload: { isLoaded: true } })
      } catch (e) {
        console.error('[init]', e)
        dispatch({ type: 'SET_INITIAL_DATA', payload: { isLoaded: true } })
      }
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-launch directories
  const tabsRef = useRef(state.tabs)
  useEffect(() => { tabsRef.current = state.tabs }, [state.tabs])

  useEffect(() => {
    if (!state.isLoaded) return
    const autoLaunch = state.savedDirectories.filter(d => d.startOnLaunch)
    async function run() {
      for (const dir of autoLaunch) {
        const args = dir.continueSession ? '--continue' : ''
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
        window.dispatchEvent(new CustomEvent('resize-active-tab'))
      }
    } catch (e) {
      updateTab(id, { status: 'error' })
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
        removeTab(id)
        recalcDisplayNames(closedCwd)
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
      console.error('[closeTab] Error:', e)
    }
  }, [state.tabs, state.activeId, state.editorTabId, setActiveTab, setEditorTab, removeTab, updateTab])

  // Restart terminal
  const restartTerminal = useCallback(async (dir, tab) => {
    if (!tab) return
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
      const { x, y, targetId, type } = e.detail
      setContextMenu({ x, y, visible: true, targetId, type })
    }
    document.addEventListener('context-menu', handler)
    return () => document.removeEventListener('context-menu', handler)
  }, [])

  const handleContextClose = useCallback(() => {
    setContextMenu(prev => ({ ...prev, visible: false, targetId: null }))
  }, [])

  // Context menu actions
  const handleCtxRestart = useCallback(async () => {
    const id = contextMenu.targetId
    handleContextClose()
    if (!id) return
    const tab = state.tabs.find(t => t.id === id)
    if (!tab) return
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
    if (id) closeTab(id)
  }, [contextMenu.targetId, handleContextClose, closeTab])

  const handleCtxSave = useCallback(() => {
    handleContextClose()
    document.dispatchEvent(new CustomEvent('save-editor'))
  }, [handleContextClose])

  const handleDeleteCard = useCallback(() => {
    const id = Number(contextMenu.targetId)
    handleContextClose()
    if (!id) return
    removeDirectory(id)
    const tab = state.tabs.find(t => t.dirId === id)
    if (tab) closeTab(tab.id)
  }, [contextMenu.targetId, state.tabs, removeDirectory, closeTab, handleContextClose])

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
    const { action, name, folderPath, description, startOnLaunch, continueSession, model } = e.detail
    if (action === 'saveAndOpen') {
      const newId = generateId()
      addDirectory({ _id: newId, name, path: folderPath, description, startOnLaunch, continueSession, model })
      const args = [
        model ? `--model ${model}` : '',
        continueSession ? '--continue' : '',
      ].filter(Boolean).join(' ')
      const id = await createTab(name, folderPath, args, newId)
      setActiveTab(id)
    } else if (action === 'saveOnly') {
      const newId = generateId()
      addDirectory({ _id: newId, name, path: folderPath, description, startOnLaunch, continueSession, model })
    } else if (action === 'openOnly') {
      const id = await createTab(name, folderPath)
      setActiveTab(id)
    }
  }, [addDirectory, createTab, setActiveTab])

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

  // Render panes for tabs
  const terminalTabRefs = useRef({})
  const editorTabRefs = useRef({})

  const handleProcessingChange = useCallback((tabId, isProcessing, isStarting) => {
    updateTab(tabId, {
      isProcessing: () => isProcessing,
      status: 'running',
    })
  }, [updateTab])

  const handleStatusChange = useCallback((tabId, status) => {
    updateTab(tabId, { status })
    const tab = state.tabs.find(t => t.id === tabId)
    if (tab) recalcDisplayNames(tab.cwd)
  }, [state.tabs, updateTab, recalcDisplayNames])

  const handleDirtyChange = useCallback((tabId, dirty) => {
    updateTab(tabId, { isDirty: dirty })
  }, [updateTab])

  const handleEditorSave = useCallback(async (tabId, value) => {
    const tab = state.tabs.find(t => t.id === tabId)
    if (!tab || tab.type !== 'editor') return
    const result = await api.writeOpencodeConfig(value, tab.filePath)
    if (result?.ok) {
      updateTab(tabId, { isDirty: false, content: value })
    }
  }, [state.tabs, updateTab])

  // Settings
  const handleSettingsSave = useCallback((selectedTab, selectedLang) => {
    setDefaultTab(selectedTab)
    const langChanged = selectedLang !== getLanguage()
    if (langChanged) {
      setAppLang(selectedLang)
      setLanguage(selectedLang)
    }
    persist(state.savedDirectories, selectedTab, selectedLang)
    setShowSettings(false)
    if (langChanged) {
      setNextLang(selectedLang)
      setShowRestart(true)
    } else {
      applyTranslations()
    }
  }, [state.savedDirectories, setDefaultTab, setAppLang, persist])

  const handleSettingsCancel = useCallback(() => {
    setShowSettings(false)
  }, [])

  return (
    <div className={styles.app}>
      <TabBar
        tabs={state.tabs}
        activeId={state.activeId}
        onActivate={setActiveTab}
        onCloseTab={closeTab}
        onAddTab={() => document.dispatchEvent(new CustomEvent('open-add-directory'))}
        onContextMenu={(x, y, id, type) => setContextMenu({ x, y, visible: true, targetId: id, type })}
        onMoveTab={moveTab}
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
        {state.tabs.filter(t => t.type !== 'editor').map(tab => (
          <div
            key={tab.id}
            className={`${styles.contentPane} ${tab.id === state.activeId ? styles.active : ''}`}
          >
            <TerminalPane
              tab={tab}
              isActive={tab.id === state.activeId}
              onProcessingChange={handleProcessingChange}
              onStatusChange={handleStatusChange}
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
        onClose={handleContextClose}
        onRestart={handleCtxRestart}
        onCloseTab={handleCtxCloseTab}
        onSave={handleCtxSave}
        onDeleteCard={handleDeleteCard}
      />

      {/* Settings Dialog */}
      {showSettings && (
        <SettingsDialog
          directories={state.savedDirectories}
          defaultTab={state.defaultTab}
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
