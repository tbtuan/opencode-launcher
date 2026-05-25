import { useState, useCallback } from 'react'
import styles from './SettingsDialog.module.css'
import { t, getLanguage, setLanguage } from '../../i18n'
import { logger } from '../../services/logger'

export function SettingsDialog({ directories, defaultTab, flagDe, flagEn, onSave, onCancel }) {
  const [selectedTab, setSelectedTab] = useState(defaultTab)
  const [selectedLang, setSelectedLang] = useState(getLanguage())

  const handleSave = useCallback(() => {
    logger.info('SettingsDialog', 'Save settings', { defaultTab: selectedTab, language: selectedLang })
    onSave?.(selectedTab, selectedLang)
  }, [selectedTab, selectedLang, onSave])

  return (
    <div className={styles.overlay} id="settings-dialog-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel?.() }}>
      <div className={styles.dialog}>
        <div className={styles.title}>{t('settings.title')}</div>
        <div className={styles.options}>
          <label className={styles.option}>
            <input
              type="radio"
              name="settings-default-tab"
              value="home"
              checked={selectedTab === 'home'}
              onChange={() => setSelectedTab('home')}
            />
            <span className={styles.optLabel}>Home</span>
            <span className={styles.optSub}>{t('settings.homeSubtitle')}</span>
          </label>
          {directories.map(dir => (
            <label key={dir._id} className={styles.option}>
              <input
                type="radio"
                name="settings-default-tab"
                value={dir.path}
                checked={selectedTab === dir.path}
                onChange={() => setSelectedTab(dir.path)}
              />
              <span className={styles.optLabel}>{dir.name}</span>
              <span className={styles.optSub}>{dir.path}</span>
            </label>
          ))}

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
