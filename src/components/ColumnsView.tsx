import { useEffect, useRef, useState } from 'react'
import type { Node } from '../types'
import { findNode, findParent } from '../lib/tree'
import { useStore } from '../store/useStore'
import { DepBadges } from './DepBadges'
import { Icon } from './ui/Icon'
import { Checkbox } from './ui/Checkbox'
import { NodeMenu } from './NodeMenu'
import { confirmToggleDone } from '../lib/confirmToggleDone'
import { CardModal } from './CardModal'

interface Row { node: Node; depth: number }

function flatten(items: Node[], depth: number, expanded: Set<string>, acc: Row[]) {
  for (const c of items) {
    acc.push({ node: c, depth })
    if (c.children.length > 0 && expanded.has(c.id)) flatten(c.children, depth + 1, expanded, acc)
  }
}

// Obsidian-style: a collapsible tree of the whole project on the left, and the
// selected item's full detail (the card modal, reused inline) on the right.
export function ColumnsView({ node }: { node: Node }) {
  const roots = useStore(s => s.doc.roots)
  const [sel, setSel] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    setSel(null)
    setExpanded(new Set(node.children.map(c => c.id)))
  }, [node.id])

  const rows: Row[] = []
  flatten(node.children, 0, expanded, rows)

  const toggle = (id: string) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  // Keyboard browsing: ↑/↓ move the selection through the visible rows, → opens
  // a collapsed parent (or steps into it), ← collapses it (or steps out to the
  // parent). "Overview" is the top row. A ref carries the latest tree so the
  // window listener stays subscribed just once.
  const navRef = useRef<{ order: string[]; byId: Map<string, Row>; sel: string | null; expanded: Set<string> }>({ order: [], byId: new Map(), sel: null, expanded: new Set() })
  navRef.current = { order: [node.id, ...rows.map(r => r.node.id)], byId: new Map(rows.map(r => [r.node.id, r])), sel, expanded }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (t && typeof t.closest === 'function' && t.closest('.ol-main')) return // typing/scrolling in the detail pane
      const { order, byId, sel, expanded } = navRef.current
      if (order.length <= 1) return
      const curId = sel ?? node.id
      const idx = Math.max(0, order.indexOf(curId))
      const cur = byId.get(curId)
      e.preventDefault()
      if (e.key === 'ArrowDown') setSel(order[Math.min(order.length - 1, idx + 1)])
      else if (e.key === 'ArrowUp') setSel(order[Math.max(0, idx - 1)])
      else if (e.key === 'ArrowRight') {
        if (cur && cur.node.children.length > 0) {
          if (!expanded.has(cur.node.id)) toggle(cur.node.id)
          else setSel(order[Math.min(order.length - 1, idx + 1)])
        }
      } else { // ArrowLeft
        if (cur && cur.node.children.length > 0 && expanded.has(cur.node.id)) toggle(cur.node.id)
        else if (cur) {
          const parent = findParent([node], cur.node.id)
          setSel(parent && parent.id !== node.id ? parent.id : node.id)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id])

  // Keep the selected row in view as you arrow through a long tree.
  useEffect(() => {
    document.querySelector('.ol-tree-rows .ol-row.active')?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  const pane = (sel ? findNode([node], sel) : null) ?? node

  return (
    <div className="outline">
      <aside className="ol-tree">
        <div className="ol-tree-rows">
          <div className={`ol-row${sel === null || sel === node.id ? ' active' : ''}`} onClick={() => setSel(node.id)}>
            <span className="ol-spacer" />
            <span className="ol-row-ic"><Icon name="ti-file-description" /></span>
            <span className="ol-row-title">Overview</span>
          </div>
          {rows.map(({ node: c, depth }) => {
            const isParent = c.children.length > 0
            return (
              <div key={c.id} className={`ol-row${sel === c.id ? ' active' : ''}`} style={{ paddingLeft: 6 + depth * 15 }} onClick={() => setSel(c.id)}>
                {isParent ? (
                  <button className="ol-caret" onClick={e => { e.stopPropagation(); toggle(c.id) }} aria-label={expanded.has(c.id) ? 'Collapse' : 'Expand'}>
                    <Icon name={expanded.has(c.id) ? 'ti-chevron-down' : 'ti-chevron-right'} />
                  </button>
                ) : (
                  <span className="ol-spacer" />
                )}
                <span className="ol-row-check" onClick={e => e.stopPropagation()}>
                  <Checkbox round status={c.status} onToggle={() => confirmToggleDone(c)} />
                </span>
                <span className="ol-row-ic"><Icon name={isParent ? (c.icon ?? 'ti-list-tree') : 'ti-file'} /></span>
                <span className="ol-row-title">{c.title}</span>
                <DepBadges node={c} roots={roots} compact />
                <NodeMenu id={c.id} className="ol-row-menu" />
              </div>
            )
          })}
        </div>
      </aside>
      <div className="ol-main">
        <CardModal inlineNode={pane} key={pane.id} />
      </div>
    </div>
  )
}
