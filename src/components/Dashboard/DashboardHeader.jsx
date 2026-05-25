import styles from './Dashboard.module.css'
import { t } from '../../i18n'
import { formatTimestamp } from '../../utils/helpers'

export function DashboardHeader({
  modelsTimestamp,
  startTabLabel,
}) {
  return (
    <div className={styles.header}>
      <h1 className={styles.title}>OpenCode Launcher</h1>
      <div className={styles.headerActions}>
        <div className={styles.headerLabels}>
          <span className={styles.modelsLabel} id="models-last-loaded">
            {modelsTimestamp ? `${t('models.lastLoaded')} ${formatTimestamp(modelsTimestamp)}` : ''}
          </span>
          <span className={styles.modelsLabel}>
            {t('models.startTab')} {startTabLabel}
          </span>
        </div>
      </div>
    </div>
  )
}
