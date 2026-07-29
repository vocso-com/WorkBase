export type Status = 'todo' | 'doing' | 'done' | 'blocked'
export type Priority = 'low' | 'med' | 'high'
export type ColorKey = 'blue' | 'teal' | 'coral' | 'violet' | 'amber' | 'red' | 'gray'

export interface Tag {
  name: string
  color: ColorKey
}

export interface Node {
  id: string
  shortId: string
  title: string
  status: Status
  children: Node[]
  color?: ColorKey
  icon?: string
  description?: string
  priority?: Priority
  dueDate?: string
  tags?: Tag[]
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface StoreDoc {
  version: 1
  roots: Node[]
  tagPalette: Tag[]
}
