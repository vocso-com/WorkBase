import type { StoreDoc } from '../types'
import { serialize, deserialize, emptyDocument } from './serialize'

export interface StorageAdapter {
  load(): Promise<StoreDoc>
  save(doc: StoreDoc): Promise<void>
}

const KEY = 'manage.doc'

// IndexedDB key-value store — localStorage's ~5MB cap can't hold a doc with
// several embedded image data-URLs (logos/covers), so saves were silently
// failing. IndexedDB gives us gigabytes.
const IDB_NAME = 'workbase'
const IDB_STORE = 'kv'
const IDB_KEY = 'doc'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => { req.result.createObjectStore(IDB_STORE) }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet(): Promise<string | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly')
    const req = tx.objectStore(IDB_STORE).get(IDB_KEY)
    req.onsuccess = () => resolve((req.result as string) ?? null)
    req.onerror = () => reject(req.error)
  })
}

async function idbSet(value: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).put(value, IDB_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

const hasIDB = typeof indexedDB !== 'undefined'

export const webAdapter: StorageAdapter = {
  async load() {
    let text: string | null = null
    if (hasIDB) { try { text = await idbGet() } catch { /* ignore */ } }
    // Fall back to / migrate from the old localStorage store.
    if (!text) { try { text = localStorage.getItem(KEY) } catch { /* ignore */ } }
    return text ? deserialize(text) : emptyDocument()
  },
  async save(doc) {
    const text = serialize(doc)
    if (hasIDB) {
      try {
        await idbSet(text)
        try { localStorage.removeItem(KEY) } catch { /* ignore */ } // free old quota
        return
      } catch { /* fall through to localStorage */ }
    }
    try { localStorage.setItem(KEY, text) } catch { /* quota — nothing more we can do */ }
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
