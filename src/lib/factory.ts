import { nanoid } from 'nanoid'
import type { Node } from '../types'

export function newNode(title: string, opts: Partial<Node> = {}): Node {
  const now = new Date().toISOString()
  return {
    id: nanoid(), shortId: '', title, status: 'todo', children: [],
    createdAt: now, updatedAt: now, ...opts,
  }
}
