import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearch } from '../hooks/useSearch'
import { useStore } from '../store/useStore'
import { searchNodes, type SearchHit } from '../lib/search'
import { goToNode } from '../lib/goto'
import { tagBg, tagFg } from '../lib/colorMode'
import { Icon } from './ui/Icon'

const KIND_ICON: Record<SearchHit['kind'], string> = {
  project: 'ti-folder',
  module: 'ti-stack-2',
  task: 'ti-checkbox',
}

export function SearchPalette() {
  const open = useSearch(s => s.open)
  const roots = useStore(s => s.doc.roots)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Global ⌘K / Ctrl+K toggle — mounted for the whole app lifetime.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        useSearch.getState().toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) { setQ(''); setActive(0); setTimeout(() => inputRef.current?.focus(), 0) }
  }, [open])

  const hits = useMemo(() => (open ? searchNodes(roots, q) : []), [open, q, roots])

  useEffect(() => { setActive(0) }, [q])

  if (!open) return null

  const hide = () => useSearch.getState().hide()
  const choose = (hit?: SearchHit) => {
    const h = hit ?? hits[active]
    if (!h) return
    hide()
    goToNode(h.node.id)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); hide() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(hits.length - 1, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(0, i - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); choose() }
  }

  return (
    <div className="cmdk-overlay" onClick={hide}>
      <div className="cmdk" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="cmdk-input">
          <Icon name="ti-search" />
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search projects, modules, tasks…"
            aria-label="Search"
          />
          <kbd className="cmdk-esc">esc</kbd>
        </div>
        <div className="cmdk-list" ref={listRef}>
          {q.trim() === '' ? (
            <div className="cmdk-empty">Type to search across every project and WorkBase.</div>
          ) : hits.length === 0 ? (
            <div className="cmdk-empty">No matches for “{q}”.</div>
          ) : (
            hits.map((h, i) => {
              const color = h.node.color ?? h.node.labelColor ?? 'gray'
              return (
                <button
                  key={h.node.id}
                  className={`cmdk-row${i === active ? ' on' : ''}`}
                  onMouseMove={() => setActive(i)}
                  onClick={() => choose(h)}
                >
                  <span className="cmdk-ic" style={{ background: tagBg(color), color: tagFg(color) }}>
                    <Icon name={h.node.icon ?? KIND_ICON[h.kind]} />
                  </span>
                  <span className="cmdk-main">
                    <span className="cmdk-title">{h.node.title}</span>
                    {h.kind === 'project'
                      ? <span className="cmdk-trail">Project</span>
                      : <span className="cmdk-trail">{[h.rootTitle, h.trail].filter(Boolean).join(' › ')}</span>}
                  </span>
                  <span className="cmdk-sid">{h.node.shortId}</span>
                </button>
              )
            })
          )}
        </div>
        <div className="cmdk-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>⌘K</kbd> toggle</span>
        </div>
      </div>
    </div>
  )
}
