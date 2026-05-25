import { useEffect, useRef } from 'react'

export function useResizeObserver(ref, callback) {
  const savedCallback = useRef(callback)

  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    if (!ref?.current) return

    const observer = new ResizeObserver(() => {
      savedCallback.current?.()
    })

    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [ref])
}
