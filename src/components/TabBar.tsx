import { useStore } from '../store/useStore'
import { useTabs } from '../hooks/useTabs'
import { findNode } from '../lib/tree'
import { tagBg, tagFg } from '../lib/colorMode'
import { Icon } from './ui/Icon'

// Desktop-style tabs: keep several projects/locations open and switch between
// them. Each tab remembers its own drill path + view.
export function TabBar() {
  const tabs = useTabs(s => s.tabs)
  const activeId = useTabs(s => s.activeId)
  const roots = useStore(s => s.doc.roots)

  // Only surface tabs once you're actually juggling more than one thing.
  if (tabs.length < 2) return null

  return (
    <div className="tabbar">
      {tabs.map(t => {
        const root = t.path[0] ? findNode(roots, t.path[0]) : null
        const active = t.id === activeId
        const label = root?.title ?? 'Home'
        return (
          <div
            key={t.id}
            className={`tab${active ? ' on' : ''}`}
            onClick={() => useTabs.getState().activate(t.id)}
            title={label}
          >
            <span
              className="tab-ic"
              style={root ? { background: tagBg(root.color ?? 'gray'), color: tagFg(root.color ?? 'gray') } : undefined}
            >
              <Icon name={root ? (root.icon ?? 'ti-folder') : 'ti-home'} />
            </span>
            <span className="tab-label">{label}</span>
            {tabs.length > 1 ? (
              <button
                className="tab-close"
                onClick={e => { e.stopPropagation(); useTabs.getState().close(t.id) }}
                aria-label="Close tab"
              ><Icon name="ti-x" /></button>
            ) : null}
          </div>
        )
      })}
      <button className="tab-new" onClick={() => useTabs.getState().newTab()} title="New tab" aria-label="New tab">
        <Icon name="ti-plus" />
      </button>
    </div>
  )
}
