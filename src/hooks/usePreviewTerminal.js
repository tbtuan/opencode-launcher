import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { XTERM_THEME, TERMINAL_FONT } from '../utils/constants'

export function usePreviewTerminal(containerRef) {
  const terminalRef = useRef(null)

  useEffect(() => {
    if (!containerRef?.current) return

    const terminal = new Terminal({
      cols: 80,
      rows: 24,
      theme: XTERM_THEME,
      fontFamily: TERMINAL_FONT,
      fontSize: 6,
      lineHeight: 1.2,
      cursorBlink: false,
      cursorStyle: 'underline',
      scrollback: 500,
      disableStdin: true,
    })

    terminal.open(containerRef.current)
    terminalRef.current = terminal

    return () => {
      terminal.dispose()
      terminalRef.current = null
    }
  }, [containerRef])

  return terminalRef
}
