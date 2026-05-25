import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { logger } from '../services/logger'
import styles from './DevTools.module.css'

const LEVELS = ['all', 'info', 'warn', 'error', 'debug']

export function LogViewer({ logs, onClear }) {
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState('all')
  const [componentFilter, setComponentFilter] = useState('all')
  const [expanded, setExpanded] = useState(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [recording, setRecording] = useState(false)
  const [recordedLogs, setRecordedLogs] = useState([])
  const [showRecordDialog, setShowRecordDialog] = useState(false)
  const [saveStatus, setSaveStatus] = useState('')
  const listRef = useRef(null)
  const recordedRef = useRef([])

  // Collect unique components
  const components = useMemo(() => {
    const set = new Set()
    for (const l of logs) set.add(l.component)
    return ['all', ...Array.from(set).sort()]
  }, [logs])

  // Filter logs
  const filtered = useMemo(() => {
    return logs.filter(l => {
      if (levelFilter !== 'all' && l.level !== levelFilter) return false
      if (componentFilter !== 'all' && l.component !== componentFilter) return false
      if (search) {
        const s = search.toLowerCase()
        const msg = l.args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')
        if (!msg.toLowerCase().includes(s)) return false
      }
      return true
    })
  }, [logs, levelFilter, componentFilter, search])

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [filtered.length, autoScroll])

  const handleScroll = useCallback(() => {
    if (!listRef.current) return
    const el = listRef.current
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50
    setAutoScroll(isAtBottom)
  }, [])

  const toggleExpand = useCallback((id) => {
    setExpanded(prev => prev === id ? null : id)
  }, [])

  // Record logs via logger subscription
  useEffect(() => {
    if (!recording) return
    recordedRef.current = []
    const unsub = logger.subscribe((entry) => {
      recordedRef.current = [...recordedRef.current, entry]
    })
    return () => {
      unsub()
      setRecordedLogs([...recordedRef.current])
    }
  }, [recording])

  const handleRecordToggle = useCallback(() => {
    if (recording) {
      setRecording(false)
      setShowRecordDialog(true)
    } else {
      recordedRef.current = []
      setRecordedLogs([])
      setRecording(true)
    }
  }, [recording])

  const formatRecordedText = useCallback(() => {
    return recordedLogs.map(e => {
      const ts = new Date(e.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 })
      const args = e.args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')
      return `[${ts}] [${e.level.toUpperCase()}] [${e.component}] ${args}`
    }).join('\n')
  }, [recordedLogs])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(formatRecordedText())
      setSaveStatus('In Zwischenablage kopiert!')
      setTimeout(() => setSaveStatus(''), 2000)
    } catch {
      setSaveStatus('Fehler beim Kopieren')
    }
  }, [formatRecordedText])

  const handleSave = useCallback(async () => {
    try {
      const api = typeof window !== 'undefined' ? window.api : null
      if (api?.saveTextFile) {
        const result = await api.saveTextFile(formatRecordedText(), 'aufzeichnung.log')
        if (result?.ok) {
          setSaveStatus(`Gespeichert: ${result.filePath}`)
        } else {
          setSaveStatus(result?.error || 'Abgebrochen')
        }
      } else {
        setSaveStatus('Nicht im Electron-Kontext verfügbar')
      }
    } catch (e) {
      setSaveStatus('Fehler: ' + e.message)
    }
    setTimeout(() => setSaveStatus(''), 3000)
  }, [formatRecordedText])

  const formatTime = (ts) => {
    const d = new Date(ts)
    return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 })
  }

  const copyToClipboard = useCallback(async (text) => {
    try {
      const api = typeof window !== 'undefined' ? window.api : null
      if (api?.writeClipboard) {
        await api.writeClipboard(text)
      } else {
        await navigator.clipboard.writeText(text)
      }
    } catch {}
  }, [])

  const formatArgs = (args) => {
    return args.map(a => {
      if (typeof a === 'string') return a
      try { return JSON.stringify(a, null, 2) } catch { return String(a) }
    }).join(' ')
  }

  const [ctxMenu, setCtxMenu] = useState({ x: 0, y: 0, visible: false })

  const handleContextMenu = useCallback((e, entry) => {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY, visible: true, entry })
  }, [])

  const handleCtxCopy = useCallback(() => {
    const entry = ctxMenu.entry
    if (!entry) return
    const ts = new Date(entry.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 })
    const args = entry.args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')
    const text = `[${ts}] [${entry.level.toUpperCase()}] [${entry.component}] ${args}`
    copyToClipboard(text)
    setCtxMenu(prev => ({ ...prev, visible: false }))
  }, [ctxMenu.entry, copyToClipboard])

  useEffect(() => {
    if (!ctxMenu.visible) return
    const handler = () => setCtxMenu(prev => ({ ...prev, visible: false }))
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [ctxMenu.visible])

  return (
    <div className={styles.logViewer}>
      <div className={styles.filterBar}>
        <select
          className={styles.filterSelect}
          value={componentFilter}
          onChange={e => setComponentFilter(e.target.value)}
        >
          {components.map(c => (
            <option key={c} value={c}>
              {c === 'all' ? 'Alle Komponenten' : c}
            </option>
          ))}
        </select>

        <select
          className={styles.filterSelect}
          value={levelFilter}
          onChange={e => setLevelFilter(e.target.value)}
        >
          {LEVELS.map(l => (
            <option key={l} value={l}>
              {l === 'all' ? 'Alle Level' : l}
            </option>
          ))}
        </select>

        <input
          className={styles.filterInput}
          type="text"
          placeholder="Suchen..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <button className={styles.filterBtn} onClick={onClear}>
          Leeren
        </button>

        <button
          className={`${styles.filterBtn} ${recording ? styles.recordingBtn : ''}`}
          onClick={handleRecordToggle}
        >
          {recording ? '⏹ Aufnahme beenden' : '⏺ Aufzeichnung'}
        </button>

        <span className={styles.logCount}>
          {filtered.length} / {logs.length} Einträge
        </span>
      </div>

      <div
        ref={listRef}
        className={styles.logList}
        onScroll={handleScroll}
      >
        {filtered.map(entry => (
          <div
            key={entry.id}
            className={`${styles.logEntry} ${styles[`level_${entry.level}`]} ${expanded === entry.id ? styles.expanded : ''}`}
            onClick={() => toggleExpand(entry.id)}
            onContextMenu={(e) => handleContextMenu(e, entry)}
          >
            <span className={styles.logTime}>{formatTime(entry.timestamp)}</span>
            <span className={`${styles.logLevel} ${styles[`levelBadge_${entry.level}`]}`}>
              {entry.level}
            </span>
            <span className={styles.logComponent}>{entry.component}</span>
            <span className={styles.logMessage}>
              {formatArgs(expanded === entry.id ? entry.args : entry.args.slice(0, 1))}
              {expanded !== entry.id && entry.args.length > 1 ? ' …' : ''}
            </span>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className={styles.empty}>Keine Logs</div>
        )}
      </div>

      {ctxMenu.visible && (
        <div
          className={styles.ctxMenu}
          style={{ left: ctxMenu.x, top: ctxMenu.y, position: 'fixed' }}
        >
          <button className={styles.ctxMenuItem} onClick={handleCtxCopy}>
            Kopieren
          </button>
        </div>
      )}

      <div className={styles.statusBar}>
        <span>{autoScroll ? '● Auto-Scroll aktiv' : '○ Auto-Scroll pausiert'}</span>
        {recording && <span className={styles.recordingIndicator}>● Aufnahme läuft...</span>}
      </div>

      {/* Recorded Logs Dialog */}
      {showRecordDialog && (
        <div className={styles.dialogOverlay} onClick={() => setShowRecordDialog(false)}>
          <div className={styles.dialog} onClick={e => e.stopPropagation()}>
            <div className={styles.dialogHeader}>
              <span>Aufzeichnung — {recordedLogs.length} Einträge</span>
              <button className={styles.dialogClose} onClick={() => setShowRecordDialog(false)}>&times;</button>
            </div>
            <pre className={styles.dialogContent}>{formatRecordedText()}</pre>
            <div className={styles.dialogActions}>
              <span className={styles.saveStatus}>{saveStatus}</span>
              <button className={styles.filterBtn} onClick={handleCopy}>In Zwischenablage kopieren</button>
              <button className={styles.filterBtn} onClick={handleSave}>Als Textdatei speichern</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
