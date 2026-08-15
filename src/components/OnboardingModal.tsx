import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { useOnboarding } from '../hooks/useOnboarding'
import { requestCode, verifyCode, activationConfigured } from '../lib/activation'
import { Icon } from './ui/Icon'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * First-run onboarding + email verification. The app is free and local-first —
 * verification is a light nudge (skippable). Codes are sent by a tiny endpoint
 * (see lib/activation); with no endpoint configured it falls back to a local
 * demo code so the flow works offline.
 */
export function OnboardingModal() {
  const open = useOnboarding(s => s.open)
  const hide = useOnboarding(s => s.hide)
  const profile = useStore(s => s.doc.profile)

  const [step, setStep] = useState<'info' | 'verify'>('info')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [demo, setDemo] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setName(profile?.userName ?? '')
    setEmail(profile?.userEmail ?? '')
    setCode('')
    setErr('')
    setDemo('')
    setStep(profile?.userEmail && !profile?.emailVerified ? 'verify' : 'info')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  const sendCode = async () => {
    const e = email.trim()
    if (!EMAIL_RE.test(e)) { setErr('Enter a valid email address.'); return }
    setBusy(true); setErr('')
    useStore.getState().setProfile({ userName: name.trim() || undefined, userEmail: e })
    const r = await requestCode(e)
    setBusy(false)
    if (!r.ok) { setErr(r.error ?? 'Could not send the code.'); return }
    setDemo(r.demoCode ?? '')
    setCode('')
    setStep('verify')
  }

  const verify = async () => {
    setBusy(true); setErr('')
    const r = await verifyCode(email.trim(), code)
    setBusy(false)
    if (r.ok) {
      useStore.getState().setProfile({ emailVerified: true })
      hide()
    } else {
      setErr(r.error ?? 'That code doesn’t match.')
    }
  }

  const resend = async () => {
    setBusy(true); setErr('')
    const r = await requestCode(email.trim())
    setBusy(false)
    setDemo(r.demoCode ?? '')
    setCode('')
    if (!r.ok) setErr(r.error ?? 'Could not resend.')
  }

  const skip = () => hide()

  return (
    <div className="modal-overlay" onClick={skip}>
      <div className="modal onb" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="onb-brand">
          <img className="onb-logo" src="/workbase-logo.png" alt="" />
          <div className="onb-brand-txt">WorkBase</div>
        </div>

        {step === 'info' ? (
          <>
            <div className="onb-title">Welcome — let’s set you up</div>
            <div className="onb-sub">Tell us who you are. Your data stays on this device.</div>
            <label className="onb-field">
              <span>Your name</span>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Doe" autoFocus />
            </label>
            <label className="onb-field">
              <span>Email</span>
              <input ref={emailRef} type="email" value={email} onChange={e => { setEmail(e.target.value); setErr('') }}
                placeholder="you@company.com"
                onKeyDown={e => { if (e.key === 'Enter') sendCode() }} />
            </label>
            {err ? <div className="onb-err">{err}</div> : null}
            <button className="onb-primary" onClick={() => void sendCode()} disabled={busy}>{busy ? 'Sending…' : 'Continue'}</button>
            <button className="onb-skip" onClick={skip}>Skip for now</button>
          </>
        ) : (
          <>
            <div className="onb-title">Verify your email</div>
            <div className="onb-sub">Enter the 6-digit code we sent to <b>{email}</b>.</div>
            {!activationConfigured() && demo ? (
              <div className="onb-demo"><Icon name="ti-info-circle" /> Demo build — no email is sent yet. Your code is <b>{demo}</b>.</div>
            ) : null}
            <label className="onb-field">
              <span>Verification code</span>
              <input className="onb-code" value={code} inputMode="numeric" maxLength={6} autoFocus
                onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setErr('') }}
                placeholder="000000"
                onKeyDown={e => { if (e.key === 'Enter') void verify() }} />
            </label>
            {err ? <div className="onb-err">{err}</div> : null}
            <button className="onb-primary" onClick={() => void verify()} disabled={busy || code.length < 6}>{busy ? 'Verifying…' : 'Verify & continue'}</button>
            <div className="onb-row">
              <button className="onb-link" onClick={() => void resend()} disabled={busy}>Resend code</button>
              <button className="onb-link" onClick={() => setStep('info')}>Change email</button>
            </div>
            <button className="onb-skip" onClick={skip}>I’ll verify later</button>
          </>
        )}
      </div>
    </div>
  )
}
