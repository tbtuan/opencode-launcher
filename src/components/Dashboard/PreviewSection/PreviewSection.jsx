import styles from './PreviewSection.module.css'
import { PreviewCard } from './PreviewCard'
import { t } from '../../../i18n'

export function PreviewSection({ previews, onActivate }) {
  if (previews.length === 0) return null

  return (
    <div className={styles.section} id="preview-section">
      <div className={styles.header}>
        <span className={styles.title} id="preview-section-title">{t('preview.title')}</span>
      </div>
      <div className={styles.grid} id="preview-grid">
        {previews.map(p => (
          <PreviewCard
            key={p.tab.id}
            tab={p.tab}
            cols={p.cols || 80}
            rows={p.rows || 24}
            isProcessing={p.isProcessing}
            onClick={onActivate}
            splits={p.splits}
          />
        ))}
      </div>
    </div>
  )
}
