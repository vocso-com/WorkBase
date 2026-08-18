import type { Node } from '../types'
import { askConfirm } from '../hooks/useConfirm'
import { useStore } from '../store/useStore'

/**
 * Ask how to delete a node, consistently across every view. A leaf is a plain
 * confirm; a node with children offers a third choice — delete the whole
 * sub-tree, or keep the children by promoting them to the parent. `onDone` runs
 * after whichever delete the user picks.
 */
export function confirmDeleteNode(node: Node, onDone?: () => void): void {
  const kids = node.children.length
  const store = () => useStore.getState()

  if (kids === 0) {
    askConfirm({
      title: 'Delete',
      message: `Delete “${node.title}”? This can’t be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => { store().remove(node.id); onDone?.() },
    })
    return
  }

  askConfirm({
    title: 'Delete',
    message: `“${node.title}” has ${kids} sub-item${kids > 1 ? 's' : ''}. Delete everything, or keep them by moving them up to the parent?`,
    confirmLabel: 'Delete all',
    danger: true,
    onConfirm: () => { store().remove(node.id); onDone?.() },
    altLabel: 'Keep sub-items',
    onAlt: () => { store().removeKeepingChildren(node.id); onDone?.() },
  })
}
