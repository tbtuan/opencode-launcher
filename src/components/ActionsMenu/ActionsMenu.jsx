import { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '../../utils/cn'
import styles from './ActionsMenu.module.css'
import { t } from '../../i18n'
import { useApp } from '../../store/AppContext'
import { refreshModels } from '../../services/modelService'
import { api } from '../../services/api'
import { logger } from '../../services/logger'

export function ActionsMenu() {
  const { setModels } = useApp()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoadingModels, setIsLoadingModels] = useState(false)
  const menuRef = useRef(null)

  const close = useCallback(() => setIsOpen(false), [])

  useEffect(() => {
    if (!isOpen) return
    function handler() { close() }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [isOpen, close])

  const handleAction = useCallback((fn) => {
    close()
    fn?.()
  }, [close])

  const handleReload = useCallback(async () => {
    logger.info('ActionsMenu', 'Reload models')
    setIsLoadingModels(true)
    try {
      const result = await refreshModels()
      setModels(result.models, result.timestamp)
    } catch (e) {
      logger.error('ActionsMenu', 'refreshModels', e?.stack)
    }
    setIsLoadingModels(false)
  }, [setModels])

  const handleEditConfig = useCallback(() => {
    logger.info('ActionsMenu', 'Open config editor')
    document.dispatchEvent(new CustomEvent('open-config-editor'))
  }, [])

  const handleRestart = useCallback(async () => {
    logger.info('ActionsMenu', 'Restart launcher')
    try {
      await api.restartApp()
    } catch (e) {}
  }, [])

  const handleSettings = useCallback(() => {
    logger.info('ActionsMenu', 'Open settings')
    document.dispatchEvent(new CustomEvent('open-settings'))
  }, [])

  const handleDevTools = useCallback(async () => {
    logger.info('ActionsMenu', 'Open dev tools')
    try {
      await api.openDevTools()
    } catch (e) {}
  }, [])

  return (
    <div className={styles.actionsMenu} ref={menuRef}>
      <button
        className={styles.trigger}
        id="btn-actions"
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen) }}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="18" x2="20" y2="18" />
        </svg>
      </button>
      <div className={cn(styles.dropdown, !isOpen && styles.hidden)} id="actions-dropdown">
        <button
          id="act-reload-models"
          onClick={() => handleAction(handleReload)}
          disabled={isLoadingModels}
        >
          <span className={styles.icon}>↻</span>
          {isLoadingModels ? t('loading.models') : t('actions.reloadModels')}
        </button>
        <button id="act-edit-config" onClick={() => handleAction(handleEditConfig)}>
          <span className={styles.icon}>✎</span>
          {t('actions.editConfig')}
        </button>
        <button id="act-restart-launcher" onClick={() => handleAction(handleRestart)}>
          <span className={styles.icon}>↻</span>
          {t('actions.restartLauncher')}
        </button>
        <button id="act-devtools" onClick={() => handleAction(handleDevTools)}>
          <span className={styles.icon}>⬡</span>
          {t('actions.devTools')}
        </button>
        <hr className={styles.separator} />
        <button id="act-settings" onClick={() => handleAction(handleSettings)}>
          <span className={styles.icon}>⚙</span>
          {t('actions.settings')}
        </button>
      </div>
    </div>
  )
}
