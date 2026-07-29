import type { StoreDoc } from '../types'
import { serialize, deserialize, emptyDocument } from './serialize'

export interface StorageAdapter {
  load(): Promise<StoreDoc>
  save(doc: StoreDoc): Promise<void>
}

const KEY = 'manage.doc'

export const webAdapter: StorageAdapter = {
  async load() {
    const text = localStorage.getItem(KEY)
    return text ? deserialize(text) : emptyDocument()
  },
  async save(doc) {
    localStorage.setItem(KEY, serialize(doc))
  },
}

export function makeTauriAdapter(): StorageAdapter {
  const DIR = 'manage'
  const FILE = 'manage/data.json'
  return {
    async load() {
      const fs = await import('@tauri-apps/plugin-fs')
      const opts = { baseDir: fs.BaseDirectory.AppData }
      if (!(await fs.exists(FILE, opts))) return emptyDocument()
      const text = await fs.readTextFile(FILE, opts)
      return deserialize(text)
    },
    async save(doc) {
      const fs = await import('@tauri-apps/plugin-fs')
      const opts = { baseDir: fs.BaseDirectory.AppData }
      if (!(await fs.exists(DIR, opts))) await fs.mkdir(DIR, { ...opts, recursive: true })
      await fs.writeTextFile(FILE, serialize(doc), opts)
    },
  }
}

export function pickAdapter(): StorageAdapter {
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) return makeTauriAdapter()
  return webAdapter
}
