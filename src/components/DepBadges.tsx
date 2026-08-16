import type { Node } from '../types'
import { dependencyNodes, dependents, isComplete } from '../lib/deps'
import { goToNode } from '../lib/goto'
import { Icon } from './ui/Icon'

const list = (nodes: Node[]) =>
  nodes.map(n => `${n.shortId ? `${n.shortId} · ` : ''}${n.title}`).join('\n')

/**
 * The dependency edges Flow draws as dashed lines, shown as chips for the views
 * that have no canvas to draw on. Both directions: what is holding this item up,
 * and what is waiting on it — the second is invisible on the item's own card
 * otherwise, so it is easy to finish something without realising it unblocks
 * three other things.
 *
 * Clicking a chip jumps to the first related item rather than only describing
 * it, since "what is blocking me" is usually followed by "take me there".
 */
export function DepBadges({ node, roots, compact }: { node: Node; roots: Node[]; compact?: boolean }) {
  const blockedBy = node.dependsOn?.length ? dependencyNodes(roots, node) : []
  const unmet = blockedBy.filter(n => !isComplete(n))
  const blocking = dependents(roots, node.id)
  if (unmet.length === 0 && blocking.length === 0) return null

  const jump = (e: React.MouseEvent, to: Node) => {
    e.stopPropagation()
    goToNode(to.id)
  }

  return (
    <>
      {unmet.length > 0 ? (
        <button
          className="depchip depchip-blocked"
          title={`Blocked by:\n${list(unmet)}`}
          onClick={e => jump(e, unmet[0])}
          onPointerDown={e => e.stopPropagation()}
        >
          <Icon name="ti-lock" />
          {compact ? unmet.length : `Blocked by ${unmet.length}`}
        </button>
      ) : null}
      {blocking.length > 0 ? (
        <button
          className="depchip depchip-blocking"
          title={`This is blocking:\n${list(blocking)}`}
          onClick={e => jump(e, blocking[0])}
          onPointerDown={e => e.stopPropagation()}
        >
          <Icon name="ti-arrows-split-2" />
          {compact ? blocking.length : `Blocks ${blocking.length}`}
        </button>
      ) : null}
    </>
  )
}
