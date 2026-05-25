import { useRef, useCallback, useEffect } from 'react'
import {
  IDLE_DEBOUNCE_MS,
  STARTUP_POLL_INTERVAL_MS,
  STARTUP_FALLBACK_TIMEOUT_MS,
} from '../utils/constants'

export function isMouseTrackingData(data) {
  if (data.length < 3 || data.length > 20) return false
  if (data.charCodeAt(0) !== 0x1b) return false
  if (data[1] !== '[') return false

  // X10 / Normal mode: ESC [ M <b+32> <x+32> <y+32> (exactly 6 bytes)
  if (data.length === 6 && data[2] === 'M') return true

  // SGR mode: ESC [ <x;y;btn> M/m
  const last = data[data.length - 1]
  return (last === 'M' || last === 'm') && data.includes('<')
}

export function useProcessingDetection({ terminalRef, onProcessingChange, tabId }) {
  const writeIdleTimeoutRef = useRef(null)
  const openCodeReadyTimeoutRef = useRef(null)
  const tuiCheckIntervalRef = useRef(null)
  const suppressUntilRef = useRef(null)
  const suppressTimeoutRef = useRef(null)

  const isProcessingRef = useRef(false)
  const isOpenCodeStartingRef = useRef(false)
  const lastReportedProcessingRef = useRef(null)

  const setIdleRef = useRef(null)

  const setProcessing = useCallback(() => {
    isProcessingRef.current = true
    clearTimeout(writeIdleTimeoutRef.current)
    if (lastReportedProcessingRef.current !== true) {
      lastReportedProcessingRef.current = true
      onProcessingChange?.(true, isOpenCodeStartingRef.current)
    }
  }, [onProcessingChange])

  const setIdle = useCallback(() => {
    writeIdleTimeoutRef.current = null
    if (isOpenCodeStartingRef.current) {
      writeIdleTimeoutRef.current = setTimeout(() => setIdleRef.current(), IDLE_DEBOUNCE_MS)
      return
    }
    isProcessingRef.current = false
    if (lastReportedProcessingRef.current !== false) {
      lastReportedProcessingRef.current = false
      onProcessingChange?.(false, false)
    }
  }, [onProcessingChange])
  setIdleRef.current = setIdle

  const suppressIndicator = useCallback((ms = 200) => {
    suppressUntilRef.current = Date.now() + ms
    clearTimeout(suppressTimeoutRef.current)
    suppressTimeoutRef.current = setTimeout(() => {
      suppressUntilRef.current = null
    }, ms)
  }, [])

  const handlePtyData = useCallback((data) => {
    if (isMouseTrackingData(data)) return
    if (isOpenCodeStartingRef.current) {
      setProcessing()
      clearTimeout(writeIdleTimeoutRef.current)
      writeIdleTimeoutRef.current = setTimeout(() => setIdle(), IDLE_DEBOUNCE_MS)
      return
    }
    if (suppressUntilRef.current !== null && Date.now() < suppressUntilRef.current) {
      clearTimeout(writeIdleTimeoutRef.current)
      writeIdleTimeoutRef.current = setTimeout(() => setIdle(), IDLE_DEBOUNCE_MS)
      return
    }
    if (data.length > 100) {
      setProcessing()
    }
    clearTimeout(writeIdleTimeoutRef.current)
    writeIdleTimeoutRef.current = setTimeout(() => setIdle(), IDLE_DEBOUNCE_MS)
  }, [setProcessing, setIdle])

  const handleUserInput = useCallback(() => {}, [])

  const handleOpencodeStarted = useCallback(() => {
    isOpenCodeStartingRef.current = true
    setProcessing()
    clearTimeout(openCodeReadyTimeoutRef.current)

    const terminal = terminalRef?.current
    if (!terminal) return

    tuiCheckIntervalRef.current = setInterval(() => {
      const buffer = terminal.buffer.active
      const rows = terminal.rows
      if (buffer.cursorY >= rows - 3) {
        let rowsWithContent = 0
        for (let y = 0; y < rows; y++) {
          const line = buffer.getLine(y)
          if (line && line.translateToString().trim().length > 0) {
            rowsWithContent++
          }
        }
        if (rowsWithContent >= rows * 0.5) {
          clearInterval(tuiCheckIntervalRef.current)
          tuiCheckIntervalRef.current = null
          isOpenCodeStartingRef.current = false
        }
      }
    }, STARTUP_POLL_INTERVAL_MS)

    openCodeReadyTimeoutRef.current = setTimeout(() => {
      if (tuiCheckIntervalRef.current) {
        clearInterval(tuiCheckIntervalRef.current)
        tuiCheckIntervalRef.current = null
      }
      isOpenCodeStartingRef.current = false
    }, STARTUP_FALLBACK_TIMEOUT_MS)
  }, [setProcessing, terminalRef])

  const cleanup = useCallback(() => {
    clearTimeout(writeIdleTimeoutRef.current)
    clearTimeout(openCodeReadyTimeoutRef.current)
    clearTimeout(suppressTimeoutRef.current)
    if (tuiCheckIntervalRef.current) {
      clearInterval(tuiCheckIntervalRef.current)
      tuiCheckIntervalRef.current = null
    }
  }, [])

  useEffect(() => {
    return cleanup
  }, [cleanup])

  return {
    suppressIndicator,
    handlePtyData,
    handleUserInput,
    handleOpencodeStarted,
    cleanup,
    isProcessingRef,
    isOpenCodeStartingRef,
  }
}
