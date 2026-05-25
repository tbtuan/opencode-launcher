import styles from './DirectoryCard.module.css'
import { t } from '../../../i18n'

export function NoDescriptionPlaceholder({ description }) {
  if (description) {
    return <div className={styles.desc}>{description}</div>
  }
  return <div className={`${styles.desc} ${styles.descEmpty}`}>{t('card.noDescription')}</div>
}
