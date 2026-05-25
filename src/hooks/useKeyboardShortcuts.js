import { useEffect } from 'react'
import { logger } from '../services/logger'

export function useKeyboardShortcuts({
  onNewTerminal,
  onCloseTab,
  onCycleTab,
  onSaveEditor,
  activeId,
  tabs,
  editorTabId,
}) {
  useEffect(() => {
    function handler(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (editorTabId) {
          logger.info('KB', 'Save editor')
          onSaveEditor?.()
        }
        return
      }

      if (e.ctrlKey && e.key === 't') {
        e.preventDefault()
        logger.info('KB', 'New terminal')
        onNewTerminal?.()
        return
      }

      if (e.ctrlKey && e.key === 'w') {
        e.preventDefault()
        if (activeId !== 'home') {
          logger.info('KB', 'Close tab', { id: activeId })
          onCloseTab?.(activeId)
        }
        return
      }

      if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault()
        if (tabs.length === 0) return
        const allIds = ['home', ...tabs.map(t => t.id)]
        const idx = allIds.indexOf(activeId)
        const next = e.shiftKey
          ? allIds[(idx - 1 + allIds.length) % allIds.length]
          : allIds[(idx + 1) % allIds.length]
        logger.info('KB', 'Cycle tab', { direction: e.shiftKey ? 'prev' : 'next', target: next })
        onCycleTab?.(next)
        return
      }

      if (e.key === 'Escape') {
        document.dispatchEvent(new CustomEvent('escape-pressed'))
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [activeId, tabs, editorTabId, onNewTerminal, onCloseTab, onCycleTab, onSaveEditor])
}
