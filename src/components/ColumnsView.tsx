import { useEffect, useState } from 'react'
import type { Node } from '../types'
import { PRIORITY_META, stageMeta } from '../theme'
import { useStore } from '../store/useStore'
import { useDetail } from '../hooks/useDetail'
import { findNode } from '../lib/tree'
import { tagBg, tagFg } from '../lib/colorMode'
import { RichText } from './RichText'
import { ChecklistTree } from './ChecklistTree'
import { Checkbox } from './ui/Checkbox'
import { Icon } from './ui/Icon'

interface Row { node: Node; depth: number }

function flatten(items: Node[], depth: number, expanded: Set<string>, acc: Row[]) {
  for (const c of items) {
    acc.push({ node: c, depth })
    if (c.children.length > 0 && expanded.has(c.id)) flatten(c.children, depth + 1, expanded, acc)
  }
}

// Obsidian-style: a collapsible tree of the whole project on the left, the
// selected item open in a reading/editing pane on the right.
export function ColumnsView({ node }: { node: Node }) {
  const [sel, setSel] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Reset navigation and open the first level when the project changes.
  useEffect(() => {
    setSel(null)
    setExpanded(new Set(node.children.map(c => c.id)))
  }, [node.id, node.children])

  const rows: Row[] = []
  flatten(node.children, 0, expanded, rows)

  const toggle = (id: string) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const pane = (sel ? findNode([node], sel) : null) ?? node

  return (
    <div className="outline">
      <aside className="ol-tree">
        <div className="ol-tree-head">
          <Icon name={node.icon ?? 'ti-folders'} /> <span>{node.title}</span>
        </div>
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
                <span className="ol-row-ic"><Icon name={isParent ? (c.icon ?? 'ti-list-tree') : (c.status === 'done' ? 'ti-circle-check' : 'ti-circle')} /></span>
                <span className="ol-row-title">{c.title}</span>
              </div>
            )
          })}
        </div>
      </aside>
      <div className="ol-main"><OutlinePane node={pane} /></div>
    </div>
  )
}

function OutlinePane({ node }: { node: Node }) {
  const customStages = useStore(s => s.doc.stages)
  const color = node.labelColor ?? node.color ?? 'gray'
  const sm = stageMeta(customStages, node.status)
  const isContainer = node.children.length > 0
  return (
    <div className="ol-pane">
      <div className="ol-pane-head">
        {isContainer ? (
          <span className="ol-pane-ic" style={{ background: tagBg(color), color: tagFg(color) }}><Icon name={node.icon ?? 'ti-stack-2'} /></span>
        ) : (
          <Checkbox status={node.status} color={color} onToggle={() => useStore.getState().toggleDone(node.id)} />
        )}
        <h2 className="ol-pane-title">{node.title}</h2>
        <button className="ol-pane-open" onClick={() => useDetail.getState().open(node.id)}><Icon name="ti-arrow-up-right" /> Details</button>
      </div>
      <div className="ol-pane-chips">
        <span className="ol-chip" style={{ background: tagBg(sm.color), color: tagFg(sm.color) }}><span className="sdot" style={{ background: sm.dot }} /> {sm.label}</span>
        {node.priority ? <span className="tprio" style={{ background: tagBg(PRIORITY_META[node.priority].color), color: tagFg(PRIORITY_META[node.priority].color) }}>{PRIORITY_META[node.priority].label}</span> : null}
      </div>
      <RichText
        key={node.id}
        initial={node.description}
        onChange={html => useStore.getState().patch(node.id, { description: html })}
        placeholder="Write here…"
      />
      {isContainer ? (
        <>
          <div className="ol-sec-h">Sub-items</div>
          <ChecklistTree root={node} color={color} />
        </>
      ) : null}
    </div>
  )
}
