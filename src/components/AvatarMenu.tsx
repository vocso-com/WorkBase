import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { useSettings } from '../hooks/useSettings'
import { Icon } from './ui/Icon'

export function AvatarMenu({ onExport, onImport }: { onExport: () => void; onImport: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const profile = useStore(s => s.doc.profile)
  const name = profile?.userName?.trim() || 'You'
  const initials = name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'U'
  const avatarStyle: React.CSSProperties = profile?.userAvatar
    ? { backgroundImage: `url(${profile.userAvatar})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : {}

  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        aria-label="account menu"
        onClick={() => setOpen(o => !o)}
        style={{
          width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#1d9e75,#3b82c4)',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
          fontWeight: 600, cursor: 'pointer', boxShadow: 'var(--shadow-sm)', border: '2px solid var(--card)',
          padding: 0, ...avatarStyle,
        }}
      >
        {profile?.userAvatar ? '' : initials}
      </button>
      {open && (
        <div
          style={{
            position: 'absolute', right: 0, top: 42, width: 210, background: 'var(--card)', borderRadius: 12,
            boxShadow: 'var(--shadow)', padding: 6, zIndex: 40, border: '1px solid var(--line)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px 10px', borderBottom: '1px solid var(--line)', marginBottom: 4 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#1d9e75,#3b82c4)',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, ...avatarStyle,
            }}>
              {profile?.userAvatar ? '' : initials}
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{name}</div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{profile?.orgName || 'Local workspace'}</div>
            </div>
          </div>
          <div className="avatar-menu-item" onClick={() => { setOpen(false); useSettings.getState().show() }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 8px', borderRadius: 8, fontSize: 13.5, color: 'var(--ink)', cursor: 'pointer' }}>
            <Icon name="ti-settings" style={{ fontSize: 17, color: 'var(--muted)' }} /> Settings
          </div>
          <div className="avatar-menu-item" onClick={() => { setOpen(false); onExport() }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 8px', borderRadius: 8, fontSize: 13.5, color: 'var(--ink)', cursor: 'pointer' }}>
            <Icon name="ti-upload" style={{ fontSize: 17, color: 'var(--muted)' }} /> Export data
          </div>
          <div className="avatar-menu-item" onClick={() => { setOpen(false); onImport() }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 8px', borderRadius: 8, fontSize: 13.5, color: 'var(--ink)', cursor: 'pointer' }}>
            <Icon name="ti-download" style={{ fontSize: 17, color: 'var(--muted)' }} /> Import data
          </div>
          <div className="avatar-menu-item" onClick={() => setOpen(false)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 8px', borderRadius: 8, fontSize: 13.5, color: 'var(--ink)', cursor: 'pointer' }}>
            <Icon name="ti-info-circle" style={{ fontSize: 17, color: 'var(--muted)' }} /> About Manage
          </div>
        </div>
      )}
    </div>
  )
}
