import { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '../../../utils/cn'
import styles from './DirectoryCard.module.css'
import { t } from '../../../i18n'

export function CardEditor({ dir, onSave, onCancel }) {
  const [name, setName] = useState(dir.name)
  const [description, setDescription] = useState(dir.description || '')
  const [preStartCommand, setPreStartCommand] = useState(dir.preStartCommand || '')
  const [startOnLaunch, setStartOnLaunch] = useState(dir.startOnLaunch || false)
  const [continueSession, setContinueSession] = useState(dir.continueSession || false)
  const nameRef = useRef(null)

  useEffect(() => {
    setName(dir.name)
    setDescription(dir.description || '')
    setPreStartCommand(dir.preStartCommand || '')
    setStartOnLaunch(dir.startOnLaunch || false)
    setContinueSession(dir.continueSession || false)
  }, [dir])

  useEffect(() => {
    nameRef.current?.focus()
    nameRef.current?.select()
  }, [])

  const handleSave = useCallback(() => {
    onSave?.({
      name: name.trim() || dir.name,
      description: description.trim(),
      preStartCommand: preStartCommand.trim(),
      startOnLaunch,
      continueSession,
    })
  }, [name, description, preStartCommand, startOnLaunch, continueSession, dir.name, onSave])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSave() }
    if (e.key === 'Escape') { e.preventDefault(); onCancel?.() }
  }, [handleSave, onCancel])

  return (
    <div className={styles.editor} onClick={(e) => e.stopPropagation()}>
      <div className={styles.editorRow}>
        <label>{t('editor.name')}</label>
        <input
          ref={nameRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
      <div className={styles.editorRow}>
        <label>{t('editor.description')}</label>
        <input
          type="text"
          placeholder={t('editor.descriptionPlaceholder')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
      <div className={styles.editorRow}>
        <label htmlFor={`pre-start-${dir._id}`}>{t('editor.preStartCommand')}</label>
        <input
          id={`pre-start-${dir._id}`}
          type="text"
          placeholder={t('editor.preStartCommandPlaceholder')}
          value={preStartCommand}
          onChange={(e) => setPreStartCommand(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className={styles.editorHint}>{t('editor.preStartCommandHint')}</div>
      </div>
      <div className={`${styles.editorRow} ${styles.checkRow}`}>
        <input
          type="checkbox"
          checked={startOnLaunch}
          onChange={(e) => setStartOnLaunch(e.target.checked)}
        />
        <label onClick={(e) => e.stopPropagation()}>
          {t('editor.startOnLaunch')}
        </label>
      </div>
      <div className={`${styles.editorRow} ${styles.checkRow}`}>
        <input
          type="checkbox"
          checked={continueSession}
          onChange={(e) => setContinueSession(e.target.checked)}
        />
        <label onClick={(e) => e.stopPropagation()}>
          {t('editor.continueSession')}
        </label>
      </div>
      <div className={styles.editorFooter}>
        <button className={styles.editorSave} onClick={handleSave}>
          {t('editor.save')}
        </button>
        <button className={styles.editorCancel} onClick={onCancel}>
          {t('editor.cancel')}
        </button>
      </div>
    </div>
  )
}
