import { useRef, useEffect } from 'react'
import styles from './PreviewSection.module.css'
import { usePreviewTerminal } from '../../../hooks/usePreviewTerminal'
import { t } from '../../../i18n'

function PreviewTerminal({ tab, style }) {
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

  return <div className={styles.terminal} style={style} ref={containerRef} />
}

export function PreviewCard({ tab, isProcessing, onClick, splits, splitRatio }) {
  const hasSplits = splits?.length > 0
  const ratio = splitRatio || 0.5

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
      <div className={styles.previewBody}>
        <PreviewTerminal tab={tab} style={{ flex: hasSplits ? ratio : 1 }} />
        {splits?.map(split => (
          <div key={split.tab.id} className={styles.splitPreview} style={{ flex: 1 - ratio }}>
            <div className={styles.cardHeader}>
              <span className={styles.cardName}>Terminal</span>
              <span className={`${styles.status} ${split.isProcessing ? styles.statusActive : ''}`}>
                <span className={`${styles.dot} ${split.isProcessing ? styles.dotActive : ''}`} />
                {' '}{split.isProcessing ? t('preview.processing') : t('preview.running')}
              </span>
            </div>
            <PreviewTerminal tab={split.tab} style={{ flex: 1, minHeight: 0 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
