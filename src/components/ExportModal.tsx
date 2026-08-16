import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import { useTransfer } from '../hooks/useTransfer'
import { findNode } from '../lib/tree'
import { exportView, EXPORT_FORMATS, type ExportFormat } from '../lib/export'
import { Icon } from './ui/Icon'

export function ExportModal() {
  const nodeId = useTransfer(s => s.exportFor)
  const hide = useTransfer(s => s.hideExport)
  const roots = useStore(s => s.doc.roots)
  const [busy, setBusy] = useState<ExportFormat | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<ExportFormat | null>(null)

  useEffect(() => {
    if (!nodeId) return
    setBusy(null); setError(null); setDone(null)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') hide() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [nodeId, hide])

  if (!nodeId) return null
  const node = findNode(roots, nodeId)
  if (!node) return null

  const run = async (format: ExportFormat) => {
    setError(null); setDone(null); setBusy(format)
    try {
      // The image formats rasterize what the project page is rendering, so the
      // element is read at export time rather than threaded down as a ref.
      const saved = await exportView(format, node, useStore.getState().doc, document.querySelector<HTMLElement>('.proj-page'))
      if (saved) setDone(format)
    } catch (e) {
      setError((e as Error).message || 'That export could not be completed.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="modal-overlay" onClick={hide}>
      <div className="modal xfer" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <div className="modal-title">Export “{node.title}”</div>
            <div className="modal-desc">Pick a format. Image and PDF capture the view you have open; the rest describe the project itself.</div>
          </div>
          <button className="modal-x" onClick={hide} aria-label="Close"><Icon name="ti-x" /></button>
        </div>

        <div className="modal-body">
          <div className="xfer-list">
            {EXPORT_FORMATS.map(f => (
              <button key={f.key} className="xfer-opt" disabled={busy !== null} onClick={() => run(f.key)}>
                <span className="xfer-opt-ic"><Icon name={busy === f.key ? 'ti-loader-2' : f.icon} className={busy === f.key ? 'expmenu-spin' : undefined} /></span>
                <span className="xfer-opt-txt">
                  <b>{f.label} <span className="xfer-ext">{f.ext}</span></b>
                  <span>{f.hint}</span>
                </span>
                {done === f.key
                  ? <Icon name="ti-check" className="xfer-done" />
                  : <Icon name="ti-download" className="xfer-go" />}
              </button>
            ))}
          </div>

          {error ? <div className="tpl-err"><Icon name="ti-alert-triangle" /> {error}</div> : null}
          {done ? <div className="xfer-note"><Icon name="ti-check" /> Saved. Spreadsheet and JSON files can be brought back in through Import.</div> : null}
        </div>
      </div>
    </div>
  )
}
