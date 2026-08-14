import { useState } from 'react'
import { useStore } from '../store/useStore'
import { useTabs } from '../hooks/useTabs'
import { findNode } from '../lib/tree'
import { hex } from '../theme'
import { tagBg, tagFg } from '../lib/colorMode'
import { Icon } from './ui/Icon'

// Desktop-style tabs: keep several projects/locations open and switch between
// them. Each tab remembers its own drill path + view, is colored by its
// project accent, can be dragged to reorder, and answers ⌘T/⌘W/⌘1–9.
export function TabBar() {
  const tabs = useTabs(s => s.tabs)
  const activeId = useTabs(s => s.activeId)
  const activeWorkspace = useStore(s => s.doc.activeWorkspace)
  const roots = useStore(s => s.doc.roots)
  const [drag, setDrag] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)

  // Tabs are scoped to the active WorkBase; only surface them once you're
  // juggling more than one thing in this WorkBase.
  const visible = tabs.filter(t => t.workspace === activeWorkspace)
  if (visible.length < 2) return null

  return (
    <div className="tabbar">
      {visible.map(t => {
        const i = tabs.indexOf(t)
        const root = t.path[0] ? findNode(roots, t.path[0]) : null
        const active = t.id === activeId
        const label = root?.title ?? 'Home'
        const accent = root ? hex(root.color ?? 'gray') : 'var(--dot)'
        return (
          <div
            key={t.id}
            className={`tab${active ? ' on' : ''}${root ? ' tab-proj' : ''}${drag === i ? ' dragging' : ''}${over === i && drag !== i ? ' dropbefore' : ''}`}
            style={active ? { background: `color-mix(in srgb, ${accent} 10%, var(--card))`, borderColor: `color-mix(in srgb, ${accent} 30%, var(--line))` } : undefined}
            onClick={() => useTabs.getState().activate(t.id)}
            title={label}
            draggable
            onDragStart={() => setDrag(i)}
            onDragOver={e => { e.preventDefault(); setOver(i) }}
            onDrop={() => { if (drag !== null) useTabs.getState().reorder(drag, i); setDrag(null); setOver(null) }}
            onDragEnd={() => { setDrag(null); setOver(null) }}
          >
            <span
              className="tab-ic"
              style={root ? { background: tagBg(root.color ?? 'gray'), color: tagFg(root.color ?? 'gray') } : undefined}
            >
              <Icon name={root ? (root.icon ?? 'ti-folder') : 'ti-home'} />
            </span>
            <span className="tab-label">{label}</span>
            <button
              className="tab-close"
              onClick={e => { e.stopPropagation(); useTabs.getState().close(t.id) }}
              aria-label="Close tab"
            ><Icon name="ti-x" /></button>
          </div>
        )
      })}
      <button className="tab-new" onClick={() => useTabs.getState().newTab()} title="New tab (⌘T)" aria-label="New tab">
        <Icon name="ti-plus" />
      </button>
    </div>
  )
}
