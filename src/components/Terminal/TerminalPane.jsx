import { useRef, useEffect, useCallback, useState } from 'react'
import styles from './TerminalPane.module.css'
import { useTerminalSetup } from '../../hooks/useTerminalSetup'
import { useProcessingDetection } from '../../hooks/useProcessingDetection'
import {
  writeToPty, onPtyData, onPtyExit, onOpencodeStarted,
  triggerPaste, onPasteComplete, writeClipboard, resizePty,
  setTerminalDimensions, clearTerminalDimensions, killPty,
} from '../../services/terminalService'
import { t } from '../../i18n'
import { useApp } from '../../store/AppContext'
import { logger } from '../../services/logger'

function SplitPane({ tab, parentTab, onSplitClose }) {
  const containerRef = useRef(null)
  const { updateTab } = useApp()

  const {
    terminalRef, fitAddonRef, fit, focus, write, clear,
    hasSelection, getSelection, getCols, getRows,
  } = useTerminalSetup(containerRef)

  const handleProcessingChange = useCallback((processing, isStarting) => {
    updateTab(tab.id, {
      isProcessing: () => processing,
      status: 'running',
    })
  }, [tab.id, updateTab])

  const {
    suppressIndicator,
    handlePtyData,
    handleUserInput,
    handleOpencodeStarted,
    cleanup: cleanupProcessing,
  } = useProcessingDetection({
    terminalRef,
    onProcessingChange: handleProcessingChange,
    tabId: tab.id,
  })

  useEffect(() => {
    const term = terminalRef.current
    if (!term) return

    const unsubKey = term.onKey(() => suppressIndicator(300))
    const timeout = setTimeout(() => {
      const el = term.element
      if (!el) return
      el.addEventListener('wheel', () => suppressIndicator(500), { passive: true })
    }, 50)
    const unsubData = term.onData((data) => {
      handleUserInput(data)
      writeToPty(tab.id, data)
    })

    return () => {
      unsubKey.dispose()
      clearTimeout(timeout)
      unsubData.dispose()
    }
  }, [terminalRef, tab.id, suppressIndicator, handleUserInput])

  useEffect(() => {
    const unsubData = onPtyData(tab.id, (data) => {
      write(data)
      handlePtyData(data)
      logger.info('SplitPane', 'forwarding pty-preview-data', { fromTab: tab.id, toTab: tab.id, len: data.length })
      document.dispatchEvent(new CustomEvent('pty-preview-data', {
        detail: { tabId: tab.id, data }
      }))
    })
    const unsubExit = onPtyExit(tab.id, (code) => {
      write(`\r\n\x1b[33m${t('terminal.processExited').replace('{code}', code)}\x1b[0m\r\n`)
    })
    return () => {
      unsubData?.()
      unsubExit?.()
    }
  }, [tab.id, write, handlePtyData, parentTab.id])

  useEffect(() => {
    const unsub = onOpencodeStarted(tab.id, () => {
      handleOpencodeStarted()
    })
    return () => unsub?.()
  }, [tab.id, handleOpencodeStarted])

  useEffect(() => {
    const term = terminalRef.current
    if (!term) return
    const unsubKeyHandler = term.attachCustomKeyEventHandler((e) => {
      if (e.type !== 'keydown') return true
      if (e.ctrlKey && e.key === 'Tab') return false
      if (e.ctrlKey && e.key === 'c' && hasSelection()) {
        writeClipboard(getSelection())
        return false
      }
      if (e.ctrlKey && e.key === 'v') {
        triggerPaste(tab.id)
        return false
      }
      return true
    })
    const timeout = setTimeout(() => {
      const textarea = term.element?.querySelector('textarea')
      if (textarea) {
        textarea.addEventListener('paste', (e) => {
          e.preventDefault()
          e.stopPropagation()
        }, { capture: true })
      }
    }, 50)
    return () => {
      unsubKeyHandler?.dispose()
      clearTimeout(timeout)
    }
  }, [terminalRef, tab.id, hasSelection, getSelection])

  useEffect(() => {
    const unsub = onPasteComplete(tab.id, (text) => {
      suppressIndicator(1000)
      terminalRef.current?.input('\x1b[200~' + text + '\x1b[201~')
    })
    return () => unsub?.()
  }, [tab.id, suppressIndicator, terminalRef])

  const fitAndResize = useCallback(() => {
    suppressIndicator(500)
    requestAnimationFrame(() => {
      if (!fitAddonRef.current || !terminalRef.current) return
      // Force layout recalculation so fit() reads correct container dimensions
      containerRef.current?.parentElement?.offsetHeight
      try { fit() } catch {}
      const cols = getCols()
      const rows = getRows()
      if (cols && rows) {
        setTerminalDimensions(tab.id, cols, rows)
        resizePty(tab.id, cols, rows)
        window.dispatchEvent(new CustomEvent('preview-resize', {
          detail: { tabId: tab.id, cols, rows }
        }))
      }
      focus()
    })
  }, [fit, getCols, getRows, tab.id, focus, suppressIndicator, fitAddonRef, terminalRef, containerRef])

  useEffect(() => {
    if (!terminalRef.current) return
    const raf = requestAnimationFrame(() => {
      fit()
      const cols = getCols()
      const rows = getRows()
      if (cols && rows) {
        setTerminalDimensions(tab.id, cols, rows)
        resizePty(tab.id, cols, rows)
      }
    })
    focus()
    return () => cancelAnimationFrame(raf)
  }, [terminalRef, fit, getCols, getRows, tab.id, focus])

  useEffect(() => {
    const handler = () => fitAndResize()
    document.addEventListener('resize-active-tab', handler)
    return () => document.removeEventListener('resize-active-tab', handler)
  }, [fitAndResize])

  const handleClose = useCallback(() => {
    onSplitClose?.(tab.id)
  }, [tab.id, onSplitClose])

  return (
    <div className={styles.splitPane}>
      <div className={styles.splitHeader}>
        <span className={styles.splitName}>Terminal</span>
        <button className={styles.splitClose} onClick={handleClose} title={t('ctx.closeTab')}>
          &times;
        </button>
      </div>
      <div ref={containerRef} className={`terminal-pane ${styles.pane}`} id={`pane-${tab.id}`} style={{ flex: 1, minHeight: 0 }} />
    </div>
  )
}

export function TerminalPane({ tab, isActive, onProcessingChange, onStatusChange, splits }) {
  const containerRef = useRef(null)
  const { state, updateTab, removeTab } = useApp()

  const {
    terminalRef, fitAddonRef, fit, focus, write, clear,
    hasSelection, getSelection, getCols, getRows,
  } = useTerminalSetup(containerRef)

  const handleProcessingChange = useCallback((processing, isStarting) => {
    onProcessingChange?.(tab.id, processing, isStarting)
  }, [tab.id, onProcessingChange])

  const {
    suppressIndicator,
    handlePtyData,
    handleUserInput,
    handleOpencodeStarted,
    cleanup: cleanupProcessing,
  } = useProcessingDetection({
    terminalRef,
    onProcessingChange: handleProcessingChange,
    tabId: tab.id,
  })

  // Terminal event handlers (typing, scrolling, input forwarding)
  useEffect(() => {
    const term = terminalRef.current
    if (!term) return

    const unsubKey = term.onKey(() => suppressIndicator(300))

    const timeout = setTimeout(() => {
      const el = term.element
      if (!el) return
      el.addEventListener('wheel', () => suppressIndicator(500), { passive: true })
    }, 50)

    const unsubData = term.onData((data) => {
      handleUserInput(data)
      writeToPty(tab.id, data)
    })

    return () => {
      unsubKey.dispose()
      clearTimeout(timeout)
      unsubData.dispose()
    }
  }, [terminalRef, tab.id, suppressIndicator, handleUserInput])

  // PTY data subscription — writes to main terminal AND forwards to preview
  useEffect(() => {
    const unsubData = onPtyData(tab.id, (data) => {
      write(data)
      handlePtyData(data)
      document.dispatchEvent(new CustomEvent('pty-preview-data', {
        detail: { tabId: tab.id, data }
      }))
    })

    const unsubExit = onPtyExit(tab.id, (code) => {
      write(`\r\n\x1b[33m${t('terminal.processExited').replace('{code}', code)}\x1b[0m\r\n`)
      onStatusChange?.(tab.id, 'stopped')
    })

    return () => {
      unsubData?.()
      unsubExit?.()
    }
  }, [tab.id, write, handlePtyData, onStatusChange])

  // OpenCode started signal
  useEffect(() => {
    const unsub = onOpencodeStarted(tab.id, () => {
      handleOpencodeStarted()
    })
    return () => unsub?.()
  }, [tab.id, handleOpencodeStarted])

  // Custom key handler (Ctrl+C copy, Ctrl+V paste)
  useEffect(() => {
    const term = terminalRef.current
    if (!term) return

    const unsubKeyHandler = term.attachCustomKeyEventHandler((e) => {
      if (e.type !== 'keydown') return true
      if (e.ctrlKey && e.key === 'Tab') return false
      if (e.ctrlKey && e.key === 'c' && hasSelection()) {
        writeClipboard(getSelection())
        return false
      }
      if (e.ctrlKey && e.key === 'v') {
        triggerPaste(tab.id)
        return false
      }
      return true
    })

    const timeout = setTimeout(() => {
      const textarea = term.element?.querySelector('textarea')
      if (textarea) {
        textarea.addEventListener('paste', (e) => {
          e.preventDefault()
          e.stopPropagation()
        }, { capture: true })
      }
    }, 50)

    return () => {
      unsubKeyHandler?.dispose()
      clearTimeout(timeout)
    }
  }, [terminalRef, tab.id, hasSelection, getSelection])

  // Paste complete handler
  useEffect(() => {
    const unsub = onPasteComplete(tab.id, (text) => {
      suppressIndicator(1000)
      terminalRef.current?.input('\x1b[200~' + text + '\x1b[201~')
    })
    return () => unsub?.()
  }, [tab.id, suppressIndicator, terminalRef])

  const fitRafRef = useRef(null)

  const fitAndResize = useCallback(() => {
    suppressIndicator(500)
    fitRafRef.current = requestAnimationFrame(() => {
      if (!fitAddonRef.current || !terminalRef.current) return
      containerRef.current?.parentElement?.offsetHeight
      try { fit() } catch {}
      const cols = getCols()
      const rows = getRows()
      if (cols && rows) {
        setTerminalDimensions(tab.id, cols, rows)
        resizePty(tab.id, cols, rows)
        window.dispatchEvent(new CustomEvent('preview-resize', {
          detail: { tabId: tab.id, cols, rows }
        }))
      }
      focus()
    })
  }, [fit, getCols, getRows, tab.id, focus, suppressIndicator, fitAddonRef, terminalRef, containerRef])

  useEffect(() => {
    return () => cancelAnimationFrame(fitRafRef.current)
  }, [])

  // Initial fit + resize when terminal first mounts (even for non-active tabs)
  useEffect(() => {
    if (!terminalRef.current) return
    const raf = requestAnimationFrame(() => {
      fit()
      const cols = getCols()
      const rows = getRows()
      if (cols && rows) {
        setTerminalDimensions(tab.id, cols, rows)
        resizePty(tab.id, cols, rows)
      }
    })
    return () => cancelAnimationFrame(raf)
  }, [terminalRef, fit, getCols, getRows, tab.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isActive) {
      fitAndResize()
    }
  }, [isActive, fitAndResize])

  useEffect(() => {
    const handler = () => {
      if (isActive) fitAndResize()
    }
    document.addEventListener('resize-active-tab', handler)
    return () => document.removeEventListener('resize-active-tab', handler)
  }, [isActive, fitAndResize])

  // Split drag state
  const [splitRatio, setSplitRatio] = useState(0.6)
  const splitRatioRef = useRef(splitRatio)
  splitRatioRef.current = splitRatio

  const handleSplitClose = useCallback((splitId) => {
    logger.info('TerminalPane', 'Split close', { splitId })
    killPty(splitId)
    clearTerminalDimensions(splitId)
    removeTab(splitId)
    setTimeout(() => {
      document.dispatchEvent(new CustomEvent('resize-active-tab'))
    }, 0)
  }, [removeTab])

  const handleDividerMouseDown = useCallback((e) => {
    e.preventDefault()
    const startY = e.clientY
    const startRatio = splitRatio

    const onMove = (e) => {
      const container = containerRef.current?.parentElement
      if (!container) return
      const rect = container.getBoundingClientRect()
      const delta = e.clientY - startY
      const newRatio = startRatio + delta / rect.height
      setSplitRatio(Math.max(0.2, Math.min(0.8, newRatio)))
    }

    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      const finalRatio = splitRatioRef.current
      // Defer to ensure React 18 has committed the latest setSplitRatio
      setTimeout(() => {
        document.dispatchEvent(new CustomEvent('resize-active-tab'))
        document.dispatchEvent(new CustomEvent('split-ratio-change', {
          detail: { tabId: tab.id, ratio: finalRatio }
        }))
        // Directly size previews based on container height and split ratio
        const container = containerRef.current?.parentElement
        if (container) {
          const rect = container.getBoundingClientRect()
          const totalRows = Math.floor(rect.height / 18)
          window.dispatchEvent(new CustomEvent('preview-resize', {
            detail: { tabId: tab.id, cols: 80, rows: Math.max(5, Math.round(totalRows * finalRatio)) }
          }))
          splits?.forEach(s => {
            window.dispatchEvent(new CustomEvent('preview-resize', {
              detail: { tabId: s.id, cols: 80, rows: Math.max(3, Math.round(totalRows * (1 - finalRatio))) }
            }))
          })
        }
      }, 0)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp, { once: true })
  }, [splitRatio])

  return (
    <div className={styles.splitContainer}>
      <div
        ref={containerRef}
        className={`terminal-pane ${styles.pane}`}
        id={`pane-${tab.id}`}
        style={{ flex: splits?.length ? splitRatio : 1 }}
      />
      {splits?.length > 0 && (
        <>
          <div className={styles.divider} onMouseDown={handleDividerMouseDown} />
          <div className={styles.splitArea} style={{ flex: 1 - splitRatio }}>
            {splits.map(split => (
              <SplitPane
                key={split.id}
                tab={split}
                parentTab={tab}
                onSplitClose={handleSplitClose}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
