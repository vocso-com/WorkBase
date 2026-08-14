import { useEffect, useState } from 'react'
import type { ColorKey, Priority, Status } from '../types'
import { COLORS, ICON_CHOICES, PRIORITY_META, hex, mergedStages, stageMeta } from '../theme'
import { useStore } from '../store/useStore'
import { useDetail } from '../hooks/useDetail'
import { useNav } from '../hooks/useNav'
import { findNode, findParent, leaves } from '../lib/tree'
import { progressOf, statusCounts } from '../lib/progress'
import { tagBg, tagFg } from '../lib/colorMode'
import { uploadFile } from '../lib/uploads'
import { askConfirm } from '../hooks/useConfirm'
import { RichText } from './RichText'
import { Icon } from './ui/Icon'
import { Tag } from './ui/Tag'
import { Checkbox } from './ui/Checkbox'

const PRIORITIES: Priority[] = ['low', 'med', 'high']

const SWATCHES: ColorKey[] = ['blue', 'indigo', 'violet', 'pink', 'coral', 'red', 'amber', 'lime', 'teal', 'cyan', 'slate', 'gray']

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function ago(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 45) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`
  return new Date(iso).toLocaleDateString()
}

export function CardModal() {
  const openId = useDetail(s => s.openId)
  const roots = useStore(s => s.doc.roots)
  const tagPalette = useStore(s => s.doc.tagPalette)
  const customStages = useStore(s => s.doc.stages)
  const node = openId ? findNode(roots, openId) : null

  const [item, setItem] = useState('')
  const [comment, setComment] = useState('')
  const [pick, setPick] = useState<'status' | 'priority' | 'color' | 'icon' | null>(null)
  const [menu, setMenu] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [moveQuery, setMoveQuery] = useState('')

  useEffect(() => {
    setItem('')
    setComment('')
    setPick(null)
    setMenu(false)
    setMoveOpen(false)
    setMoveQuery('')
    if (!openId) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') useDetail.getState().close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openId])

  if (!openId || !node) return null

  const color = node.labelColor ?? node.color ?? 'gray'
  const sm = stageMeta(customStages, node.status)
  const parent = findParent(roots, node.id)
  const isProject = roots.some(r => r.id === node.id)
  const children = node.children
  const isContainer = children.length > 0
  const doneChildren = children.filter(c => (c.children.length > 0 ? progressOf(c) === 100 : c.status === 'done')).length
  const comments = node.comments ?? []
  const attachments = node.attachments ?? []
  const tags = node.tags ?? []
  const availableTags = tagPalette.filter(t => !tags.some(nt => nt.name === t.name))

  const close = () => useDetail.getState().close()

  const addItem = () => {
    const t = item.trim()
    if (!t) return
    useStore.getState().addChildNode(node.id, t)
    setItem('')
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
  const del = () => {
    const id = node.id
    const title = node.title
    askConfirm({
      title: 'Delete',
      message: `Delete "${title}" and all its sub-items? This can't be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => {
        useStore.getState().remove(id)
        close()
        if (useNav.getState().path.includes(id)) useNav.getState().home()
      },
    })
  }

  // Reparent targets: every node except this node, its descendants, and its
  // current parent (a no-op).
  const blocked = new Set<string>()
  const markSub = (n: typeof node) => { blocked.add(n.id); n.children.forEach(markSub) }
  markSub(node)
  const moveTargets: { id: string; label: string }[] = []
  const walkTargets = (n: typeof node, trail: string[]) => {
    if (!blocked.has(n.id) && n.id !== parent?.id) moveTargets.push({ id: n.id, label: [...trail, n.title].join(' › ') })
    n.children.forEach(c => walkTargets(c, [...trail, n.title]))
  }
  roots.forEach(r => walkTargets(r, []))
  const moveTo = (value: string) => {
    if (!value) return
    useStore.getState().move(node.id, value === '__root__' ? null : value, 99999)
  }

  return (
    <div className="card-overlay" onClick={close}>
      <div className="cardmodal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div
          className={`cm-band${node.image ? ' cm-band-img' : ''}`}
          style={node.image
            ? { backgroundImage: `url(${node.image})` }
            : { background: `linear-gradient(120deg, ${hex(color)}, ${hex(color)}bb)` }}
        >
          {!node.image ? <div className="cm-band-ic"><Icon name={node.icon ?? (children.length ? 'ti-stack-2' : 'ti-checkbox')} /></div> : null}
          <div className="cm-crumb">
            {parent ? <><span>{parent.title}</span><Icon name="ti-chevron-right" /></> : null}
            <span className="cm-id">{node.shortId}</span>
          </div>
          <div className="cm-band-actions">
            <label className="cm-band-btn" title={node.image ? 'Change image' : 'Upload cover / logo'}>
              <Icon name="ti-photo" />
              <input type="file" accept="image/*" hidden onChange={onCover} />
            </label>
            {node.image ? (
              <button className="cm-band-btn" onClick={() => useStore.getState().patch(node.id, { image: undefined })} title="Remove image"><Icon name="ti-photo-off" /></button>
            ) : null}
            <div className="cm-menu-wrap">
              <button className="cm-band-btn" onClick={() => setMenu(m => !m)} aria-label="More actions"><Icon name="ti-dots" /></button>
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
                        <button className="cm-menu-item cm-menu-danger" onClick={() => { setMenu(false); del() }}><Icon name="ti-trash" /> Delete {isProject ? 'project' : children.length ? 'module' : 'task'}</button>
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
                            <button key={t.id} className="cm-menu-item" onClick={() => { moveTo(t.id); setMenu(false); setMoveOpen(false) }}>{t.label}</button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
            <button className="cm-band-btn" onClick={close} aria-label="Close"><Icon name="ti-x" /></button>
          </div>
        </div>

        <div className="cm-titlerow">
          <input
            aria-label="Title"
            className="cm-title"
            value={node.title}
            onChange={e => useStore.getState().rename(node.id, e.target.value)}
          />
          <span className="cm-statuspill" style={{ background: tagBg(sm.color), color: tagFg(sm.color) }}>
            <span className="sdot" style={{ background: sm.dot }} /> {sm.label}
          </span>
        </div>

        <div className="cm-body cm-body-wide">
          <div className="cm-main">
            <div className="cm-quickprops">
              <div className="cm-qp-wrap">
                <button className="cm-qp" onClick={() => setPick(p => (p === 'status' ? null : 'status'))}>
                  <span className="sdot" style={{ background: sm.dot }} /> {sm.label} <Icon name="ti-chevron-down" className="cm-qp-caret" />
                </button>
                {pick === 'status' ? (
                  <div className="cm-qp-pop">
                    {mergedStages(customStages).map(st => (
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

              <label className={`cm-qp cm-qp-due${node.dueDate ? ' set' : ''}`}>
                <Icon name="ti-clock" className="cm-qp-lead" />
                <span>{node.dueDate || 'Due date'}</span>
                <input type="date" aria-label="Due date" value={node.dueDate ?? ''} onChange={e => useStore.getState().patch(node.id, { dueDate: e.target.value })} />
              </label>

              <div className="cm-qp-wrap">
                {(() => {
                  const curColor = isContainer ? node.color : node.labelColor
                  return (
                    <>
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
                    </>
                  )
                })()}
              </div>

              {isContainer ? (
                <div className="cm-qp-wrap">
                  <button className="cm-qp" onClick={() => setPick(p => (p === 'icon' ? null : 'icon'))}>
                    <span className="cm-qp-ic" style={{ background: tagBg(color), color: tagFg(color) }}><Icon name={node.icon ?? 'ti-folder'} /></span>
                    Icon <Icon name="ti-chevron-down" className="cm-qp-caret" />
                  </button>
                  {pick === 'icon' ? (
                    <div className="cm-qp-pop cm-icons">
                      {ICON_CHOICES.map(ic => (
                        <button key={ic} className={`cm-ic${(node.icon ?? 'ti-folder') === ic ? ' on' : ''}`} onClick={() => { useStore.getState().patch(node.id, { icon: ic }); setPick(null) }} aria-label={ic}><Icon name={ic} /></button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {tags.map(t => (
                <span key={t.name} className="cm-tag cm-qp-tag">
                  <Tag tag={t} />
                  <button onClick={() => useStore.getState().patch(node.id, { tags: tags.filter(x => x.name !== t.name) })} aria-label={`Remove ${t.name}`}><Icon name="ti-x" /></button>
                </span>
              ))}
              {availableTags.length > 0 ? (
                <select className="cm-tag-add" aria-label="Add tag" value="" onChange={e => { const pt = tagPalette.find(t => t.name === e.target.value); if (pt) useStore.getState().patch(node.id, { tags: [...tags, pt] }) }}>
                  <option value="">+ Tag</option>
                  {availableTags.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                </select>
              ) : null}
            </div>

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
                      <img src={a.dataUrl} alt={a.name} />
                      <button className="cm-att-del" onClick={() => useStore.getState().removeAttachment(node.id, a.id)} aria-label="Remove"><Icon name="ti-x" /></button>
                    </div>
                  ) : (
                    <div key={a.id} className="cm-att cm-att-file">
                      <Icon name="ti-file" />
                      <span className="cm-att-name">{a.name}</span>
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
              </div>
              {children.length > 0 ? (
                <div className="cm-checkbar"><span style={{ width: `${progressOf(node)}%`, background: hex(color) }} /></div>
              ) : null}
              <div className="cm-checks">
                {children.map(c => {
                  const cc = c.labelColor ?? c.color ?? color
                  const del = (
                    <button className="cm-check-del" onClick={() => useStore.getState().remove(c.id)} aria-label="Delete item"><Icon name="ti-trash" /></button>
                  )
                  if (c.children.length > 0) {
                    const pc = progressOf(c)
                    const total = leaves(c).filter(l => l.id !== c.id).length
                    const done = statusCounts(c).done
                    return (
                      <div key={c.id} className="cm-check cm-check-mod" onClick={() => useDetail.getState().open(c.id)}>
                        <span className="cm-check-t">{c.title}</span>
                        <div className="cm-check-bar"><span style={{ width: `${pc}%`, background: hex(cc) }} /></div>
                        <span className="cm-check-count">{done}/{total}</span>
                        {del}
                      </div>
                    )
                  }
                  return (
                    <div key={c.id} className={`cm-check${c.status === 'done' ? ' done' : ''}`}>
                      <Checkbox status={c.status} color={cc} onToggle={() => useStore.getState().toggleDone(c.id)} />
                      <span className="cm-check-t" onClick={() => useDetail.getState().open(c.id)}>{c.title}</span>
                      {c.priority ? (
                        <span className="tprio" style={{ background: tagBg(PRIORITY_META[c.priority].color), color: tagFg(PRIORITY_META[c.priority].color) }}>{PRIORITY_META[c.priority].label}</span>
                      ) : null}
                      {(c.tags ?? []).map(t => <Tag key={t.name} tag={t} />)}
                      {del}
                    </div>
                  )
                })}
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
            <div className="cm-rail-h"><Icon name="ti-message-2" /> Comments &amp; activity</div>
            <div className="cm-compose">
              <span className="cm-av">D</span>
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
              {comments.slice().reverse().map(c => (
                <div key={c.id} className="cm-comment">
                  <span className="cm-av">D</span>
                  <div className="cm-comment-body">
                    <div className="cm-comment-meta"><b>You</b><span>{ago(c.at)}</span></div>
                    <div className="cm-comment-text">{c.text}</div>
                  </div>
                  <button className="cm-check-del" onClick={() => useStore.getState().removeComment(node.id, c.id)} aria-label="Delete comment"><Icon name="ti-trash" /></button>
                </div>
              ))}
              <div className="cm-act"><span className="cm-act-dot" /><span><b>{node.shortId}</b> · created {fmtDate(node.createdAt)}</span></div>
              <div className="cm-act"><span className="cm-act-dot" /><span>updated {ago(node.updatedAt)}</span></div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
