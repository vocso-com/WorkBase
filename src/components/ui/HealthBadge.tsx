import type { Node } from '../../types'
import { healthOf, type HealthState } from '../../lib/health'
import { useStore } from '../../store/useStore'
import { COLORS } from '../../theme'

const TONE: Record<HealthState, { label: string; color: string }> = {
  'at-risk': { label: 'At risk', color: COLORS.red },
  blocked: { label: 'Blocked', color: COLORS.amber },
  stalled: { label: 'Stalled', color: COLORS.slate },
  'on-track': { label: 'On track', color: COLORS.teal },
}

/**
 * One state, with the facts behind it — never a composite score. "Health: 72"
 * is uninterpretable: nobody can say what would make it 73, so nobody believes
 * it. The test for the label is whether a reader can tell what to do next.
 *
 * Silent when a project is on track. A grid of twelve green badges is noise,
 * and the moment people start ignoring the badge the whole mechanism is lost —
 * so absence is the reassuring signal and presence always means something.
 */
export function HealthBadge({ node, showEvidence = false }: { node: Node; showEvidence?: boolean }) {
  const roots = useStore(s => s.doc.roots)
  const health = healthOf(roots, node)
  if (health.state === 'on-track') return null

  const tone = TONE[health.state]
  const evidence = health.evidence.join(' · ')

  return (
    <span
      className="health-badge"
      title={evidence || tone.label}
      style={{ borderColor: `${tone.color}55`, color: tone.color }}
    >
      <span className="sdot" style={{ background: tone.color }} />
      {tone.label}
      {showEvidence && evidence ? <span className="health-ev">{evidence}</span> : null}
    </span>
  )
}
