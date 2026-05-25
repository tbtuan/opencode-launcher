import { useRef, useCallback, useEffect } from 'react'
import {
  IDLE_DEBOUNCE_MS,
  INPUT_ECHO_TIMEOUT_MS,
  STARTUP_POLL_INTERVAL_MS,
  STARTUP_FALLBACK_TIMEOUT_MS,
} from '../utils/constants'

function isMouseTrackingData(data) {
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
  const userActionTimeoutRef = useRef(null)
  const inputTimeoutRef = useRef(null)
  const openCodeReadyTimeoutRef = useRef(null)
  const tuiCheckIntervalRef = useRef(null)

  const isUserActionRef = useRef(false)
  const isProcessingRef = useRef(false)
  const isOpenCodeStartingRef = useRef(false)
  const recentInputSizeRef = useRef(0)
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

  const suppressIndicator = useCallback((ms = 300) => {
    isUserActionRef.current = true
    clearTimeout(userActionTimeoutRef.current)
    userActionTimeoutRef.current = setTimeout(() => {
      isUserActionRef.current = false
    }, ms)
  }, [])

  const handlePtyData = useCallback((data) => {
    if (isMouseTrackingData(data)) {
      clearTimeout(writeIdleTimeoutRef.current)
      writeIdleTimeoutRef.current = setTimeout(() => setIdle(), IDLE_DEBOUNCE_MS)
      return
    }
    if (isOpenCodeStartingRef.current) {
      setProcessing()
      clearTimeout(writeIdleTimeoutRef.current)
      writeIdleTimeoutRef.current = setTimeout(() => setIdle(), IDLE_DEBOUNCE_MS)
      return
    }
    if (data.length > 100 || data.length > recentInputSizeRef.current * 1.5) {
      setProcessing()
    }
    clearTimeout(writeIdleTimeoutRef.current)
    writeIdleTimeoutRef.current = setTimeout(() => setIdle(), IDLE_DEBOUNCE_MS)
  }, [setProcessing, setIdle])

  const handleUserInput = useCallback((data) => {
    recentInputSizeRef.current += data.length
    clearTimeout(inputTimeoutRef.current)
    inputTimeoutRef.current = setTimeout(() => {
      recentInputSizeRef.current = 0
    }, INPUT_ECHO_TIMEOUT_MS)
  }, [])

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
    clearTimeout(userActionTimeoutRef.current)
    clearTimeout(inputTimeoutRef.current)
    clearTimeout(openCodeReadyTimeoutRef.current)
    if (tuiCheckIntervalRef.current) {
      clearInterval(tuiCheckIntervalRef.current)
      tuiCheckIntervalRef.current = null
    }
  }, [])

  useEffect(() => {
    return cleanup
  }, [cleanup])

  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') {
        suppressIndicator(500)
      }
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [suppressIndicator])

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
