import { createContext, useContext, useReducer, useCallback, useEffect } from 'react'
import { appReducer, initialState } from './appReducer'
import { persistConfig } from '../services/configService'
import { getLanguage, setLanguage } from '../i18n'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState)

  const persist = useCallback(async (dirs, tab, lang) => {
    await persistConfig(dirs, tab, lang)
  }, [])

  const setActiveTab = useCallback((id) => {
    dispatch({ type: 'SET_ACTIVE_TAB', payload: id })
  }, [])

  const addTab = useCallback((tab) => {
    dispatch({ type: 'ADD_TAB', payload: tab })
  }, [])

  const insertTab = useCallback((tab, index) => {
    dispatch({ type: 'INSERT_TAB', payload: tab, index })
  }, [])

  const removeTab = useCallback((id) => {
    dispatch({ type: 'REMOVE_TAB', payload: id })
  }, [])

  const updateTab = useCallback((id, updates) => {
    dispatch({ type: 'UPDATE_TAB', payload: { id, updates } })
  }, [])

  const moveTab = useCallback((fromIdx, toIdx) => {
    dispatch({ type: 'MOVE_TAB', payload: { fromIdx, toIdx } })
  }, [])

  const setDirectories = useCallback((dirs) => {
    dispatch({ type: 'SET_DIRECTORIES', payload: dirs })
  }, [])

  const addDirectory = useCallback((dir) => {
    dispatch({ type: 'ADD_DIRECTORY', payload: dir })
    persist([...state.savedDirectories, dir], state.defaultTab, state.language)
  }, [state.savedDirectories, state.defaultTab, state.language, persist])

  const removeDirectory = useCallback((id) => {
    dispatch({ type: 'REMOVE_DIRECTORY', payload: id })
    const newDirs = state.savedDirectories.filter(d => d._id !== id)
    persist(newDirs, state.defaultTab, state.language)
  }, [state.savedDirectories, state.defaultTab, state.language, persist])

  const updateDirectory = useCallback((id, updates) => {
    dispatch({ type: 'UPDATE_DIRECTORY', payload: { _id: id, updates } })
    const newDirs = state.savedDirectories.map(d =>
      d._id === id ? { ...d, ...updates } : d
    )
    persist(newDirs, state.defaultTab, state.language)
  }, [state.savedDirectories, state.defaultTab, state.language, persist])

  const moveDirectory = useCallback((fromIdx, toIdx) => {
    dispatch({ type: 'MOVE_DIRECTORY', payload: { fromDirIdx: fromIdx, toDirIdx: toIdx } })
    const newDirs = [...state.savedDirectories]
    const [moved] = newDirs.splice(fromIdx, 1)
    newDirs.splice(toIdx, 0, moved)
    persist(newDirs, state.defaultTab, state.language)
  }, [state.savedDirectories, state.defaultTab, state.language, persist])

  const setModels = useCallback((models, timestamp) => {
    dispatch({ type: 'SET_MODELS', payload: { models, timestamp } })
  }, [])

  const setDefaultTab = useCallback((tab) => {
    dispatch({ type: 'SET_DEFAULT_TAB', payload: tab })
  }, [])

  const setEditorTab = useCallback((id) => {
    dispatch({ type: 'SET_EDITOR_TAB', payload: id })
  }, [])

  const setLanguage_ = useCallback((lang) => {
    dispatch({ type: 'SET_LANGUAGE', payload: lang })
    setLanguage(lang)
  }, [])

  const setFlags = useCallback((flagDe, flagEn) => {
    dispatch({ type: 'SET_FLAGS', payload: { flagDe, flagEn } })
  }, [])

  const value = {
    state,
    dispatch,
    setActiveTab,
    addTab,
    insertTab,
    removeTab,
    updateTab,
    moveTab,
    setDirectories,
    addDirectory,
    removeDirectory,
    updateDirectory,
    moveDirectory,
    setModels,
    setDefaultTab,
    setEditorTab,
    setLanguage: setLanguage_,
    setFlags,
    persist,
    insertTab,
  }

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
