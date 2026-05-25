import { useState, useCallback } from 'react'
import { cn } from '../../../utils/cn'
import styles from './DirectoryCard.module.css'
import { NoDescriptionPlaceholder } from './NoDescriptionPlaceholder'
import { ModelSelector } from './ModelSelector'
import { CardEditor } from './CardEditor'
import { useApp } from '../../../store/AppContext'
import { t } from '../../../i18n'
import { logger } from '../../../services/logger'

export function DirectoryCard({ dir, onOpenTerminal, onCloseTab, onRestartTerminal, onContextMenu }) {
  const { state, updateDirectory } = useApp()
  const [isEditing, setIsEditing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  const tab = state.tabs.find(t => t.dirId === dir._id)
  const isRunning = tab?.status === 'running'
  const displayName = isRunning && tab?.displayName ? tab.displayName : dir.name

  const handlePlay = useCallback((e) => {
    e.stopPropagation()
    logger.info('DirectoryCard', 'Play terminal', { dirId: dir._id, name: dir.name })
    onOpenTerminal?.(dir)
  }, [dir, onOpenTerminal])

  const handleStop = useCallback((e) => {
    e.stopPropagation()
    logger.info('DirectoryCard', 'Stop terminal', { dirId: dir._id, name: dir.name, tabId: tab?.id })
    if (tab) onCloseTab?.(tab.id)
  }, [dir, tab, onCloseTab])

  const handleRestart = useCallback((e) => {
    e.stopPropagation()
    logger.info('DirectoryCard', 'Restart terminal', { dirId: dir._id, name: dir.name })
    onRestartTerminal?.(dir, tab)
  }, [dir, tab, onRestartTerminal])

  const handleSettings = useCallback((e) => {
    e.stopPropagation()
    logger.info('DirectoryCard', 'Open card editor', { dirId: dir._id, name: dir.name })
    setIsEditing(true)
  }, [dir])

  const handleEditorSave = useCallback((data) => {
    logger.info('DirectoryCard', 'Save card editor', { dirId: dir._id, ...data })
    updateDirectory(dir._id, data)
    setIsEditing(false)
  }, [dir._id, updateDirectory])

  const handleEditorCancel = useCallback(() => {
    logger.info('DirectoryCard', 'Cancel card editor', { dirId: dir._id })
    setIsEditing(false)
  }, [dir._id])

  const handleModelSelect = useCallback((model) => {
    logger.info('DirectoryCard', 'Select model', { dirId: dir._id, model })
    updateDirectory(dir._id, { model })
  }, [dir._id, updateDirectory])

  const handleContextMenu = useCallback((e) => {
    e.preventDefault()
    onContextMenu?.(e.clientX, e.clientY, String(dir._id), 'card')
  }, [dir._id, onContextMenu])

  const selectedModel = state.availableModels.find(m => m.id === dir.model)
  const providerLabel = selectedModel
    ? `${t('models.provider')} ${selectedModel.providerID}`
    : ''

  // Drag & Drop
  const handleDragStart = useCallback((e) => {
    if (isEditing) { e.preventDefault(); return }
    e.dataTransfer.setData('text/plain', String(dir._id))
    e.dataTransfer.effectAllowed = 'move'
    setIsDragging(true)
  }, [dir._id, isEditing])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => setIsDragOver(false), [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragOver(false)
    const fromId = e.dataTransfer.getData('text/plain')
    if (!fromId || fromId === String(dir._id)) return
    document.dispatchEvent(new CustomEvent('card-drop', {
      detail: { fromId: Number(fromId), toId: dir._id },
    }))
  }, [dir._id])

  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
    setIsDragOver(false)
  }, [])

  return (
    <div
      className={cn(styles.card, isDragging && styles.dragging, isDragOver && styles.dragOver)}
      data-dir-id={dir._id}
      onContextMenu={handleContextMenu}
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
    >
      <div className={cn(styles.view, isEditing && styles.hidden)}>
        <div className={styles.icon}>&#128193;</div>
        <div className={styles.info}>
          <div className={styles.name}>{displayName}</div>
          <div className={styles.path}>{dir.path}</div>
          <NoDescriptionPlaceholder description={dir.description} />
          {dir.startOnLaunch && (
            <div className={styles.badgeAutoLaunch}>&#9654; {t('editor.startOnLaunch')}</div>
          )}
        </div>
        <div className={styles.actions}>
          <button className={`${styles.actionBtn} ${styles.settingsBtn}`} onClick={handleSettings} title={t('card.btn.settings')}>
            &#9881;
          </button>
          {!isRunning && (
            <button className={`${styles.actionBtn} ${styles.playBtn}`} onClick={handlePlay} title={t('card.btn.play')}>
              &#9654;
            </button>
          )}
          {isRunning && (
            <button className={`${styles.actionBtn} ${styles.stopBtn}`} onClick={handleStop} title={t('card.btn.stop')}>
              &#9632;
            </button>
          )}
          {isRunning && (
            <button className={`${styles.actionBtn} ${styles.restartBtn}`} onClick={handleRestart} title={t('card.btn.restart')}>
              &#8635;
            </button>
          )}
        </div>
      </div>

      <div className={styles.modelSection}>
        <div className={styles.modelLabel}>{t('models.preferred')}</div>
        <ModelSelector
          models={state.availableModels}
          selectedModel={dir.model}
          onSelect={handleModelSelect}
        />
        <div className={styles.modelProvider}>{providerLabel}</div>
      </div>

      {isEditing && (
        <CardEditor
          dir={dir}
          onSave={handleEditorSave}
          onCancel={handleEditorCancel}
        />
      )}
    </div>
  )
}
