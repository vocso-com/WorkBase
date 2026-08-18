import { useEffect, useState } from 'react'
import type { Node } from '../types'
import { findNode } from '../lib/tree'
import { useStore } from '../store/useStore'
import { DepBadges } from './DepBadges'
import { Icon } from './ui/Icon'
import { Checkbox } from './ui/Checkbox'
import { NodeMenu } from './NodeMenu'
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
                  <Checkbox status={c.status} onToggle={() => useStore.getState().toggleDone(c.id)} />
                </span>
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
