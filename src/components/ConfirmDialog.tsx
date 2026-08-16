import { useEffect } from 'react'
import { useConfirm } from '../hooks/useConfirm'
import { Icon } from './ui/Icon'

export function ConfirmDialog() {
  const current = useConfirm(s => s.current)
  const close = useConfirm(s => s.close)

  useEffect(() => {
    if (!current) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, close])

  if (!current) return null

  const confirm = () => { current.onConfirm(); close() }
  const alt = () => { current.onAlt?.(); close() }

  return (
    <div className="confirm-overlay" onClick={close}>
      <div className="confirm" onClick={e => e.stopPropagation()} role="alertdialog" aria-modal="true">
        <div className={`confirm-ic${current.danger ? ' danger' : ''}`}>
          <Icon name={current.danger ? 'ti-alert-triangle' : 'ti-help'} />
        </div>
        <div className="confirm-body">
          {current.title ? <div className="confirm-title">{current.title}</div> : null}
          <div className="confirm-msg">{current.message}</div>
        </div>
        <div className="confirm-actions">
          <button className="ghostbtn" onClick={close}>Cancel</button>
          {current.altLabel && current.onAlt ? (
            <button className="ghostbtn confirm-alt" onClick={alt}>{current.altLabel}</button>
          ) : null}
          <button className={`newbtn${current.danger ? ' newbtn-danger' : ''}`} onClick={confirm} autoFocus>
            {current.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
