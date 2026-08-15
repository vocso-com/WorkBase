import type { WorkItem } from '../lib/execution'
import { buildWork } from '../lib/execution'
import { useStore } from '../store/useStore'
import { useMyWork } from '../hooks/useMyWork'
import { useVocab } from '../hooks/useVocab'
import { DEFAULT_WORKSPACE_ID } from '../lib/serialize'
import { goToNode } from '../lib/goto'
import { PRIORITY_META, hex } from '../theme'
import { dueInfo } from '../lib/due'
import { Checkbox } from './ui/Checkbox'
import { Icon } from './ui/Icon'

function WorkRow({ item }: { item: WorkItem }) {
  const n = item.node
  const di = dueInfo(n.dueDate)
  const open = () => { useMyWork.getState().hide(); goToNode(n.id) }
  return (
    <div className="mw-row">
      <Checkbox status={n.status} onToggle={() => useStore.getState().toggleDone(n.id)} />
      {item.priority >= 3 ? <span className="mw-pri" style={{ background: hex(PRIORITY_META.high.color) }} title="High priority" /> : null}
      <button className="mw-title" onClick={open}>{n.title}</button>
      <span className="mw-crumb" onClick={open}>{[item.rootTitle, item.trail].filter(Boolean).join(' › ')}</span>
      <span className="mw-meta">
        {item.blocked ? <span className="mw-blocked"><Icon name="ti-lock" /> Blocked</span> : null}
        {di ? <span className={`mw-due mw-due-${di.tone}`}><Icon name="ti-clock" /> {di.label}</span> : null}
        <span className="mw-sid">{n.shortId}</span>
      </span>
    </div>
  )
}

function Section({ title, icon, tone, items }: { title: string; icon: string; tone: string; items: WorkItem[] }) {
  if (items.length === 0) return null
  return (
    <section className="mw-sec">
      <div className={`mw-sec-h mw-tone-${tone}`}>
        <Icon name={icon} /> {title} <span className="mw-count">{items.length}</span>
      </div>
      <div className="mw-list">{items.map(i => <WorkRow key={i.node.id} item={i} />)}</div>
    </section>
  )
}

export function MyWorkPage() {
  const roots = useStore(s => s.doc.roots)
  const activeWs = useStore(s => s.doc.activeWorkspace)
  const workspaces = useStore(s => s.doc.workspaces)
  const v = useVocab()

  const wsRoots = roots.filter(r => (r.workspace ?? DEFAULT_WORKSPACE_ID) === activeWs)
  const work = buildWork(wsRoots)
  const wsName = workspaces.find(w => w.id === activeWs)?.name ?? 'Workspace'

  const empty = work.total === 0
  // Focus only earns its own section when there's something to prioritise —
  // an urgent date or a high priority. Otherwise it just mirrors "Anytime".
  const showFocus = work.focus.length > 0
    && (work.overdue.length > 0 || work.today.length > 0 || work.week.length > 0 || work.focus.some(i => i.priority >= 2))

  return (
    <div className="mw">
      <div className="mw-head">
        <div>
          <div className="mw-title-lg">My Work</div>
          <div className="mw-sub">{wsName} · {work.total} open {work.total === 1 ? v.task : v.tasks}{work.blocked.length ? ` · ${work.blocked.length} blocked` : ''}</div>
        </div>
      </div>

      {empty ? (
        <div className="mw-clear">
          <Icon name="ti-circle-check" />
          <div className="mw-clear-t">You’re all clear</div>
          <div className="mw-clear-s">No open {v.tasks} in {wsName}. Add work in your projects and it’ll show up here.</div>
        </div>
      ) : (
        <>
          {showFocus ? (
            <section className="mw-focus">
              <div className="mw-focus-h"><Icon name="ti-target-arrow" /> What to work on now</div>
              <div className="mw-list">{work.focus.map(i => <WorkRow key={i.node.id} item={i} />)}</div>
            </section>
          ) : null}

          <Section title="Overdue" icon="ti-alert-triangle" tone="overdue" items={work.overdue} />
          <Section title="Today" icon="ti-calendar-due" tone="today" items={work.today} />
          <Section title="This week" icon="ti-calendar" tone="week" items={work.week} />
          <Section title="Anytime" icon="ti-inbox" tone="anytime" items={work.anytime} />
          <Section title="Blocked" icon="ti-lock" tone="blocked" items={work.blocked} />
        </>
      )}
    </div>
  )
}
