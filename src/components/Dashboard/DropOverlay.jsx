import styles from './Dashboard.module.css'

export function DropOverlay({ visible }) {
  if (!visible) return null
  return (
    <div className={styles.dropOverlay} id="drop-overlay">
      <div className={styles.dropOverlayContent}>
        &#128193; Verzeichnis hier ablegen
      </div>
    </div>
  )
}
