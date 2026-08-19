// Tiny synthesized UI sounds — no audio files, generated with the Web Audio
// API so they add zero weight and stay crisp at any volume. Gated by the
// user's setting at the call site.

let ctx: AudioContext | null = null
function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!C) return null
      ctx = new C()
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function blip(freq: number, at: number, dur: number, peak: number, type: OscillatorType = 'sine') {
  const a = audio()
  if (!a) return
  const t = a.currentTime + at
  const osc = a.createOscillator()
  const gain = a.createGain()
  osc.type = type
  osc.frequency.value = freq
  osc.connect(gain)
  gain.connect(a.destination)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.linearRampToValueAtTime(peak, t + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.start(t)
  osc.stop(t + dur + 0.03)
}

/** A bright rising two-note chime when a task is completed. */
export function playComplete() {
  blip(659.25, 0, 0.13, 0.16)   // E5
  blip(987.77, 0.085, 0.18, 0.16) // B5
}

/** A soft, gentle chime when a reminder surfaces. */
export function playReminder() {
  blip(587.33, 0, 0.2, 0.1)     // D5
  blip(783.99, 0.13, 0.32, 0.1) // G5
}

/**
 * For finishing a whole project. A rising triad rather than the single blip a
 * task gets — the same vocabulary, more of it, so it reads as the big version
 * of a familiar sound rather than a different app.
 */
export function playProjectComplete(): void {
  blip(523.25, 0, 0.18, 0.05)      // C5
  blip(659.25, 0.09, 0.18, 0.05)   // E5
  blip(783.99, 0.18, 0.26, 0.055)  // G5
  blip(1046.5, 0.3, 0.42, 0.045)   // C6
}
