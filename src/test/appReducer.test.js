import { describe, it, expect } from 'vitest'
import { appReducer, initialState } from '../store/appReducer'

const tabFixture = (id, overrides = {}) => ({
  id,
  title: `Tab ${id}`,
  type: 'terminal',
  ...overrides,
})

const dirFixture = (_id, overrides = {}) => ({
  _id,
  name: `Dir ${_id}`,
  path: `/path/to/${_id}`,
  ...overrides,
})

describe('appReducer', () => {
  describe('default / unknown action', () => {
    it('returns the same state for an unknown action type', () => {
      const state = { ...initialState, tabs: [tabFixture('a')] }
      const next = appReducer(state, { type: 'UNKNOWN', payload: {} })
      expect(next).toBe(state)
    })
  })

  // ── SET_INITIAL_DATA ──────────────────────────────────────────────────────

  describe('SET_INITIAL_DATA', () => {
    it('merges payload into state and sets isLoaded to true', () => {
      const payload = {
        tabs: [tabFixture('x')],
        savedDirectories: [dirFixture('d1')],
        language: 'de',
      }
      const next = appReducer(initialState, { type: 'SET_INITIAL_DATA', payload })
      expect(next).toEqual({
        ...initialState,
        ...payload,
        isLoaded: true,
      })
    })

    it('preserves existing fields not in payload', () => {
      const state = { ...initialState, language: 'de' }
      const payload = { tabs: [tabFixture('x')] }
      const next = appReducer(state, { type: 'SET_INITIAL_DATA', payload })
      expect(next.language).toBe('de')
      expect(next.isLoaded).toBe(true)
    })

    it('overrides isLoaded even if payload includes it as false', () => {
      const next = appReducer(initialState, {
        type: 'SET_INITIAL_DATA',
        payload: { isLoaded: false },
      })
      expect(next.isLoaded).toBe(true)
    })
  })

  // ── SET_ACTIVE_TAB ────────────────────────────────────────────────────────

  describe('SET_ACTIVE_TAB', () => {
    it('sets activeId to the given payload', () => {
      const next = appReducer(initialState, { type: 'SET_ACTIVE_TAB', payload: 'tab-2' })
      expect(next).toEqual({ ...initialState, activeId: 'tab-2' })
    })

    it('accepts any string value', () => {
      const next = appReducer(initialState, { type: 'SET_ACTIVE_TAB', payload: '' })
      expect(next.activeId).toBe('')
    })
  })

  // ── SET_TABS ──────────────────────────────────────────────────────────────

  describe('SET_TABS', () => {
    it('replaces the tabs array entirely', () => {
      const state = { ...initialState, tabs: [tabFixture('old')] }
      const newTabs = [tabFixture('a'), tabFixture('b')]
      const next = appReducer(state, { type: 'SET_TABS', payload: newTabs })
      expect(next.tabs).toEqual(newTabs)
      expect(next.tabs).not.toBe(state.tabs)
    })

    it('sets tabs to an empty array', () => {
      const state = { ...initialState, tabs: [tabFixture('a')] }
      const next = appReducer(state, { type: 'SET_TABS', payload: [] })
      expect(next.tabs).toEqual([])
    })
  })

  // ── ADD_TAB ───────────────────────────────────────────────────────────────

  describe('ADD_TAB', () => {
    it('adds a tab to an empty tabs array', () => {
      const tab = tabFixture('t1')
      const next = appReducer(initialState, { type: 'ADD_TAB', payload: tab })
      expect(next.tabs).toEqual([tab])
    })

    it('appends a tab to existing tabs', () => {
      const existing = tabFixture('t1')
      const state = { ...initialState, tabs: [existing] }
      const added = tabFixture('t2')
      const next = appReducer(state, { type: 'ADD_TAB', payload: added })
      expect(next.tabs).toEqual([existing, added])
    })

    it('preserves all existing state properties', () => {
      const state = { ...initialState, language: 'de', activeId: 'custom' }
      const next = appReducer(state, { type: 'ADD_TAB', payload: tabFixture('t1') })
      expect(next.language).toBe('de')
      expect(next.activeId).toBe('custom')
    })
  })

  // ── REMOVE_TAB ────────────────────────────────────────────────────────────

  describe('REMOVE_TAB', () => {
    it('removes a tab by id', () => {
      const tabs = [tabFixture('a'), tabFixture('b'), tabFixture('c')]
      const state = { ...initialState, tabs }
      const next = appReducer(state, { type: 'REMOVE_TAB', payload: 'b' })
      expect(next.tabs).toEqual([tabFixture('a'), tabFixture('c')])
    })

    it('does nothing when id does not exist', () => {
      const tabs = [tabFixture('a')]
      const state = { ...initialState, tabs }
      const next = appReducer(state, { type: 'REMOVE_TAB', payload: 'non-existent' })
      expect(next.tabs).toEqual(tabs)
    })

    it('clears editorTabId when the removed tab is the editor tab', () => {
      const tabs = [tabFixture('editor-tab')]
      const state = { ...initialState, tabs, editorTabId: 'editor-tab' }
      const next = appReducer(state, { type: 'REMOVE_TAB', payload: 'editor-tab' })
      expect(next.editorTabId).toBeNull()
    })

    it('preserves editorTabId when a non-editor tab is removed', () => {
      const tabs = [tabFixture('a'), tabFixture('b')]
      const state = { ...initialState, tabs, editorTabId: 'b' }
      const next = appReducer(state, { type: 'REMOVE_TAB', payload: 'a' })
      expect(next.editorTabId).toBe('b')
    })

    it('removing the last tab results in empty array', () => {
      const tabs = [tabFixture('only')]
      const state = { ...initialState, tabs }
      const next = appReducer(state, { type: 'REMOVE_TAB', payload: 'only' })
      expect(next.tabs).toEqual([])
    })
  })

  // ── UPDATE_TAB ────────────────────────────────────────────────────────────

  describe('UPDATE_TAB', () => {
    it('updates specified fields on the matching tab', () => {
      const tabs = [tabFixture('a', { title: 'Original' }), tabFixture('b')]
      const state = { ...initialState, tabs }
      const next = appReducer(state, {
        type: 'UPDATE_TAB',
        payload: { id: 'a', updates: { title: 'Updated' } },
      })
      expect(next.tabs[0].title).toBe('Updated')
      expect(next.tabs[0].id).toBe('a')
    })

    it('preserves fields not in the updates object', () => {
      const tabs = [tabFixture('a', { title: 'Original', type: 'editor' })]
      const state = { ...initialState, tabs }
      const next = appReducer(state, {
        type: 'UPDATE_TAB',
        payload: { id: 'a', updates: { title: 'Changed' } },
      })
      expect(next.tabs[0].title).toBe('Changed')
      expect(next.tabs[0].type).toBe('editor')
    })

    it('does not modify unrelated tabs', () => {
      const tabs = [tabFixture('a'), tabFixture('b', { title: 'Keep' })]
      const state = { ...initialState, tabs }
      const next = appReducer(state, {
        type: 'UPDATE_TAB',
        payload: { id: 'a', updates: { title: 'Changed' } },
      })
      expect(next.tabs[1].title).toBe('Keep')
    })

    it('does nothing when tab id does not exist', () => {
      const tabs = [tabFixture('a')]
      const state = { ...initialState, tabs }
      const next = appReducer(state, {
        type: 'UPDATE_TAB',
        payload: { id: 'nonexistent', updates: { title: 'Nope' } },
      })
      expect(next.tabs).toEqual(tabs)
    })
  })

  // ── MOVE_TAB ──────────────────────────────────────────────────────────────

  describe('MOVE_TAB', () => {
    it('reorders tabs from one index to another (forward)', () => {
      const tabs = [tabFixture('a'), tabFixture('b'), tabFixture('c')]
      const state = { ...initialState, tabs }
      const next = appReducer(state, { type: 'MOVE_TAB', payload: { fromIdx: 0, toIdx: 2 } })
      expect(next.tabs.map(t => t.id)).toEqual(['b', 'c', 'a'])
    })

    it('reorders tabs from one index to another (backward)', () => {
      const tabs = [tabFixture('a'), tabFixture('b'), tabFixture('c')]
      const state = { ...initialState, tabs }
      const next = appReducer(state, { type: 'MOVE_TAB', payload: { fromIdx: 2, toIdx: 0 } })
      expect(next.tabs.map(t => t.id)).toEqual(['c', 'a', 'b'])
    })

    it('does nothing when fromIdx equals toIdx', () => {
      const tabs = [tabFixture('a'), tabFixture('b')]
      const state = { ...initialState, tabs }
      const next = appReducer(state, { type: 'MOVE_TAB', payload: { fromIdx: 1, toIdx: 1 } })
      expect(next.tabs.map(t => t.id)).toEqual(['a', 'b'])
    })

    it('creates a sparse array when moving on empty tabs (splice edge case)', () => {
      const state = { ...initialState, tabs: [] }
      const next = appReducer(state, { type: 'MOVE_TAB', payload: { fromIdx: 0, toIdx: 1 } })
      expect(next.tabs.length).toBe(1)
      expect(next.tabs[0]).toBeUndefined()
    })
  })

  // ── SET_DIRECTORIES ───────────────────────────────────────────────────────

  describe('SET_DIRECTORIES', () => {
    it('replaces the savedDirectories array', () => {
      const dirs = [dirFixture('d1'), dirFixture('d2')]
      const state = { ...initialState, savedDirectories: [dirFixture('old')] }
      const next = appReducer(state, { type: 'SET_DIRECTORIES', payload: dirs })
      expect(next.savedDirectories).toEqual(dirs)
      expect(next.savedDirectories).not.toBe(state.savedDirectories)
    })

    it('sets to an empty array', () => {
      const state = { ...initialState, savedDirectories: [dirFixture('d1')] }
      const next = appReducer(state, { type: 'SET_DIRECTORIES', payload: [] })
      expect(next.savedDirectories).toEqual([])
    })
  })

  // ── ADD_DIRECTORY ─────────────────────────────────────────────────────────

  describe('ADD_DIRECTORY', () => {
    it('appends a directory to savedDirectories', () => {
      const existing = dirFixture('d1')
      const added = dirFixture('d2')
      const state = { ...initialState, savedDirectories: [existing] }
      const next = appReducer(state, { type: 'ADD_DIRECTORY', payload: added })
      expect(next.savedDirectories).toEqual([existing, added])
    })

    it('adds to an empty list', () => {
      const dir = dirFixture('d1')
      const next = appReducer(initialState, { type: 'ADD_DIRECTORY', payload: dir })
      expect(next.savedDirectories).toEqual([dir])
    })
  })

  // ── REMOVE_DIRECTORY ──────────────────────────────────────────────────────

  describe('REMOVE_DIRECTORY', () => {
    it('removes a directory by _id', () => {
      const dirs = [dirFixture('a'), dirFixture('b'), dirFixture('c')]
      const state = { ...initialState, savedDirectories: dirs }
      const next = appReducer(state, { type: 'REMOVE_DIRECTORY', payload: 'b' })
      expect(next.savedDirectories).toEqual([dirFixture('a'), dirFixture('c')])
    })

    it('does nothing when _id does not exist', () => {
      const dirs = [dirFixture('a')]
      const state = { ...initialState, savedDirectories: dirs }
      const next = appReducer(state, { type: 'REMOVE_DIRECTORY', payload: 'nonexistent' })
      expect(next.savedDirectories).toEqual(dirs)
    })

    it('removes the last directory', () => {
      const state = { ...initialState, savedDirectories: [dirFixture('only')] }
      const next = appReducer(state, { type: 'REMOVE_DIRECTORY', payload: 'only' })
      expect(next.savedDirectories).toEqual([])
    })
  })

  // ── UPDATE_DIRECTORY ──────────────────────────────────────────────────────

  describe('UPDATE_DIRECTORY', () => {
    it('updates specified fields on the matching directory', () => {
      const dirs = [dirFixture('d1', { name: 'Old Name' }), dirFixture('d2')]
      const state = { ...initialState, savedDirectories: dirs }
      const next = appReducer(state, {
        type: 'UPDATE_DIRECTORY',
        payload: { _id: 'd1', updates: { name: 'New Name' } },
      })
      expect(next.savedDirectories[0].name).toBe('New Name')
      expect(next.savedDirectories[0].path).toBe('/path/to/d1')
    })

    it('does not modify unrelated directories', () => {
      const dirs = [dirFixture('a'), dirFixture('b', { name: 'Keep' })]
      const state = { ...initialState, savedDirectories: dirs }
      const next = appReducer(state, {
        type: 'UPDATE_DIRECTORY',
        payload: { _id: 'a', updates: { name: 'Changed' } },
      })
      expect(next.savedDirectories[1].name).toBe('Keep')
    })

    it('does nothing when _id does not exist', () => {
      const dirs = [dirFixture('a')]
      const state = { ...initialState, savedDirectories: dirs }
      const next = appReducer(state, {
        type: 'UPDATE_DIRECTORY',
        payload: { _id: 'nonexistent', updates: { name: 'Nope' } },
      })
      expect(next.savedDirectories).toEqual(dirs)
    })
  })

  // ── MOVE_DIRECTORY ────────────────────────────────────────────────────────

  describe('MOVE_DIRECTORY', () => {
    it('reorders directories (forward)', () => {
      const dirs = [dirFixture('a'), dirFixture('b'), dirFixture('c')]
      const state = { ...initialState, savedDirectories: dirs }
      const next = appReducer(state, {
        type: 'MOVE_DIRECTORY',
        payload: { fromDirIdx: 0, toDirIdx: 2 },
      })
      expect(next.savedDirectories.map(d => d._id)).toEqual(['b', 'c', 'a'])
    })

    it('reorders directories (backward)', () => {
      const dirs = [dirFixture('a'), dirFixture('b'), dirFixture('c')]
      const state = { ...initialState, savedDirectories: dirs }
      const next = appReducer(state, {
        type: 'MOVE_DIRECTORY',
        payload: { fromDirIdx: 2, toDirIdx: 0 },
      })
      expect(next.savedDirectories.map(d => d._id)).toEqual(['c', 'a', 'b'])
    })

    it('does nothing when fromDirIdx equals toDirIdx', () => {
      const dirs = [dirFixture('a'), dirFixture('b')]
      const state = { ...initialState, savedDirectories: dirs }
      const next = appReducer(state, {
        type: 'MOVE_DIRECTORY',
        payload: { fromDirIdx: 1, toDirIdx: 1 },
      })
      expect(next.savedDirectories.map(d => d._id)).toEqual(['a', 'b'])
    })

    it('creates a sparse array when moving on empty directories (splice edge case)', () => {
      const state = { ...initialState, savedDirectories: [] }
      const next = appReducer(state, {
        type: 'MOVE_DIRECTORY',
        payload: { fromDirIdx: 0, toDirIdx: 1 },
      })
      expect(next.savedDirectories.length).toBe(1)
      expect(next.savedDirectories[0]).toBeUndefined()
    })
  })

  // ── SET_MODELS ────────────────────────────────────────────────────────────

  describe('SET_MODELS', () => {
    it('sets availableModels and modelsTimestamp from payload', () => {
      const payload = {
        models: ['gpt-4', 'claude-3'],
        timestamp: 1700000000000,
      }
      const next = appReducer(initialState, { type: 'SET_MODELS', payload })
      expect(next.availableModels).toEqual(['gpt-4', 'claude-3'])
      expect(next.modelsTimestamp).toBe(1700000000000)
    })

    it('overwrites previous models and timestamp', () => {
      const state = {
        ...initialState,
        availableModels: ['old-model'],
        modelsTimestamp: 100,
      }
      const payload = { models: ['new-model'], timestamp: 200 }
      const next = appReducer(state, { type: 'SET_MODELS', payload })
      expect(next.availableModels).toEqual(['new-model'])
      expect(next.modelsTimestamp).toBe(200)
    })

    it('accepts empty models array', () => {
      const state = {
        ...initialState,
        availableModels: ['old'],
        modelsTimestamp: 100,
      }
      const payload = { models: [], timestamp: null }
      const next = appReducer(state, { type: 'SET_MODELS', payload })
      expect(next.availableModels).toEqual([])
      expect(next.modelsTimestamp).toBeNull()
    })
  })

  // ── SET_DEFAULT_TAB ───────────────────────────────────────────────────────

  describe('SET_DEFAULT_TAB', () => {
    it('sets defaultTab to the given payload', () => {
      const next = appReducer(initialState, { type: 'SET_DEFAULT_TAB', payload: 'my-tab' })
      expect(next.defaultTab).toBe('my-tab')
    })

    it('overrides previous defaultTab', () => {
      const state = { ...initialState, defaultTab: 'old' }
      const next = appReducer(state, { type: 'SET_DEFAULT_TAB', payload: 'new' })
      expect(next.defaultTab).toBe('new')
    })
  })

  // ── SET_EDITOR_TAB ────────────────────────────────────────────────────────

  describe('SET_EDITOR_TAB', () => {
    it('sets editorTabId to the given payload', () => {
      const next = appReducer(initialState, { type: 'SET_EDITOR_TAB', payload: 'editor-1' })
      expect(next.editorTabId).toBe('editor-1')
    })

    it('sets editorTabId to null when payload is null', () => {
      const state = { ...initialState, editorTabId: 'some-editor' }
      const next = appReducer(state, { type: 'SET_EDITOR_TAB', payload: null })
      expect(next.editorTabId).toBeNull()
    })
  })

  // ── SET_LANGUAGE ──────────────────────────────────────────────────────────

  describe('SET_LANGUAGE', () => {
    it('sets language to the given payload', () => {
      const next = appReducer(initialState, { type: 'SET_LANGUAGE', payload: 'de' })
      expect(next.language).toBe('de')
    })

    it('accepts any locale string', () => {
      const next = appReducer(initialState, { type: 'SET_LANGUAGE', payload: 'fr' })
      expect(next.language).toBe('fr')
    })
  })

  // ── SET_FLAGS ─────────────────────────────────────────────────────────────

  describe('SET_FLAGS', () => {
    it('sets flagDe and flagEn from payload', () => {
      const payload = { flagDe: '<svg>de</svg>', flagEn: '<svg>en</svg>' }
      const next = appReducer(initialState, { type: 'SET_FLAGS', payload })
      expect(next.flagDe).toBe('<svg>de</svg>')
      expect(next.flagEn).toBe('<svg>en</svg>')
    })

    it('overrides previous flag values', () => {
      const state = { ...initialState, flagDe: 'old-de', flagEn: 'old-en' }
      const payload = { flagDe: 'new-de', flagEn: 'new-en' }
      const next = appReducer(state, { type: 'SET_FLAGS', payload })
      expect(next.flagDe).toBe('new-de')
      expect(next.flagEn).toBe('new-en')
    })
  })
})
