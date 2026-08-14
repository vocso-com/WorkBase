import { useEffect, useRef, useState } from 'react'
import type { Node } from '../types'
import { COLORS, hex, mergedStages } from '../theme'
import { findNode, leaves } from '../lib/tree'
import { progressOf } from '../lib/progress'
import { tagBg, tagFg } from '../lib/colorMode'
import { useStore } from '../store/useStore'
import { useNav } from '../hooks/useNav'
import { useDetail } from '../hooks/useDetail'
import { useView, type ViewKind } from '../hooks/useView'
import { useNewProject } from '../hooks/useNewProject'
import { AvatarMenu } from './AvatarMenu'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'
import { TabBar } from './TabBar'
import { Icon } from './ui/Icon'

const VIEWS: { key: ViewKind; label: string; icon: string }[] = [
  { key: 'board', label: 'Board', icon: 'ti-layout-grid' },
  { key: 'kanban', label: 'Kanban', icon: 'ti-layout-kanban' },
  { key: 'flow', label: 'Flow', icon: 'ti-sitemap' },
]

export function AppHeader({
  roots,
  path,
  onExport,
  onImport,
  onHome,
  onGoto,
}: {
  roots: Node[]
  path: string[]
  onExport: () => void
  onImport: () => void
  onHome: () => void
  onGoto: (index: number) => void
}) {
  const crumbs = path.map(id => findNode(roots, id)).filter((n): n is Node => n !== null)
  const current = crumbs[crumbs.length - 1] ?? null
  const parents = crumbs.slice(0, -1)
  const profile = useStore(s => s.doc.profile)

  return (
    <header className="phead">
      <div className="phead-nav">
        <div className="brand">
          {profile?.orgLogo ? (
            <img className="brand-logo" src={profile.orgLogo} alt="" onClick={onHome} title="Home" style={{ cursor: 'pointer' }} />
          ) : (
            <span className="brand-ic" onClick={onHome} title="Home" style={{ cursor: 'pointer' }}><Icon name="ti-checkup-list" /></span>
          )}
          <WorkspaceSwitcher />
        </div>

        <TabBar />
        <div className="phead-fill" />

        <button className="newbtn" onClick={() => useNewProject.getState().show()}>
          <Icon name="ti-plus" /> New
        </button>
        <AvatarMenu onExport={onExport} onImport={onImport} />
      </div>

      {current ? (
        <div className="phead-sub" style={{ ['--pj' as string]: hex(current.color ?? 'gray') }}>
          <nav className="phead-crumb">
            <span className="cl" onClick={onHome}>Projects</span>
            {parents.map((n, i) => (
              <span key={n.id} className="cseg">
                <Icon name="ti-chevron-right" />
                <span className="cl" onClick={() => onGoto(i)}>{n.title}</span>
              </span>
            ))}
            <Icon name="ti-chevron-right" />
          </nav>
          <ProjectChip node={current} />
          <ViewMenu />
          <div className="phead-fill" />
          <HeaderProgress node={current} />
        </div>
      ) : null}
    </header>
  )
}

function ProjectChip({ node }: { node: Node }) {
  const color = node.color ?? 'gray'
  const isTemplate = useStore(s => s.doc.templates.some(t => t.name === node.title))
  const hasModules = node.children.some(c => c.children.length > 0)
  const meta = hasModules ? `${node.children.length} modules · ${leaves(node).length} tasks` : `${leaves(node).length} tasks`
  return (
    <button className="phead-proj" onClick={() => useDetail.getState().open(node.id)} title="Open details">
      {node.image ? (
        <span className="phead-proj-ic phead-proj-img" style={{ backgroundImage: `url(${node.image})` }} />
      ) : (
        <span className="phead-proj-ic" style={{ background: tagBg(color), color: tagFg(color) }}><Icon name={node.icon ?? 'ti-folder'} /></span>
      )}
      <span className="phead-proj-text">
        <b>{node.title}</b>
        <span className="phead-proj-meta">{meta}</span>
      </span>
      {isTemplate ? <Icon name="ti-template" className="phead-proj-tpl" /> : null}
    </button>
  )
}

function HeaderProgress({ node }: { node: Node }) {
  const stages = mergedStages(useStore(s => s.doc.stages))
  const ls = leaves(node)
  const total = ls.length
  const counts: Record<string, number> = {}
  for (const l of ls) counts[l.status] = (counts[l.status] ?? 0) + 1
  const pct = progressOf(node)
  const done = counts['done'] ?? 0
  const segments = stages.filter(s => (counts[s.id] ?? 0) > 0)

  return (
    <div className="hprog" title={`${done} of ${total} done`}>
      <span className="hprog-done">{done}/{total}</span>
      <div className="hprog-bar">
        {total === 0 ? <span style={{ width: '100%', background: 'var(--chip)' }} /> : segments.map(s => (
          <span key={s.id} style={{ width: `${(counts[s.id] / total) * 100}%`, background: COLORS[s.color] }} />
        ))}
      </div>
      <span className="hprog-pct">{pct}%</span>
    </div>
  )
}

function ViewMenu() {
  const view = useView(s => s.view)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const cur = VIEWS.find(v => v.key === view) ?? VIEWS[0]

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as globalThis.Node)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div className="viewmenu" ref={ref}>
      <button className="viewmenu-btn" onClick={() => setOpen(o => !o)}>
        <Icon name={cur.icon} /> {cur.label}
        <Icon name="ti-chevron-down" className="viewmenu-caret" />
      </button>
      {open ? (
        <div className="viewmenu-pop">
          {VIEWS.map(v => (
            <button
              key={v.key}
              className={`viewmenu-item${v.key === view ? ' on' : ''}`}
              onClick={() => {
                useView.getState().setView(v.key)
                const rid = useNav.getState().path[0]
                if (rid) useStore.getState().patch(rid, { view: v.key })
                setOpen(false)
              }}
            >
              <Icon name={v.icon} /> {v.label}
              {v.key === view ? <Icon name="ti-check" className="viewmenu-check" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
