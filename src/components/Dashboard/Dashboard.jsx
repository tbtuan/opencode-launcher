import { useCallback, useEffect, useState, useRef } from 'react'
import styles from './Dashboard.module.css'
import { DashboardHeader } from './DashboardHeader'
import { NoDirsPlaceholder } from './NoDirsPlaceholder'
import { DropOverlay } from './DropOverlay'
import { getTerminalDimensions } from '../../services/terminalService'
import { DirectoryCard } from './DirectoryCard/DirectoryCard'
import { PreviewSection } from './PreviewSection/PreviewSection'
import { SaveDialog } from '../Modals/SaveDialog'
import { useApp } from '../../store/AppContext'
import { getDirNameFromPath } from '../../utils/helpers'
import { api } from '../../services/api'
import { generateId } from '../../services/configService'
import { t } from '../../i18n'

export function Dashboard({ onOpenTerminal, onCloseTab, onRestartTerminal }) {
  const {
    state,
    removeDirectory,
    moveDirectory,
  } = useApp()

  const [dragCounter, setDragCounter] = useState(0)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [saveDialogData, setSaveDialogData] = useState(null)
  const dashboardRef = useRef(null)

  const handleAddDirectory = useCallback(async () => {
    try {
      const folderPath = await api.openFolder()
      if (!folderPath) return
      const defaultName = getDirNameFromPath(folderPath)
      setSaveDialogData({ folderPath, defaultName })
      setShowSaveDialog(true)
    } catch (e) {}
  }, [])

  // Drag & Drop for files onto dashboard
  useEffect(() => {
    const el = dashboardRef.current
    if (!el) return

    const handleDragEnter = (e) => {
      e.preventDefault()
      setDragCounter(c => c + 1)
    }

    const handleDragOver = (e) => {
      e.preventDefault()
    }

    const handleDragLeave = (e) => {
      e.preventDefault()
      setDragCounter(c => Math.max(0, c - 1))
    }

    const handleDrop = (e) => {
      e.preventDefault()
      setDragCounter(0)
      const file = e.dataTransfer.files[0]
      if (!file) return
      const folderPath = file.path
      const defaultName = getDirNameFromPath(folderPath)
      setSaveDialogData({ folderPath, defaultName })
      setShowSaveDialog(true)
    }

    el.addEventListener('dragenter', handleDragEnter)
    el.addEventListener('dragover', handleDragOver)
    el.addEventListener('dragleave', handleDragLeave)
    el.addEventListener('drop', handleDrop)

    return () => {
      el.removeEventListener('dragenter', handleDragEnter)
      el.removeEventListener('dragover', handleDragOver)
      el.removeEventListener('dragleave', handleDragLeave)
      el.removeEventListener('drop', handleDrop)
    }
  }, [])

  // Open add-directory dialog from TabBar "+" button or keyboard shortcut
  useEffect(() => {
    const handler = () => handleAddDirectory()
    document.addEventListener('open-add-directory', handler)
    return () => document.removeEventListener('open-add-directory', handler)
  }, [handleAddDirectory])

  // Card Drag & Drop
  useEffect(() => {
    const handler = (e) => {
      const { fromId, toId } = e.detail
      const fromIdx = state.savedDirectories.findIndex(d => d._id === fromId)
      const toIdx = state.savedDirectories.findIndex(d => d._id === toId)
      if (fromIdx !== -1 && toIdx !== -1) {
        moveDirectory(fromIdx, toIdx)
      }
    }
    document.addEventListener('card-drop', handler)
    return () => document.removeEventListener('card-drop', handler)
  }, [state.savedDirectories, moveDirectory])

  const handleContextMenu = useCallback((x, y, targetId, type) => {
    document.dispatchEvent(new CustomEvent('context-menu', {
      detail: { x, y, targetId, type },
    }))
  }, [])

  const handleDeleteCard = useCallback((id) => {
    removeDirectory(Number(id))
    // Close associated tab
    const tab = state.tabs.find(t => t.dirId === Number(id))
    if (tab) onCloseTab(tab.id)
  }, [state.tabs, removeDirectory, onCloseTab])

  const previews = Array.from((() => {
    const map = new Map()
    for (const tab of state.tabs) {
      if (tab.type !== 'editor' && tab.status === 'running' && !tab.isSplit) {
        const dims = getTerminalDimensions(tab.id)
        const childSplits = state.tabs.filter(t => t.parentId === tab.id && t.status === 'running')
        const splits = childSplits.map(s => ({
          tab: s,
          isProcessing: s.isProcessing?.(),
          cols: getTerminalDimensions(s.id)?.cols || 80,
          rows: getTerminalDimensions(s.id)?.rows || 24,
          splitRatio: s.splitRatio || 0.5,
        }))
        map.set(tab.id, {
          tab,
          isProcessing: tab.isProcessing?.(),
          cols: dims?.cols || 80,
          rows: dims?.rows || 24,
          splits,
        })
      }
    }
    return map
  })()).map(([_, v]) => v)

  return (
    <div
      ref={dashboardRef}
      className={styles.dashboard}
      id="dashboard"
    >
      <DashboardHeader
        modelsTimestamp={state.modelsTimestamp}
      />

      <div className={styles.cardsGrid} id="cards-grid">
        {state.savedDirectories.map(dir => (
          <DirectoryCard
            key={dir._id}
            dir={dir}
            onOpenTerminal={onOpenTerminal}
            onCloseTab={onCloseTab}
            onRestartTerminal={onRestartTerminal}
            onContextMenu={handleContextMenu}
          />
        ))}
      </div>

      <NoDirsPlaceholder visible={state.savedDirectories.length === 0} />

      <PreviewSection
        previews={previews}
        onActivate={(id) => {
          document.dispatchEvent(new CustomEvent('activate-tab', { detail: { id } }))
        }}
      />

      <DropOverlay visible={dragCounter > 0} />

      {showSaveDialog && saveDialogData && (
        <SaveDialog
          folderPath={saveDialogData.folderPath}
          defaultName={saveDialogData.defaultName}
          onSaveAndOpen={(data) => {
            setShowSaveDialog(false)
            document.dispatchEvent(new CustomEvent('save-dialog-result', {
              detail: { action: 'saveAndOpen', folderPath: saveDialogData.folderPath, ...data },
            }))
          }}
          onSaveOnly={(data) => {
            setShowSaveDialog(false)
            document.dispatchEvent(new CustomEvent('save-dialog-result', {
              detail: { action: 'saveOnly', folderPath: saveDialogData.folderPath, ...data },
            }))
          }}
          onOpenOnly={() => {
            setShowSaveDialog(false)
            document.dispatchEvent(new CustomEvent('save-dialog-result', {
              detail: { action: 'openOnly', name: saveDialogData.defaultName, folderPath: saveDialogData.folderPath },
            }))
          }}
          onCancel={() => setShowSaveDialog(false)}
        />
      )}
    </div>
  )
}


