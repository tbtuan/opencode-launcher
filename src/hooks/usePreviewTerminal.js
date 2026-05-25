import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { XTERM_THEME, TERMINAL_FONT } from '../utils/constants'

export function usePreviewTerminal(containerRef, cols, rows) {
  const terminalRef = useRef(null)

  useEffect(() => {
    if (!containerRef?.current) return

    const terminal = new Terminal({
      cols,
      rows,
      theme: XTERM_THEME,
      fontFamily: TERMINAL_FONT,
      fontSize: 6,
      lineHeight: 1.2,
      cursorBlink: false,
      cursorStyle: 'underline',
      scrollback: 500,
      disableStdin: true,
    })

    // Set container height to exactly fit the main terminal's row count
    const rowHeight = Math.round(6 * 1.2)
    containerRef.current.style.height = `${rows * rowHeight + 40}px`

    terminal.open(containerRef.current)
    // Use explicit resize to match main terminal dimensions (not fit(), which
    // would calculate a different row count due to font metric rounding)
    terminal.resize(cols, rows)

    terminalRef.current = terminal

    return () => {
      terminal.dispose()
      terminalRef.current = null
      if (containerRef.current) {
        containerRef.current.style.height = ''
      }
    }
  }, [containerRef, cols, rows])

  return terminalRef
}
