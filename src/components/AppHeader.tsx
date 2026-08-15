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
import { useQuickCapture } from '../hooks/useQuickCapture'
import { useNewProject } from '../hooks/useNewProject'
import { useSearch } from '../hooks/useSearch'
import { useActivityFeed } from '../hooks/useActivityFeed'
import { useNudge } from '../hooks/useNudge'
import { showWidgetFromMain } from '../lib/desktopWidget'
import { isTauri } from '../lib/platform'
import { useTabs } from '../hooks/useTabs'
import { useVocab } from '../hooks/useVocab'
import { AvatarMenu } from './AvatarMenu'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'
import { TabBar } from './TabBar'
import { Icon } from './ui/Icon'

// The header "+" — a project (rich flow) or a quick task at any depth.
function AddMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as globalThis.Node)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])
  return (
    <div className="addmenu-wrap" ref={ref}>
      <button className="addbtn" onClick={() => setOpen(o => !o)} title="Add a project or task" aria-label="Add"><Icon name="ti-plus" /></button>
      {open ? (
        <div className="addmenu">
          <button className="addmenu-item" onClick={() => { useNewProject.getState().show(); setOpen(false) }}><Icon name="ti-folder-plus" /> New project</button>
          <button className="addmenu-item" onClick={() => { useQuickCapture.getState().show(); setOpen(false) }}><Icon name="ti-bolt" /> Quick add task</button>
        </div>
      ) : null}
    </div>
  )
}

// Bring the reminder widget forward: the native always-on-top window on
// desktop, or the in-app floating nudge on the web.
function revealReminders() {
  if (isTauri()) void showWidgetFromMain()
  else useNudge.getState().reopen()
}

const VIEWS: { key: ViewKind; label: string; icon: string }[] = [
  { key: 'board', label: 'Board', icon: 'ti-layout-grid' },
  { key: 'kanban', label: 'Kanban', icon: 'ti-layout-kanban' },
  { key: 'flow', label: 'Flow', icon: 'ti-sitemap' },
  { key: 'columns', label: 'Outline', icon: 'ti-layout-sidebar' },
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
  // My Work lives as a pinned tab near Home (see TabBar), so it's active
  // whenever the current tab is the My Work surface.
  const myWorkOpen = useTabs(s => s.tabs.find(t => t.id === s.activeId)?.kind === 'mywork')

  return (
    <header className="phead">
      <div className="phead-nav">
        <div className="brand">
          {profile?.orgLogo ? (
            <img className="brand-logo" src={profile.orgLogo} alt="" onClick={onHome} title="Home" style={{ cursor: 'pointer' }} />
          ) : (
            <img className="brand-mark" src="/workbase-logo.png" alt="WorkBase" onClick={onHome} title="Home" style={{ cursor: 'pointer' }} />
          )}
          <WorkspaceSwitcher />
        </div>

        <TabBar />
        <div className="phead-fill" />

        <button className="iconbtn" onClick={() => revealReminders()} title="Reminders" aria-label="Reminders">
          <Icon name="ti-bell" />
        </button>
        <button className="iconbtn" onClick={() => useActivityFeed.getState().toggle()} title="Activity" aria-label="Activity">
          <Icon name="ti-history" />
        </button>
        <button className="searchbtn" onClick={() => useSearch.getState().show()} title="Search (⌘K)">
          <Icon name="ti-search" />
          <span className="searchbtn-txt">Search</span>
          <kbd className="searchbtn-kbd">⌘K</kbd>
        </button>
        <AddMenu />
        <AvatarMenu onExport={onExport} onImport={onImport} />
      </div>

      {myWorkOpen ? (
        <div className="phead-sub" style={{ ['--pj' as string]: 'var(--dot)' }}>
          <nav className="phead-crumb"><span className="cl cl-static"><Icon name="ti-target-arrow" /> My Work</span></nav>
          <div className="phead-fill" />
        </div>
      ) : current ? (
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
      ) : (
        <div className="phead-sub" style={{ ['--pj' as string]: 'var(--dot)' }}>
          <nav className="phead-crumb"><span className="cl cl-static">Projects</span></nav>
          <div className="phead-fill" />
        </div>
      )}
    </header>
  )
}

function ProjectChip({ node }: { node: Node }) {
  const color = node.color ?? 'gray'
  const v = useVocab()
  const isTemplate = useStore(s => s.doc.templates.some(t => t.name === node.title))
  const hasModules = node.children.some(c => c.children.length > 0)
  const taskN = leaves(node).length
  const meta = hasModules ? `${node.children.length} ${node.children.length === 1 ? v.module : v.modules} · ${taskN} ${taskN === 1 ? v.task : v.tasks}` : `${taskN} ${taskN === 1 ? v.task : v.tasks}`
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
  const stages = mergedStages(useStore(s => s.doc.stages), useStore(s => s.doc.stageLabels), useStore(s => s.doc.stageOrder))
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
