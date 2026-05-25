import { useState, useEffect, useRef } from 'react'
import { logger } from '../services/logger'
import { LogViewer } from './LogViewer'
import styles from './DevTools.module.css'

export function DevToolsApp() {
  const [logs, setLogs] = useState(() => logger.getHistory())
  const entriesRef = useRef(logs)

  useEffect(() => {
    const unsub = logger.subscribe((entry) => {
      entriesRef.current = [...entriesRef.current, entry]
      if (!batchRef.current) {
        batchRef.current = requestAnimationFrame(() => {
          setLogs([...entriesRef.current])
          batchRef.current = null
        })
      }
    })
    return unsub
  }, [])

  const batchRef = useRef(null)

  useEffect(() => {
    return () => { if (batchRef.current) cancelAnimationFrame(batchRef.current) }
  }, [])

  const handleClear = () => {
    logger.clear()
    entriesRef.current = []
    setLogs([])
  }

  const handleOpenChromeDevTools = () => {
    try {
      const a = typeof window !== 'undefined' ? window.api : null
      if (a?.openDevTools) {
        a.openDevTools()
      }
    } catch {}
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.app}>
        <div className={styles.header}>
          <span className={styles.title}>OpenCode Launcher — Entwicklertools</span>
          <div className={styles.headerRight}>
            <button className={styles.chromeBtn} onClick={handleOpenChromeDevTools}>
              Chrome DevTools öffnen
            </button>
          </div>
        </div>
        <div className={styles.content}>
          <LogViewer logs={logs} onClear={handleClear} />
        </div>
      </div>
    </div>
  )
}
