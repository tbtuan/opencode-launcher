import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { XTERM_THEME, TERMINAL_FONT } from '../utils/constants'

export function useTerminalSetup(containerRef) {
  const terminalRef = useRef(null)
  const fitAddonRef = useRef(null)

  useEffect(() => {
    if (!containerRef?.current) return

    const terminal = new Terminal({
      theme: XTERM_THEME,
      fontFamily: TERMINAL_FONT,
      fontSize: 13,
      lineHeight: 1.3,
      cursorBlink: true,
      scrollback: 5000,
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(containerRef.current)
    // Only fit on initial open if the container already has real dimensions.
    // Inactive panes are hidden via opacity:0, so clientWidth is 0 at mount time —
    // calling fit() in that state would set the terminal to 0 columns which breaks
    // PTY output. The TerminalPane fitAndResize effect handles the correct fit once
    // the tab becomes active and the container is visible.
    if (containerRef.current.clientWidth >= 10 && containerRef.current.clientHeight >= 10) {
      try { fitAddon.fit() } catch {}
    }

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    return () => {
      terminal.dispose()
      terminalRef.current = null
      fitAddonRef.current = null
    }
  }, [containerRef])

  const fit = useCallback(() => {
    try { fitAddonRef.current?.fit() } catch {}
  }, [])

  const focus = useCallback(() => {
    terminalRef.current?.focus()
  }, [])

  const write = useCallback((data) => {
    terminalRef.current?.write(data)
  }, [])

  const clear = useCallback(() => {
    terminalRef.current?.clear()
  }, [])

  const hasSelection = useCallback(() => {
    return terminalRef.current?.hasSelection() || false
  }, [])

  const getSelection = useCallback(() => {
    return terminalRef.current?.getSelection() || ''
  }, [])

  const getCols = useCallback(() => terminalRef.current?.cols || 80, [])
  const getRows = useCallback(() => terminalRef.current?.rows || 24, [])

  return {
    terminalRef,
    fitAddonRef,
    fit,
    focus,
    write,
    clear,
    hasSelection,
    getSelection,
    getCols,
    getRows,
  }
}
