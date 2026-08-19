import { create } from 'zustand'

interface CelebrationState {
  /** The project just finished, or null. */
  projectId: string | null
  show: (id: string) => void
  dismiss: () => void
}

/**
 * Finishing a project is rare — monthly, not forty times a day — which is the
 * only reason a moment of ceremony can survive without becoming noise.
 * Deliberately not a streak or a score: the buyer is closing a client
 * engagement, and slot-machine feedback undercuts that.
 */
export const useCelebration = create<CelebrationState>(set => ({
  projectId: null,
  show: id => set({ projectId: id }),
  dismiss: () => set({ projectId: null }),
}))
