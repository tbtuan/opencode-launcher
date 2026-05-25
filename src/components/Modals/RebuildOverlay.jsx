import { useEffect, useState } from 'react'
import styles from './RebuildOverlay.module.css'
import { api } from '../../services/api'
import { t } from '../../i18n'

export function RebuildOverlay() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const unsub = api.onBuildStatus((data) => {
      if (data.status === 'building') {
        setVisible(true)
      }
    })
    return () => unsub?.()
  }, [])

  if (!visible) return null

  return (
    <div className={styles.overlay}>
      <div className={styles.dialog}>
        <div className={styles.spinner} />
        <div className={styles.text}>{t('actions.rebuilding')}</div>
      </div>
    </div>
  )
}
