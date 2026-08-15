import type { WorkItem } from '../lib/execution'
import type { StageMeta } from '../theme'
import { buildWork } from '../lib/execution'
import { mergedStages, PRIORITY_META, hex } from '../theme'
import { useStore } from '../store/useStore'
import { useVocab } from '../hooks/useVocab'
import { DEFAULT_WORKSPACE_ID } from '../lib/serialize'
import { toText } from '../lib/text'
import { goToNode } from '../lib/goto'
import { tagBg, tagFg } from '../lib/colorMode'
import { DueChip } from './DueChip'
import { Checkbox } from './ui/Checkbox'
import { Tag } from './ui/Tag'
import { Icon } from './ui/Icon'

function WorkRow({ item, stages, done }: { item: WorkItem; stages: StageMeta[]; done?: boolean }) {
  const n = item.node
  const tags = n.tags ?? []
  const stage = stages.find(s => s.id === n.status)
  const hasDesc = !!toText(n.description).trim()
  const attach = n.attachments?.length ?? 0
  const open = () => goToNode(n.id)
  return (
    <div className={`mw-row${done ? ' mw-row-done' : ''}`}>
      <span className="mw-projdot" style={{ background: hex(item.rootColor) }} title={item.rootTitle} />
      <span className="mw-check" onPointerDown={e => e.stopPropagation()}>
        <Checkbox status={n.status} onToggle={() => useStore.getState().toggleDone(n.id)} />
      </span>
      <div className="mw-body" onClick={open}>
        <div className="mw-line1">
          <span className="mw-title">{n.title}</span>
          <div className="mw-l1r">
            {n.priority ? (
              <span className="mw-prio" style={{ background: tagBg(PRIORITY_META[n.priority].color), color: tagFg(PRIORITY_META[n.priority].color) }}>{PRIORITY_META[n.priority].label}</span>
            ) : null}
            {item.blocked ? <span className="mw-blocked"><Icon name="ti-lock" /> Blocked</span> : null}
            {!done ? <DueChip dueDate={n.dueDate} /> : null}
          </div>
        </div>
        <div className="mw-line2">
          {stage && !done ? <span className="mw-stage"><span className="mw-stage-dot" style={{ background: stage.dot }} /> {stage.label}</span> : null}
          <span className="mw-crumb">{[item.rootTitle, item.trail].filter(Boolean).join(' › ')}</span>
          {tags.slice(0, 2).map(t => <Tag key={t.name} tag={t} />)}
          <div className="mw-l2r">
            {hasDesc ? <span className="mw-mini" title="Has a description"><Icon name="ti-align-left" /></span> : null}
            {attach > 0 ? <span className="mw-mini" title={`${attach} attachment${attach > 1 ? 's' : ''}`}><Icon name="ti-paperclip" /> {attach}</span> : null}
            <span className="mw-sid">{n.shortId}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ title, icon, tone, items, stages }: { title: string; icon: string; tone: string; items: WorkItem[]; stages: StageMeta[] }) {
  if (items.length === 0) return null
  return (
    <section className="mw-sec">
      <div className={`mw-sec-h mw-tone-${tone}`}>
        <Icon name={icon} /> {title} <span className="mw-count">{items.length}</span>
      </div>
      <div className="mw-list">{items.map(i => <WorkRow key={i.node.id} item={i} stages={stages} />)}</div>
    </section>
  )
}

export function MyWorkPage() {
  const roots = useStore(s => s.doc.roots)
  const activeWs = useStore(s => s.doc.activeWorkspace)
  const workspaces = useStore(s => s.doc.workspaces)
  const stages = mergedStages(useStore(s => s.doc.stages), useStore(s => s.doc.stageLabels), useStore(s => s.doc.stageOrder))
  const v = useVocab()

  const wsRoots = roots.filter(r => (r.workspace ?? DEFAULT_WORKSPACE_ID) === activeWs)
  const work = buildWork(wsRoots)
  const wsName = workspaces.find(w => w.id === activeWs)?.name ?? 'Workspace'

  const empty = work.total === 0
  const showFocus = work.focus.length > 0
    && (work.overdue.length > 0 || work.today.length > 0 || work.week.length > 0 || work.focus.some(i => i.priority >= 2))

  return (
    <div className="mw">
      <div className="mw-head">
        <div className="mw-title-lg">My Work</div>
        <div className="mw-sub">{wsName} · {work.total} open {work.total === 1 ? v.task : v.tasks}{work.blocked.length ? ` · ${work.blocked.length} blocked` : ''}</div>
      </div>

      {empty && work.done.length === 0 ? (
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
              <div className="mw-list">{work.focus.map(i => <WorkRow key={i.node.id} item={i} stages={stages} />)}</div>
            </section>
          ) : null}

          <Section title="Overdue" icon="ti-alert-triangle" tone="overdue" items={work.overdue} stages={stages} />
          <Section title="Today" icon="ti-calendar-due" tone="today" items={work.today} stages={stages} />
          <Section title="This week" icon="ti-calendar" tone="week" items={work.week} stages={stages} />
          <Section title="Anytime" icon="ti-inbox" tone="anytime" items={work.anytime} stages={stages} />
          <Section title="Blocked" icon="ti-lock" tone="blocked" items={work.blocked} stages={stages} />

          {work.done.length > 0 ? (
            <section className="mw-sec mw-sec-done">
              <div className="mw-sec-h mw-tone-blocked"><Icon name="ti-circle-check" /> Recently done <span className="mw-count">{work.done.length}</span></div>
              <div className="mw-list">{work.done.map(i => <WorkRow key={i.node.id} item={i} stages={stages} done />)}</div>
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}
