import { useRef, useEffect, useCallback } from 'react'
import CodeMirror from 'codemirror'
import 'codemirror/mode/javascript/javascript'
import 'codemirror/addon/selection/active-line'
import 'codemirror/addon/edit/matchbrackets'
import styles from './ConfigEditor.module.css'
import { logger } from '../../services/logger'

export function ConfigEditor({ tab, isActive, onDirtyChange, onSave }) {
  const containerRef = useRef(null)
  const editorRef = useRef(null)
  const contentRef = useRef(tab.content)

  useEffect(() => {
    contentRef.current = tab.content
  }, [tab.content])

  useEffect(() => {
    if (!containerRef.current) return

    const editor = CodeMirror(containerRef.current, {
      value: tab.content,
      mode: { name: 'javascript', json: true },
      theme: 'default',
      lineNumbers: true,
      indentUnit: 2,
      tabSize: 2,
      indentWithTabs: true,
      electricChars: true,
      matchBrackets: true,
      autoCloseBrackets: false,
      styleActiveLine: true,
      viewportMargin: Infinity,
      extraKeys: {
        'Ctrl-S': () => handleSave(),
      },
    })

    editor.getWrapperElement().style.height = '100%'
    editorRef.current = editor

    editor.on('change', () => {
      const dirty = editor.getValue() !== contentRef.current
      onDirtyChange?.(tab.id, dirty)
    })

    return () => {
      try { editor.toTextArea() } catch (e) { logger.warn('ConfigEditor', 'cleanup', e?.stack) }
      editorRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = useCallback(() => {
    if (editorRef.current) {
      onSave?.(tab.id, editorRef.current.getValue())
    }
  }, [tab.id, onSave])

  useEffect(() => {
    if (isActive && editorRef.current) {
      requestAnimationFrame(() => {
        try { editorRef.current.refresh() } catch {}
      })
    }
  }, [isActive])

  return <div ref={containerRef} className={styles.editor} />
}
