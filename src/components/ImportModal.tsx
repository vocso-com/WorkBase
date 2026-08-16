import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import { useTabs } from '../hooks/useTabs'
import { useTransfer } from '../hooks/useTransfer'
import { openTextFile } from '../lib/export/save'
import {
  parseImportFile,
  planImport,
  formatLabel,
  type ImportCandidate,
  type ParsedImport,
  type Resolution,
} from '../lib/export/importPlan'
import { Icon } from './ui/Icon'

const RESOLUTIONS: { key: Resolution; label: string; hint: string }[] = [
  { key: 'add', label: 'Add as new', hint: 'Keep both — this comes in as a separate project' },
  { key: 'update', label: 'Update existing', hint: 'Replace the existing project’s contents with this one' },
  { key: 'ignore', label: 'Skip', hint: 'Leave the existing project exactly as it is' },
]

export function ImportModal() {
  const open = useTransfer(s => s.importOpen)
  const hide = useTransfer(s => s.hideImport)
  const [parsed, setParsed] = useState<ParsedImport | null>(null)
  const [plan, setPlan] = useState<ImportCandidate[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setParsed(null); setPlan([]); setError(null); setBusy(false)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') hide() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, hide])

  if (!open) return null

  const pick = async () => {
    setError(null); setBusy(true)
    try {
      const text = await openTextFile()
      if (!text) return
      const next = parseImportFile(text)
      setParsed(next)
      setPlan(planImport(useStore.getState().doc, next))
    } catch (e) {
      setParsed(null); setPlan([])
      setError((e as Error).message || 'That file could not be read.')
    } finally {
      setBusy(false)
    }
  }

  const setAt = (i: number, patch: Partial<ImportCandidate>) =>
    setPlan(p => p.map((c, j) => (j === i ? { ...c, ...patch } : c)))

  const chosen = plan.filter(c => c.selected && c.resolution !== 'ignore')
  const willUpdate = chosen.filter(c => c.resolution === 'update').length

  const run = () => {
    if (!parsed) return
    const out = useStore.getState().applyImport(parsed, plan)
    hide()
    if (out.openId) useTabs.getState().openProject(out.openId)
  }

  return (
    <div className="modal-overlay" onClick={hide}>
      <div className="modal xfer" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <div className="modal-title">Import</div>
            <div className="modal-desc">
              Bring in a WorkBase project or account backup (<b>.json</b>) or a spreadsheet (<b>.csv</b>) exported from here.
            </div>
          </div>
          <button className="modal-x" onClick={hide} aria-label="Close"><Icon name="ti-x" /></button>
        </div>

        <div className="modal-body">
          {!parsed ? (
            <>
              <button className="tpl-blank xfer-pick" onClick={pick} disabled={busy}>
                <div className="tpl-blank-ic"><Icon name={busy ? 'ti-loader-2' : 'ti-file-import'} className={busy ? 'expmenu-spin' : undefined} /></div>
                <div>
                  <div className="tpl-blank-t">Choose a file</div>
                  <div className="tpl-blank-s">.json or .csv — nothing changes until you confirm</div>
                </div>
                <Icon name="ti-arrow-right" style={{ marginLeft: 'auto', color: 'var(--faint)' }} />
              </button>
              {error ? <div className="tpl-err"><Icon name="ti-alert-triangle" /> {error}</div> : null}
            </>
          ) : (
            <>
              <div className="xfer-note">
                <Icon name="ti-file-check" /> Read as <b>{formatLabel(parsed.format)}</b> — {plan.length} project{plan.length === 1 ? '' : 's'} found.
              </div>

              <div className="xfer-list">
                {plan.map((c, i) => (
                  <div key={c.key} className={`xfer-row${c.selected ? '' : ' xfer-row-off'}`}>
                    <label className="xfer-row-head">
                      <input type="checkbox" checked={c.selected} onChange={e => setAt(i, { selected: e.target.checked })} />
                      <span className="xfer-row-title">{c.title}</span>
                      <span className="xfer-row-meta">{c.modules} modules · {c.tasks} tasks</span>
                    </label>

                    {c.existingId && c.selected ? (
                      <>
                        <div className="xfer-warn">
                          <Icon name="ti-alert-triangle" /> A project called “{c.title}” already exists here.
                        </div>
                        <div className="xfer-res">
                          {RESOLUTIONS.map(r => (
                            <button
                              key={r.key}
                              className={`xfer-res-opt${c.resolution === r.key ? ' on' : ''}${r.key === 'update' ? ' danger' : ''}`}
                              onClick={() => setAt(i, { resolution: r.key })}
                              aria-pressed={c.resolution === r.key}
                            >
                              <b>{r.label}</b>
                              <span>{r.hint}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    ) : null}
                  </div>
                ))}
              </div>

              {willUpdate > 0 ? (
                <div className="tpl-err">
                  <Icon name="ti-alert-triangle" />
                  {willUpdate === 1 ? 'One existing project will be replaced' : `${willUpdate} existing projects will be replaced`} by
                  the version in this file. This cannot be undone — export a backup first if you are unsure.
                </div>
              ) : null}

              <div className="xfer-actions">
                <button className="ghostbtn" onClick={() => { setParsed(null); setPlan([]) }}>Choose another file</button>
                <button className="newbtn" onClick={run} disabled={chosen.length === 0}>
                  {chosen.length === 0 ? 'Nothing selected' : `Import ${chosen.length} project${chosen.length === 1 ? '' : 's'}`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
