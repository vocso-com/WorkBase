import { useState } from 'react'
import { useStore } from '../store/useStore'
import { useTabs } from '../hooks/useTabs'
import { tagBg, tagFg } from '../lib/colorMode'
import { Icon } from './ui/Icon'

// The header hub selector: shows the active WorkBase, switches between them,
// and creates new ones. Projects live inside the selected WorkBase.
export function WorkspaceSwitcher() {
  const workspaces = useStore(s => s.doc.workspaces)
  const activeId = useStore(s => s.doc.activeWorkspace)
  const active = workspaces.find(w => w.id === activeId) ?? workspaces[0]
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  if (!active) return null

  const pick = (id: string) => {
    useStore.getState().setActiveWorkspace(id)
    useTabs.getState().goHome()
    setOpen(false)
  }
  const create = () => {
    const n = name.trim()
    if (!n) return
    useStore.getState().addWorkspace(n)
    useTabs.getState().goHome()
    setName('')
    setAdding(false)
    setOpen(false)
  }

  return (
    <div className="wsw">
      <button className="wsw-btn" onClick={() => setOpen(o => !o)}>
        <span className="wsw-text">
          <span className="wsw-name">{active.name}</span>
          <span className="wsw-sub">WORKBASE</span>
        </span>
        <Icon name="ti-chevron-down" className="wsw-caret" />
      </button>
      {open ? (
        <>
          <div className="cm-menu-backdrop" onClick={() => { setOpen(false); setAdding(false) }} />
          <div className="wsw-menu" onClick={e => e.stopPropagation()}>
            <div className="wsw-head">Your WorkBases</div>
            {workspaces.map(w => (
              <button key={w.id} className={`wsw-item${w.id === activeId ? ' on' : ''}`} onClick={() => pick(w.id)}>
                <span className="wsw-ic" style={{ background: tagBg(w.color ?? 'blue'), color: tagFg(w.color ?? 'blue') }}><Icon name={w.icon ?? 'ti-stack-2'} /></span>
                <span className="wsw-item-name">{w.name}</span>
                {w.id === activeId ? <Icon name="ti-check" className="wsw-check" /> : null}
              </button>
            ))}
            <div className="cm-menu-sep" />
            {adding ? (
              <div className="wsw-new">
                <input
                  autoFocus
                  placeholder="WorkBase name…"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') create(); if (e.key === 'Escape') { setAdding(false); setName('') } }}
                />
                <button className="cm-add-btn" onClick={create}>Add</button>
              </div>
            ) : (
              <button className="wsw-item wsw-add" onClick={() => setAdding(true)}>
                <span className="wsw-ic wsw-add-ic"><Icon name="ti-plus" /></span> New WorkBase
              </button>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}
