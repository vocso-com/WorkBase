import { useState } from 'react'
import type { Node } from '../types'
import { hex } from '../theme'
import { progressOf, statusCounts } from '../lib/progress'
import { leaves, pathTo } from '../lib/tree'
import { tagBg, tagFg } from '../lib/colorMode'
import { useStore } from '../store/useStore'
import { useNav } from '../hooks/useNav'
import { useDetail } from '../hooks/useDetail'
import { Icon } from './ui/Icon'
import { Checkbox } from './ui/Checkbox'
import { Tag } from './ui/Tag'
import { DueChip } from './DueChip'
import { dueInfo } from '../lib/due'

function hasOverdueDescendant(n: Node): boolean {
  if (n.status !== 'done' && dueInfo(n.dueDate)?.tone === 'overdue') return true
  return n.children.some(hasOverdueDescendant)
}

// One consistent progress color, switched by health: complete → green,
// delayed (any overdue item) → red, otherwise on-track → blue.
function progressColor(node: Node, pc: number): string {
  if (pc >= 100) return hex('teal')
  if (hasOverdueDescendant(node)) return hex('red')
  return hex('blue')
}

function isChildDone(child: Node): boolean {
  if (child.children.length > 0) return progressOf(child) === 100
  return child.status === 'done'
}

function AddItemRow({ node }: { node: Node }) {
  const [adding, setAdding] = useState(false)
  const [val, setVal] = useState('')
  const submit = () => {
    const t = val.trim()
    if (!t) return
    useStore.getState().addChildNode(node.id, t)
    setVal('')
  }
  if (!adding) {
    return (
      <div className="check" style={{ color: 'var(--faint)', marginTop: 4 }} onClick={e => { e.stopPropagation(); setAdding(true) }}>
        <Icon name="ti-plus" className="box" />
        <span>New item</span>
      </div>
    )
  }
  return (
    <div className="mc-add" onClick={e => e.stopPropagation()}>
      <input
        autoFocus
        placeholder="Item name…"
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') { setAdding(false); setVal('') } }}
        onBlur={() => { if (!val.trim()) setAdding(false) }}
      />
    </div>
  )
}

export function ModuleCard({ node, onOpen }: { node: Node; onOpen: () => void }) {
  const color = node.color ?? 'gray'
  const total = node.children.length
  const done = node.children.filter(isChildDone).length
  const pc = progressOf(node)
  const canDrillIn = node.children.length > 0

  return (
    <div
      className="card mcard"
      onClick={canDrillIn ? onOpen : undefined}
      style={{ cursor: canDrillIn ? 'pointer' : 'default' }}
    >
      <div className="accent" style={{ background: hex(color) }} />
      <div className="pad">
        <div className="row1">
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div className="ic" style={{ width: 32, height: 32, fontSize: 17, background: tagBg(color), color: tagFg(color) }}>
              <Icon name={node.icon ?? 'ti-folder'} />
            </div>
            <div
              data-testid="module-card-title"
              style={{ fontSize: 14.5, fontWeight: 600, cursor: 'pointer' }}
              onClick={e => { e.stopPropagation(); useDetail.getState().open(node.id) }}
            >
              {node.title}
            </div>
          </div>
          <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>{done}/{total}</span>
        </div>
        <div className="bar2">
          <span style={{ width: `${pc}%`, background: progressColor(node, pc) }} />
        </div>
        {node.children.map(child => {
          const isLeaf = child.children.length === 0
          if (!isLeaf) {
            const subs = leaves(child).filter(l => l.id !== child.id)
            const subDone = statusCounts(child).done
            return (
              <div
                key={child.id}
                data-testid={`child-row-${child.id}`}
                className="check check-item check-parent"
                onClick={e => { e.stopPropagation(); useDetail.getState().open(child.id) }}
                title="Open details"
              >
                <span className="check-sub-ic"><Icon name="ti-list-tree" /></span>
                <span className="check-parent-title">{child.title}</span>
                <div className="check-parent-meta">
                  <DueChip dueDate={child.dueDate} />
                  {(child.tags ?? []).slice(0, 1).map(t => <Tag key={t.name} tag={t} />)}
                  <span className="check-sub-count">{subDone}/{subs.length}</span>
                  <button
                    className="check-drill-btn"
                    onClick={e => { e.stopPropagation(); useNav.getState().set(pathTo(useStore.getState().doc.roots, child.id)) }}
                    aria-label="Open sub-items"
                    title="Open sub-items"
                  ><Icon name="ti-chevron-right" /></button>
                </div>
              </div>
            )
          }
          const overdue = child.status !== 'done' && dueInfo(child.dueDate)?.tone === 'overdue'
          const state = child.status === 'done' ? 'done' : overdue ? 'overdue' : ''
          return (
            <div key={child.id} data-testid={`child-row-${child.id}`} className={`check check-item ${state}`} onClick={e => e.stopPropagation()}>
              <Checkbox status={child.status} color={color} onToggle={() => useStore.getState().toggleDone(child.id)} />
              <span
                className="grow"
                style={{ cursor: 'pointer' }}
                onClick={e => { e.stopPropagation(); useDetail.getState().open(child.id) }}
              >
                {child.title}
              </span>
              <DueChip dueDate={child.dueDate} />
              {(child.tags ?? []).map(t => (
                <Tag key={t.name} tag={t} />
              ))}
              {child.status === 'blocked' ? (
                <span className="mini" style={{ background: tagBg('red'), color: tagFg('red') }}>Blocked</span>
              ) : null}
            </div>
          )
        })}
        <AddItemRow node={node} />
      </div>
    </div>
  )
}
