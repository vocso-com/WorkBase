import { useCelebration } from '../hooks/useCelebration'
import { useStore } from '../store/useStore'
import { useVocab } from '../hooks/useVocab'
import { projectSummary, formatDuration } from '../lib/summary'
import { hex } from '../theme'
import { Icon } from './ui/Icon'

/**
 * What a finished project earned.
 *
 * Confetti evaporates in two seconds; this is something an agency can send to
 * the client, at the one moment they are most receptive. Every figure was
 * already being recorded for another reason — completion dates for learning
 * weights, the kickoff baseline for scope growth — so the celebration does
 * work rather than just sparkling.
 */
export function CompletionSummary() {
  const projectId = useCelebration(s => s.projectId)
  const roots = useStore(s => s.doc.roots)
  const v = useVocab()

  const node = projectId ? roots.find(r => r.id === projectId) : undefined
  const summary = node ? projectSummary(node) : null
  if (!node || !summary) return null

  const dismiss = () => useCelebration.getState().dismiss()
  const color = hex(node.color ?? 'teal')
  const growth = summary.scopeGrowth !== null ? Math.round(summary.scopeGrowth * 100) : null

  const lines = [
    `${summary.tasks} ${summary.tasks === 1 ? v.task : v.tasks}`,
    summary.modules ? `${summary.modules} ${summary.modules === 1 ? v.module : v.modules}` : null,
    summary.days !== null ? formatDuration(summary.days) : null,
  ].filter(Boolean) as string[]

  return (
    <>
      <div className="cs-backdrop" onClick={dismiss} />
      <div className="cs" role="dialog" aria-label={`${node.title} complete`}>
        <div className="cs-ring" style={{ borderColor: color }}>
          <Icon name="ti-check" />
        </div>
        <div className="cs-title">{node.title}</div>
        <div className="cs-kicker">complete</div>

        <div className="cs-stats">{lines.join(' · ')}</div>

        {summary.deadline ? (
          <div className={`cs-note${summary.deadline.early ? ' cs-note-good' : ''}`}>
            {summary.deadline.days === 0
              ? 'Finished on the deadline.'
              : `Finished ${formatDuration(summary.deadline.days)} ${summary.deadline.early ? 'before' : 'after'} the deadline.`}
          </div>
        ) : null}

        {growth !== null && growth > 0 ? (
          <div className="cs-note">Scope grew {growth}% after kickoff.</div>
        ) : null}

        <button className="cs-done" onClick={dismiss}>Done</button>
      </div>
    </>
  )
}
