import { create } from 'zustand'

const CKEY = 'wb.nudge.collapsed'
const read = () => { try { return localStorage.getItem(CKEY) === '1' } catch { return false } }

interface NudgeState {
  closed: boolean
  collapsed: boolean
  close: () => void
  reopen: () => void
  toggleCollapsed: () => void
}

// Session-only dismissal + a persisted collapsed/expanded preference for the
// desktop reminder widget.
export const useNudge = create<NudgeState>(set => ({
  closed: false,
  collapsed: read(),
  close: () => set({ closed: true }),
  reopen: () => set({ closed: false }),
  toggleCollapsed: () => set(s => {
    const collapsed = !s.collapsed
    try { localStorage.setItem(CKEY, collapsed ? '1' : '0') } catch { /* ignore */ }
    return { collapsed }
  }),
}))
