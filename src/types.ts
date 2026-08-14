// A status is a stage id: one of the built-in ids ('todo' | 'doing' | 'done' |
// 'blocked') or a custom stage id stored in StoreDoc.stages.
export type Status = string
export type Priority = 'low' | 'med' | 'high'
export type ColorKey =
  | 'blue' | 'teal' | 'coral' | 'violet' | 'amber' | 'red' | 'gray'
  | 'indigo' | 'cyan' | 'lime' | 'pink' | 'slate'

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

export interface Attachment {
  id: string
  name: string
  type: string
  dataUrl: string
  at: string
}

export interface Node {
  id: string
  shortId: string
  title: string
  status: Status
  children: Node[]
  // A palette key (ColorKey) or a raw hex string like "#8b5cf6".
  color?: string
  labelColor?: string
  icon?: string
  image?: string
  attachments?: Attachment[]
  description?: string
  priority?: Priority
  dueDate?: string
  tags?: Tag[]
  notes?: string
  comments?: Comment[]
  pos?: { x: number; y: number }
  collapsed?: boolean
  view?: 'board' | 'kanban' | 'flow'
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

export interface Profile {
  orgName?: string
  orgLogo?: string
  userName?: string
  userAvatar?: string
}

export interface StoreDoc {
  version: 1
  roots: Node[]
  tagPalette: Tag[]
  templates: Template[]
  stages: Stage[]
  profile?: Profile
}
