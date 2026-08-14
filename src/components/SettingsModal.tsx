import { useEffect, useState } from 'react'
import { getCloud, setCloud, uploadFile } from '../lib/uploads'
import { useStore } from '../store/useStore'
import { useSettings } from '../hooks/useSettings'
import { Icon } from './ui/Icon'

export function SettingsModal() {
  const open = useSettings(s => s.open)
  const hide = useSettings(s => s.hide)
  const profile = useStore(s => s.doc.profile)
  const [endpoint, setEndpoint] = useState('')
  const [token, setToken] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!open) return
    const c = getCloud()
    setEndpoint(c?.endpoint ?? '')
    setToken(c?.token ?? '')
    setSaved(false)
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
  const saveCloud = () => { setCloud(endpoint.trim() ? { endpoint, token } : null); setSaved(true); setTimeout(() => setSaved(false), 1500) }

  return (
    <div className="modal-overlay" onClick={hide}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <div className="modal-title">Settings</div>
            <div className="modal-desc">Profile, workspace, and image storage.</div>
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
            <div className="set-sec-h">Cloud image storage (Cloudflare R2)</div>
            <label className="modal-field"><span>Worker URL</span>
              <input value={endpoint} onChange={e => setEndpoint(e.target.value)} placeholder="https://manage-uploads.you.workers.dev" />
            </label>
            <label className="modal-field"><span>Upload token</span>
              <input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="UPLOAD_TOKEN" />
            </label>
            <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
              <button className="newbtn" onClick={saveCloud}><Icon name={saved ? 'ti-check' : 'ti-device-floppy'} /> {saved ? 'Saved' : 'Save'}</button>
              <button className="ghostbtn" onClick={() => { setCloud(null); setEndpoint(''); setToken('') }}><Icon name="ti-folder" /> Use local storage</button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12, lineHeight: 1.5 }}>
              Deploy the Worker in <code style={{ background: 'var(--chip)', padding: '1px 5px', borderRadius: 5 }}>worker/</code> (see its README). Until configured, images are stored inline and work offline.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
