import { useRef, useEffect } from 'react'
import styles from './PreviewSection.module.css'
import { usePreviewTerminal } from '../../../hooks/usePreviewTerminal'
import { t } from '../../../i18n'

export function PreviewCard({ tab, cols, rows, isProcessing, onClick }) {
  const containerRef = useRef(null)
  const terminalRef = usePreviewTerminal(containerRef, cols, rows)

  // Receive live PTY data forwarded from TerminalPane
  useEffect(() => {
    const handler = (e) => {
      if (e.detail.tabId === tab.id && terminalRef.current) {
        terminalRef.current.write(e.detail.data)
      }
    }
    document.addEventListener('pty-preview-data', handler)
    return () => document.removeEventListener('pty-preview-data', handler)
  }, [tab.id, terminalRef])

  // Keep preview dimensions in sync with main terminal
  useEffect(() => {
    const handler = (e) => {
      if (e.detail.tabId === tab.id && terminalRef.current && containerRef.current) {
        terminalRef.current.resize(e.detail.cols, e.detail.rows)
        containerRef.current.style.height = `${e.detail.rows * Math.round(6 * 1.2) + 40}px`
      }
    }
    window.addEventListener('preview-resize', handler)
    return () => window.removeEventListener('preview-resize', handler)
  }, [tab.id, terminalRef])

  return (
    <div
      className={styles.card}
      data-tab-id={tab.id}
      onClick={() => onClick?.(tab.id)}
    >
      <div className={styles.cardHeader}>
        <span className={styles.cardName}>{tab.displayName || tab.name}</span>
        <span className={`${styles.status} ${isProcessing ? styles.statusActive : ''}`}>
          <span className={`${styles.dot} ${isProcessing ? styles.dotActive : ''}`} />
          {' '}{isProcessing ? t('preview.processing') : t('preview.running')}
        </span>
      </div>
      <div className={styles.terminal} ref={containerRef} />
    </div>
  )
}
