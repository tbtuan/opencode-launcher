export const initialState = {
  tabs: [],
  activeId: 'home',
  savedDirectories: [],
  availableModels: [],
  modelsTimestamp: null,
  defaultTab: 'home',
  editorTabId: null,
  language: 'en',
  flagDe: '',
  flagEn: '',
  isLoaded: false,
  savedTabOrder: null,
}

export function appReducer(state, action) {
  switch (action.type) {
    case 'SET_INITIAL_DATA':
      return {
        ...state,
        ...action.payload,
        isLoaded: true,
      }

    case 'SET_ACTIVE_TAB':
      return { ...state, activeId: action.payload }

    case 'SET_TABS':
      return { ...state, tabs: action.payload }

    case 'ADD_TAB':
      return { ...state, tabs: [...state.tabs, action.payload] }

    case 'INSERT_TAB':
      const insertTabs = [...state.tabs]
      insertTabs.splice(action.index, 0, action.payload)
      return { ...state, tabs: insertTabs }

    case 'REMOVE_TAB':
      return {
        ...state,
        tabs: state.tabs.filter(t => t.id !== action.payload),
        editorTabId: state.editorTabId === action.payload ? null : state.editorTabId,
      }

    case 'UPDATE_TAB':
      return {
        ...state,
        tabs: state.tabs.map(t =>
          t.id === action.payload.id ? { ...t, ...action.payload.updates } : t
        ),
      }

    case 'SET_DIRECTORIES':
      return { ...state, savedDirectories: action.payload }

    case 'ADD_DIRECTORY':
      return { ...state, savedDirectories: [...state.savedDirectories, action.payload] }

    case 'REMOVE_DIRECTORY':
      return {
        ...state,
        savedDirectories: state.savedDirectories.filter(d => d._id !== action.payload),
      }

    case 'UPDATE_DIRECTORY':
      return {
        ...state,
        savedDirectories: state.savedDirectories.map(d =>
          d._id === action.payload._id ? { ...d, ...action.payload.updates } : d
        ),
      }

    case 'SET_MODELS':
      return {
        ...state,
        availableModels: action.payload.models,
        modelsTimestamp: action.payload.timestamp,
      }

    case 'SET_DEFAULT_TAB':
      return { ...state, defaultTab: action.payload }

    case 'SET_EDITOR_TAB':
      return { ...state, editorTabId: action.payload }

    case 'SET_LANGUAGE':
      return { ...state, language: action.payload }

    case 'SET_FLAGS':
      return { ...state, flagDe: action.payload.flagDe, flagEn: action.payload.flagEn }

    case 'MOVE_TAB':
      const { fromIdx, toIdx } = action.payload
      const newTabs = [...state.tabs]
      const [moved] = newTabs.splice(fromIdx, 1)
      newTabs.splice(toIdx, 0, moved)
      return { ...state, tabs: newTabs }

    case 'MOVE_DIRECTORY':
      const { fromDirIdx, toDirIdx } = action.payload
      const newDirs = [...state.savedDirectories]
      const [movedDir] = newDirs.splice(fromDirIdx, 1)
      newDirs.splice(toDirIdx, 0, movedDir)
      return { ...state, savedDirectories: newDirs }

    default:
      return state
  }
}
