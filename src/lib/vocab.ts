import type { VocabKey } from '../types'

// A vocabulary preset retitles the core nouns to suit a vertical while keeping
// the app welcoming to everyone. Agency leans on professional-services language
// (phases); consultant leans on engagements/workstreams; general is neutral.
export interface Vocab {
  key: VocabKey
  label: string
  hint: string
  project: string
  projects: string
  module: string
  modules: string
  task: string
  tasks: string
}

export const VOCAB: Record<VocabKey, Vocab> = {
  general: {
    key: 'general', label: 'General', hint: 'Projects, modules, tasks',
    project: 'project', projects: 'projects', module: 'module', modules: 'modules', task: 'task', tasks: 'tasks',
  },
  agency: {
    key: 'agency', label: 'Agency', hint: 'Client projects, phases, tasks',
    project: 'project', projects: 'projects', module: 'phase', modules: 'phases', task: 'task', tasks: 'tasks',
  },
  consultant: {
    key: 'consultant', label: 'Consultant', hint: 'Engagements, workstreams, tasks',
    project: 'engagement', projects: 'engagements', module: 'workstream', modules: 'workstreams', task: 'task', tasks: 'tasks',
  },
}

export const VOCAB_KEYS: VocabKey[] = ['general', 'agency', 'consultant']

export function vocabFor(k?: VocabKey): Vocab {
  return VOCAB[k ?? 'general']
}

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
