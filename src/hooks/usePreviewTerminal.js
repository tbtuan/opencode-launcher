import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { XTERM_THEME, TERMINAL_FONT } from '../utils/constants'

export function usePreviewTerminal(containerRef) {
  const terminalRef = useRef(null)
  const fitAddonRef = useRef(null)

  useEffect(() => {
    if (!containerRef?.current) return

    const fitAddon = new FitAddon()
    fitAddonRef.current = fitAddon

    const terminal = new Terminal({
      cols: 80,
      rows: 24,
      theme: XTERM_THEME,
      fontFamily: TERMINAL_FONT,
      fontSize: 6,
      lineHeight: 1.2,
      cursorBlink: false,
      cursorStyle: 'underline',
      scrollback: 0,
      disableStdin: true,
    })

    terminal.loadAddon(fitAddon)
    terminal.open(containerRef.current)

    try { fitAddon.fit() } catch {}

    terminalRef.current = terminal

    return () => {
      terminal.dispose()
      terminalRef.current = null
      fitAddonRef.current = null
    }
  }, [containerRef])

  return terminalRef
}
