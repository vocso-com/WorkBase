import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ColorKey, Node, Priority, Status } from '../types'
import { COLORS, ICON_CHOICES, PRIORITY_META, hex, mergedStages, stageMeta } from '../theme'
import { useStore } from '../store/useStore'
import { useDetail } from '../hooks/useDetail'
import { useNav } from '../hooks/useNav'
import { findNode, findParent, leaves, pathTo } from '../lib/tree'
import { ago, fmtDate } from '../lib/time'
import { CHECKLIST_TEMPLATES } from '../lib/templates'
import { progressOf } from '../lib/progress'
import { linkifyText } from '../lib/linkify'
import { tagBg, tagFg } from '../lib/colorMode'
import { uploadFile } from '../lib/uploads'
import { confirmDeleteNode } from '../lib/confirmDelete'
import { confirmToggleDone } from '../lib/confirmToggleDone'
import { RichText } from './RichText'
import { ChecklistTree } from './ChecklistTree'
import { ProgressBar } from './ui/ProgressBar'
import { Dependencies } from './Dependencies'
import { DatePicker } from './DatePicker'
import { Icon } from './ui/Icon'
import { SizePicker } from './SizePicker'
import { Tag } from './ui/Tag'
import { Checkbox } from './ui/Checkbox'

const PRIORITIES: Priority[] = ['low', 'med', 'high']

const SWATCHES: ColorKey[] = ['blue', 'indigo', 'violet', 'pink', 'coral', 'red', 'amber', 'lime', 'teal', 'cyan', 'slate', 'gray']


// Renders the full card detail. As the app's singleton overlay when driven by
// useDetail.openId, or inline in the page (Outline view) when given `inlineNode`.
export function CardModal({ inlineNode }: { inlineNode?: Node } = {}) {
  const openId = useDetail(s => s.openId)
  const roots = useStore(s => s.doc.roots)
  const tagPalette = useStore(s => s.doc.tagPalette)
  const customStages = useStore(s => s.doc.stages)
  const stageLabels = useStore(s => s.doc.stageLabels)
  const stageOrder = useStore(s => s.doc.stageOrder)
  const profile = useStore(s => s.doc.profile)
  const workspaces = useStore(s => s.doc.workspaces)
  const templates = useStore(s => s.doc.templates)
  const node = inlineNode ?? (openId ? findNode(roots, openId) : null)

  const [item, setItem] = useState('')
  const [comment, setComment] = useState('')
  const [pick, setPick] = useState<'status' | 'priority' | 'color' | 'icon' | 'tags' | 'due' | null>(null)
  const [newTag, setNewTag] = useState('')
  const [newTagColor, setNewTagColor] = useState<ColorKey>('blue')
  const [menu, setMenu] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [moveQuery, setMoveQuery] = useState('')
  const [details, setDetails] = useState(false)
  const [clTpl, setClTpl] = useState(false)
  const [tplQuery, setTplQuery] = useState('')
  const [tplPos, setTplPos] = useState<{ bottom: number; right: number; maxH: number } | null>(null)
  const tplBtnRef = useRef<HTMLButtonElement>(null)
  const titleRef = useRef<HTMLTextAreaElement>(null)

  // Open the checklist-template picker, anchored above its button (portaled to
  // body so the scrolling modal body can't clip the search field).
  const toggleTpl = () => {
    setTplQuery('')
    setClTpl(v => {
      const open = !v
      if (open && tplBtnRef.current) {
        const r = tplBtnRef.current.getBoundingClientRect()
        setTplPos({ bottom: window.innerHeight - r.top + 6, right: window.innerWidth - r.right, maxH: Math.min(440, r.top - 24) })
      }
      return open
    })
  }

  const sizeTitle = () => {
    const el = titleRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }
  useEffect(() => { sizeTitle() }, [openId, node?.title])

  useEffect(() => {
    setItem('')
    setComment('')
    setPick(null)
    setMenu(false)
    setMoveOpen(false)
    setMoveQuery('')
    setDetails(false)
    setClTpl(false)
    setTplQuery('')
    setNewTag('')
    if (!openId) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') useDetail.getState().close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openId])

  if (!node) return null

  const color = node.labelColor ?? node.color ?? 'gray'
  const sm = stageMeta(customStages, node.status, stageLabels)
  const parent = findParent(roots, node.id)
  const isProject = roots.some(r => r.id === node.id)
  const children = node.children
  const isContainer = children.length > 0
  const doneChildren = children.filter(c => (c.children.length > 0 ? progressOf(c) === 100 : c.status === 'done')).length
  const comments = node.comments ?? []
  const activities = node.activities ?? []
  const feed = [
    ...comments.map(c => ({ kind: 'comment' as const, at: c.at, c })),
    ...activities.map(a => ({ kind: 'act' as const, at: a.at, a })),
  ].sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : 0))
  const attachments = node.attachments ?? []
  const tags = node.tags ?? []
  const availableTags = tagPalette.filter(t => !tags.some(nt => nt.name === t.name))

  const close = () => useDetail.getState().close()

  const gotoParent = () => {
    if (!parent) return
    close()
    useNav.getState().set(pathTo(roots, parent.id))
  }

  const addItem = () => {
    const t = item.trim()
    if (!t) return
    useStore.getState().addChildNode(node.id, t)
    setItem('')
  }
  const applyChecklistTemplate = (items: string[]) => {
    items.forEach(t => useStore.getState().addChildNode(node.id, t))
    setClTpl(false)
  }
  const applyTag = (t: { name: string; color: ColorKey }) => {
    if (!tags.some(x => x.name.toLowerCase() === t.name.toLowerCase())) {
      useStore.getState().patch(node.id, { tags: [...tags, t] })
    }
  }
  const createTag = () => {
    const name = newTag.trim()
    if (!name) return
    useStore.getState().addTag(name, newTagColor)
    applyTag({ name, color: newTagColor })
    setNewTag('')
  }
  const addComment = () => {
    const t = comment.trim()
    if (!t) return
    useStore.getState().addComment(node.id, t)
    setComment('')
  }
  const onCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try {
      const url = await uploadFile(f)
      useStore.getState().patch(node.id, { image: url })
    } catch (err) { alert((err as Error).message) }
  }
  const onAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : []
    e.target.value = ''
    for (const f of files) {
      try {
        const url = await uploadFile(f)
        useStore.getState().addAttachment(node.id, { name: f.name, type: f.type, dataUrl: url })
      } catch (err) { alert((err as Error).message) }
    }
  }
  // Attachments are stored as data-URLs (or remote URLs). Convert to a blob URL
  // for a reliable preview/download in both the browser and the Tauri webview.
  const attBlobUrl = async (a: { dataUrl: string }) => {
    const res = await fetch(a.dataUrl)
    return URL.createObjectURL(await res.blob())
  }
  const openAttachment = async (a: { name: string; type: string; dataUrl: string }) => {
    try {
      const url = await attBlobUrl(a)
      const w = window.open(url, '_blank')
      if (!w) { const link = document.createElement('a'); link.href = url; link.download = a.name; link.click() }
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch { window.open(a.dataUrl, '_blank') }
  }
  const downloadAttachment = async (a: { name: string; type: string; dataUrl: string }) => {
    try {
      const url = await attBlobUrl(a)
      const link = document.createElement('a'); link.href = url; link.download = a.name; link.click()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch { const link = document.createElement('a'); link.href = a.dataUrl; link.download = a.name; link.click() }
  }
  const del = () => {
    const id = node.id
    confirmDeleteNode(node, () => {
      close()
      if (useNav.getState().path.includes(id)) useNav.getState().home()
    })
  }

  // Reparent targets: every node except this node, its descendants, and its
  // current parent (a no-op).
  const blocked = new Set<string>()
  const markSub = (n: typeof node) => { blocked.add(n.id); n.children.forEach(markSub) }
  markSub(node)
  const moveTargets: { id: string; label: string; node: typeof node }[] = []
  const walkTargets = (n: typeof node, trail: string[]) => {
    if (!blocked.has(n.id) && n.id !== parent?.id) moveTargets.push({ id: n.id, label: [...trail, n.title].join(' › '), node: n })
    n.children.forEach(c => walkTargets(c, [...trail, n.title]))
  }
  roots.forEach(r => walkTargets(r, []))
  const moveTo = (value: string) => {
    if (!value) return
    useStore.getState().move(node.id, value === '__root__' ? null : value, 99999)
  }

  const kind = isProject ? 'project' : isContainer ? 'module' : 'task'
  const curColor = isContainer ? node.color : node.labelColor

  // Searchable checklist sources: built-in templates, any project/module's
  // checklist reused from across all hubs, and saved project templates.
  type ClSource = { key: string; name: string; sub: string; icon: string; items: string[] }
  const q = tplQuery.trim().toLowerCase()
  const clMatches = (s: ClSource) => !q || s.name.toLowerCase().includes(q) || s.sub.toLowerCase().includes(q) || s.items.some(i => i.toLowerCase().includes(q))
  const builtinSources: ClSource[] = CHECKLIST_TEMPLATES.map(t => ({ key: `b:${t.id}`, name: t.name, sub: `${t.items.length} items`, icon: t.icon, items: t.items })).filter(clMatches)
  const wsName = (wid?: string) => workspaces.find(w => w.id === (wid ?? ''))?.name ?? 'WorkBase'
  const projectSources: ClSource[] = []
  const walkCl = (n: typeof node, rootTitle: string, ws: string) => {
    if (n.children.length > 0 && !blocked.has(n.id)) {
      const items = n.children.map(c => c.title).filter(Boolean)
      if (items.length) projectSources.push({ key: `p:${n.id}`, name: n.title, sub: `${items.length} items · ${ws} › ${rootTitle}`, icon: n.icon ?? 'ti-list-tree', items })
    }
    n.children.forEach(c => walkCl(c, rootTitle, ws))
  }
  roots.forEach(r => walkCl(r, r.title, wsName(r.workspace)))
  const projFiltered = projectSources.filter(clMatches).slice(0, 40)
  const templateSources: ClSource[] = templates.flatMap(t =>
    t.modules.filter(m => m.items.length).map((m, i) => ({ key: `t:${t.id}:${i}`, name: m.name, sub: `${m.items.length} items · ${t.name} template`, icon: m.icon ?? 'ti-template', items: m.items.map(it => it.title) })),
  ).filter(clMatches)
  const noClMatches = !builtinSources.length && !projFiltered.length && !templateSources.length
  const renderClSource = (s: ClSource) => (
    <button key={s.key} className="cm-tpl-item" onClick={() => applyChecklistTemplate(s.items)}>
      <span className="cm-tpl-ic"><Icon name={s.icon} /></span>
      <span className="cm-tpl-info">
        <span className="cm-tpl-name">{s.name}</span>
        <span className="cm-tpl-sub">{s.sub}</span>
      </span>
      <Icon name="ti-plus" className="cm-tpl-add" />
    </button>
  )

  const userName = profile?.userName?.trim() || 'You'
  const userAvatar = profile?.userAvatar
  const avInitial = userName.charAt(0).toUpperCase()
  const avStyle = userAvatar ? { backgroundImage: `url(${userAvatar})` } : undefined
  const Avatar = () => <span className={`cm-av${userAvatar ? ' cm-av-img' : ''}`} style={avStyle}>{userAvatar ? '' : avInitial}</span>

  // Editable title — reused in the project brand band and the normal title row.
  const titleField = (
    <textarea
      ref={titleRef}
      aria-label="Title"
      className="cm-title"
      rows={1}
      value={node.title}
      onChange={e => { useStore.getState().rename(node.id, e.target.value); sizeTitle() }}
      onInput={sizeTitle}
    />
  )
  // Project-level "at a glance" line for the brand band.
  const moduleTotal = children.filter(c => c.children.length > 0).length
  const taskTotal = leaves(node).length
  const bandMeta = [
    moduleTotal ? `${moduleTotal} module${moduleTotal > 1 ? 's' : ''}` : null,
    `${taskTotal} task${taskTotal === 1 ? '' : 's'}`,
    taskTotal ? `${progressOf(node)}% done` : null,
  ].filter(Boolean).join(' · ')
  const iconPicker = pick === 'icon' ? (
    <>
      <div className="cm-menu-backdrop" onClick={() => setPick(null)} />
      <div className="cm-qp-pop cm-icons cm-icons-pop" onClick={e => e.stopPropagation()}>
        {ICON_CHOICES.map(ic => (
          <button key={ic} className={`cm-ic${(node.icon ?? 'ti-stack-2') === ic ? ' on' : ''}`} onClick={() => { useStore.getState().patch(node.id, { icon: ic }); setPick(null) }} aria-label={ic}><Icon name={ic} /></button>
        ))}
      </div>
    </>
  ) : null

  return (
    <div className={inlineNode ? 'cm-inline' : 'card-overlay'} onClick={inlineNode ? undefined : close}>
      <div className={`cardmodal${inlineNode ? ' cardmodal-inline' : ''}`} onClick={e => e.stopPropagation()} role={inlineNode ? undefined : 'dialog'} aria-modal={inlineNode ? undefined : true} style={{ ['--cm-accent' as string]: hex(color) }}>
        <div className="cm-accent" />
        {!isProject && node.image ? (
          <div className="cm-cover" style={{ backgroundImage: `url(${node.image})` }}>
            <button className="cm-cover-del" onClick={() => useStore.getState().patch(node.id, { image: undefined })}>
              <Icon name="ti-photo-off" /> Remove cover
            </button>
          </div>
        ) : null}

        <div className="cm-top">
          {parent ? (
            <button className="cm-crumb-chip" onClick={gotoParent} title={`Open ${parent.title}`}>
              <span className="cm-crumb-ic" style={{ background: tagBg(parent.color ?? 'gray'), color: tagFg(parent.color ?? 'gray') }}>
                <Icon name={parent.icon ?? 'ti-stack-2'} />
              </span>
              <span className="cm-crumb-lbl">{parent.title}</span>
              <Icon name="ti-chevron-right" className="cm-crumb-sep" />
            </button>
          ) : (
            <span className="cm-crumb-chip cm-crumb-static"><Icon name="ti-folder" /> Project</span>
          )}
          <span className="cm-id">{node.shortId}</span>
          <div className="cm-top-actions">
            <label className="cm-icon-btn" title={node.image ? 'Change cover' : 'Add cover'}>
              <Icon name="ti-photo" />
              <input type="file" accept="image/*" hidden onChange={onCover} />
            </label>
            <div className="cm-menu-wrap">
              <button className="cm-icon-btn" onClick={() => setMenu(m => !m)} aria-label="More actions"><Icon name="ti-dots" /></button>
              {menu ? (
                <>
                  <div className="cm-menu-backdrop" onClick={() => { setMenu(false); setMoveOpen(false) }} />
                  <div className="cm-menu" onClick={e => e.stopPropagation()}>
                    {!moveOpen ? (
                      <>
                        <button className="cm-menu-item" onClick={() => setMoveOpen(true)}><Icon name="ti-arrow-right" /> Move to…</button>
                        {isProject ? (
                          <button className="cm-menu-item" onClick={() => { useStore.getState().saveAsTemplate(node.id); setMenu(false) }}><Icon name="ti-template" /> Save as template</button>
                        ) : null}
                        <div className="cm-menu-sep" />
                        <button className="cm-menu-item cm-menu-danger" onClick={() => { setMenu(false); del() }}><Icon name="ti-trash" /> Delete {kind}</button>
                      </>
                    ) : (
                      <div className="cm-move">
                        <div className="cm-move-head">
                          <button className="cm-move-back" onClick={() => setMoveOpen(false)} aria-label="Back"><Icon name="ti-chevron-left" /></button>
                          Move to
                        </div>
                        <input className="cm-move-input" autoFocus placeholder="Search a parent…" value={moveQuery} onChange={e => setMoveQuery(e.target.value)} />
                        <div className="cm-move-list">
                          <button className="cm-menu-item" onClick={() => { moveTo('__root__'); setMenu(false); setMoveOpen(false) }}>— Top level (project) —</button>
                          {moveTargets.filter(t => t.label.toLowerCase().includes(moveQuery.toLowerCase())).slice(0, 40).map(t => (
                            <button key={t.id} className="cm-menu-item cm-move-item" onClick={() => { moveTo(t.id); setMenu(false); setMoveOpen(false) }}>
                              {t.node.image ? (
                                <span className="cm-move-ic cm-move-img" style={{ backgroundImage: `url(${t.node.image})` }} />
                              ) : (
                                <span className="cm-move-ic" style={{ background: tagBg(t.node.color ?? 'gray'), color: tagFg(t.node.color ?? 'gray') }}><Icon name={t.node.icon ?? 'ti-folder'} /></span>
                              )}
                              <span className="cm-move-lbl">{t.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
            {!inlineNode ? <button className="cm-icon-btn" onClick={close} aria-label="Close"><Icon name="ti-x" /></button> : null}
          </div>
        </div>

        {isProject ? (
          <div className="cm-brandband">
            <div className="cm-title-ic-wrap">
              {node.image ? (
                <button className="cm-bb-logo" onClick={() => setPick(p => (p === 'icon' ? null : 'icon'))} title="Change icon">
                  <img className="cm-bb-logo-img" src={node.image} alt="" />
                  <span className="cm-title-ic-edit"><Icon name="ti-pencil" /></span>
                </button>
              ) : (
                <button className="cm-bb-ic" style={{ background: tagBg(color), color: tagFg(color) }} onClick={() => setPick(p => (p === 'icon' ? null : 'icon'))} title="Change icon">
                  <Icon name={node.icon ?? 'ti-folder'} />
                  <span className="cm-title-ic-edit"><Icon name="ti-pencil" /></span>
                </button>
              )}
              {iconPicker}
            </div>
            <div className="cm-bb-text">
              {titleField}
              {bandMeta ? <span className="cm-bb-meta">{bandMeta}</span> : null}
            </div>
            <span className="cm-bb-status" style={{ background: tagBg(sm.color), color: tagFg(sm.color) }}>
              <span className="sdot" style={{ background: sm.dot }} /> {sm.label}
            </span>
          </div>
        ) : null}

        <div className="cm-body">
          <div className="cm-main">
            {!isProject ? (
              <div className="cm-titlerow">
                {isContainer ? (
                  <div className="cm-title-ic-wrap">
                    <button className="cm-title-ic" style={{ background: tagBg(color), color: tagFg(color) }} onClick={() => setPick(p => (p === 'icon' ? null : 'icon'))} title="Change icon">
                      <Icon name={node.icon ?? 'ti-stack-2'} />
                      <span className="cm-title-ic-edit"><Icon name="ti-pencil" /></span>
                    </button>
                    {iconPicker}
                  </div>
                ) : (
                  <span className="cm-title-check">
                    <Checkbox status={node.status} onToggle={() => confirmToggleDone(node)} />
                  </span>
                )}
                {titleField}
              </div>
            ) : null}

            <div className="cm-quickprops">
              <div className="cm-qp-wrap">
                <button className="cm-qp" onClick={() => setPick(p => (p === 'status' ? null : 'status'))}>
                  <span className="sdot" style={{ background: sm.dot }} /> {sm.label} <Icon name="ti-chevron-down" className="cm-qp-caret" />
                </button>
                {pick === 'status' ? (
                  <div className="cm-qp-pop">
                    {mergedStages(customStages, stageLabels, stageOrder).map(st => (
                      <button key={st.id} className={`cm-qp-opt${node.status === st.id ? ' on' : ''}`} onClick={() => { useStore.getState().setStatus(node.id, st.id as Status); setPick(null) }}>
                        <span className="sdot" style={{ background: st.dot }} /> {st.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="cm-qp-wrap">
                <button className="cm-qp" onClick={() => setPick(p => (p === 'priority' ? null : 'priority'))}>
                  <Icon name="ti-flag" className="cm-qp-lead" />
                  {node.priority ? PRIORITY_META[node.priority].label : 'Priority'}
                  <Icon name="ti-chevron-down" className="cm-qp-caret" />
                </button>
                {pick === 'priority' ? (
                  <div className="cm-qp-pop">
                    <button className={`cm-qp-opt${!node.priority ? ' on' : ''}`} onClick={() => { useStore.getState().patch(node.id, { priority: undefined }); setPick(null) }}>
                      <span className="sdot" style={{ background: 'var(--dot)' }} /> None
                    </button>
                    {PRIORITIES.map(p => (
                      <button key={p} className={`cm-qp-opt${node.priority === p ? ' on' : ''}`} onClick={() => { useStore.getState().patch(node.id, { priority: p }); setPick(null) }}>
                        <span className="sdot" style={{ background: COLORS[PRIORITY_META[p].color] }} /> {PRIORITY_META[p].label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <SizePicker node={node} />

              <div className="cm-qp-wrap">
                <button
                  className={`cm-qp cm-qp-due${node.dueDate ? ' set' : ''}`}
                  onClick={() => setPick(p => (p === 'due' ? null : 'due'))}
                  aria-label="Due date"
                >
                  <Icon name="ti-clock" className="cm-qp-lead" />
                  <span>{node.dueDate || 'Due date'}</span>
                  <Icon name="ti-chevron-down" className="cm-qp-caret" />
                </button>
                {pick === 'due' ? (
                  <DatePicker
                    value={node.dueDate}
                    onChange={due => useStore.getState().patch(node.id, { dueDate: due })}
                    onClose={() => setPick(null)}
                  />
                ) : null}
              </div>

              <div className="cm-qp-wrap">
                <button className="cm-qp" onClick={() => setPick(p => (p === 'color' ? null : 'color'))}>
                  <span className="cm-qp-sw" style={curColor ? { background: hex(curColor) } : undefined} />
                  <span style={{ textTransform: 'capitalize' }}>{curColor ?? 'Color'}</span>
                  <Icon name="ti-chevron-down" className="cm-qp-caret" />
                </button>
                {pick === 'color' ? (
                  <div className="cm-qp-pop cm-swatches">
                    {!isContainer ? (
                      <button className={`cm-sw cm-sw-auto${!node.labelColor ? ' on' : ''}`} onClick={() => { useStore.getState().patch(node.id, { labelColor: undefined }); setPick(null) }} title="Match status"><Icon name="ti-circle-dashed" /></button>
                    ) : null}
                    {SWATCHES.map(c => (
                      <button key={c} className={`cm-sw${curColor === c ? ' on' : ''}`} style={{ background: COLORS[c] }} onClick={() => { useStore.getState().patch(node.id, isContainer ? { color: c } : { labelColor: c }); setPick(null) }} aria-label={c} />
                    ))}
                    <label className={`cm-sw cm-sw-custom${curColor?.startsWith('#') ? ' on' : ''}`} title="Custom color" style={curColor?.startsWith('#') ? { background: curColor } : undefined}>
                      {!curColor?.startsWith('#') ? <Icon name="ti-color-picker" /> : null}
                      <input type="color" value={curColor?.startsWith('#') ? curColor : '#7c6cf0'} onChange={e => useStore.getState().patch(node.id, isContainer ? { color: e.target.value } : { labelColor: e.target.value })} />
                    </label>
                  </div>
                ) : null}
              </div>

              {tags.map(t => (
                <span key={t.name} className="cm-tag cm-qp-tag">
                  <Tag tag={t} />
                  <button onClick={() => useStore.getState().patch(node.id, { tags: tags.filter(x => x.name !== t.name) })} aria-label={`Remove ${t.name}`}><Icon name="ti-x" /></button>
                </span>
              ))}
              <div className="cm-qp-wrap">
                <button className="cm-tag-add" onClick={() => setPick(p => (p === 'tags' ? null : 'tags'))}>+ Tag</button>
                {pick === 'tags' ? (
                  <>
                    <div className="cm-menu-backdrop" onClick={() => setPick(null)} />
                    <div className="cm-qp-pop cm-tagpop" onClick={e => e.stopPropagation()}>
                      {availableTags.map(t => (
                        <button key={t.name} className="cm-qp-opt" onClick={() => applyTag(t)}>
                          <span className="cm-tagdot" style={{ background: hex(t.color) }} /> {t.name}
                        </button>
                      ))}
                      {availableTags.length === 0 ? <div className="cm-tagpop-empty">No more saved tags — create one.</div> : null}
                      <div className="cm-menu-sep" />
                      <div className="cm-tagnew">
                        <input
                          className="cm-tagnew-input"
                          placeholder="New tag name…"
                          value={newTag}
                          onChange={e => setNewTag(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') createTag() }}
                        />
                        <div className="cm-tagnew-sw">
                          {SWATCHES.map(c => (
                            <button key={c} className={`cm-sw${newTagColor === c ? ' on' : ''}`} style={{ background: COLORS[c] }} onClick={() => setNewTagColor(c)} aria-label={c} />
                          ))}
                        </div>
                        <button className="cm-add-btn" onClick={createTag}>Add tag</button>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </div>

            <Dependencies node={node} />

            <section className="cm-sec">
              <div className="cm-sec-h"><Icon name="ti-align-left" /> Description</div>
              <RichText
                key={node.id}
                initial={node.description}
                onChange={html => useStore.getState().patch(node.id, { description: html })}
                placeholder="Add a more detailed description…"
              />
            </section>

            <section className="cm-sec">
              <div className="cm-sec-h">
                <Icon name="ti-paperclip" /> Attachments
                {attachments.length > 0 ? <span className="cm-sec-count">{attachments.length}</span> : null}
              </div>
              <div className="cm-atts">
                {attachments.map(a => (
                  a.type.startsWith('image/') ? (
                    <div key={a.id} className="cm-att cm-att-img">
                      <img src={a.dataUrl} alt={a.name} onClick={() => openAttachment(a)} style={{ cursor: 'zoom-in' }} />
                      <button className="cm-att-dl" onClick={() => downloadAttachment(a)} aria-label="Download" title="Download"><Icon name="ti-download" /></button>
                      <button className="cm-att-del" onClick={() => useStore.getState().removeAttachment(node.id, a.id)} aria-label="Remove"><Icon name="ti-x" /></button>
                    </div>
                  ) : (
                    <div key={a.id} className="cm-att cm-att-file">
                      <button className="cm-att-open" onClick={() => openAttachment(a)} title="Open preview">
                        <span className="cm-att-ic"><Icon name="ti-file-text" /></span>
                        <span className="cm-att-info">
                          <span className="cm-att-name">{a.name}</span>
                          <span className="cm-att-type">{(a.name.split('.').pop() || 'file').toUpperCase()}</span>
                        </span>
                      </button>
                      <button className="cm-att-dl" onClick={() => downloadAttachment(a)} aria-label="Download" title="Download"><Icon name="ti-download" /></button>
                      <button className="cm-att-del" onClick={() => useStore.getState().removeAttachment(node.id, a.id)} aria-label="Remove"><Icon name="ti-x" /></button>
                    </div>
                  )
                ))}
                <label className="cm-att-add">
                  <Icon name="ti-plus" /> Add file
                  <input type="file" multiple hidden onChange={onAttach} />
                </label>
              </div>
            </section>

            <section className="cm-sec">
              <div className="cm-sec-h">
                <Icon name="ti-checklist" /> Checklist
                {children.length > 0 ? <span className="cm-sec-count">{doneChildren}/{children.length}</span> : null}
                <div className="cm-tpl-wrap">
                  <button ref={tplBtnRef} className="cm-sec-btn" onClick={toggleTpl}>
                    <Icon name="ti-template" /> Templates <Icon name="ti-chevron-down" className="cm-qp-caret" />
                  </button>
                  {clTpl ? createPortal(
                    <>
                      <div className="cm-tpl-backdrop" onClick={() => setClTpl(false)} />
                      <div
                        className="cm-tpl-menu cm-tpl-menu-fixed"
                        onClick={e => e.stopPropagation()}
                        style={tplPos ? { bottom: tplPos.bottom, right: tplPos.right, maxHeight: tplPos.maxH } : undefined}
                      >
                        <div className="cm-tpl-search-wrap">
                          <Icon name="ti-search" className="cm-tpl-search-ic" />
                          <input
                            className="cm-tpl-search"
                            autoFocus
                            placeholder="Search checklists, projects, templates…"
                            value={tplQuery}
                            onChange={e => setTplQuery(e.target.value)}
                          />
                        </div>
                        <div className="cm-tpl-scroll">
                          {builtinSources.length ? <div className="cm-tpl-group">Checklist templates</div> : null}
                          {builtinSources.map(renderClSource)}
                          {projFiltered.length ? <div className="cm-tpl-group">From your projects</div> : null}
                          {projFiltered.map(renderClSource)}
                          {templateSources.length ? <div className="cm-tpl-group">Project templates</div> : null}
                          {templateSources.map(renderClSource)}
                          {noClMatches ? <div className="cm-tpl-empty">No matches{q ? ` for “${tplQuery.trim()}”` : ''}.</div> : null}
                        </div>
                      </div>
                    </>,
                    document.body,
                  ) : null}
                </div>
              </div>
              {children.length > 0 ? (
                <ProgressBar node={node} className="cm-checkbar" />
              ) : null}
              <div className="cm-checks">
                <ChecklistTree root={node} color={color} />
              </div>
              <div className="cm-add">
                <Icon name="ti-plus" />
                <input
                  placeholder="Add an item…"
                  value={item}
                  onChange={e => setItem(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addItem() }}
                />
                {item.trim() ? <button className="cm-add-btn" onClick={addItem}>Add</button> : null}
              </div>
            </section>

          </div>

          <aside className="cm-rail">
            <div className="cm-rail-h">
              <span className="cm-rail-t"><Icon name="ti-message-2" /> Comments and activity</span>
              <button className="cm-rail-toggle" onClick={() => setDetails(d => !d)}>{details ? 'Hide details' : 'Show details'}</button>
            </div>
            <div className="cm-compose">
              <Avatar />
              <div className="cm-compose-box">
                <textarea
                  placeholder="Write a comment…"
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  rows={2}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addComment() }}
                />
                {comment.trim() ? <button className="cm-add-btn" onClick={addComment}>Comment</button> : null}
              </div>
            </div>
            <div className="cm-comments">
              {feed.map(f => f.kind === 'comment' ? (
                <div key={f.c.id} className="cm-comment">
                  <Avatar />
                  <div className="cm-comment-body">
                    <div className="cm-comment-meta"><b>{userName}</b><span>{ago(f.c.at)}</span></div>
                    <div className="cm-comment-text" dangerouslySetInnerHTML={{ __html: linkifyText(f.c.text) }} />
                  </div>
                  <button className="cm-check-del" onClick={() => useStore.getState().removeComment(node.id, f.c.id)} aria-label="Delete comment"><Icon name="ti-trash" /></button>
                </div>
              ) : (
                <div key={f.a.id} className="cm-act"><span className="cm-act-dot" /><span>{f.a.text} · {ago(f.a.at)}</span></div>
              ))}
              {details ? (
                <>
                  <div className="cm-act"><span className="cm-act-dot" /><span><b>{node.shortId}</b> · created {fmtDate(node.createdAt)}</span></div>
                  <div className="cm-act"><span className="cm-act-dot" /><span>updated {ago(node.updatedAt)}</span></div>
                </>
              ) : null}
              {feed.length === 0 && !details ? (
                <div className="cm-comment-empty">No activity yet. Add a comment, tick items, or make changes — they’ll show up here.</div>
              ) : null}
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
