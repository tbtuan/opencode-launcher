import styles from './Dashboard.module.css'
import { t } from '../../i18n'

export function NoDirsPlaceholder({ visible }) {
  if (!visible) return null
  return (
    <div className={styles.noDirs} id="no-dirs">
      <div className={styles.noDirsIcon}>&#128193;</div>
      <div className={styles.noDirsText} data-i18n="dashboard.noDirs">
        {t('dashboard.noDirs')}
      </div>
      <div
        className={styles.noDirsHint}
        data-i18n-html="dashboard.noDirsHint"
        dangerouslySetInnerHTML={{ __html: t('dashboard.noDirsHint') }}
      />
    </div>
  )
}
