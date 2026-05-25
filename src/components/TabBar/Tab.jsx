import { useState, useCallback, useRef, useEffect } from 'react'
import { cn } from '../../utils/cn'
import styles from './Tab.module.css'
import { t } from '../../i18n'
import { useApp } from '../../store/AppContext'
import { logger } from '../../services/logger'

export function Tab({ id, tab, isHome, label, isActive, onActivate, onClose, onContextMenu, index, totalTabs, hasSplits }) {
  const { state } = useApp()
  const splits = tab ? state.tabs.filter(t => t.parentId === tab.id) : []
  const processing = tab?.isProcessing?.() || splits.some(s => s.isProcessing?.())
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef(null)

  const displayLabel = tab
    ? (tab.isDirty ? '* ' : '') + (tab.displayName || tab.name)
    : label

  const title = tab ? (tab.type === 'editor' ? tab.filePath : tab.cwd) : 'Home'

  const indicatorClass = tab
    ? tab.status === 'error'
      ? styles.indicatorError
      : tab.status === 'running'
        ? processing
          ? `${styles.indicatorRunning} ${styles.indicatorActive}`
          : styles.indicatorRunning
        : styles.indicatorStopped
    : ''

  const handleClick = useCallback((e) => {
    if (e.target.closest(`.${styles.closeBtn}`)) return
    onActivate?.(id)
  }, [id, onActivate])

  const handleClose = useCallback((e) => {
    e.stopPropagation()
    logger.info('Tab', 'Close tab', { id })
    onClose?.(id)
  }, [id, onClose])

  const handleContextMenu = useCallback((e) => {
    e.preventDefault()
    onContextMenu?.(e.clientX, e.clientY, id, tab?.type === 'editor' ? 'editor' : 'tab', hasSplits)
  }, [id, tab, onContextMenu, hasSplits])

  const handleRenameStart = useCallback(() => {
    setIsRenaming(true)
    setRenameValue(tab?.name || '')
  }, [tab])

  const handleRenameCommit = useCallback(() => {
    setIsRenaming(false)
    if (tab && renameValue.trim()) {
      logger.info('Tab', 'Rename tab', { id, from: tab.name, to: renameValue.trim() })
      tab.name = renameValue.trim()
    }
  }, [tab, renameValue, id])

  const handleRenameKeyDown = useCallback((e) => {
    if (e.key === 'Enter') { e.preventDefault(); inputRef.current?.blur() }
    if (e.key === 'Escape') { setRenameValue(tab?.name || ''); inputRef.current?.blur() }
  }, [tab])

  useEffect(() => {
    if (isRenaming) {
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 0)
    }
  }, [isRenaming])

  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.action === 'rename' && e.detail?.tabId === id) {
        handleRenameStart()
      }
    }
    document.addEventListener('tab-rename', handler)
    return () => document.removeEventListener('tab-rename', handler)
  }, [id, handleRenameStart])

  // Drag & Drop
  const handleDragStart = useCallback((e) => {
    if (document.getElementById('settings-dialog-overlay') && !document.getElementById('settings-dialog-overlay').classList.contains('hidden')) {
      e.preventDefault(); return
    }
    e.dataTransfer.setData('text/plain', id)
    e.dataTransfer.effectAllowed = 'move'
    setIsDragging(true)
  }, [id])

  const handleDragOver = useCallback((e) => {
    if (!isHome) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      setIsDragOver(true)
    }
  }, [isHome])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragOver(false)
    const dragId = e.dataTransfer.getData('text/plain')
    if (!dragId || dragId === id) return
    logger.info('Tab', 'Tab drag drop', { fromId: dragId, toId: id })
    const fromIdx = totalTabs !== undefined ? tab?.id === dragId ? index : -1 : -1
    document.dispatchEvent(new CustomEvent('tab-drop', { detail: { fromId: dragId, toId: id } }))
  }, [id, index, totalTabs, tab])

  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
    setIsDragOver(false)
  }, [])

  const className = [
    styles.tab,
    isActive ? styles.active : '',
    isDragging ? styles.dragging : '',
    isDragOver ? styles.dragOver : '',
    isHome ? styles.homeTab : '',
  ].filter(Boolean).join(' ')

  return (
    <div
      className={className}
      data-id={id}
      title={title}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      draggable={!isHome}
      onDragStart={!isHome ? handleDragStart : undefined}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={!isHome ? handleDrop : undefined}
      onDragEnd={!isHome ? handleDragEnd : undefined}
    >
      {isHome ? (
        <span className={styles.homeIcon}>&#8962;</span>
      ) : tab?.type === 'editor' ? (
        <span className={styles.editorIcon}>&#9998;</span>
      ) : (
        <div className={`${styles.indicator} ${indicatorClass}`} />
      )}
      {!isHome && (isRenaming ? (
        <input
          ref={inputRef}
          className={styles.renameInput}
          type="text"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={handleRenameCommit}
          onKeyDown={handleRenameKeyDown}
        />
      ) : (
        <span className={styles.label}>{displayLabel}</span>
      ))}
      {!isHome && (
        <button className={styles.closeBtn} onClick={handleClose} title={t('ctx.closeTab')}>
          &times;
        </button>
      )}
    </div>
  )
}
