import type { StoreDoc, Tag, Template, Stage, Workspace } from '../types'

export const DEFAULT_WORKSPACE_ID = 'ws-default'
export function defaultWorkspaces(): Workspace[] {
  return [{ id: DEFAULT_WORKSPACE_ID, name: 'Default', icon: 'ti-stack-2', color: 'blue' }]
}

// Agency-focused default labels — the language a studio actually uses on work.
export const DEFAULT_TAGS: Tag[] = [
  { name: 'Design', color: 'violet' },
  { name: 'Development', color: 'blue' },
  { name: 'Content', color: 'teal' },
  { name: 'SEO', color: 'cyan' },
  { name: 'Client Review', color: 'amber' },
  { name: 'Revision', color: 'coral' },
  { name: 'Billable', color: 'lime' },
  { name: 'Urgent', color: 'red' },
]

export function emptyDocument(): StoreDoc {
  return { version: 1, roots: [], workspaces: defaultWorkspaces(), activeWorkspace: DEFAULT_WORKSPACE_ID, tagPalette: [...DEFAULT_TAGS], templates: [], stages: [] }
}

export function serialize(doc: StoreDoc): string {
  return JSON.stringify(doc, null, 2)
}

export function deserialize(text: string): StoreDoc {
  const parsed = JSON.parse(text)
  if (typeof parsed.version === 'number' && parsed.version > 1) {
    throw new Error('Unsupported data version')
  }
  if (!Array.isArray(parsed.roots)) {
    throw new Error('Invalid data file')
  }
  const workspaces: Workspace[] = Array.isArray(parsed.workspaces) && parsed.workspaces.length > 0
    ? (parsed.workspaces as Workspace[])
    : defaultWorkspaces()
  const activeWorkspace = typeof parsed.activeWorkspace === 'string' && workspaces.some(w => w.id === parsed.activeWorkspace)
    ? parsed.activeWorkspace
    : workspaces[0].id
  return {
    version: 1,
    roots: parsed.roots,
    workspaces,
    activeWorkspace,
    tagPalette: Array.isArray(parsed.tagPalette) ? parsed.tagPalette : [...DEFAULT_TAGS],
    templates: Array.isArray(parsed.templates) ? (parsed.templates as Template[]) : [],
    stages: Array.isArray(parsed.stages) ? (parsed.stages as Stage[]) : [],
    stageLabels: parsed.stageLabels && typeof parsed.stageLabels === 'object' ? (parsed.stageLabels as Record<string, string>) : undefined,
    stageOrder: Array.isArray(parsed.stageOrder) ? (parsed.stageOrder as string[]) : undefined,
    profile: parsed.profile && typeof parsed.profile === 'object' ? parsed.profile : undefined,
  }
}
