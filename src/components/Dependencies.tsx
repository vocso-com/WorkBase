import { useMemo, useState } from 'react'
import type { Node } from '../types'
import { useStore } from '../store/useStore'
import { dependencyNodes, unmetDependencies, dependents, isComplete, wouldCycle } from '../lib/deps'
import { findNode, pathTo } from '../lib/tree'
import { searchNodes } from '../lib/search'
import { goToNode } from '../lib/goto'
import { Icon } from './ui/Icon'

interface Candidate { node: Node; label: string }

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
  const [allProjects, setAllProjects] = useState(false)

  const deps = dependencyNodes(roots, node)
  const unmet = unmetDependencies(roots, node)
  const blocking = dependents(roots, node.id)
  const isBlocked = unmet.length > 0

  // Exclude self, the whole subtree, and every ancestor — a node depending on
  // its own container/child can never unblock (a hierarchy deadlock).
  const excluded = useMemo(() => {
    const s = new Set<string>()
    const w = (n: Node) => { s.add(n.id); n.children.forEach(w) }
    w(node)
    for (const id of pathTo(roots, node.id)) s.add(id)
    return s
  }, [roots, node])

  const eligible = (id: string) =>
    !excluded.has(id) && !(node.dependsOn ?? []).includes(id) && !wouldCycle(roots, node.id, id)

  // Same-project candidates (the default): every task/module in this node's
  // project except itself, its subtree, existing deps and anything cyclic.
  const project = useMemo(() => {
    const p = pathTo(roots, node.id)
    return p[0] ? findNode(roots, p[0]) : null
  }, [roots, node.id])

  const projectCandidates = useMemo(() => {
    if (!project) return [] as Candidate[]
    const out: Candidate[] = []
    const walk = (n: Node, trail: string[], depth: number) => {
      if (depth > 0 && eligible(n.id)) out.push({ node: n, label: trail.join(' › ') || project.title })
      const ct = depth === 0 ? [] : [...trail, n.title]
      n.children.forEach(c => walk(c, ct, depth + 1))
    }
    walk(project, [], 0)
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, roots, node.dependsOn, excluded])

  const results = useMemo<Candidate[]>(() => {
    const ql = q.trim().toLowerCase()
    if (allProjects) {
      return searchNodes(roots, q)
        .filter(h => eligible(h.node.id) && (project ? findNode(project.children, h.node.id) === null && h.node.id !== project.id : true))
        .slice(0, 8)
        .map(h => ({ node: h.node, label: [h.rootTitle, h.trail].filter(Boolean).join(' › ') }))
    }
    const list = !ql
      ? projectCandidates
      : projectCandidates.filter(c => c.node.title.toLowerCase().includes(ql) || c.node.shortId.toLowerCase().includes(ql))
    return list.slice(0, 10)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, allProjects, projectCandidates, roots, project])

  const add = (id: string) => { useStore.getState().addDependency(node.id, id); setQ(''); setAdding(false); setAllProjects(false) }

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
          <div className="dep-label">{isBlocked ? 'Blocked by' : 'Depends on'}</div>
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
            placeholder={allProjects ? 'Search all projects…' : 'Search this project…'}
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') { setAdding(false); setQ(''); setAllProjects(false) } }}
          />
          <div className="dep-results">
            {results.length === 0 ? (
              <div className="dep-hint">{allProjects ? 'Type to search other projects.' : 'Nothing else in this project to depend on.'}</div>
            ) : results.map(c => (
              <button key={c.node.id} className="dep-result" onClick={() => add(c.node.id)}>
                <span className="dep-result-title">{c.node.title}</span>
                <span className="dep-result-trail">{c.label}</span>
              </button>
            ))}
          </div>
          <button className="dep-scope" onClick={() => { setAllProjects(v => !v); setQ('') }}>
            {allProjects
              ? <><Icon name="ti-arrow-left" /> Only this project</>
              : <><Icon name="ti-world-search" /> Search all projects</>}
          </button>
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
