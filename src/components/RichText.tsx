import { useEffect, useRef, useState, useCallback } from 'react'
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

/** Insert an <img> (data URL) at the current caret, inside the editor. */
function insertImageAtCaret(editor: HTMLElement, dataUrl: string) {
  editor.focus()
  const sel = window.getSelection()
  const img = `<img src="${dataUrl}" class="rt-img" alt="" />`
  if (sel && sel.rangeCount && editor.contains(sel.anchorNode)) {
    document.execCommand('insertHTML', false, img)
  } else {
    editor.insertAdjacentHTML('beforeend', img)
  }
}

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = reject
    r.readAsDataURL(file)
  })

// Embedded files live inline as data URLs (local-first, no backend). Small ones
// render in place; larger ones become a rich file card so a big blob never
// bloats a card's saved data or slows rendering. Beyond the hard cap we decline.
const MAX_EMBED = 12 * 1024 * 1024
const INLINE_PDF_MAX = 3 * 1024 * 1024
const DOC_ICON: Record<string, string> = { pdf: 'ti-file-type-pdf', doc: 'ti-file-type-doc', docx: 'ti-file-type-docx', ppt: 'ti-file-type-ppt', pptx: 'ti-file-type-ppt', xls: 'ti-file-type-xls', xlsx: 'ti-file-type-xls', zip: 'ti-file-zip' }
const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const sizeLabel = (b: number) => (b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`)
const fileCardHtml = (url: string, name: string, size: number, icon: string) =>
  `<a class="rt-filecard" contenteditable="false" href="${url}" download="${escHtml(name)}" target="_blank" rel="noopener"><span class="rt-file-ic"><i class="ti ${icon}"></i></span><span class="rt-file-meta"><b>${escHtml(name)}</b><small>${sizeLabel(size)}</small></span><i class="ti ti-external-link rt-file-open"></i></a>`

/**
 * Notion/Trello-style rich text: shows the rendered content with a click-to-edit
 * affordance. While editing, a floating "bubble" toolbar follows the text
 * selection so you format the selected part in place; images can be pasted,
 * dropped, or added from the insert bar. Content is stored as HTML.
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
  const [bubble, setBubble] = useState<{ top: number; left: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const docRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.innerHTML = html
      ref.current.focus()
      placeCaretEnd(ref.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  const emit = useCallback(() => {
    const h = ref.current?.innerHTML ?? ''
    setHtml(h)
    onChange(h)
  }, [onChange])

  // Position the bubble over the current selection while editing.
  const updateBubble = useCallback(() => {
    const editor = ref.current, wrap = wrapRef.current
    const sel = window.getSelection()
    if (!editor || !wrap || !sel || sel.rangeCount === 0 || sel.isCollapsed || !editor.contains(sel.anchorNode)) {
      setBubble(null); return
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) { setBubble(null); return }
    const wr = wrap.getBoundingClientRect()
    setBubble({ top: rect.top - wr.top - 46, left: Math.min(Math.max(rect.left - wr.left + rect.width / 2 - 130, 0), wr.width - 260) })
  }, [])

  useEffect(() => {
    if (!editing) { setBubble(null); return }
    const on = () => updateBubble()
    document.addEventListener('selectionchange', on)
    return () => document.removeEventListener('selectionchange', on)
  }, [editing, updateBubble])

  const exec = (cmd: string, value?: string) => {
    ref.current?.focus()
    document.execCommand(cmd, false, value)
    emit(); updateBubble()
  }
  const addLink = () => {
    const url = window.prompt('Link URL')
    if (url) exec('createLink', /^https?:\/\//i.test(url) ? url : `https://${url}`)
  }
  // Images embed inline; PDFs inline when small (else a card); other docs are
  // always a rich card. Everything is stored as a data URL — see MAX_EMBED.
  const embedFiles = async (files: FileList | File[]) => {
    const editor = ref.current; if (!editor) return
    let any = false
    for (const f of files) {
      if (f.type.startsWith('image/')) { insertImageAtCaret(editor, await fileToDataUrl(f)); any = true; continue }
      if (f.size > MAX_EMBED) { window.alert(`“${f.name}” is ${sizeLabel(f.size)} — too large to embed (max ${sizeLabel(MAX_EMBED)}). Add it as an attachment instead.`); continue }
      const url = await fileToDataUrl(f)
      const ext = (f.name.split('.').pop() || '').toLowerCase()
      editor.focus()
      const block = f.type === 'application/pdf' && f.size <= INLINE_PDF_MAX
        ? `<div class="rt-embed" contenteditable="false"><embed src="${url}" type="application/pdf" /><div class="rt-embed-cap"><i class="ti ti-file-type-pdf"></i> ${escHtml(f.name)}</div></div>`
        : fileCardHtml(url, f.name, f.size, DOC_ICON[ext] || 'ti-file')
      document.execCommand('insertHTML', false, block + '<p><br></p>')
      any = true
    }
    if (any) emit()
  }
  const onPaste = (e: React.ClipboardEvent) => {
    const imgs = [...e.clipboardData.files].filter(f => f.type.startsWith('image/'))
    if (imgs.length) { e.preventDefault(); void embedFiles(imgs) }
  }
  const onDrop = (e: React.DragEvent) => {
    if (e.dataTransfer.files.length) { e.preventDefault(); void embedFiles(e.dataTransfer.files) }
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
    <div ref={wrapRef} className="rt rt-focus" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) { setEditing(false); emit() } }}>
      {bubble ? (
        <div className="rt-bubble" style={{ top: bubble.top, left: bubble.left }} onMouseDown={e => e.preventDefault()}>
          <Btn cmd="bold" icon="ti-bold" label="Bold" />
          <Btn cmd="italic" icon="ti-italic" label="Italic" />
          <Btn cmd="underline" icon="ti-underline" label="Underline" />
          <Btn cmd="strikeThrough" icon="ti-strikethrough" label="Strikethrough" />
          <button type="button" title="Link" aria-label="Link" onMouseDown={e => { e.preventDefault(); addLink() }}><Icon name="ti-link" /></button>
          <span className="rt-sep" />
          <Btn cmd="formatBlock" value="H3" icon="ti-heading" label="Heading" />
          <Btn cmd="formatBlock" value="BLOCKQUOTE" icon="ti-quote" label="Quote" />
          <Btn cmd="insertUnorderedList" icon="ti-list" label="Bulleted list" />
          <Btn cmd="removeFormat" icon="ti-clear-formatting" label="Clear formatting" />
        </div>
      ) : null}
      <div
        ref={ref}
        className="rt-editor"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={emit}
        onPaste={onPaste}
        onDrop={onDrop}
      />
      <div className="rt-insert">
        <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => fileRef.current?.click()}><Icon name="ti-photo" /> Image</button>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e => { if (e.target.files) void embedFiles(e.target.files); e.target.value = '' }} />
        <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => docRef.current?.click()}><Icon name="ti-paperclip" /> File</button>
        <input ref={docRef} type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.zip" multiple hidden onChange={e => { if (e.target.files) void embedFiles(e.target.files); e.target.value = '' }} />
        <button type="button" className="rt-done" onMouseDown={e => { e.preventDefault(); setEditing(false); emit() }}>Done</button>
      </div>
    </div>
  )
}
