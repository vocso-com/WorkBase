import { useEffect, useState } from 'react'
import { useActivityFeed } from '../hooks/useActivityFeed'
import { useStore } from '../store/useStore'
import { collectActivity } from '../lib/activity'
import { DEFAULT_WORKSPACE_ID } from '../lib/serialize'
import { ago } from '../lib/time'
import { goToNode } from '../lib/goto'
import { hex } from '../theme'
import { Icon } from './ui/Icon'

// A subtle right-side drawer with the recent activity across the active
// WorkBase. Opened from the history icon in the header.
export function ActivityFeed() {
  const open = useActivityFeed(s => s.open)
  const roots = useStore(s => s.doc.roots)
  const activeWs = useStore(s => s.doc.activeWorkspace)
  const [count, setCount] = useState(50)

  useEffect(() => {
    if (!open) return
    setCount(50)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') useActivityFeed.getState().hide() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  const wsRoots = roots.filter(r => (r.workspace ?? DEFAULT_WORKSPACE_ID) === activeWs)
  const all = collectActivity(wsRoots)
  const entries = all.slice(0, count)

  const openNode = (id: string) => { useActivityFeed.getState().hide(); goToNode(id) }

  return (
    <div className="af-overlay" onClick={() => useActivityFeed.getState().hide()}>
      <aside className="af" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Activity">
        <div className="af-head">
          <div className="af-title"><Icon name="ti-history" /> Activity</div>
          <button className="af-x" onClick={() => useActivityFeed.getState().hide()} aria-label="Close"><Icon name="ti-x" /></button>
        </div>
        <div className="af-body">
          {entries.length === 0 ? (
            <div className="af-empty">No activity yet. Changes you make — moving cards, ticking items, adding work — show up here.</div>
          ) : (
            entries.map(e => (
              <button key={e.id} className="af-row" onClick={() => openNode(e.nodeId)}>
                <span className="af-dot" style={{ background: hex(e.rootColor) }} />
                <span className="af-main">
                  <span className="af-text">{e.text}</span>
                  <span className="af-ctx">{e.nodeTitle} · {e.rootTitle}</span>
                </span>
                <span className="af-time">{ago(e.at)}</span>
              </button>
            ))
          )}
          {all.length > count ? (
            <button className="af-more" onClick={() => setCount(c => c + 50)}>Load more ({all.length - count} older)</button>
          ) : null}
        </div>
      </aside>
    </div>
  )
}
