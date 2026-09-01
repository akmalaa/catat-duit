import { useEffect, useState } from 'react'
import { CheckCircle, XCircle } from './icons'

export default function Toast({ message, type = 'success', onDone }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setShow(true), 20)
    const t2 = setTimeout(() => setShow(false), 3000)
    const t3 = setTimeout(() => onDone?.(), 3400)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onDone])

  const Icon = type === 'error' ? XCircle : CheckCircle

  return (
    <div
      role="status"
      aria-live="polite"
      className={`toast toast-${type} ${show ? 'toast-visible' : ''}`}
    >
      <Icon size={16} weight="bold" aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}
