import { useStore } from '../store/useStore'
import { vocabFor, type Vocab } from '../lib/vocab'

// The active vocabulary preset (from the profile), reactive to changes.
export function useVocab(): Vocab {
  return vocabFor(useStore(s => s.doc.profile?.vocab))
}
