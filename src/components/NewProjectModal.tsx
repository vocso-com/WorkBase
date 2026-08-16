import { useEffect, useState } from 'react'
import type { Template } from '../types'
import { useStore } from '../store/useStore'
import { useTabs } from '../hooks/useTabs'
import { useNewProject } from '../hooks/useNewProject'
import { BUILTIN_TEMPLATES } from '../lib/templates'
import { hex } from '../theme'
import { tagBg, tagFg } from '../lib/colorMode'
import { useVocab } from '../hooks/useVocab'
import { useTransfer } from '../hooks/useTransfer'
import { fetchCatalog, fetchTemplate, directoryEnabled, type DirectoryEntry } from '../lib/directory'
import { Icon } from './ui/Icon'

function taskCount(tpl: Template): number {
  return tpl.modules.reduce((a, m) => a + m.items.length, 0)
}

export function NewProjectModal() {
  const open = useNewProject(s => s.open)
  const hide = useNewProject(s => s.hide)
  const custom = useStore(s => s.doc.templates)
  const v = useVocab()
  const [name, setName] = useState('')
  const [dir, setDir] = useState<DirectoryEntry[] | null>(null)
  const [dirBusy, setDirBusy] = useState(false)
  const [dirErr, setDirErr] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName('')
    setDirErr(null)
    // The catalogue is cached, so opening the modal is never blocked on the
    // network; a failure just leaves the section out.
    if (directoryEnabled()) {
      setDirBusy(true)
      void fetchCatalog(useStore.getState().doc.profile?.userEmail)
        .then(c => setDir(c?.templates ?? null))
        .finally(() => setDirBusy(false))
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') hide() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, hide])

  if (!open) return null

  const openProject = (id: string) => {
    hide()
    useTabs.getState().openProject(id)
  }

  const createBlank = () => {
    const id = useStore.getState().addProject(name.trim() || 'Untitled project')
    openProject(id)
  }

  const importFromFile = () => {
    hide()
    useTransfer.getState().showImport()
  }

  /**
   * A directory template is fetched on use, not up front — the gallery only
   * ever needs the metadata. A locked one explains itself rather than erroring.
   */
  const createFromDirectory = async (entry: DirectoryEntry) => {
    setDirErr(null)
    if (entry.locked) {
      setDirErr(`“${entry.name}” is part of the paid catalogue. Upgrade to use it.`)
      return
    }
    setDirBusy(true)
    try {
      const tpl = await fetchTemplate(entry.id, entry.version, useStore.getState().doc.profile?.userEmail)
      createFromTemplate(tpl)
    } catch (e) {
      setDirErr((e as Error).message)
    } finally {
      setDirBusy(false)
    }
  }

  const createFromTemplate = (tpl: Template) => {
    const id = useStore.getState().addProjectFromTemplate(tpl, name.trim() || undefined)
    openProject(id)
  }

  const removeTemplate = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    useStore.getState().deleteTemplate(id)
  }

  return (
    <div className="modal-overlay" onClick={hide}>
      <div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <div className="modal-title">New {v.project}</div>
            <div className="modal-desc">Start blank or pick a template to pre-seed {v.modules} and {v.tasks}.</div>
          </div>
          <button className="modal-x" onClick={hide} aria-label="Close">
            <Icon name="ti-x" />
          </button>
        </div>

        <div className="modal-body">
          <label className="modal-field">
            <span>Project name</span>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Optional — uses the template name if left blank"
              onKeyDown={e => { if (e.key === 'Enter' && name.trim()) createBlank() }}
            />
          </label>

          <div className="tpl-blank" onClick={createBlank}>
            <div className="tpl-blank-ic"><Icon name="ti-plus" /></div>
            <div>
              <div className="tpl-blank-t">Blank {v.project}</div>
              <div className="tpl-blank-s">Start from scratch with no {v.modules}</div>
            </div>
            <Icon name="ti-arrow-right" style={{ marginLeft: 'auto', color: 'var(--faint)' }} />
          </div>

          <div className="tpl-blank" onClick={importFromFile}>
            <div className="tpl-blank-ic"><Icon name="ti-file-import" /></div>
            <div>
              <div className="tpl-blank-t">Import a {v.project} file</div>
              <div className="tpl-blank-s">From a .json or .csv export — choose what comes in and what to do about duplicates</div>
            </div>
            <Icon name="ti-arrow-right" style={{ marginLeft: 'auto', color: 'var(--faint)' }} />
          </div>

          <div className="tpl-sechead">Templates</div>
          <div className="tpl-grid">
            {BUILTIN_TEMPLATES.map(tpl => (
              <TemplateCard key={tpl.id} tpl={tpl} onPick={() => createFromTemplate(tpl)} />
            ))}
          </div>

          {dir && dir.length > 0 ? (
            <>
              <div className="tpl-sechead">
                Directory
                <button
                  className="tpl-refresh"
                  disabled={dirBusy}
                  onClick={() => {
                    setDirBusy(true)
                    void fetchCatalog(useStore.getState().doc.profile?.userEmail, true)
                      .then(c => setDir(c?.templates ?? null))
                      .finally(() => setDirBusy(false))
                  }}
                >
                  <Icon name={dirBusy ? 'ti-loader-2' : 'ti-refresh'} className={dirBusy ? 'expmenu-spin' : undefined} /> Refresh
                </button>
              </div>
              {dirErr ? <div className="tpl-err"><Icon name="ti-alert-triangle" /> {dirErr}</div> : null}
              <div className="tpl-grid">
                {dir.map(entry => (
                  <DirectoryCard key={entry.id} entry={entry} busy={dirBusy} onPick={() => void createFromDirectory(entry)} />
                ))}
              </div>
            </>
          ) : null}

          {custom.length > 0 ? (
            <>
              <div className="tpl-sechead">Your templates</div>
              <div className="tpl-grid">
                {custom.map(tpl => (
                  <TemplateCard
                    key={tpl.id}
                    tpl={tpl}
                    onPick={() => createFromTemplate(tpl)}
                    onDelete={e => removeTemplate(e, tpl.id)}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function TemplateCard({
  tpl,
  onPick,
  onDelete,
}: {
  tpl: Template
  onPick: () => void
  onDelete?: (e: React.MouseEvent) => void
}) {
  const color = tpl.color
  return (
    <div className="tpl-card" onClick={onPick}>
      <div className="tpl-cover" style={{ background: `linear-gradient(135deg, ${hex(color)}, ${hex(color)}cc)` }}>
        <div className="tpl-cover-ic"><Icon name={tpl.icon} /></div>
        {onDelete ? (
          <button className="tpl-del" onClick={onDelete} aria-label="Delete template">
            <Icon name="ti-trash" />
          </button>
        ) : null}
      </div>
      <div className="tpl-card-body">
        <div className="tpl-card-t">{tpl.name}</div>
        <div className="tpl-card-s">{tpl.description}</div>
        <div className="tpl-card-meta">
          <span className="tpl-pill" style={{ background: tagBg(color), color: tagFg(color) }}>
            {tpl.modules.length} modules
          </span>
          <span className="tpl-pill" style={{ background: 'var(--chip)', color: 'var(--muted)' }}>
            {taskCount(tpl)} tasks
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * A directory template. Locked ones are shown, not hidden: the paid catalogue is
 * the reason to upgrade, so it has to be visible to be wanted.
 */
function DirectoryCard({ entry, busy, onPick }: { entry: DirectoryEntry; busy: boolean; onPick: () => void }) {
  const color = entry.color
  return (
    <div className={`tpl-card${entry.locked ? ' tpl-card-locked' : ''}`} onClick={busy ? undefined : onPick}>
      <div className="tpl-cover" style={{ background: `linear-gradient(135deg, ${hex(color)}, ${hex(color)}cc)` }}>
        <div className="tpl-cover-ic"><Icon name={entry.icon} /></div>
        {entry.locked ? <span className="tpl-lock"><Icon name="ti-lock" /> Pro</span> : null}
      </div>
      <div className="tpl-card-body">
        <div className="tpl-card-t">{entry.name}</div>
        <div className="tpl-card-s">{entry.description}</div>
        <div className="tpl-card-meta">
          <span className="tpl-pill" style={{ background: tagBg(color), color: tagFg(color) }}>
            {entry.modules} modules
          </span>
          <span className="tpl-pill" style={{ background: 'var(--chip)', color: 'var(--muted)' }}>
            {entry.tasks} tasks
          </span>
        </div>
      </div>
    </div>
  )
}
