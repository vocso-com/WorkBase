// A status is a stage id: one of the built-in ids ('todo' | 'doing' | 'done' |
// 'blocked') or a custom stage id stored in StoreDoc.stages.
export type Status = string
export type Priority = 'low' | 'med' | 'high'
export type ColorKey =
  | 'blue' | 'teal' | 'coral' | 'violet' | 'amber' | 'red' | 'gray'
  | 'indigo' | 'cyan' | 'lime' | 'pink' | 'slate'

// Explicit weight of a node relative to its siblings. Doubling from a default
// of M, so each step is "twice the previous". Absent means the weight is
// inferred from subtree size instead — see lib/weight.ts.
export type SizeKey = 'S' | 'M' | 'L' | 'XL' | 'XXL'

export interface Tag {
  name: string
  color: ColorKey
}

export interface Stage {
  id: string
  label: string
  color: ColorKey
}

export interface Comment {
  id: string
  text: string
  at: string
}

export interface Activity {
  id: string
  text: string
  at: string
}

export interface Attachment {
  id: string
  name: string
  type: string
  dataUrl: string
  at: string
}

export interface Workspace {
  id: string
  name: string
  icon?: string
  color?: string
}

export interface Node {
  id: string
  shortId: string
  title: string
  status: Status
  children: Node[]
  // Root-level only: which WorkBase this project belongs to (undefined = default).
  workspace?: string
  // A palette key (ColorKey) or a raw hex string like "#8b5cf6".
  color?: string
  labelColor?: string
  icon?: string
  image?: string
  attachments?: Attachment[]
  description?: string
  priority?: Priority
  dueDate?: string
  // Ids of nodes this one is blocked by. Optional and opt-in: absent means no
  // dependencies and the app behaves exactly as before.
  dependsOn?: string[]
  tags?: Tag[]
  notes?: string
  comments?: Comment[]
  activities?: Activity[]
  pos?: { x: number; y: number }
  collapsed?: boolean
  view?: 'board' | 'kanban' | 'flow' | 'columns'
  flowOrientation?: 'h' | 'v'
  // Show `dependsOn` links as dashed edges in Flow. Absent means on, so no
  // existing document needs migrating.
  flowDeps?: boolean
  // Root-level only: show a one-line description teaser on every Flow card.
  // Absent means on.
  flowDesc?: boolean
  // Root-level only: expand every Flow card's full description by default. A
  // card's own `cardOpen` still overrides this, so you can collapse specific
  // cards with "Less" while the rest stay open. Absent means off.
  flowDescExpanded?: boolean
  // This card is expanded on the Flow canvas, showing its full description and
  // detail counts. Absent means collapsed. Distinct from `collapsed`, which
  // controls whether the node's *children* are laid out.
  cardOpen?: boolean
  // Explicit size relative to siblings. Absent means inferred from subtree size.
  size?: SizeKey
  // Set when status becomes 'done', cleared when un-done. Recorded so weights
  // can be learned from real completion history later.
  completedAt?: string
  // Root-level only: total weight captured at kickoff (first move to 'doing'),
  // so scope growth since then can be reported.
  baselineWeight?: number
  baselineAt?: string
  createdAt: string
  updatedAt: string
}

export interface TemplateTask {
  title: string
  status?: Status
  priority?: Priority
  tags?: Tag[]
}

export interface TemplateModule {
  name: string
  // Declared prior: how big this module is relative to the template's others.
  size?: SizeKey
  color?: string
  icon?: string
  items: TemplateTask[]
}

export interface Template {
  id: string
  name: string
  description: string
  color: string
  icon: string
  tags?: Tag[]
  builtin?: boolean
  modules: TemplateModule[]
}

export type VocabKey = 'general' | 'agency' | 'consultant'

export interface Profile {
  orgName?: string
  orgLogo?: string
  userName?: string
  userAvatar?: string
  vocab?: VocabKey
  // Preferred view for opening a project that has no view of its own.
  defaultView?: 'board' | 'kanban' | 'flow' | 'columns'
  // First-run account info.
  userEmail?: string
  emailVerified?: boolean
  userType?: string // 'agency' | 'consultant' | 'inhouse' | 'personal'
  // Desktop nudge / reminder widget. `nudgeReminders` shows overdue + due-today
  // tasks (default on); `nudgeMyWork` adds a soft My Work summary (default off).
  nudgeReminders?: boolean
  nudgeMyWork?: boolean
  // Optional calibration: roughly how many hours an M-sized item takes in this
  // shop. Display only — sizing stays a relative comparison, because an hour
  // attached to a task becomes a commitment people pad against. Absent by
  // default, and always rendered with a "≈". Learned from real completion
  // history later rather than asked for per task.
  hoursPerM?: number
  // Play a chime on task completion and when a reminder surfaces (default on).
  soundsEnabled?: boolean
}

export interface StoreDoc {
  version: 1
  roots: Node[]
  // WorkBases (hubs). Projects belong to one via Node.workspace; templates,
  // labels and stages stay shared across all of them.
  workspaces: Workspace[]
  activeWorkspace: string
  tagPalette: Tag[]
  templates: Template[]
  stages: Stage[]
  // Optional per-stage-id label overrides — lets built-in stages (To do, In
  // progress, …) be renamed without changing their status ids.
  stageLabels?: Record<string, string>
  // Optional explicit display order of stage ids (built-ins + customs). When
  // absent, order is the four built-ins followed by customs in insertion order.
  stageOrder?: string[]
  profile?: Profile
}
