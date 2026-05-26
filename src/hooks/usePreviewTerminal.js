import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { XTERM_THEME, TERMINAL_FONT } from '../utils/constants'
import { getTerminalDimensions } from '../services/terminalService'

/**
 * Preview-Terminal als 1:1-Spiegel des Main-Panes.
 *
 * Die Initialisierung des xterm wird verzögert, bis die echten cols/rows der
 * Main-Pane via `getTerminalDimensions(tabId)` verfügbar sind. So vermeiden wir
 * den Mismatch-Render (alte/neue Spalten mit/ohne Background), der entsteht,
 * wenn das xterm zuerst mit Default 80x24 erzeugt wird und PTY-Daten schon
 * reinkommen, bevor ein späterer Resize auf die echten Dimensionen läuft.
 *
 * Skalierung: nur nach Breite (`scale = cw/tw`), mit Bottom-Clip via
 * pre-scale translateY, damit die untersten/aktuellsten Zeilen sichtbar sind.
 */
export function usePreviewTerminal(containerRef, tabId) {
  const terminalRef = useRef(null)

  useEffect(() => {
    if (!containerRef?.current) return

    let terminal = null
    let ro = null
    let syncTimer = null
    let onPreviewResize = null
    let attempts = 0
    let disposed = false

    const applyScale = () => {
      const container = containerRef.current
      const xterm = container?.querySelector('.xterm')
      const screen = container?.querySelector('.xterm-screen')
      if (!container || !xterm || !screen) return

      const cw = container.clientWidth
      const ch = container.clientHeight
      const tw = screen.offsetWidth || xterm.offsetWidth
      const th = screen.offsetHeight || xterm.offsetHeight
      if (!cw || !ch || !tw || !th) return

      const scale = cw / tw
      const translateY = Math.min(0, ch / scale - th)
      xterm.style.transform = `scale(${scale}) translateY(${translateY}px)`
    }

    const init = (cols, rows) => {
      if (disposed || !containerRef.current) return

      terminal = new Terminal({
        cols,
        rows,
        theme: XTERM_THEME,
        fontFamily: TERMINAL_FONT,
        fontSize: 13,
        lineHeight: 1.3,
        cursorBlink: false,
        cursorStyle: 'underline',
        scrollback: 0,
        disableStdin: true,
      })

      terminal.open(containerRef.current)
      terminalRef.current = terminal

      const xtermEl = containerRef.current.querySelector('.xterm')
      if (xtermEl) {
        xtermEl.style.transformOrigin = 'top left'
        xtermEl.style.position = 'absolute'
        xtermEl.style.top = '0'
        xtermEl.style.left = '0'
        xtermEl.style.background = XTERM_THEME.background
      }

      // xterm only paints background on written cells; empty/unwritten cells
      // would let the parent's background bleed through. Set the terminal
      // background on the container so empty regions blend in.
      containerRef.current.style.background = XTERM_THEME.background

      const viewport = containerRef.current.querySelector('.xterm-viewport')
      if (viewport) {
        viewport.style.overflowY = 'hidden'
      }

      // Apply scale once xterm has measured itself
      requestAnimationFrame(() => requestAnimationFrame(applyScale))

      // Re-scale when the card container resizes
      ro = new ResizeObserver(() => applyScale())
      ro.observe(containerRef.current)

      // Re-size terminal AND re-scale whenever the main pane's PTY resizes
      onPreviewResize = (e) => {
        if (e.detail?.tabId !== tabId) return
        const { cols: c, rows: r } = e.detail
        if (!c || !r) return
        try { terminal.resize(c, r) } catch {}
        requestAnimationFrame(() => requestAnimationFrame(applyScale))
      }
      window.addEventListener('preview-resize', onPreviewResize)
    }

    const tryInit = () => {
      syncTimer = null
      if (disposed) return
      const dims = getTerminalDimensions(tabId)
      if (dims) {
        init(dims.cols, dims.rows)
        return
      }
      if (attempts++ < 20) {
        syncTimer = setTimeout(tryInit, 100)
      } else {
        // Fallback after 2s — main pane may have failed to fit; use default
        init(80, 24)
      }
    }

    tryInit()

    return () => {
      disposed = true
      if (syncTimer) clearTimeout(syncTimer)
      if (ro) ro.disconnect()
      if (onPreviewResize) window.removeEventListener('preview-resize', onPreviewResize)
      if (terminal) terminal.dispose()
      terminalRef.current = null
    }
  }, [containerRef, tabId])

  return terminalRef
}
