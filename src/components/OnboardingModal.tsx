import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import { useOnboarding } from '../hooks/useOnboarding'

/**
 * First run: ask who this is, then get out of the way. Everything captured here
 * is written to the local document and never leaves the device — there is no
 * account, no sign-in and nothing to verify. The "You are…" answer is the one
 * field the app actually uses, to pick which sample project to seed.
 */
export function OnboardingModal() {
  const open = useOnboarding(s => s.open)
  const hide = useOnboarding(s => s.hide)
  const profile = useStore(s => s.doc.profile)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [org, setOrg] = useState('')
  const [userType, setUserType] = useState('')

  useEffect(() => {
    if (!open) return
    setName(profile?.userName ?? '')
    setEmail(profile?.userEmail ?? '')
    setOrg(profile?.orgName ?? '')
    setUserType(profile?.userType ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  const save = () => {
    useStore.getState().setProfile({
      userName: name.trim() || undefined,
      userEmail: email.trim() || undefined,
      orgName: org.trim() || undefined,
      userType: userType || undefined,
      onboarded: true,
    })
    hide()
  }

  return (
    <div className="modal-overlay" onClick={hide}>
      <div className="modal onb" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="onb-brand">
          <img className="onb-logo" src="/workbase-logo.png" alt="" />
          <div className="onb-brand-txt">WorkBase</div>
        </div>

        <div className="onb-title">Welcome — let’s set you up</div>
        <div className="onb-sub">Tell us who you are. All of it stays on this device.</div>
        <label className="onb-field">
          <span>Your name</span>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Doe" autoFocus />
        </label>
        <label className="onb-field">
          <span>Email <span className="onb-opt">(optional)</span></span>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="you@company.com"
            onKeyDown={e => { if (e.key === 'Enter') save() }} />
        </label>
        <label className="onb-field">
          <span>Organization <span className="onb-opt">(optional)</span></span>
          <input value={org} onChange={e => setOrg(e.target.value)} placeholder="Acme Studio" />
        </label>
        <label className="onb-field">
          <span>You are… <span className="onb-opt">(pick or type)</span></span>
          <input list="wb-usertypes" value={userType} onChange={e => setUserType(e.target.value)} placeholder="e.g. Agency" />
          <datalist id="wb-usertypes">
            <option value="Agency" />
            <option value="Consultant" />
            <option value="Freelancer" />
            <option value="In-house team" />
            <option value="Startup" />
            <option value="Enterprise" />
            <option value="Developer" />
            <option value="Designer" />
            <option value="Marketer" />
            <option value="Product manager" />
            <option value="Personal use" />
          </datalist>
        </label>
        <button className="onb-primary" onClick={save}>Continue</button>
        <button className="onb-skip" onClick={() => { useStore.getState().setProfile({ onboarded: true }); hide() }}>Skip for now</button>
      </div>
    </div>
  )
}
