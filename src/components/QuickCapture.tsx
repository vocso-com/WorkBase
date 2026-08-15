import { useEffect, useState } from 'react'
import { useQuickCapture } from '../hooks/useQuickCapture'
import { useStore } from '../store/useStore'
import { parseDue } from '../lib/nlDate'
import { goToNode } from '../lib/goto'
import { Icon } from './ui/Icon'

// A fast task capture with natural-language dates: "ship blog fri" → a task
// titled "ship blog" due Friday, filed in the Inbox project.
export function QuickCapture() {
  const open = useQuickCapture(s => s.open)
  const [val, setVal] = useState('')

  useEffect(() => {
    if (!open) return
    setVal('')
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') useQuickCapture.getState().hide() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  const parsed = parseDue(val)
  const canAdd = parsed.title.trim().length > 0

  const submit = (openAfter: boolean) => {
    if (!canAdd) return
    const id = useStore.getState().quickAddTask(parsed.title.trim(), parsed.dueDate)
    useQuickCapture.getState().hide()
    if (openAfter) goToNode(id)
  }

  return (
    <div className="qc-backdrop" onClick={() => useQuickCapture.getState().hide()}>
      <div className="qc" onClick={e => e.stopPropagation()}>
        <div className="qc-head"><Icon name="ti-bolt" /> Quick add <span>→ Inbox</span></div>
        <input
          className="qc-input"
          autoFocus
          placeholder="e.g. Ship the blog post fri"
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(e.metaKey || e.shiftKey) } }}
        />
        {parsed.dueDate ? (
          <div className="qc-preview">
            <span className="qc-preview-title">{parsed.title}</span>
            <span className="qc-preview-due"><Icon name="ti-calendar" /> {parsed.dueLabel}</span>
          </div>
        ) : (
          <div className="qc-hint">Add “tomorrow”, “fri”, “next week”, or “aug 20” to set a due date</div>
        )}
        <div className="qc-actions">
          <button className="qc-add" onClick={() => submit(false)} disabled={!canAdd}>Add task</button>
          <kbd>⏎</kbd>
        </div>
      </div>
    </div>
  )
}
