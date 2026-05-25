import { useState, useCallback } from 'react'
import styles from './SettingsDialog.module.css'
import { t, getLanguage, setLanguage } from '../../i18n'
import { logger } from '../../services/logger'

export function SettingsDialog({ flagDe, flagEn, onSave, onCancel }) {
  const [selectedLang, setSelectedLang] = useState(getLanguage())

  const handleSave = useCallback(() => {
    logger.info('SettingsDialog', 'Save settings', { language: selectedLang })
    onSave?.(selectedLang)
  }, [selectedLang, onSave])

  return (
    <div className={styles.overlay} id="settings-dialog-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel?.() }}>
      <div className={styles.dialog}>
        <div className={styles.title}>{t('settings.title')}</div>
        <div className={styles.options}>
          <div className={styles.langRow}>
            <span className={styles.langLabel}>{t('settings.language')}</span>
            <div className={styles.langOptions}>
              <button
                className={`${styles.langBtn} ${selectedLang === 'de' ? styles.langBtnActive : ''}`}
                onClick={() => setSelectedLang('de')}
                dangerouslySetInnerHTML={{ __html: (flagDe || '') + ' Deutsch' }}
              />
              <button
                className={`${styles.langBtn} ${selectedLang === 'en' ? styles.langBtnActive : ''}`}
                onClick={() => setSelectedLang('en')}
                dangerouslySetInnerHTML={{ __html: (flagEn || '') + ' English' }}
              />
            </div>
          </div>
        </div>
        <div className={styles.buttons}>
          <button className={styles.btnSave} onClick={handleSave}>{t('settings.save')}</button>
          <button className={styles.btnCancel} onClick={onCancel}>{t('settings.cancel')}</button>
        </div>
      </div>
    </div>
  )
}
