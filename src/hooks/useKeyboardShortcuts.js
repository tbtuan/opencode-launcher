import { useEffect } from 'react'

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
          onSaveEditor?.()
        }
        return
      }

      if (e.ctrlKey && e.key === 't') {
        e.preventDefault()
        onNewTerminal?.()
        return
      }

      if (e.ctrlKey && e.key === 'w') {
        e.preventDefault()
        if (activeId !== 'home') {
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
