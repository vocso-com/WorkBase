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
  const roots = useStore(s => s.doc.roots)
  const [drag, setDrag] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)

  // Only surface tabs once you're actually juggling more than one thing.
  if (tabs.length < 2) return null

  // The bar itself carries the active project's color; the active tab is a
  // lighter "folder" that opens straight into the (same-tinted) board below.
  const activeTab = tabs.find(t => t.id === activeId)
  const activeRoot = activeTab?.path[0] ? findNode(roots, activeTab.path[0]) : null
  const barTint = activeRoot ? hex(activeRoot.color ?? 'gray') : 'var(--dot)'

  return (
    <div className="tabbar" style={{ background: `color-mix(in srgb, ${barTint} 15%, var(--bg))` }}>
      {tabs.map((t, i) => {
        const root = t.path[0] ? findNode(roots, t.path[0]) : null
        const active = t.id === activeId
        const label = root?.title ?? 'Home'
        const accent = root ? hex(root.color ?? 'gray') : 'var(--dot)'
        return (
          <div
            key={t.id}
            className={`tab${active ? ' on' : ''}${drag === i ? ' dragging' : ''}${over === i && drag !== i ? ' dropbefore' : ''}`}
            style={active ? { background: `color-mix(in srgb, ${accent} 5%, var(--bg))` } : undefined}
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
