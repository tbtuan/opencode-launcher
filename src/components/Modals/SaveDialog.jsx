import { useState, useEffect, useRef, useCallback } from 'react'
import styles from './SaveDialog.module.css'
import { t } from '../../i18n'
import { useApp } from '../../store/AppContext'
import { ModelSelector } from '../Dashboard/DirectoryCard/ModelSelector'
import { logger } from '../../services/logger'

export function SaveDialog({ folderPath, defaultName, onSaveAndOpen, onSaveOnly, onOpenOnly, onCancel }) {
  const { state } = useApp()
  const [name, setName] = useState(defaultName)
  const [description, setDescription] = useState('')
  const [startOnLaunch, setStartOnLaunch] = useState(false)
  const [continueSession, setContinueSession] = useState(false)
  const [selectedModel, setSelectedModel] = useState(undefined)
  const inputRef = useRef(null)

  useEffect(() => {
    setName(defaultName)
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [defaultName])

  const getData = useCallback(() => ({
    name: name.trim() || defaultName,
    description: description.trim(),
    startOnLaunch,
    continueSession,
    model: selectedModel,
  }), [name, defaultName, description, startOnLaunch, continueSession, selectedModel])

  const handleSaveAndOpen = useCallback(() => {
    const data = getData()
    logger.info('SaveDialog', 'Save and open', { name: data.name })
    onSaveAndOpen?.(data)
  }, [getData, onSaveAndOpen])
  const handleSaveOnly = useCallback(() => {
    const data = getData()
    logger.info('SaveDialog', 'Save only', { name: data.name })
    onSaveOnly?.(data)
  }, [getData, onSaveOnly])
  const handleOpenOnly = useCallback(() => {
    logger.info('SaveDialog', 'Open only', { name: name.trim() || defaultName })
    onOpenOnly?.()
  }, [onOpenOnly, name, defaultName])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') handleSaveAndOpen()
    if (e.key === 'Escape') onCancel?.()
  }, [handleSaveAndOpen, onCancel])

  return (
    <div className={styles.overlay} id="save-dialog-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel?.() }}>
      <div className={styles.dialog}>
        <div className={styles.title}>{t('saveDialog.title')}</div>
        <div className={styles.path}>{folderPath}</div>

        <div className={styles.row}>
          <label>{t('saveDialog.name')}</label>
          <input
            ref={inputRef}
            className={styles.input}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className={styles.row}>
          <label>{t('editor.description')}</label>
          <input
            className={styles.input}
            type="text"
            placeholder={t('editor.descriptionPlaceholder')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <label className={styles.checkRow}>
          <input
            type="checkbox"
            checked={startOnLaunch}
            onChange={(e) => setStartOnLaunch(e.target.checked)}
          />
          {t('editor.startOnLaunch')}
        </label>

        <label className={styles.checkRow}>
          <input
            type="checkbox"
            checked={continueSession}
            onChange={(e) => setContinueSession(e.target.checked)}
          />
          {t('editor.continueSession')}
        </label>

        <div className={styles.modelSection}>
          <div className={styles.modelLabel}>{t('models.preferred')}</div>
          <ModelSelector
            models={state.availableModels}
            selectedModel={selectedModel}
            onSelect={setSelectedModel}
          />
        </div>

        <div className={styles.buttons}>
          <button className={styles.btnPrimary} onClick={handleSaveAndOpen}>
            {t('saveDialog.saveAndOpen')}
          </button>
          <button className={styles.btnSecondary} onClick={handleSaveOnly}>
            {t('saveDialog.saveOnly')}
          </button>
          <button className={styles.btnSecondary} onClick={handleOpenOnly}>
            {t('saveDialog.openOnly')}
          </button>
          <button className={styles.btnCancel} onClick={onCancel}>
            {t('saveDialog.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
