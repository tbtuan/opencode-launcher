import styles from './RestartDialog.module.css'
import { t } from '../../i18n'

export function RestartDialog({ visible, onRestart, onLater }) {
  if (!visible) return null

  return (
    <div className={styles.overlay} id="restart-dialog-overlay" onClick={(e) => { if (e.target === e.currentTarget) onLater?.() }}>
      <div className={styles.dialog}>
        <div className={styles.title}>{t('restartDialog.title')}</div>
        <div className={styles.text} dangerouslySetInnerHTML={{ __html: t('restartDialog.message') }} />
        <div className={styles.buttons}>
          <button className={styles.btnRestart} onClick={onRestart}>{t('restartDialog.restart')}</button>
          <button className={styles.btnLater} onClick={onLater}>{t('restartDialog.later')}</button>
        </div>
      </div>
    </div>
  )
}
