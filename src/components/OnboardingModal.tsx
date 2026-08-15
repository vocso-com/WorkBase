import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { useOnboarding } from '../hooks/useOnboarding'
import { Icon } from './ui/Icon'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function genCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

/**
 * First-run onboarding + email verification.
 *
 * The app is local-first with no mail backend, so verification is stubbed: we
 * generate a 6-digit code on the client and show it as a demo hint. Swapping in
 * a real backend later means emailing `sent` instead of displaying it and
 * checking the code server-side — the UI/flow stays identical. Verification is
 * a *nudge*: the user can skip and keep using the app offline.
 */
export function OnboardingModal() {
  const open = useOnboarding(s => s.open)
  const hide = useOnboarding(s => s.hide)
  const profile = useStore(s => s.doc.profile)

  const [step, setStep] = useState<'info' | 'verify'>('info')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState('')
  const [err, setErr] = useState('')
  const emailRef = useRef<HTMLInputElement>(null)

  // Seed fields + starting step whenever the modal opens. Re-opening from the
  // nudge (email already captured) jumps straight to the verify step.
  useEffect(() => {
    if (!open) return
    setName(profile?.userName ?? '')
    setEmail(profile?.userEmail ?? '')
    setCode('')
    setErr('')
    if (profile?.userEmail && !profile?.emailVerified) {
      setSent(genCode())
      setStep('verify')
    } else {
      setStep('info')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  const sendCode = () => {
    const e = email.trim()
    if (!EMAIL_RE.test(e)) { setErr('Enter a valid email address.'); return }
    useStore.getState().setProfile({ userName: name.trim() || undefined, userEmail: e })
    setSent(genCode())
    setCode('')
    setErr('')
    setStep('verify')
  }

  const verify = () => {
    if (code.trim() === sent) {
      useStore.getState().setProfile({ emailVerified: true })
      hide()
    } else {
      setErr('That code doesn’t match. Check the code and try again.')
    }
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
            <button className="onb-primary" onClick={sendCode}>Continue</button>
            <button className="onb-skip" onClick={skip}>Skip for now</button>
          </>
        ) : (
          <>
            <div className="onb-title">Verify your email</div>
            <div className="onb-sub">Enter the 6-digit code we sent to <b>{email}</b>.</div>
            <div className="onb-demo"><Icon name="ti-info-circle" /> Demo build — no email is sent. Your code is <b>{sent}</b>.</div>
            <label className="onb-field">
              <span>Verification code</span>
              <input className="onb-code" value={code} inputMode="numeric" maxLength={6} autoFocus
                onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setErr('') }}
                placeholder="000000"
                onKeyDown={e => { if (e.key === 'Enter') verify() }} />
            </label>
            {err ? <div className="onb-err">{err}</div> : null}
            <button className="onb-primary" onClick={verify}>Verify &amp; continue</button>
            <div className="onb-row">
              <button className="onb-link" onClick={() => { setSent(genCode()); setCode(''); setErr('') }}>Resend code</button>
              <button className="onb-link" onClick={() => setStep('info')}>Change email</button>
            </div>
            <button className="onb-skip" onClick={skip}>I’ll verify later</button>
          </>
        )}
      </div>
    </div>
  )
}
