import { useEffect, useState } from 'react'
import type { Template } from '../types'
import { useStore } from '../store/useStore'
import { useTabs } from '../hooks/useTabs'
import { useNewProject } from '../hooks/useNewProject'
import { BUILTIN_TEMPLATES } from '../lib/templates'
import { hex } from '../theme'
import { tagBg, tagFg } from '../lib/colorMode'
import { useVocab } from '../hooks/useVocab'
import { parseProjectExport } from '../lib/export/json'
import { openTextFile } from '../lib/export/save'
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
  const [importError, setImportError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName('')
    setImportError(null)
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

  /**
   * Bring in a project someone exported as JSON. The file carries its own
   * stages and labels, so it lands intact even in a document that never had
   * them; ids and shortIds are re-issued, so importing twice gives two
   * projects rather than a collision.
   */
  const importFromFile = async () => {
    setImportError(null)
    try {
      const text = await openTextFile('json')
      if (!text) return
      const id = useStore.getState().importProject(parseProjectExport(text))
      if (name.trim()) useStore.getState().rename(id, name.trim())
      openProject(id)
    } catch (e) {
      setImportError((e as Error).message || 'That file could not be imported.')
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
              <div className="tpl-blank-s">From a {v.project} exported as JSON — its {v.modules}, {v.tasks} and labels come with it</div>
            </div>
            <Icon name="ti-arrow-right" style={{ marginLeft: 'auto', color: 'var(--faint)' }} />
          </div>
          {importError ? <div className="tpl-err"><Icon name="ti-alert-triangle" /> {importError}</div> : null}

          <div className="tpl-sechead">Templates</div>
          <div className="tpl-grid">
            {BUILTIN_TEMPLATES.map(tpl => (
              <TemplateCard key={tpl.id} tpl={tpl} onPick={() => createFromTemplate(tpl)} />
            ))}
          </div>

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
