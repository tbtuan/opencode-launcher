import { useRef, useEffect, useCallback } from 'react'
import styles from './TerminalPane.module.css'
import { useTerminalSetup } from '../../hooks/useTerminalSetup'
import { useProcessingDetection } from '../../hooks/useProcessingDetection'
import {
  writeToPty, onPtyData, onPtyExit, onOpencodeStarted,
  triggerPaste, onPasteComplete, writeClipboard, resizePty,
  setTerminalDimensions,
} from '../../services/terminalService'
import { t } from '../../i18n'

export function TerminalPane({ tab, isActive, onProcessingChange, onStatusChange }) {
  const containerRef = useRef(null)
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
      term.element?.addEventListener('wheel', () => suppressIndicator(500), { passive: true })
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
      fit()
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
  }, [fit, getCols, getRows, tab.id, focus, suppressIndicator, fitAddonRef, terminalRef])

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

  return (
    <div
      ref={containerRef}
      className={`terminal-pane ${styles.pane}`}
      id={`pane-${tab.id}`}
    />
  )
}
