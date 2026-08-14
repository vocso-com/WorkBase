import { useEffect, useRef, useState } from 'react'
import { Icon } from './ui/Icon'
import { linkifyHtml } from '../lib/linkify'

function placeCaretEnd(el: HTMLElement) {
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(false)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
}

/**
 * Notion/Trello-style rich text: shows the rendered content with a click-to-edit
 * affordance; the toolbar + editable box only appear while editing. Content is
 * stored as HTML. Uncontrolled while editing (to avoid caret jumps) — remount
 * via `key` to load a different value.
 */
export function RichText({
  initial,
  onChange,
  placeholder,
}: {
  initial?: string
  onChange: (html: string) => void
  placeholder?: string
}) {
  const [html, setHtml] = useState(initial ?? '')
  const [editing, setEditing] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.innerHTML = html
      ref.current.focus()
      placeCaretEnd(ref.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  const emit = () => {
    const h = ref.current?.innerHTML ?? ''
    setHtml(h)
    onChange(h)
  }
  const exec = (cmd: string, value?: string) => {
    ref.current?.focus()
    document.execCommand(cmd, false, value)
    emit()
  }
  const Btn = ({ cmd, icon, value, label }: { cmd: string; icon: string; value?: string; label: string }) => (
    <button type="button" title={label} aria-label={label} onMouseDown={e => { e.preventDefault(); exec(cmd, value) }}>
      <Icon name={icon} />
    </button>
  )

  if (!editing) {
    return (
      <div className="rt-read" onClick={e => { if ((e.target as HTMLElement).closest('a')) return; setEditing(true) }} title="Click to edit">
        {html ? <div dangerouslySetInnerHTML={{ __html: linkifyHtml(html) }} /> : <span className="rt-ph">{placeholder}</span>}
      </div>
    )
  }

  return (
    <div className="rt rt-focus" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) { setEditing(false); emit() } }}>
      <div className="rt-bar">
        <Btn cmd="bold" icon="ti-bold" label="Bold" />
        <Btn cmd="italic" icon="ti-italic" label="Italic" />
        <span className="rt-sep" />
        <Btn cmd="formatBlock" value="H3" icon="ti-heading" label="Heading" />
        <Btn cmd="insertUnorderedList" icon="ti-list" label="Bulleted list" />
        <Btn cmd="insertOrderedList" icon="ti-list-numbers" label="Numbered list" />
        <Btn cmd="formatBlock" value="BLOCKQUOTE" icon="ti-quote" label="Quote" />
        <span className="rt-sep" />
        <Btn cmd="removeFormat" icon="ti-clear-formatting" label="Clear formatting" />
        <button type="button" className="rt-done" onMouseDown={e => { e.preventDefault(); setEditing(false); emit() }}>Done</button>
      </div>
      <div ref={ref} className="rt-editor" contentEditable suppressContentEditableWarning data-placeholder={placeholder} onInput={emit} />
    </div>
  )
}
