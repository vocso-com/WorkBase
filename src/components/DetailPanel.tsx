import { useEffect, useRef } from 'react'
import type { Priority, Status } from '../types'
import { STATUS, STATUS_ORDER } from '../theme'
import { useStore } from '../store/useStore'
import { useDetail } from '../hooks/useDetail'
import { findNode } from '../lib/tree'
import { Icon } from './ui/Icon'
import { Tag } from './ui/Tag'

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'med', label: 'Medium' },
  { value: 'high', label: 'High' },
]

const fieldStyle: React.CSSProperties = {
  width: '100%', font: 'inherit', fontSize: 13, color: 'var(--ink)', background: 'var(--panel)',
  border: '1px solid var(--line)', borderRadius: 8, padding: '7px 9px', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.02em',
  textTransform: 'uppercase', margin: '14px 0 6px',
}

export function DetailPanel() {
  const openId = useDetail(s => s.openId)
  const roots = useStore(s => s.doc.roots)
  const tagPalette = useStore(s => s.doc.tagPalette)
  const panelRef = useRef<HTMLDivElement>(null)
  const node = openId ? findNode(roots, openId) : null

  useEffect(() => {
    if (!openId) return
    function onMouseDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        useDetail.getState().close()
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [openId])

  if (!openId || !node) return null

  const tags = node.tags ?? []
  const availableTags = tagPalette.filter(t => !tags.some(nt => nt.name === t.name))

  function addTag(name: string) {
    if (!node || !name) return
    const paletteTag = tagPalette.find(t => t.name === name)
    if (!paletteTag || tags.some(t => t.name === name)) return
    useStore.getState().patch(node.id, { tags: [...tags, paletteTag] })
  }

  function removeTag(name: string) {
    if (!node) return
    useStore.getState().patch(node.id, { tags: tags.filter(t => t.name !== name) })
  }

  return (
    <div
      ref={panelRef}
      style={{
        width: 340, minWidth: 340, flexShrink: 0, background: 'var(--card)', borderLeft: '1px solid var(--line)',
        boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto',
        padding: '18px 18px 28px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <input
          aria-label="Title"
          value={node.title}
          onChange={e => useStore.getState().rename(node.id, e.target.value)}
          style={{ ...fieldStyle, fontSize: 15.5, fontWeight: 700, border: 'none', background: 'transparent', padding: '2px 0', flex: 1 }}
        />
        <button
          aria-label="Close panel"
          onClick={() => useDetail.getState().close()}
          style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--faint)', fontSize: 18, lineHeight: 1, padding: 4 }}
        >
          <Icon name="ti-x" />
        </button>
      </div>

      <div style={labelStyle}>Description</div>
      <textarea
        placeholder="Add a description…"
        value={node.description ?? ''}
        onChange={e => useStore.getState().patch(node.id, { description: e.target.value })}
        rows={3}
        style={{ ...fieldStyle, resize: 'vertical', fontFamily: 'inherit' }}
      />

      <div style={labelStyle}>Status</div>
      <select
        value={node.status}
        onChange={e => useStore.getState().setStatus(node.id, e.target.value as Status)}
        style={fieldStyle}
      >
        {STATUS_ORDER.map(s => (
          <option key={s} value={s}>{STATUS[s].label}</option>
        ))}
      </select>

      <div style={labelStyle}>Priority</div>
      <select
        value={node.priority ?? ''}
        onChange={e => useStore.getState().patch(node.id, { priority: (e.target.value || undefined) as Priority | undefined })}
        style={fieldStyle}
      >
        <option value="">No priority</option>
        {PRIORITIES.map(p => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
      </select>

      <div style={labelStyle}>Due date</div>
      <input
        aria-label="Due date"
        type="date"
        value={node.dueDate ?? ''}
        onChange={e => useStore.getState().patch(node.id, { dueDate: e.target.value })}
        style={fieldStyle}
      />

      <div style={labelStyle}>Tags</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 22 }}>
        {tags.map(t => (
          <span key={t.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Tag tag={t} />
            <button
              aria-label={`Remove tag ${t.name}`}
              onClick={() => removeTag(t.name)}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--faint)', fontSize: 11, lineHeight: 1, padding: 0 }}
            >
              <Icon name="ti-x" />
            </button>
          </span>
        ))}
      </div>
      {availableTags.length > 0 ? (
        <select
          aria-label="Add tag"
          value=""
          onChange={e => addTag(e.target.value)}
          style={{ ...fieldStyle, marginTop: 8 }}
        >
          <option value="">Add tag…</option>
          {availableTags.map(t => (
            <option key={t.name} value={t.name}>{t.name}</option>
          ))}
        </select>
      ) : null}

      <div style={labelStyle}>Notes</div>
      <textarea
        placeholder="Notes…"
        value={node.notes ?? ''}
        onChange={e => useStore.getState().patch(node.id, { notes: e.target.value })}
        rows={4}
        style={{ ...fieldStyle, resize: 'vertical', fontFamily: 'inherit' }}
      />
    </div>
  )
}
