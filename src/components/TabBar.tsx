import { useLayoutEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { useTabs } from '../hooks/useTabs'
import { findNode } from '../lib/tree'
import { hex } from '../theme'
import { tagBg, tagFg } from '../lib/colorMode'
import { Icon } from './ui/Icon'

// Home and My Work are always pinned at the left; open projects scroll in the
// middle (with edge fades hinting at more); the New-tab button is pinned right.
export function TabBar() {
  const tabs = useTabs(s => s.tabs)
  const activeId = useTabs(s => s.activeId)
  const activeWorkspace = useStore(s => s.doc.activeWorkspace)
  const roots = useStore(s => s.doc.roots)
  const [drag, setDrag] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)
  const [edges, setEdges] = useState({ l: false, r: false })
  const barRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const root = document.documentElement
    const measure = () => {
      const el = barRef.current?.querySelector('.tab.on') as HTMLElement | null
      if (el) {
        const r = el.getBoundingClientRect()
        root.style.setProperty('--tabgap-l', `${Math.max(0, r.left)}px`)
        root.style.setProperty('--tabgap-r', `${Math.max(0, r.right)}px`)
      } else {
        root.style.setProperty('--tabgap-l', '0px')
        root.style.setProperty('--tabgap-r', '0px')
      }
      const sc = scrollRef.current
      if (sc) {
        const l = sc.scrollLeft > 4
        const r = sc.scrollLeft + sc.clientWidth < sc.scrollWidth - 4
        setEdges(prev => (prev.l === l && prev.r === r ? prev : { l, r }))
      }
    }
    measure()
    const sc = scrollRef.current
    window.addEventListener('resize', measure)
    sc?.addEventListener('scroll', measure)
    return () => { window.removeEventListener('resize', measure); sc?.removeEventListener('scroll', measure) }
    // Re-measure when the set of tabs or the active tab changes (not every
    // render — measuring writes state and would otherwise loop).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs, activeId, activeWorkspace])

  const visible = tabs.filter(t => t.workspace === activeWorkspace)
  const active = visible.find(t => t.id === activeId)
  const projectTabs = visible.filter(t => t.path.length > 0 && !t.kind)
  const homeActive = !!active && active.path.length === 0 && !active.kind
  const myworkActive = active?.kind === 'mywork'
  const iconOnly = projectTabs.length >= 3
  const violet = hex('violet')

  return (
    <div className="tabbar" ref={barRef}>
      <button
        className={`tab tab-pinned${homeActive ? ' on' : ''}${iconOnly ? ' tab-icononly' : ''}`}
        style={homeActive ? { background: 'color-mix(in srgb, var(--dot) 16%, var(--card))', borderColor: 'color-mix(in srgb, var(--dot) 32%, var(--line))' } : undefined}
        onClick={() => useTabs.getState().goHome()}
        title="Home"
      >
        <span className="tab-ic"><Icon name="ti-home" /></span>
        {iconOnly ? null : <span className="tab-label">Home</span>}
      </button>

      <button
        className={`tab tab-pinned tab-mywork${myworkActive ? ' on' : ''}${iconOnly ? ' tab-icononly' : ''}`}
        style={myworkActive ? { background: `color-mix(in srgb, ${violet} 10%, var(--card))`, borderColor: `color-mix(in srgb, ${violet} 32%, var(--line))` } : undefined}
        onClick={() => useTabs.getState().openMyWork()}
        title="My Work — what to do next"
      >
        <span className="tab-ic" style={{ background: tagBg('violet'), color: tagFg('violet') }}><Icon name="ti-target-arrow" /></span>
        {iconOnly ? null : <span className="tab-label">My Work</span>}
      </button>

      <div className={`tab-scroll${edges.l ? ' fade-l' : ''}${edges.r ? ' fade-r' : ''}`} ref={scrollRef}>
        {projectTabs.map(t => {
          const i = tabs.indexOf(t)
          const root = findNode(roots, t.path[0])
          const on = t.id === activeId
          const label = root?.title ?? 'Project'
          const accent = root ? hex(root.color ?? 'gray') : 'var(--dot)'
          return (
            <div
              key={t.id}
              className={`tab tab-proj${on ? ' on' : ''}${drag === i ? ' dragging' : ''}${over === i && drag !== i ? ' dropbefore' : ''}`}
              style={on ? { background: `color-mix(in srgb, ${accent} 10%, var(--card))`, borderColor: `color-mix(in srgb, ${accent} 32%, var(--line))` } : undefined}
              onClick={() => useTabs.getState().activate(t.id)}
              title={label}
              draggable
              onDragStart={() => setDrag(i)}
              onDragOver={e => { e.preventDefault(); setOver(i) }}
              onDrop={() => { if (drag !== null) useTabs.getState().reorder(drag, i); setDrag(null); setOver(null) }}
              onDragEnd={() => { setDrag(null); setOver(null) }}
            >
              <span className="tab-ic" style={{ background: tagBg(root?.color ?? 'gray'), color: tagFg(root?.color ?? 'gray') }}>
                <Icon name={root?.icon ?? 'ti-folder'} />
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
      </div>

      <button className="tab-new" onClick={() => useTabs.getState().newTab()} title="New tab (⌘T)" aria-label="New tab">
        <Icon name="ti-plus" />
      </button>
    </div>
  )
}
