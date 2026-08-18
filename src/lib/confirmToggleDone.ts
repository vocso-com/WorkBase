import type { Node } from '../types'
import { askConfirm } from '../hooks/useConfirm'
import { useStore } from '../store/useStore'
import { openDescendants } from './progress'

/**
 * Toggle a node's done state, consistently across every view. Completing a
 * container that still has unfinished sub-items asks first (mirrors Flow):
 * complete just this one, or complete everything under it. Un-ticking, leaves,
 * and already-clear containers toggle straight away.
 */
export function confirmToggleDone(node: Node): void {
  const store = () => useStore.getState()
  const toggle = () => store().toggleDone(node.id)

  const open = node.status === 'done' ? 0 : openDescendants(node)
  if (open === 0) { toggle(); return }

  askConfirm({
    title: 'Sub-items still open',
    message: `“${node.title}” has ${open} sub-item${open === 1 ? '' : 's'} that ${open === 1 ? 'is' : 'are'} not done yet. Mark it complete anyway?`,
    confirmLabel: 'Mark complete',
    onConfirm: toggle,
    altLabel: 'Complete all sub-items too',
    onAlt: () => store().completeSubtree(node.id),
  })
}
