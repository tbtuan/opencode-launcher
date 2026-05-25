import { useRef, useEffect } from 'react'
import styles from './PreviewSection.module.css'
import { usePreviewTerminal } from '../../../hooks/usePreviewTerminal'
import { t } from '../../../i18n'
import { logger } from '../../../services/logger'

function PreviewTerminal({ tab, cols, rows }) {
  const containerRef = useRef(null)
  const terminalRef = usePreviewTerminal(containerRef)
  const dataBufferRef = useRef([])

  useEffect(() => {
    const handler = (e) => {
      if (e.detail.tabId !== tab.id) return
      if (terminalRef.current) {
        terminalRef.current.write(e.detail.data)
        try { terminalRef.current.scrollToBottom() } catch {}
      } else {
        dataBufferRef.current.push(e.detail.data)
      }
    }
    document.addEventListener('pty-preview-data', handler)
    return () => document.removeEventListener('pty-preview-data', handler)
  }, [tab.id, terminalRef])

  useEffect(() => {
    if (terminalRef.current && dataBufferRef.current.length > 0) {
      const buf = dataBufferRef.current
      buf.forEach(d => {
        terminalRef.current.write(d)
        try { terminalRef.current.scrollToBottom() } catch {}
      })
      buf.length = 0
    }
  })

  useEffect(() => {
    const handler = (e) => {
      if (e.detail.tabId === tab.id && terminalRef.current && containerRef.current) {
        terminalRef.current.resize(e.detail.cols, e.detail.rows)
        const rowHeight = Math.round(6 * 1.2)
        containerRef.current.style.height = `${e.detail.rows * rowHeight + 40}px`
      }
    }
    window.addEventListener('preview-resize', handler)
    return () => window.removeEventListener('preview-resize', handler)
  }, [tab.id, terminalRef])

  return <div className={styles.terminal} ref={containerRef} />
}

export function PreviewCard({ tab, cols, rows, isProcessing, onClick, splits }) {
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
      <PreviewTerminal tab={tab} cols={cols} rows={rows} />
      {splits?.map(split => (
        <div key={split.tab.id} className={styles.splitPreview}>
          <div className={styles.cardHeader}>
            <span className={styles.cardName}>Terminal</span>
            <span className={`${styles.status} ${split.isProcessing ? styles.statusActive : ''}`}>
              <span className={`${styles.dot} ${split.isProcessing ? styles.dotActive : ''}`} />
              {' '}{split.isProcessing ? t('preview.processing') : t('preview.running')}
            </span>
          </div>
          <PreviewTerminal tab={split.tab} cols={split.cols} rows={split.rows} />
        </div>
      ))}
    </div>
  )
}
