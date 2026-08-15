import { useMemo, useState } from 'react'
import type { Node } from '../types'
import { useStore } from '../store/useStore'
import { dependencyNodes, unmetDependencies, dependents, isComplete, wouldCycle } from '../lib/deps'
import { searchNodes } from '../lib/search'
import { goToNode } from '../lib/goto'
import { Icon } from './ui/Icon'

function DepChip({ n, onGo, onRemove }: { n: Node; onGo: () => void; onRemove?: () => void }) {
  const done = isComplete(n)
  return (
    <div className={`dep-chip${done ? ' done' : ''}`}>
      <span className="dep-state">{done ? <Icon name="ti-circle-check-filled" /> : <Icon name="ti-circle" />}</span>
      <button className="dep-title" onClick={onGo} title="Open">{n.title}</button>
      <span className="dep-sid">{n.shortId}</span>
      {onRemove ? <button className="dep-x" onClick={onRemove} aria-label="Remove dependency"><Icon name="ti-x" /></button> : null}
    </div>
  )
}

/**
 * Blocked-by / blocking editor. Fully opt-in: when a node has no dependencies
 * (in either direction) this collapses to a single unobtrusive "Add
 * dependency" link, so nothing changes for people who never use it.
 */
export function Dependencies({ node }: { node: Node }) {
  const roots = useStore(s => s.doc.roots)
  const [adding, setAdding] = useState(false)
  const [q, setQ] = useState('')

  const deps = dependencyNodes(roots, node)
  const unmet = unmetDependencies(roots, node)
  const blocking = dependents(roots, node.id)
  const isBlocked = unmet.length > 0

  const descend = useMemo(() => {
    const s = new Set<string>()
    const w = (n: Node) => { s.add(n.id); n.children.forEach(w) }
    w(node)
    return s
  }, [node])

  const results = useMemo(() => {
    if (!q.trim()) return []
    return searchNodes(roots, q)
      .filter(h => !descend.has(h.node.id)
        && !(node.dependsOn ?? []).includes(h.node.id)
        && !wouldCycle(roots, node.id, h.node.id))
      .slice(0, 8)
  }, [q, roots, node, descend])

  const add = (id: string) => { useStore.getState().addDependency(node.id, id); setQ(''); setAdding(false) }

  // Nothing yet → a single quiet affordance, unless the user is actively adding.
  if (deps.length === 0 && blocking.length === 0 && !adding) {
    return (
      <div className="dep-empty">
        <button className="dep-addlink" onClick={() => setAdding(true)}><Icon name="ti-link" /> Add dependency</button>
      </div>
    )
  }

  return (
    <section className="cm-sec dep-sec">
      <div className="cm-sec-h">
        <Icon name="ti-link" /> Dependencies
        {deps.length > 0 ? (
          <span className={`dep-badge ${isBlocked ? 'blocked' : 'ready'}`}>
            {isBlocked ? <><Icon name="ti-lock" /> Blocked</> : <><Icon name="ti-lock-open" /> Ready</>}
          </span>
        ) : null}
      </div>

      {deps.length > 0 ? (
        <div className="dep-group">
          <div className="dep-label">Blocked by</div>
          {deps.map(d => (
            <DepChip key={d.id} n={d} onGo={() => goToNode(d.id)} onRemove={() => useStore.getState().removeDependency(node.id, d.id)} />
          ))}
        </div>
      ) : null}

      {adding ? (
        <div className="dep-add">
          <input
            autoFocus
            className="dep-input"
            placeholder="Search a task to depend on…"
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') { setAdding(false); setQ('') } }}
          />
          <div className="dep-results">
            {q.trim() === '' ? (
              <div className="dep-hint">Type to find a project, module or task.</div>
            ) : results.length === 0 ? (
              <div className="dep-hint">No eligible items.</div>
            ) : results.map(h => (
              <button key={h.node.id} className="dep-result" onClick={() => add(h.node.id)}>
                <span className="dep-result-title">{h.node.title}</span>
                <span className="dep-result-trail">{[h.rootTitle, h.trail].filter(Boolean).join(' › ')}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <button className="dep-addlink" onClick={() => setAdding(true)}><Icon name="ti-plus" /> Add dependency</button>
      )}

      {blocking.length > 0 ? (
        <div className="dep-group">
          <div className="dep-label">Blocking</div>
          {blocking.map(d => <DepChip key={d.id} n={d} onGo={() => goToNode(d.id)} />)}
        </div>
      ) : null}
    </section>
  )
}
