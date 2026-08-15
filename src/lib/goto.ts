import { useNav } from '../hooks/useNav'
import { useDetail } from '../hooks/useDetail'
import { useTabs } from '../hooks/useTabs'
import { useStore } from '../store/useStore'
import { pathTo } from './tree'

/**
 * Jump to any node anywhere in the workspace: open its project (switching
 * WorkBase/tab as needed), drill to its container, and open its detail modal.
 * Shared by global search and the execution-engine views.
 */
export function goToNode(id: string, opts: { openDetail?: boolean } = {}) {
  const roots = useStore.getState().doc.roots
  const path = pathTo(roots, id)
  if (path.length === 0) return
  useTabs.getState().openProject(path[0])
  // Drill into the node's container so it's visible; projects stay at their root.
  const container = path.length > 1 ? path.slice(0, -1) : path
  useNav.getState().set(container)
  if (opts.openDetail !== false) useDetail.getState().open(id)
}
