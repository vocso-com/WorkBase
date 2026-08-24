import { useEffect, useMemo } from 'react'
import { useStore } from '../store/useStore'
import { useAbout } from '../hooks/useAbout'
import { useTransfer } from '../hooks/useTransfer'
import { APP_VERSION } from '../lib/version'
import { isTauri } from '../lib/platform'
import { serialize } from '../lib/serialize'
import { leaves } from '../lib/tree'
import { Icon } from './ui/Icon'

const humanSize = (bytes: number): string =>
  bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`

/**
 * What this is, which version, and — the part people actually open this for —
 * where their data lives and how to get it out.
 */
export function AboutModal() {
  const open = useAbout(s => s.open)
  const hide = useAbout(s => s.hide)
  const doc = useStore(s => s.doc)
  const profile = doc.profile

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') hide() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, hide])

  const stats = useMemo(() => {
    if (!open) return null
    return {
      size: new Blob([serialize(doc)]).size,
      projects: doc.roots.length,
      tasks: doc.roots.reduce((a, r) => a + leaves(r).length, 0),
      workspaces: doc.workspaces.length,
    }
  }, [open, doc])

  if (!open || !stats) return null

  const where = isTauri()
    ? 'On this Mac, in WorkBase’s application data folder.'
    : 'In this browser’s local storage on this device.'

  return (
    <div className="modal-overlay" onClick={hide}>
      <div className="modal about" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="modal-x" onClick={hide} aria-label="Close"><Icon name="ti-x" /></button>

        <div className="about-head">
          <img className="about-mark" src="/workbase-logo.png" alt="" />
          <div>
            <div className="about-name">WorkBase</div>
            <div className="about-ver">Version {APP_VERSION}{isTauri() ? ' · Desktop' : ' · Web'}</div>
          </div>
        </div>

        <p className="about-blurb">
          Projects as a shape you can see — phases, tasks and the links between them, on one canvas.
        </p>

        <div className="about-stats">
          <div><b>{stats.projects}</b><span>project{stats.projects === 1 ? '' : 's'}</span></div>
          <div><b>{stats.tasks}</b><span>task{stats.tasks === 1 ? '' : 's'}</span></div>
          <div><b>{stats.workspaces}</b><span>WorkBase{stats.workspaces === 1 ? '' : 's'}</span></div>
          <div><b>{humanSize(stats.size)}</b><span>stored</span></div>
        </div>

        <div className="about-row">
          <Icon name="ti-lock" />
          <div>
            <b>Your data stays on this device</b>
            <span>{where} Nothing is uploaded — no account needed to use it.</span>
          </div>
        </div>

        {profile?.userEmail ? (
          <div className="about-row">
            <Icon name="ti-user" />
            <div>
              <b>{profile.userEmail}</b>
              <span>Stored on this device only</span>
            </div>
          </div>
        ) : null}

        <div className="about-actions">
          <button className="ghostbtn" onClick={() => { hide(); useTransfer.getState().showImport() }}>Import data</button>
          <button className="newbtn" onClick={() => { hide(); useTransfer.getState().showAccountExport() }}>Export your data</button>
        </div>

        <div className="about-legal">
          © {new Date().getFullYear()} VOCSO Technologies Pvt Ltd · vocso.com
        </div>
      </div>
    </div>
  )
}
