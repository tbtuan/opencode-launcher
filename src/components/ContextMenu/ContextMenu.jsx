import { useEffect, useRef, useCallback } from 'react'
import { cn } from '../../utils/cn'
import styles from './ContextMenu.module.css'
import { t } from '../../i18n'

export function ContextMenu({ x, y, visible, type, onClose, onRestart, onCloseTab, onSave, onDeleteCard }) {
  const menuRef = useRef(null)

  const adjustPosition = useCallback(() => {
    if (!menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    if (rect.right > window.innerWidth) {
      menuRef.current.style.left = `${x - rect.width}px`
    }
    if (rect.bottom > window.innerHeight) {
      menuRef.current.style.top = `${y - rect.height}px`
    }
  }, [x, y])

  useEffect(() => {
    if (visible) {
      requestAnimationFrame(adjustPosition)
    }
  }, [visible, adjustPosition])

  useEffect(() => {
    if (!visible) return
    function handler(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose?.()
      }
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [visible, onClose])

  if (!visible) return null

  const isTab = type === 'tab'
  const isEditor = type === 'editor'
  const isCard = type === 'card'

  return (
    <div
      ref={menuRef}
      className={cn(styles.contextMenu, !visible && styles.hidden)}
      style={{ left: `${x}px`, top: `${y}px` }}
    >
      {isEditor && (
        <>
          <button onClick={onSave}>{t('ctx.save')}</button>
          <hr className={styles.separator} />
        </>
      )}
      {isTab && (
        <>
          <button onClick={onRestart}>{t('ctx.restart')}</button>
          <hr className={styles.separator} />
        </>
      )}
      <button className={styles.danger} onClick={onCloseTab}>
        {t('ctx.closeTab')}
      </button>
      {isCard && (
        <>
          <hr className={styles.separator} />
          <button className={styles.danger} onClick={onDeleteCard}>
            {t('ctx.removeCard')}
          </button>
        </>
      )}
    </div>
  )
}
