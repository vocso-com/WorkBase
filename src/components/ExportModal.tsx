import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import { useTransfer } from '../hooks/useTransfer'
import { serialize } from '../lib/serialize'
import { projectsToCsv } from '../lib/export/csv'
import { saveFile, isoDate, BRAND } from '../lib/export/save'
import { leaves } from '../lib/tree'
import { Icon } from './ui/Icon'

type AccountFormat = 'json' | 'csv'

const FORMATS: { key: AccountFormat; label: string; ext: string; icon: string; hint: string }[] = [
  {
    key: 'json',
    label: 'Account backup',
    ext: '.json',
    icon: 'ti-database-export',
    hint: 'Everything, exactly — projects, templates, labels, stages, settings and images. Use this to move to another computer.',
  },
  {
    key: 'csv',
    label: 'All projects',
    ext: '.csv',
    icon: 'ti-table',
    hint: 'One row per item across every project. Opens in Excel; imports back, but without colours, images or settings.',
  },
]

const humanSize = (bytes: number): string =>
  bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`

/**
 * Whole-account export. Distinct from the per-project Export menu in the header:
 * this one is about the data as a whole — the "set it up on the new machine"
 * path — so it names what is included and how big the file will be.
 */
export function ExportModal() {
  const open = useTransfer(s => s.accountExport)
  const hide = useTransfer(s => s.hideAccountExport)
  const doc = useStore(s => s.doc)
  const [busy, setBusy] = useState<AccountFormat | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<AccountFormat | null>(null)

  useEffect(() => {
    if (!open) return
    setBusy(null); setError(null); setDone(null)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') hide() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, hide])

  // Attachments and logos live in the document as data URLs, so a backup can be
  // far larger than the project count suggests. Better to say so up front.
  const stats = useMemo(() => {
    if (!open) return null
    const json = serialize(doc)
    return {
      bytes: new Blob([json]).size,
      projects: doc.roots.length,
      tasks: doc.roots.reduce((a, r) => a + leaves(r).length, 0),
      templates: doc.templates.length,
      json,
    }
  }, [open, doc])

  if (!open || !stats) return null

  const run = async (format: AccountFormat) => {
    setError(null); setDone(null); setBusy(format)
    try {
      const name = `${BRAND.toLowerCase()}-backup-${isoDate(new Date())}`
      const saved = format === 'json'
        ? await saveFile({ name, ext: 'json', data: stats.json, mime: 'application/json' })
        : await saveFile({ name, ext: 'csv', data: projectsToCsv(doc.roots, doc.stages, doc.stageLabels), mime: 'text/csv' })
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
            <div className="modal-title">Export your data</div>
            <div className="modal-desc">
              {stats.projects} project{stats.projects === 1 ? '' : 's'} · {stats.tasks} task{stats.tasks === 1 ? '' : 's'}
              {stats.templates > 0 ? ` · ${stats.templates} template${stats.templates === 1 ? '' : 's'}` : ''} · about {humanSize(stats.bytes)}
            </div>
          </div>
          <button className="modal-x" onClick={hide} aria-label="Close"><Icon name="ti-x" /></button>
        </div>

        <div className="modal-body">
          <div className="xfer-list">
            {FORMATS.map(f => (
              <button key={f.key} className="xfer-opt" disabled={busy !== null} onClick={() => run(f.key)}>
                <span className="xfer-opt-ic">
                  <Icon name={busy === f.key ? 'ti-loader-2' : f.icon} className={busy === f.key ? 'expmenu-spin' : undefined} />
                </span>
                <span className="xfer-opt-txt">
                  <b>{f.label} <span className="xfer-ext">{f.ext}</span></b>
                  <span>{f.hint}</span>
                </span>
                {done === f.key ? <Icon name="ti-check" className="xfer-done" /> : <Icon name="ti-download" className="xfer-go" />}
              </button>
            ))}
          </div>

          <div className="xfer-note">
            <Icon name="ti-lock" />
            <span>
              Nothing is uploaded — the file is written straight to this device. On the new machine, use
              <b> Import data</b> and pick the backup.
            </span>
          </div>

          {error ? <div className="tpl-err"><Icon name="ti-alert-triangle" /> {error}</div> : null}
        </div>
      </div>
    </div>
  )
}
