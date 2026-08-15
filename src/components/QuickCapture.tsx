import { useEffect, useState } from 'react'
import type { Node } from '../types'
import { useQuickCapture } from '../hooks/useQuickCapture'
import { useStore } from '../store/useStore'
import { parseDue } from '../lib/nlDate'
import { goToNode } from '../lib/goto'
import { findNode } from '../lib/tree'
import { DEFAULT_WORKSPACE_ID } from '../lib/serialize'
import { tagBg, tagFg } from '../lib/colorMode'
import { Icon } from './ui/Icon'

const TKEY = 'wb.qc.target'

// A fast task capture with natural-language dates: "ship blog fri" → a task
// titled "ship blog" due Friday, filed wherever you point it — Inbox, a brand
// new project, or under any existing project / module / task at any depth.
export function QuickCapture() {
  const open = useQuickCapture(s => s.open)
  const roots = useStore(s => s.doc.roots)
  const activeWs = useStore(s => s.doc.activeWorkspace)
  const [val, setVal] = useState('')
  const [target, setTarget] = useState<string>('inbox')
  const [pickOpen, setPickOpen] = useState(false)
  const [query, setQuery] = useState('')

  const projects = roots.filter(r => (r.workspace ?? DEFAULT_WORKSPACE_ID) === activeWs)

  useEffect(() => {
    if (!open) return
    setVal(''); setPickOpen(false); setQuery('')
    const saved = (() => { try { return localStorage.getItem(TKEY) } catch { return null } })()
    setTarget(saved && (saved === 'inbox' || findNode(roots, saved)) ? saved : 'inbox')
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') useQuickCapture.getState().hide() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  const parsed = parseDue(val)
  const canAdd = parsed.title.trim().length > 0
  const targetNode = target === 'inbox' || target === 'new' ? null : findNode(roots, target)
  const targetLabel = target === 'new' ? 'New project' : (targetNode?.title ?? 'Inbox')

  // Every node in this WorkBase, flattened with its parent trail as context.
  const candidates: { id: string; title: string; trail: string; node: Node }[] = []
  const walk = (n: Node, trail: string[]) => {
    candidates.push({ id: n.id, title: n.title, trail: trail.join(' › '), node: n })
    n.children.forEach(c => walk(c, [...trail, n.title]))
  }
  projects.forEach(p => walk(p, []))
  const ql = query.trim().toLowerCase()
  const filtered = candidates.filter(c => !ql || c.title.toLowerCase().includes(ql) || c.trail.toLowerCase().includes(ql)).slice(0, 40)

  const choose = (id: string) => {
    setTarget(id); setPickOpen(false); setQuery('')
    try { localStorage.setItem(TKEY, id) } catch { /* ignore */ }
  }

  const submit = (openAfter: boolean) => {
    if (!canAdd) return
    const title = parsed.title.trim()
    let id: string
    if (target === 'new') {
      id = useStore.getState().addProject(title)
      if (parsed.dueDate) useStore.getState().patch(id, { dueDate: parsed.dueDate })
    } else {
      id = useStore.getState().quickAddTask(title, parsed.dueDate, target === 'inbox' ? undefined : target)
    }
    useQuickCapture.getState().hide()
    if (openAfter) goToNode(id)
  }

  return (
    <div className="qc-backdrop" onClick={() => useQuickCapture.getState().hide()}>
      <div className="qc" onClick={e => e.stopPropagation()}>
        <div className="qc-head">
          <span className="qc-head-lbl"><Icon name="ti-bolt" /> Quick add</span>
          <div className="qc-target-wrap">
            <button className="qc-target" onClick={() => { setPickOpen(o => !o); setQuery('') }}>
              <Icon name="ti-arrow-right" />
              {target === 'inbox' ? <Icon name="ti-inbox" /> : null}
              {target === 'new' ? <Icon name="ti-folder-plus" /> : null}
              <span className="qc-target-lbl">{targetLabel}</span>
              <Icon name="ti-chevron-down" className="qc-target-caret" />
            </button>
            {pickOpen ? (
              <div className="qc-target-menu">
                <input
                  className="qc-target-search"
                  autoFocus
                  placeholder="Search a project, module or task…"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                />
                <div className="qc-target-list">
                  {!ql ? (
                    <button className={`qc-target-opt${target === 'inbox' ? ' on' : ''}`} onClick={() => choose('inbox')}>
                      <span className="qc-target-ic" style={{ background: tagBg('slate'), color: tagFg('slate') }}><Icon name="ti-inbox" /></span>
                      <span className="qc-target-txt"><span className="qc-target-t">Inbox</span></span>
                    </button>
                  ) : null}
                  {filtered.map(c => (
                    <button key={c.id} className={`qc-target-opt${target === c.id ? ' on' : ''}`} onClick={() => choose(c.id)}>
                      <span className="qc-target-ic" style={{ background: tagBg(c.node.color ?? 'gray'), color: tagFg(c.node.color ?? 'gray') }}><Icon name={c.node.icon ?? (c.trail ? 'ti-file' : 'ti-folder')} /></span>
                      <span className="qc-target-txt">
                        <span className="qc-target-t">{c.title}</span>
                        {c.trail ? <span className="qc-target-tr">{c.trail}</span> : null}
                      </span>
                    </button>
                  ))}
                  <button className="qc-target-opt qc-target-new" onClick={() => choose('new')}>
                    <span className="qc-target-ic" style={{ background: tagBg('violet'), color: tagFg('violet') }}><Icon name="ti-folder-plus" /></span>
                    <span className="qc-target-txt"><span className="qc-target-t">New project{parsed.title ? ` — “${parsed.title}”` : ''}</span></span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
        <input
          className="qc-input"
          autoFocus
          placeholder={target === 'new' ? 'Name your new project…' : 'e.g. Ship the blog post fri'}
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(e.metaKey || e.shiftKey) } }}
        />
        {parsed.dueDate ? (
          <div className="qc-preview">
            <span className="qc-preview-title">{parsed.title}</span>
            <span className="qc-preview-due"><Icon name="ti-calendar" /> {parsed.dueLabel}</span>
          </div>
        ) : (
          <div className="qc-hint">Add “tomorrow”, “fri”, “next week”, or “aug 20” to set a due date</div>
        )}
        <div className="qc-actions">
          <button className="qc-add" onClick={() => submit(false)} disabled={!canAdd}>
            {target === 'new' ? 'Create project' : `Add to ${targetLabel}`}
          </button>
          <kbd>⏎</kbd>
        </div>
      </div>
    </div>
  )
}
