import { useEffect } from 'react'
import { uploadFile } from '../lib/uploads'
import { useStore } from '../store/useStore'
import { useSettings } from '../hooks/useSettings'
import { VOCAB, VOCAB_KEYS } from '../lib/vocab'
import { Icon } from './ui/Icon'

const DEFAULT_VIEW_OPTS: { key: NonNullable<import('../types').Profile['defaultView']>; label: string; icon: string }[] = [
  { key: 'board', label: 'Board', icon: 'ti-layout-grid' },
  { key: 'kanban', label: 'Kanban', icon: 'ti-layout-kanban' },
  { key: 'flow', label: 'Flow', icon: 'ti-sitemap' },
  { key: 'columns', label: 'Outline', icon: 'ti-layout-sidebar' },
]

export function SettingsModal() {
  const open = useSettings(s => s.open)
  const hide = useSettings(s => s.hide)
  const profile = useStore(s => s.doc.profile)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') hide() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, hide])

  if (!open) return null

  const onImg = (key: 'userAvatar' | 'orgLogo') => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try {
      const url = await uploadFile(f)
      useStore.getState().setProfile({ [key]: url })
    } catch (err) { alert((err as Error).message) }
  }

  return (
    <div className="modal-overlay" onClick={hide}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <div className="modal-title">Settings</div>
            <div className="modal-desc">Profile, reminders, and privacy.</div>
          </div>
          <button className="modal-x" onClick={hide} aria-label="Close"><Icon name="ti-x" /></button>
        </div>
        <div className="modal-body">
          <div className="set-sec">
            <div className="set-sec-h">Your profile</div>
            <div className="set-row">
              <label className="set-avatar" title="Upload photo">
                {profile?.userAvatar ? <img src={profile.userAvatar} alt="" /> : <span>{(profile?.userName || 'You').trim().charAt(0).toUpperCase()}</span>}
                <span className="set-avatar-edit"><Icon name="ti-camera" /></span>
                <input type="file" accept="image/*" hidden onChange={onImg('userAvatar')} />
              </label>
              <input className="set-input" placeholder="Your name" value={profile?.userName ?? ''} onChange={e => useStore.getState().setProfile({ userName: e.target.value })} />
            </div>
          </div>

          <div className="set-sec">
            <div className="set-sec-h">Workspace</div>
            <div className="set-row">
              <label className="set-avatar set-logo" title="Upload logo">
                {profile?.orgLogo ? <img src={profile.orgLogo} alt="" /> : <Icon name="ti-building" />}
                <span className="set-avatar-edit"><Icon name="ti-camera" /></span>
                <input type="file" accept="image/*" hidden onChange={onImg('orgLogo')} />
              </label>
              <input className="set-input" placeholder="Organization name" value={profile?.orgName ?? ''} onChange={e => useStore.getState().setProfile({ orgName: e.target.value })} />
            </div>
          </div>

          <div className="set-sec">
            <div className="set-sec-h">Vocabulary</div>
            <div className="set-vocab">
              {VOCAB_KEYS.map(k => {
                const vk = VOCAB[k]
                const on = (profile?.vocab ?? 'general') === k
                return (
                  <button key={k} className={`set-vocab-opt${on ? ' on' : ''}`} onClick={() => useStore.getState().setProfile({ vocab: k })}>
                    <span className="set-vocab-name">{vk.label}</span>
                    <span className="set-vocab-hint">{vk.hint}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="set-sec">
            <div className="set-sec-h">Default view</div>
            <div className="set-hint">The view a project opens in when it has no view of its own.</div>
            <div className="set-views">
              {DEFAULT_VIEW_OPTS.map(o => {
                const on = (profile?.defaultView ?? 'board') === o.key
                return (
                  <button key={o.key} className={`set-view-opt${on ? ' on' : ''}`} onClick={() => useStore.getState().setProfile({ defaultView: o.key })}>
                    <Icon name={o.icon} />
                    <span>{o.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="set-sec">
            <div className="set-sec-h">Desktop nudge</div>
            <div className="set-hint">A small sticky card in the bottom-right corner.</div>
            <label className="set-toggle">
              <input type="checkbox" checked={profile?.nudgeReminders !== false} onChange={e => useStore.getState().setProfile({ nudgeReminders: e.target.checked })} />
              <span className="set-toggle-track"><span className="set-toggle-knob" /></span>
              <span className="set-toggle-txt"><b>Reminders</b><span>Overdue &amp; due-today tasks</span></span>
            </label>
            <label className="set-toggle">
              <input type="checkbox" checked={!!profile?.nudgeMyWork} onChange={e => useStore.getState().setProfile({ nudgeMyWork: e.target.checked })} />
              <span className="set-toggle-track"><span className="set-toggle-knob" /></span>
              <span className="set-toggle-txt"><b>My Work nudge</b><span>A soft summary of what to do next</span></span>
            </label>
            <label className="set-toggle">
              <input type="checkbox" checked={profile?.soundsEnabled !== false} onChange={e => useStore.getState().setProfile({ soundsEnabled: e.target.checked })} />
              <span className="set-toggle-track"><span className="set-toggle-knob" /></span>
              <span className="set-toggle-txt"><b>Sounds</b><span>A chime when you finish a task or a reminder pops</span></span>
            </label>
          </div>

          <div className="set-sec">
            <div className="set-sec-h">Storage &amp; privacy</div>
            <div className="set-privacy">
              <Icon name="ti-lock" />
              <div>
                <b>Everything stays on this device.</b>
                <span>Your projects, tasks and images are saved locally in WorkBase's app data — no account, no cloud, nothing leaves your machine. Use Export from the menu to back up or move your data.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
