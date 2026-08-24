# Manage App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build "Manage", a native macOS desktop app (Tauri) for tracking projects → modules → tasks at infinite depth, with a card-first visual UI, status swimlanes, a per-project overview, Board/Kanban views, drag-and-drop, tags, and an enrich-on-demand detail panel — all persisted to a local JSON file.

> **Note on `prototype.html`.** This plan was written against a single-file HTML
> prototype at the repo root, which it refers to throughout as the visual source of
> truth. That file held a copy of a real internal project board, so it was removed
> before this repository was published. Its design decisions live on in
> `src/index.css` and `src/theme.ts`; the references below are kept as written so the
> plan still reads as the historical document it is.

**Architecture:** A React + TypeScript + Vite front end runs inside a Tauri v2 shell. All domain logic lives in pure, unit-tested modules under `src/lib` (tree ops, progress, shortId, tags, serialization). A Zustand store holds the node tree in memory and debounce-persists it through a storage adapter that writes JSON via Tauri's fs plugin (with a localStorage fallback so the app also runs in a plain browser during `vitest`/dev). UI components are thin and read/derive from the store. The committed `prototype.html` at the repo root is the visual source of truth — port its markup, tokens, and colors.

**Tech Stack:** Tauri v2, React 18, TypeScript 5, Vite 5, Tailwind CSS 3.4, Zustand 5, @dnd-kit (core + sortable), nanoid, Vitest + @testing-library/react + jsdom.

## Global Constraints

- macOS desktop target; Tauri v2; Rust toolchain already present (cargo 1.97).
- Node 20, npm 10 (present).
- One recursive `Node` type at every level; top-level nodes ("projects") are Nodes with no special type.
- `status` is the single source of truth for a node's state: `'todo' | 'doing' | 'done' | 'blocked'` (default `'todo'`). There is no separate `done` boolean — "done" means `status === 'done'`.
- Progress is always derived, never stored: `progress(node)` = descendant-leaf nodes with `status === 'done'` ÷ total descendant-leaf nodes (a leaf has `children.length === 0`; a leaf's own progress is 100 if done else 0).
- Colors are a fixed `ColorKey` set: `'blue' | 'teal' | 'coral' | 'violet' | 'amber' | 'red' | 'gray'`. Hex values come from `prototype.html` (`C`, `tint`, `tintD`).
- Storage document shape is `{ version: 1, roots: Node[], tagPalette: Tag[] }`. Always write `version: 1`; refuse to load a document whose `version` is a number greater than 1.
- Sentence case in all UI copy. No logout/login anywhere (offline, local-only).
- Commit after every task. Never commit `node_modules`, `dist`, or `target` (already in `.gitignore`).

---

## File Structure

```
manage/
  src-tauri/                     # Tauri Rust shell (generated + configured)
    src/main.rs, src/lib.rs
    tauri.conf.json              # window, identifier, bundle
    Cargo.toml                   # tauri, tauri-plugin-fs, tauri-plugin-dialog
    capabilities/default.json    # fs + dialog permissions
  src/
    main.tsx                     # React entry
    App.tsx                      # top-level router (home vs project route) + TopBar + DetailPanel host
    index.css                    # Tailwind directives + CSS variable tokens (light/dark)
    types.ts                     # Node, Store, Status, Priority, Tag, ColorKey
    theme.ts                     # COLORS, tint, tintDark, STATUS meta, ICONS list
    lib/
      tree.ts                    # findNode, addChild, updateNode, deleteNode, moveNode, reparentNode, leaves
      progress.ts                # progressOf, statusCounts, rollUpDone
      shortid.ts                 # projectPrefix, nextShortId
      tags.ts                    # upsertTag, tagKey
      serialize.ts               # toDocument, fromDocument (version guard), emptyDocument
      storage.ts                 # StorageAdapter: tauriAdapter + webAdapter + pickAdapter
    store/
      useStore.ts                # Zustand store: state + actions + debounced persist
    components/
      TopBar.tsx                 # brand + AvatarMenu
      AvatarMenu.tsx             # dropdown: Settings, Export, Import, About
      Breadcrumb.tsx             # Home › Project › …
      ProjectsHome.tsx           # status swimlanes of ProjectCards
      ProjectCard.tsx            # project card (accent, icon, ring, tags, footer)
      ProjectOverview.tsx        # ring + stat tiles + status-breakdown bar
      ViewToggle.tsx             # Board | Kanban segmented control
      BoardView.tsx              # grid of ModuleCards + "new" card
      ModuleCard.tsx             # module card (bar + checklist rows + tags)
      KanbanView.tsx             # 4 columns, dnd context
      KanbanColumn.tsx           # droppable column
      TaskCard.tsx               # draggable task card
      DetailPanel.tsx            # right slide-in enrich panel
      ui/
        ProgressRing.tsx         # svg ring
        Tag.tsx                  # colored pill
        Checkbox.tsx             # status checkbox
        Icon.tsx                 # tabler icon <i>
  index.html                     # loads /src/main.tsx, tabler-icons CSS
```

Tests are colocated as `*.test.ts(x)` beside each source file.

---

### Task 1: Scaffold Tauri + React + TS + Vite + Tailwind + Vitest

**Files:**
- Create: `package.json`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `tailwind.config.js`, `postcss.config.js`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/vite-env.d.ts`, `src/test/setup.ts`
- Create (Tauri): `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src-tauri/build.rs`, `src-tauri/src/main.rs`, `src-tauri/src/lib.rs`, `src-tauri/capabilities/default.json`
- Test: `src/App.test.tsx`

**Interfaces:**
- Produces: a runnable dev app (`npm run dev`), a Tauri build target (`npm run tauri dev`), and a green `vitest` run. Exposes `App` React component (renders a placeholder heading for now).

- [ ] **Step 1: Create the front-end project files**

Create `package.json`:

```json
{
  "name": "manage",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "tauri": "tauri",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@dnd-kit/core": "^6.1.0",
    "@dnd-kit/sortable": "^8.0.0",
    "@dnd-kit/utilities": "^3.2.2",
    "@tauri-apps/api": "^2.0.0",
    "@tauri-apps/plugin-dialog": "^2.0.0",
    "@tauri-apps/plugin-fs": "^2.0.0",
    "nanoid": "^5.0.7",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0",
    "@testing-library/jest-dom": "^6.4.6",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.19",
    "jsdom": "^24.1.0",
    "postcss": "^8.4.39",
    "tailwindcss": "^3.4.6",
    "typescript": "^5.5.3",
    "vite": "^5.3.4",
    "vitest": "^2.0.3"
  }
}
```

Create `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Manage</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/tabler-icons/3.30.0/tabler-icons.min.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
})
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

Create `src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"]
}
```

Create `tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: { extend: {} },
  plugins: [],
}
```

Create `postcss.config.js`:

```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } }
```

Create `src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 2: Create index.css with tokens (port from prototype.html)**

Create `src/index.css`. Start with Tailwind directives, then copy the `:root` and dark-mode CSS variable blocks and the dotted `body` background verbatim from `prototype.html` (the `--bg`, `--card`, `--ink`, `--muted`, `--faint`, `--line`, `--chip`, `--panel`, color, and shadow variables, plus the `@media (prefers-color-scheme: dark)` overrides):

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root{
  --bg:#f4f5f7; --dot:#dadce1; --card:#ffffff; --ink:#1f2430; --muted:#6b7280; --faint:#9aa1ad;
  --line:#eef0f3; --chip:#f1f3f6; --panel:#fbfbfc;
  --blue:#3b82c4; --teal:#1d9e75; --coral:#d85a30; --violet:#6d5ce0; --amber:#e0952a; --red:#e2504f;
  --shadow:0 1px 2px rgba(20,24,33,.06),0 10px 26px rgba(20,24,33,.09);
  --shadow-hover:0 2px 4px rgba(20,24,33,.08),0 18px 40px rgba(20,24,33,.14);
  --shadow-sm:0 1px 2px rgba(20,24,33,.08),0 4px 12px rgba(20,24,33,.07);
}
@media (prefers-color-scheme: dark){
  :root{ --bg:#15171c; --dot:#2b2f39; --card:#1e2128; --ink:#e9ebef; --muted:#9aa1ad; --faint:#6b7280;
    --line:#2a2e37; --chip:#262a33; --panel:#1a1d23;
    --shadow:0 1px 2px rgba(0,0,0,.4),0 12px 30px rgba(0,0,0,.5);
    --shadow-hover:0 2px 6px rgba(0,0,0,.5),0 22px 48px rgba(0,0,0,.6);
    --shadow-sm:0 1px 2px rgba(0,0,0,.4),0 6px 16px rgba(0,0,0,.45);}
}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif;
  color:var(--ink);background:var(--bg);
  background-image:radial-gradient(var(--dot) 1.3px,transparent 1.3px);background-size:22px 22px;
  min-height:100vh;-webkit-font-smoothing:antialiased;}
```

- [ ] **Step 3: Create the React entry + placeholder App**

Create `src/main.tsx`:

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

Create `src/App.tsx`:

```tsx
export default function App() {
  return <h1>Manage</h1>
}
```

- [ ] **Step 4: Write the failing smoke test**

Create `src/App.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import App from './App'

test('renders the app name', () => {
  render(<App />)
  expect(screen.getByText('Manage')).toBeInTheDocument()
})
```

- [ ] **Step 5: Install deps and run the test (expect pass after install)**

Run:
```bash
npm install
npm test
```
Expected: `App.test.tsx` passes (1 passed).

- [ ] **Step 6: Scaffold the Tauri shell**

Create `src-tauri/Cargo.toml`:

```toml
[package]
name = "manage"
version = "0.1.0"
edition = "2021"

[lib]
name = "manage_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-fs = "2"
tauri-plugin-dialog = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

Create `src-tauri/build.rs`:

```rust
fn main() {
    tauri_build::build()
}
```

Create `src-tauri/src/main.rs`:

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    manage_lib::run()
}
```

Create `src-tauri/src/lib.rs`:

```rust
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .run(tauri::generate_context!())
        .expect("error while running Manage");
}
```

Create `src-tauri/tauri.conf.json`:

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Manage",
  "version": "0.1.0",
  "identifier": "com.deepak.manage",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:1420",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },
  "app": {
    "windows": [
      { "title": "Manage", "width": 1200, "height": 820, "minWidth": 720, "minHeight": 560 }
    ],
    "security": { "csp": null }
  },
  "bundle": { "active": true, "targets": "app", "icon": ["icons/icon.icns"] }
}
```

Create `src-tauri/capabilities/default.json`:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default capabilities for Manage",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:default",
    "fs:default",
    { "identifier": "fs:allow-write-file", "allow": [{ "path": "$APPDATA/**" }] },
    { "identifier": "fs:allow-read-file", "allow": [{ "path": "$APPDATA/**" }] },
    { "identifier": "fs:allow-mkdir", "allow": [{ "path": "$APPDATA/**" }] },
    { "identifier": "fs:allow-exists", "allow": [{ "path": "$APPDATA/**" }] }
  ]
}
```

Note: provide a placeholder icon — copy any 512×512 png to `src-tauri/icons/` and run `npm run tauri icon <png>` if the build complains about a missing icon; otherwise Tauri's default icons suffice for dev.

- [ ] **Step 7: Verify the Tauri app launches**

Run:
```bash
npm run tauri dev
```
Expected: a native macOS window titled "Manage" opens showing the "Manage" heading. Close it. (First run compiles Rust — may take a few minutes.)

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold Tauri + React + TS + Vite + Tailwind + Vitest"
```

---

### Task 2: Domain types + theme constants

**Files:**
- Create: `src/types.ts`, `src/theme.ts`
- Test: `src/theme.test.ts`

**Interfaces:**
- Produces:
  - `types.ts`: `type Status = 'todo'|'doing'|'done'|'blocked'`; `type Priority = 'low'|'med'|'high'`; `type ColorKey = 'blue'|'teal'|'coral'|'violet'|'amber'|'red'|'gray'`; `interface Tag { name: string; color: ColorKey }`; `interface Node { id: string; shortId: string; title: string; status: Status; children: Node[]; color?: ColorKey; icon?: string; description?: string; priority?: Priority; dueDate?: string; tags?: Tag[]; notes?: string; createdAt: string; updatedAt: string }`; `interface StoreDoc { version: 1; roots: Node[]; tagPalette: Tag[] }`.
  - `theme.ts`: `const COLORS: Record<ColorKey,string>`, `const TINT: Record<ColorKey,string>`, `const TINT_DARK: Record<ColorKey,string>`, `const STATUS: Record<Status,{label:string; color:ColorKey; dot:string}>`, `const STATUS_ORDER: Status[]` = `['todo','doing','done','blocked']`, `const HOME_ORDER: Status[]` = `['doing','todo','blocked','done']`.

- [ ] **Step 1: Write types.ts**

Create `src/types.ts` with the exact interfaces from the Interfaces block above.

- [ ] **Step 2: Write theme.ts (port hex from prototype.html)**

Create `src/theme.ts`. Copy `COLORS`/`TINT`/`TINT_DARK` values from `prototype.html`'s `C`, `tint`, `tintD`, and `STATUS` from prototype's `STATUS` (label, color key, dot hex):

```ts
import type { ColorKey, Status } from './types'

export const COLORS: Record<ColorKey, string> = {
  blue:'#3b82c4', teal:'#1d9e75', coral:'#d85a30', violet:'#6d5ce0', amber:'#e0952a', red:'#e2504f', gray:'#9aa1ad',
}
export const TINT: Record<ColorKey, string> = {
  blue:'#e6f1fb', teal:'#e1f5ee', coral:'#faece7', violet:'#eeedfe', amber:'#faeeda', red:'#fcebeb', gray:'#eef0f3',
}
export const TINT_DARK: Record<ColorKey, string> = {
  blue:'#0c447c', teal:'#085041', coral:'#712b13', violet:'#3c3489', amber:'#633806', red:'#791f1f', gray:'#3a3f49',
}
export const STATUS: Record<Status, { label: string; color: ColorKey; dot: string }> = {
  todo:    { label: 'To do',       color: 'gray',  dot: '#c7cbd3' },
  doing:   { label: 'In progress', color: 'amber', dot: '#e0952a' },
  done:    { label: 'Done',        color: 'teal',  dot: '#1d9e75' },
  blocked: { label: 'Blocked',     color: 'red',   dot: '#e2504f' },
}
export const STATUS_ORDER: Status[] = ['todo', 'doing', 'done', 'blocked']
export const HOME_ORDER: Status[] = ['doing', 'todo', 'blocked', 'done']

export const PROJECT_ICONS = ['ti-cloud','ti-building-store','ti-users','ti-broadcast','ti-rocket','ti-briefcase','ti-bulb','ti-flame']
```

- [ ] **Step 3: Write the test**

Create `src/theme.test.ts`:

```ts
import { STATUS, STATUS_ORDER, HOME_ORDER, COLORS } from './theme'

test('every status has label/color/dot', () => {
  for (const s of STATUS_ORDER) {
    expect(STATUS[s].label).toBeTruthy()
    expect(COLORS[STATUS[s].color]).toMatch(/^#/)
    expect(STATUS[s].dot).toMatch(/^#/)
  }
})

test('home order leads with in-progress', () => {
  expect(HOME_ORDER[0]).toBe('doing')
  expect(new Set(HOME_ORDER)).toEqual(new Set(STATUS_ORDER))
})
```

- [ ] **Step 4: Run tests**

Run: `npm test -- theme`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/theme.ts src/theme.test.ts
git commit -m "feat: domain types and theme constants"
```

---

### Task 3: Tree operations (`src/lib/tree.ts`)

**Files:**
- Create: `src/lib/tree.ts`
- Test: `src/lib/tree.test.ts`

**Interfaces:**
- Consumes: `Node` from `../types`.
- Produces (all pure; never mutate inputs — return new trees):
  - `findNode(roots: Node[], id: string): Node | null`
  - `findParent(roots: Node[], id: string): Node | null`
  - `leaves(node: Node): Node[]` — all descendant nodes with no children (returns `[node]` if node itself is a leaf)
  - `updateNode(roots: Node[], id: string, patch: Partial<Node>): Node[]` — returns new roots with node shallow-merged with patch and `updatedAt` bumped (pass `now` via patch or use a fixed caller-provided timestamp; this fn stamps `updatedAt` from `patch.updatedAt ?? node.updatedAt`)
  - `addChild(roots: Node[], parentId: string | null, child: Node): Node[]` — appends `child` to parent's children, or to roots if `parentId` is null
  - `deleteNode(roots: Node[], id: string): Node[]`
  - `moveNode(roots: Node[], id: string, newParentId: string | null, index: number): Node[]` — detaches node and inserts it at `index` within the new parent's children (or roots)
  - `reorderChildren(roots: Node[], parentId: string | null, fromIndex: number, toIndex: number): Node[]`

- [ ] **Step 1: Write failing tests**

Create `src/lib/tree.test.ts`:

```ts
import { findNode, findParent, leaves, updateNode, addChild, deleteNode, moveNode, reorderChildren } from './tree'
import type { Node } from '../types'

const leaf = (id: string, title = id): Node => ({
  id, shortId: id.toUpperCase(), title, status: 'todo', children: [],
  createdAt: '2026-01-01', updatedAt: '2026-01-01',
})
const withKids = (id: string, kids: Node[]): Node => ({ ...leaf(id), children: kids })

function sample(): Node[] {
  return [withKids('p', [withKids('m1', [leaf('t1'), leaf('t2')]), leaf('m2')])]
}

test('findNode finds nested', () => {
  expect(findNode(sample(), 't2')!.title).toBe('t2')
  expect(findNode(sample(), 'nope')).toBeNull()
})

test('findParent returns the parent', () => {
  expect(findParent(sample(), 't1')!.id).toBe('m1')
  expect(findParent(sample(), 'p')).toBeNull()
})

test('leaves collects descendant leaves', () => {
  expect(leaves(sample()[0]).map(n => n.id).sort()).toEqual(['m2', 't1', 't2'])
  expect(leaves(leaf('x')).map(n => n.id)).toEqual(['x'])
})

test('updateNode is immutable and patches', () => {
  const roots = sample()
  const next = updateNode(roots, 't1', { title: 'renamed', status: 'done' })
  expect(findNode(next, 't1')!.title).toBe('renamed')
  expect(findNode(next, 't1')!.status).toBe('done')
  expect(findNode(roots, 't1')!.title).toBe('t1') // original untouched
})

test('addChild appends to parent and to roots', () => {
  const next = addChild(sample(), 'm1', leaf('t3'))
  expect(findNode(next, 'm1')!.children.map(c => c.id)).toEqual(['t1', 't2', 't3'])
  const next2 = addChild(sample(), null, leaf('p2'))
  expect(next2.map(r => r.id)).toEqual(['p', 'p2'])
})

test('deleteNode removes nested', () => {
  const next = deleteNode(sample(), 't1')
  expect(findNode(next, 't1')).toBeNull()
  expect(findNode(next, 'm1')!.children.map(c => c.id)).toEqual(['t2'])
})

test('moveNode reparents at index', () => {
  const next = moveNode(sample(), 't1', 'm2', 0)
  expect(findNode(next, 'm1')!.children.map(c => c.id)).toEqual(['t2'])
  expect(findNode(next, 'm2')!.children.map(c => c.id)).toEqual(['t1'])
})

test('reorderChildren swaps order', () => {
  const next = reorderChildren(sample(), 'm1', 0, 1)
  expect(findNode(next, 'm1')!.children.map(c => c.id)).toEqual(['t2', 't1'])
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tree`
Expected: FAIL (module not found / functions undefined).

- [ ] **Step 3: Implement tree.ts**

Create `src/lib/tree.ts`:

```ts
import type { Node } from '../types'

export function findNode(roots: Node[], id: string): Node | null {
  for (const n of roots) {
    if (n.id === id) return n
    const hit = findNode(n.children, id)
    if (hit) return hit
  }
  return null
}

export function findParent(roots: Node[], id: string, parent: Node | null = null): Node | null {
  for (const n of roots) {
    if (n.id === id) return parent
    const hit = findParent(n.children, id, n)
    if (hit !== null || n.children.some(c => c.id === id)) {
      return n.children.some(c => c.id === id) ? n : hit
    }
  }
  return null
}

export function leaves(node: Node): Node[] {
  if (node.children.length === 0) return [node]
  return node.children.flatMap(leaves)
}

function mapTree(roots: Node[], fn: (n: Node) => Node): Node[] {
  return roots.map(n => fn({ ...n, children: mapTree(n.children, fn) }))
}

export function updateNode(roots: Node[], id: string, patch: Partial<Node>): Node[] {
  return mapTree(roots, n => (n.id === id ? { ...n, ...patch } : n))
}

export function addChild(roots: Node[], parentId: string | null, child: Node): Node[] {
  if (parentId === null) return [...roots, child]
  return mapTree(roots, n => (n.id === parentId ? { ...n, children: [...n.children, child] } : n))
}

export function deleteNode(roots: Node[], id: string): Node[] {
  const filtered = roots.filter(n => n.id !== id)
  return filtered.map(n => ({ ...n, children: deleteNode(n.children, id) }))
}

export function moveNode(roots: Node[], id: string, newParentId: string | null, index: number): Node[] {
  const node = findNode(roots, id)
  if (!node) return roots
  const detached = deleteNode(roots, id)
  if (newParentId === null) {
    const copy = [...detached]
    copy.splice(index, 0, node)
    return copy
  }
  return mapTree(detached, n => {
    if (n.id !== newParentId) return n
    const kids = [...n.children]
    kids.splice(index, 0, node)
    return { ...n, children: kids }
  })
}

export function reorderChildren(roots: Node[], parentId: string | null, from: number, to: number): Node[] {
  const reorder = (arr: Node[]) => {
    const copy = [...arr]
    const [it] = copy.splice(from, 1)
    copy.splice(to, 0, it)
    return copy
  }
  if (parentId === null) return reorder(roots)
  return mapTree(roots, n => (n.id === parentId ? { ...n, children: reorder(n.children) } : n))
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tree`
Expected: PASS (all tree tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tree.ts src/lib/tree.test.ts
git commit -m "feat: immutable tree operations"
```

---

### Task 4: Progress derivation (`src/lib/progress.ts`)

**Files:**
- Create: `src/lib/progress.ts`
- Test: `src/lib/progress.test.ts`

**Interfaces:**
- Consumes: `Node`, `Status` from `../types`; `leaves` from `./tree`.
- Produces:
  - `progressOf(node: Node): number` — integer 0–100 = round(doneLeaves ÷ totalLeaves × 100); 0 if no leaves.
  - `statusCounts(node: Node): Record<Status, number>` — counts of descendant leaves by status.
  - `allLeavesDone(node: Node): boolean`.

- [ ] **Step 1: Write failing tests**

Create `src/lib/progress.test.ts`:

```ts
import { progressOf, statusCounts, allLeavesDone } from './progress'
import type { Node } from '../types'

const leaf = (id: string, status: Node['status'] = 'todo'): Node => ({
  id, shortId: id, title: id, status, children: [], createdAt: '', updatedAt: '',
})
const parent = (id: string, kids: Node[]): Node => ({ ...leaf(id), children: kids })

test('progressOf rounds done leaves', () => {
  const p = parent('p', [leaf('a', 'done'), leaf('b', 'todo'), leaf('c', 'done')])
  expect(progressOf(p)).toBe(67)
})

test('progressOf of a done leaf is 100', () => {
  expect(progressOf(leaf('x', 'done'))).toBe(100)
  expect(progressOf(leaf('y', 'todo'))).toBe(0)
})

test('statusCounts tallies leaves', () => {
  const p = parent('p', [leaf('a', 'done'), leaf('b', 'doing'), leaf('c', 'blocked')])
  expect(statusCounts(p)).toEqual({ todo: 0, doing: 1, done: 1, blocked: 1 })
})

test('allLeavesDone', () => {
  expect(allLeavesDone(parent('p', [leaf('a', 'done'), leaf('b', 'done')]))).toBe(true)
  expect(allLeavesDone(parent('p', [leaf('a', 'done'), leaf('b', 'todo')]))).toBe(false)
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- progress`
Expected: FAIL.

- [ ] **Step 3: Implement progress.ts**

Create `src/lib/progress.ts`:

```ts
import type { Node, Status } from '../types'
import { leaves } from './tree'

export function progressOf(node: Node): number {
  const ls = leaves(node)
  if (ls.length === 0) return 0
  const done = ls.filter(l => l.status === 'done').length
  return Math.round((done / ls.length) * 100)
}

export function statusCounts(node: Node): Record<Status, number> {
  const counts: Record<Status, number> = { todo: 0, doing: 0, done: 0, blocked: 0 }
  for (const l of leaves(node)) counts[l.status]++
  return counts
}

export function allLeavesDone(node: Node): boolean {
  const ls = leaves(node)
  return ls.length > 0 && ls.every(l => l.status === 'done')
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- progress`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/progress.ts src/lib/progress.test.ts
git commit -m "feat: progress derivation from leaf status"
```

---

### Task 5: Short IDs (`src/lib/shortid.ts`)

**Files:**
- Create: `src/lib/shortid.ts`
- Test: `src/lib/shortid.test.ts`

**Interfaces:**
- Consumes: `Node` from `../types`; `findNode` from `./tree`.
- Produces:
  - `projectPrefix(name: string): string` — uppercase initials of the first two words, else first two letters (e.g. "Acme Website" → "AW", "Handbook" → "HA").
  - `nextShortId(roots: Node[], prefix: string): string` — `PREFIX-N` where N is one greater than the highest existing counter for that prefix anywhere in the tree (starts at 1).

- [ ] **Step 1: Write failing tests**

Create `src/lib/shortid.test.ts`:

```ts
import { projectPrefix, nextShortId } from './shortid'
import type { Node } from '../types'

const n = (id: string, shortId: string): Node => ({
  id, shortId, title: id, status: 'todo', children: [], createdAt: '', updatedAt: '',
})

test('projectPrefix from words then letters', () => {
  expect(projectPrefix('Acme Website')).toBe('AW')
  expect(projectPrefix('Handbook')).toBe('HA')
})

test('nextShortId increments per prefix', () => {
  const roots: Node[] = [{ ...n('p', 'SR-1'), children: [n('c', 'SR-3')] }]
  expect(nextShortId(roots, 'SR')).toBe('SR-4')
  expect(nextShortId(roots, 'PG')).toBe('PG-1')
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- shortid`
Expected: FAIL.

- [ ] **Step 3: Implement shortid.ts**

Create `src/lib/shortid.ts`:

```ts
import type { Node } from '../types'

export function projectPrefix(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  const w = words[0] ?? 'X'
  return (w.slice(0, 2) || 'X').toUpperCase()
}

function collect(roots: Node[], out: string[]): void {
  for (const nd of roots) {
    out.push(nd.shortId)
    collect(nd.children, out)
  }
}

export function nextShortId(roots: Node[], prefix: string): string {
  const ids: string[] = []
  collect(roots, ids)
  let max = 0
  for (const id of ids) {
    const m = id.match(new RegExp(`^${prefix}-(\\d+)$`))
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `${prefix}-${max + 1}`
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- shortid`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shortid.ts src/lib/shortid.test.ts
git commit -m "feat: short id generation"
```

---

### Task 6: Serialization + empty document (`src/lib/serialize.ts`)

**Files:**
- Create: `src/lib/serialize.ts`
- Test: `src/lib/serialize.test.ts`

**Interfaces:**
- Consumes: `StoreDoc`, `Node`, `Tag` from `../types`.
- Produces:
  - `emptyDocument(): StoreDoc` → `{ version: 1, roots: [], tagPalette: DEFAULT_TAGS }`.
  - `serialize(doc: StoreDoc): string` → pretty JSON.
  - `deserialize(text: string): StoreDoc` → parses; throws `Error('Unsupported data version')` if `version > 1`; throws `Error('Invalid data file')` if shape is wrong (missing `roots` array).
  - `DEFAULT_TAGS: Tag[]` — a small starter palette, e.g. `[{name:'High',color:'red'},{name:'SEO',color:'blue'},{name:'Revenue',color:'teal'}]`.

- [ ] **Step 1: Write failing tests**

Create `src/lib/serialize.test.ts`:

```ts
import { emptyDocument, serialize, deserialize } from './serialize'

test('empty document is version 1 with empty roots', () => {
  const d = emptyDocument()
  expect(d.version).toBe(1)
  expect(d.roots).toEqual([])
  expect(Array.isArray(d.tagPalette)).toBe(true)
})

test('serialize/deserialize round-trips', () => {
  const d = emptyDocument()
  expect(deserialize(serialize(d))).toEqual(d)
})

test('rejects future versions', () => {
  expect(() => deserialize(JSON.stringify({ version: 2, roots: [], tagPalette: [] })))
    .toThrow('Unsupported data version')
})

test('rejects malformed shape', () => {
  expect(() => deserialize(JSON.stringify({ version: 1 }))).toThrow('Invalid data file')
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- serialize`
Expected: FAIL.

- [ ] **Step 3: Implement serialize.ts**

Create `src/lib/serialize.ts`:

```ts
import type { StoreDoc, Tag } from '../types'

export const DEFAULT_TAGS: Tag[] = [
  { name: 'High', color: 'red' },
  { name: 'SEO', color: 'blue' },
  { name: 'Revenue', color: 'teal' },
]

export function emptyDocument(): StoreDoc {
  return { version: 1, roots: [], tagPalette: [...DEFAULT_TAGS] }
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
  return {
    version: 1,
    roots: parsed.roots,
    tagPalette: Array.isArray(parsed.tagPalette) ? parsed.tagPalette : [...DEFAULT_TAGS],
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- serialize`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/serialize.ts src/lib/serialize.test.ts
git commit -m "feat: JSON serialization with version guard"
```

---

### Task 7: Storage adapter (`src/lib/storage.ts`)

**Files:**
- Create: `src/lib/storage.ts`
- Test: `src/lib/storage.test.ts`

**Interfaces:**
- Consumes: `StoreDoc` from `../types`; `serialize`/`deserialize`/`emptyDocument` from `./serialize`.
- Produces:
  - `interface StorageAdapter { load(): Promise<StoreDoc>; save(doc: StoreDoc): Promise<void> }`
  - `webAdapter: StorageAdapter` — reads/writes `localStorage['manage.doc']`; returns `emptyDocument()` if absent.
  - `makeTauriAdapter(): StorageAdapter` — writes `<appDataDir>/manage/data.json` via `@tauri-apps/plugin-fs`; creates the dir; returns `emptyDocument()` if the file is missing.
  - `pickAdapter(): StorageAdapter` — returns the Tauri adapter when `'__TAURI_INTERNALS__' in window`, else `webAdapter`.

- [ ] **Step 1: Write failing tests (web adapter only — Tauri fs is mocked out of unit scope)**

Create `src/lib/storage.test.ts`:

```ts
import { webAdapter } from './storage'
import { emptyDocument } from './serialize'

beforeEach(() => localStorage.clear())

test('load returns empty document when nothing stored', async () => {
  expect(await webAdapter.load()).toEqual(emptyDocument())
})

test('save then load round-trips', async () => {
  const doc = emptyDocument()
  doc.roots.push({ id: 'p', shortId: 'P-1', title: 'Proj', status: 'todo', children: [], createdAt: '', updatedAt: '' })
  await webAdapter.save(doc)
  expect(await webAdapter.load()).toEqual(doc)
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- storage`
Expected: FAIL.

- [ ] **Step 3: Implement storage.ts**

Create `src/lib/storage.ts`:

```ts
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
```

- [ ] **Step 4: Run tests**

Run: `npm test -- storage`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.ts src/lib/storage.test.ts
git commit -m "feat: storage adapter (web + tauri fs)"
```

---

### Task 8: Zustand store (`src/store/useStore.ts`)

**Files:**
- Create: `src/store/useStore.ts`, `src/lib/factory.ts`
- Test: `src/store/useStore.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces `src/lib/factory.ts`:
  - `newNode(title: string, opts?: Partial<Node>): Node` — builds a Node with `nanoid()` id, `status:'todo'`, empty children, `createdAt/updatedAt` = `new Date().toISOString()`, `shortId` left as `''` (the store assigns it).
- Produces `src/store/useStore.ts` — a Zustand hook `useStore` with state `{ doc: StoreDoc; ready: boolean }` and actions:
  - `init(adapter?)`: load doc, set ready.
  - `addProject(name: string): string` — creates a root Node, assigns color (round-robin over ColorKeys), icon, prefix+shortId; returns new id.
  - `addChildNode(parentId: string, title: string): string` — creates child, inherits root prefix for shortId.
  - `rename(id, title)`, `setStatus(id, status)`, `toggleDone(id)`, `patch(id, patch)`, `remove(id)`.
  - `move(id, newParentId, index)`, `reorder(parentId, from, to)`.
  - `setNodeStatusByDrag(id, status)` (alias used by Kanban).
  - `replaceDoc(doc)` (for import), `getDoc()`.
  - Persists (debounced 300ms) after any mutation via the injected adapter.

- [ ] **Step 1: Write factory.ts**

Create `src/lib/factory.ts`:

```ts
import { nanoid } from 'nanoid'
import type { Node } from '../types'

export function newNode(title: string, opts: Partial<Node> = {}): Node {
  const now = new Date().toISOString()
  return {
    id: nanoid(), shortId: '', title, status: 'todo', children: [],
    createdAt: now, updatedAt: now, ...opts,
  }
}
```

- [ ] **Step 2: Write failing store tests**

Create `src/store/useStore.test.ts`:

```ts
import { act } from '@testing-library/react'
import { useStore } from './useStore'
import type { StorageAdapter } from '../lib/storage'
import { emptyDocument } from '../lib/serialize'

function fakeAdapter(): StorageAdapter {
  let saved = emptyDocument()
  return { load: async () => saved, save: async d => { saved = d } }
}

beforeEach(async () => {
  await act(async () => { await useStore.getState().init(fakeAdapter()) })
})

test('addProject creates a root with prefix shortId and a color', () => {
  let id = ''
  act(() => { id = useStore.getState().addProject('Sample Room') })
  const p = useStore.getState().doc.roots.find(r => r.id === id)!
  expect(p.title).toBe('Sample Room')
  expect(p.shortId).toBe('SR-1')
  expect(p.color).toBeTruthy()
})

test('addChildNode nests and toggleDone flips status', () => {
  let pid = '', cid = ''
  act(() => { pid = useStore.getState().addProject('Cloud') })
  act(() => { cid = useStore.getState().addChildNode(pid, 'Task') })
  act(() => { useStore.getState().toggleDone(cid) })
  const child = useStore.getState().doc.roots[0].children[0]
  expect(child.id).toBe(cid)
  expect(child.status).toBe('done')
  act(() => { useStore.getState().toggleDone(cid) })
  expect(useStore.getState().doc.roots[0].children[0].status).toBe('todo')
})

test('setStatus and remove', () => {
  let pid = '', cid = ''
  act(() => { pid = useStore.getState().addProject('P') })
  act(() => { cid = useStore.getState().addChildNode(pid, 'T') })
  act(() => { useStore.getState().setStatus(cid, 'blocked') })
  expect(useStore.getState().doc.roots[0].children[0].status).toBe('blocked')
  act(() => { useStore.getState().remove(cid) })
  expect(useStore.getState().doc.roots[0].children).toHaveLength(0)
})
```

- [ ] **Step 3: Run to verify failure**

Run: `npm test -- useStore`
Expected: FAIL.

- [ ] **Step 4: Implement useStore.ts**

Create `src/store/useStore.ts`:

```ts
import { create } from 'zustand'
import type { StoreDoc, Node, Status, ColorKey } from '../types'
import { pickAdapter, type StorageAdapter } from '../lib/storage'
import { emptyDocument } from '../lib/serialize'
import { newNode } from '../lib/factory'
import { projectPrefix, nextShortId } from '../lib/shortid'
import { addChild, updateNode, deleteNode, moveNode, reorderChildren, findNode } from '../lib/tree'
import { PROJECT_ICONS } from '../theme'

const PALETTE: ColorKey[] = ['blue', 'teal', 'coral', 'violet', 'amber']

interface State {
  doc: StoreDoc
  ready: boolean
  adapter: StorageAdapter
  init: (adapter?: StorageAdapter) => Promise<void>
  addProject: (name: string) => string
  addChildNode: (parentId: string, title: string) => string
  rename: (id: string, title: string) => void
  setStatus: (id: string, status: Status) => void
  toggleDone: (id: string) => void
  patch: (id: string, patch: Partial<Node>) => void
  remove: (id: string) => void
  move: (id: string, newParentId: string | null, index: number) => void
  reorder: (parentId: string | null, from: number, to: number) => void
  replaceDoc: (doc: StoreDoc) => void
}

let timer: ReturnType<typeof setTimeout> | null = null
function schedulePersist(get: () => State) {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => { void get().adapter.save(get().doc) }, 300)
}

function rootPrefixFor(roots: Node[], id: string): string {
  const root = roots.find(r => r.id === id || findNode(r.children, id))
  return root ? projectPrefix(root.title) : 'X'
}

export const useStore = create<State>((set, get) => ({
  doc: emptyDocument(),
  ready: false,
  adapter: pickAdapter(),
  async init(adapter) {
    const a = adapter ?? get().adapter
    const doc = await a.load()
    set({ doc, adapter: a, ready: true })
  },
  addProject(name) {
    const roots = get().doc.roots
    const color = PALETTE[roots.length % PALETTE.length]
    const icon = PROJECT_ICONS[roots.length % PROJECT_ICONS.length]
    const node = newNode(name, { color, icon, status: 'todo' })
    node.shortId = nextShortId(roots, projectPrefix(name))
    set(s => ({ doc: { ...s.doc, roots: addChild(s.doc.roots, null, node) } }))
    schedulePersist(get)
    return node.id
  },
  addChildNode(parentId, title) {
    const node = newNode(title)
    const prefix = rootPrefixFor(get().doc.roots, parentId)
    node.shortId = nextShortId(get().doc.roots, prefix)
    set(s => ({ doc: { ...s.doc, roots: addChild(s.doc.roots, parentId, node) } }))
    schedulePersist(get)
    return node.id
  },
  rename(id, title) { get().patch(id, { title }) },
  setStatus(id, status) { get().patch(id, { status }) },
  toggleDone(id) {
    const n = findNode(get().doc.roots, id)
    get().patch(id, { status: n && n.status === 'done' ? 'todo' : 'done' })
  },
  patch(id, patch) {
    const stamped = { ...patch, updatedAt: new Date().toISOString() }
    set(s => ({ doc: { ...s.doc, roots: updateNode(s.doc.roots, id, stamped) } }))
    schedulePersist(get)
  },
  remove(id) {
    set(s => ({ doc: { ...s.doc, roots: deleteNode(s.doc.roots, id) } }))
    schedulePersist(get)
  },
  move(id, newParentId, index) {
    set(s => ({ doc: { ...s.doc, roots: moveNode(s.doc.roots, id, newParentId, index) } }))
    schedulePersist(get)
  },
  reorder(parentId, from, to) {
    set(s => ({ doc: { ...s.doc, roots: reorderChildren(s.doc.roots, parentId, from, to) } }))
    schedulePersist(get)
  },
  replaceDoc(doc) {
    set({ doc })
    schedulePersist(get)
  },
}))
```

- [ ] **Step 5: Run tests**

Run: `npm test -- useStore`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/store/useStore.ts src/lib/factory.ts src/store/useStore.test.ts
git commit -m "feat: zustand store with debounced persistence"
```

---

### Task 9: UI primitives (`ProgressRing`, `Tag`, `Checkbox`, `Icon`)

**Files:**
- Create: `src/components/ui/ProgressRing.tsx`, `src/components/ui/Tag.tsx`, `src/components/ui/Checkbox.tsx`, `src/components/ui/Icon.tsx`, `src/lib/colorMode.ts`
- Test: `src/components/ui/ProgressRing.test.tsx`, `src/components/ui/Tag.test.tsx`

**Interfaces:**
- Consumes: `COLORS`, `TINT`, `TINT_DARK` from `../../theme`; `Tag` type.
- Produces:
  - `colorMode.ts`: `prefersDark(): boolean` = `window.matchMedia('(prefers-color-scheme: dark)').matches`; `tagBg(color)`, `tagFg(color)` returning the right tint per mode.
  - `ProgressRing({ value, color, size })` — svg ring, matches prototype's `ring()`; renders `{value}%` text.
  - `Tag({ tag })` — pill with `tagBg/tagFg`.
  - `Checkbox({ status, onToggle })` — tabler `ti-square` / `ti-square-check-filled` button; `aria-label="toggle done"`.
  - `Icon({ name, className })` — `<i className={`ti ${name} ${className}`} aria-hidden />`.

- [ ] **Step 1: Write failing tests**

Create `src/components/ui/ProgressRing.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { ProgressRing } from './ProgressRing'

test('renders the percentage', () => {
  render(<ProgressRing value={67} color="teal" size={42} />)
  expect(screen.getByText('67%')).toBeInTheDocument()
})
```

Create `src/components/ui/Tag.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { Tag } from './Tag'

test('renders tag name', () => {
  render(<Tag tag={{ name: 'SEO', color: 'blue' }} />)
  expect(screen.getByText('SEO')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- ui/`
Expected: FAIL.

- [ ] **Step 3: Implement the primitives**

Create `src/lib/colorMode.ts`:

```ts
import type { ColorKey } from '../types'
import { TINT, TINT_DARK } from '../theme'

export function prefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}
export const tagBg = (c: ColorKey) => (prefersDark() ? TINT_DARK[c] : TINT[c])
export const tagFg = (c: ColorKey) => (prefersDark() ? TINT[c] : TINT_DARK[c])
```

Create `src/components/ui/Icon.tsx`:

```tsx
export function Icon({ name, className = '', style }: { name: string; className?: string; style?: React.CSSProperties }) {
  return <i className={`ti ${name} ${className}`} aria-hidden style={style} />
}
```

Create `src/components/ui/ProgressRing.tsx` (port math from prototype's `ring()`):

```tsx
export function ProgressRing({ value, color, size = 42 }: { value: number; color: string; size?: number }) {
  const r = (size - 8) / 2
  const c = 2 * Math.PI * r
  const off = c * (1 - value / 100)
  const cx = size / 2
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--line)" strokeWidth={5} />
      <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={5} strokeLinecap="round"
        strokeDasharray={c.toFixed(1)} strokeDashoffset={off.toFixed(1)} transform={`rotate(-90 ${cx} ${cx})`} />
      <text x={cx} y={cx + 4} textAnchor="middle" fontSize={size > 60 ? 15 : 11} fontWeight={700} fill="var(--ink)">
        {value}%
      </text>
    </svg>
  )
}
```

Create `src/components/ui/Tag.tsx`:

```tsx
import type { Tag as TagT } from '../../types'
import { tagBg, tagFg } from '../../lib/colorMode'

export function Tag({ tag }: { tag: TagT }) {
  return (
    <span style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: tagBg(tag.color), color: tagFg(tag.color) }}>
      {tag.name}
    </span>
  )
}
```

Create `src/components/ui/Checkbox.tsx`:

```tsx
import type { Status } from '../../types'
import { COLORS } from '../../theme'
import { Icon } from './Icon'

export function Checkbox({ status, color = 'teal', onToggle }: { status: Status; color?: keyof typeof COLORS; onToggle: () => void }) {
  const done = status === 'done'
  return (
    <button aria-label="toggle done" onClick={onToggle}
      style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, fontSize: 18, lineHeight: 1,
        color: done ? COLORS[color] : 'var(--faint)' }}>
      <Icon name={done ? 'ti-square-check-filled' : 'ti-square'} />
    </button>
  )
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- ui/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui src/lib/colorMode.ts
git commit -m "feat: UI primitives (ring, tag, checkbox, icon)"
```

---

### Task 10: TopBar + AvatarMenu

**Files:**
- Create: `src/components/TopBar.tsx`, `src/components/AvatarMenu.tsx`
- Test: `src/components/AvatarMenu.test.tsx`

**Interfaces:**
- Consumes: `Icon`.
- Produces:
  - `TopBar({ onExport, onImport })` — brand (logo + "Manage") left, `AvatarMenu` right. Port the `.bar`/`.brand` markup and inline styles from `prototype.html`.
  - `AvatarMenu({ onExport, onImport })` — avatar button "DC" that toggles a dropdown (Settings, Export data → `onExport`, Import data → `onImport`, About Manage). Closes on outside click (use a `useEffect` document listener). Port markup/styles from prototype's `.menu`.

- [ ] **Step 1: Write failing test**

Create `src/components/AvatarMenu.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AvatarMenu } from './AvatarMenu'

test('opens menu and fires export', async () => {
  const onExport = vi.fn()
  render(<AvatarMenu onExport={onExport} onImport={() => {}} />)
  expect(screen.queryByText('Export data')).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: /account menu/i }))
  await userEvent.click(screen.getByText('Export data'))
  expect(onExport).toHaveBeenCalled()
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- AvatarMenu`
Expected: FAIL.

- [ ] **Step 3: Implement TopBar + AvatarMenu**

Create `src/components/AvatarMenu.tsx` — port the `.avatar` button and `.menu` dropdown from `prototype.html`; give the avatar button `aria-label="account menu"`; render the four `.mi` rows; wire "Export data" to `onExport`, "Import data" to `onImport`; toggle an `open` state; add a `useEffect` that closes on outside `mousedown`.

Create `src/components/TopBar.tsx` — port the `.bar`/`.brand` header; render `<AvatarMenu onExport={onExport} onImport={onImport} />` on the right.

(Full inline styles are in `prototype.html`; copy them onto the JSX `style={{…}}` props.)

- [ ] **Step 4: Run tests**

Run: `npm test -- AvatarMenu`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/TopBar.tsx src/components/AvatarMenu.tsx src/components/AvatarMenu.test.tsx
git commit -m "feat: top bar and avatar menu"
```

---

### Task 11: Router + Breadcrumb + navigation state

**Files:**
- Create: `src/components/Breadcrumb.tsx`, `src/hooks/useNav.ts`
- Modify: `src/App.tsx`
- Test: `src/hooks/useNav.test.ts`

**Interfaces:**
- Produces:
  - `useNav`: a tiny Zustand (or `useState` lifted) store `{ path: string[]; open(id): void; goto(index): void; home(): void }` where `path` is the list of node ids from root to current board. `path[0]` is the current project; last element is the currently-open board.
  - `Breadcrumb({ roots, path, onHome, onGoto })` — renders `Home › <title> › …` using `findNode` to resolve titles; clicking a crumb calls `onGoto(index)`; Home calls `onHome`.
  - `App`: on mount calls `useStore.init()`; shows a loading placeholder until `ready`; renders `TopBar`, `Breadcrumb`, and (for now) `ProjectsHome` when `path` is empty or the project board when not. (BoardView/Kanban wired in later tasks — for this task, render a placeholder `<div>` for the project route so navigation is testable.)

- [ ] **Step 1: Write failing test for useNav**

Create `src/hooks/useNav.test.ts`:

```ts
import { act } from '@testing-library/react'
import { useNav } from './useNav'

beforeEach(() => act(() => useNav.getState().home()))

test('open pushes, goto truncates, home clears', () => {
  act(() => useNav.getState().open('p'))
  act(() => useNav.getState().open('m'))
  expect(useNav.getState().path).toEqual(['p', 'm'])
  act(() => useNav.getState().goto(0))
  expect(useNav.getState().path).toEqual(['p'])
  act(() => useNav.getState().home())
  expect(useNav.getState().path).toEqual([])
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- useNav`
Expected: FAIL.

- [ ] **Step 3: Implement useNav.ts**

Create `src/hooks/useNav.ts`:

```ts
import { create } from 'zustand'

interface Nav {
  path: string[]
  open: (id: string) => void
  goto: (index: number) => void
  home: () => void
}

export const useNav = create<Nav>(set => ({
  path: [],
  open: id => set(s => ({ path: [...s.path, id] })),
  goto: index => set(s => ({ path: s.path.slice(0, index + 1) })),
  home: () => set({ path: [] }),
}))
```

- [ ] **Step 4: Implement Breadcrumb + wire App**

Create `src/components/Breadcrumb.tsx` — port prototype's `.crumb`; map `path` to titles via `findNode(roots, id)`; render Home link + chevrons; last crumb bold.

Rewrite `src/App.tsx`:

```tsx
import { useEffect } from 'react'
import { useStore } from './store/useStore'
import { useNav } from './hooks/useNav'
import { TopBar } from './components/TopBar'
import { Breadcrumb } from './components/Breadcrumb'
import { ProjectsHome } from './components/ProjectsHome'

export default function App() {
  const ready = useStore(s => s.ready)
  const roots = useStore(s => s.doc.roots)
  const path = useNav(s => s.path)
  useEffect(() => { void useStore.getState().init() }, [])

  if (!ready) return <div style={{ padding: 40, color: 'var(--muted)' }}>Loading…</div>

  return (
    <>
      <TopBar onExport={() => {}} onImport={() => {}} />
      <Breadcrumb roots={roots} path={path}
        onHome={() => useNav.getState().home()} onGoto={i => useNav.getState().goto(i)} />
      <div style={{ padding: '12px 28px 70px', maxWidth: 1120 }}>
        {path.length === 0 ? <ProjectsHome /> : <div data-testid="project-route" />}
      </div>
    </>
  )
}
```

(Placeholder `<div data-testid="project-route" />` is replaced in Task 13.)

- [ ] **Step 5: Run tests**

Run: `npm test -- useNav`
Expected: PASS. (App will fail to compile until `ProjectsHome` exists — Task 12 provides it; if running the full suite now, temporarily stub `ProjectsHome`. Recommended: implement Task 12 before running `npm run dev`.)

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useNav.ts src/components/Breadcrumb.tsx src/App.tsx src/hooks/useNav.test.ts
git commit -m "feat: navigation state and breadcrumb"
```

---

### Task 12: ProjectsHome (status swimlanes) + ProjectCard

**Files:**
- Create: `src/components/ProjectsHome.tsx`, `src/components/ProjectCard.tsx`
- Test: `src/components/ProjectsHome.test.tsx`

**Interfaces:**
- Consumes: `useStore`, `useNav`, `HOME_ORDER`, `STATUS`, `progressOf`, `ProgressRing`, `Tag`, `Icon`, `COLORS`, `TINT/DARK`.
- Produces:
  - `ProjectCard({ node, onOpen })` — port prototype's `projectCard()` markup: accent bar (node.color), icon tile, status dot (`STATUS[node.status].dot`), title, description, tags, `shortId`, `ProgressRing value={progressOf(node)}`, footer "N modules · M tasks" (modules = `node.children.length`, tasks = `leaves(node).length`). Whole card `onClick={onOpen}`.
  - `ProjectsHome()` — reads `roots`; groups by `node.status` in `HOME_ORDER`; renders a `.lane` per non-empty status with header (dot + label + count) and a `.grid` of `ProjectCard`s; a dashed "New project" card in the `doing` lane (always shown, even when empty) that prompts for a name (use a simple inline input row or `window.prompt` for v1) and calls `useStore.getState().addProject(name)`.

- [ ] **Step 1: Write failing test**

Create `src/components/ProjectsHome.test.tsx`:

```tsx
import { render, screen, act } from '@testing-library/react'
import { ProjectsHome } from './ProjectsHome'
import { useStore } from '../store/useStore'
import { emptyDocument } from '../lib/serialize'

beforeEach(async () => {
  await act(async () => {
    await useStore.getState().init({ load: async () => emptyDocument(), save: async () => {} })
  })
})

test('shows a project under its status lane', () => {
  act(() => {
    const id = useStore.getState().addProject('Acme Website')
    useStore.getState().setStatus(id, 'doing')
  })
  render(<ProjectsHome />)
  expect(screen.getByText('Acme Website')).toBeInTheDocument()
  expect(screen.getByText('In progress')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- ProjectsHome`
Expected: FAIL.

- [ ] **Step 3: Implement ProjectCard + ProjectsHome**

Create both, porting markup/styles from `prototype.html` (`projectCard()` and `home()`), substituting real data from the store and `progressOf`/`leaves`. Wire `onOpen` to `useNav.getState().open(node.id)`. For "New project", read a name via `window.prompt('Project name')` (v1), then `addProject`.

- [ ] **Step 4: Run tests**

Run: `npm test -- ProjectsHome`
Expected: PASS.

- [ ] **Step 5: Manual check**

Run `npm run dev`, open http://localhost:1420 — you should see the empty home with a "New project" card; add one; it appears in the "In progress"/"To do" lane with a ring. Commit.

- [ ] **Step 6: Commit**

```bash
git add src/components/ProjectsHome.tsx src/components/ProjectCard.tsx src/components/ProjectsHome.test.tsx
git commit -m "feat: projects home with status swimlanes"
```

---

### Task 13: ProjectOverview + ViewToggle + BoardView + ModuleCard + project route

**Files:**
- Create: `src/components/ProjectOverview.tsx`, `src/components/ViewToggle.tsx`, `src/components/BoardView.tsx`, `src/components/ModuleCard.tsx`, `src/components/ProjectPage.tsx`
- Modify: `src/App.tsx` (replace the placeholder with `<ProjectPage />`)
- Test: `src/components/ProjectPage.test.tsx`

**Interfaces:**
- Consumes: `useStore`, `useNav`, `progressOf`, `statusCounts`, `leaves`, `findNode`, `ProgressRing`, `Tag`, `Checkbox`, `Icon`, `STATUS`, `COLORS`.
- Produces:
  - `ProjectOverview({ node })` — port `.over` block: big `ProgressRing size={72}`, name, description, tags, four stat tiles (Modules = `node.children.length`, Done/In progress/Blocked from `statusCounts`), and the `.sbar` breakdown (segments sized by `statusCounts` over `leaves.length`).
  - `ViewToggle({ view, onChange })` — segmented Board | Kanban (port `.toggle`).
  - `ModuleCard({ node, onOpen })` — port `.mcard`: icon, name, `done/total` from direct children where a child is "done" if `progressOf(child)===100` OR (leaf && status==='done'); a `.bar2` at `progressOf(node)`; up to N child checklist rows (`Checkbox` + title + child tags); a "New item" row calling `addChildNode(node.id, name)`; clicking the card body (not a checkbox) calls `onOpen` to drill in if the child has its own children.
  - `BoardView({ node })` — `.grid` of `ModuleCard`s for `node.children`, plus a dashed "New module" card (`addChildNode(node.id, name)`).
  - `ProjectPage()` — resolves the current board node = `findNode(roots, path[path.length-1])`; renders `ProjectOverview` (only at project root, i.e. `path.length===1`) or a compact header deeper; `ViewToggle`; then `BoardView` or `KanbanView` (Task 14) based on local `view` state.

- [ ] **Step 1: Write failing test**

Create `src/components/ProjectPage.test.tsx`:

```tsx
import { render, screen, act } from '@testing-library/react'
import ProjectPage from './ProjectPage'
import { useStore } from '../store/useStore'
import { useNav } from '../hooks/useNav'
import { emptyDocument } from '../lib/serialize'

beforeEach(async () => {
  await act(async () => {
    await useStore.getState().init({ load: async () => emptyDocument(), save: async () => {} })
  })
})

test('renders overview and a module card', () => {
  let pid = ''
  act(() => { pid = useStore.getState().addProject('Acme Website') })
  act(() => { useStore.getState().addChildNode(pid, 'Testing') })
  act(() => { useNav.getState().home(); useNav.getState().open(pid) })
  render(<ProjectPage />)
  expect(screen.getByText('Acme Website')).toBeInTheDocument()
  expect(screen.getByText('Testing')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^Board$/ })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- ProjectPage`
Expected: FAIL.

- [ ] **Step 3: Implement the components**

Create all five components, porting markup from `prototype.html` (`.over`, `.toggle`, `boardView()`, `.mcard`). For "done/total" on a `ModuleCard`, count direct children considered done via the helper above. Wire `ProjectPage` to hold `const [view, setView] = useState<'board'|'kanban'>('board')` and render `KanbanView` lazily (import in Task 14; for now render `BoardView` only and add the Kanban branch in Task 14).

Replace App's placeholder:

```tsx
// in App.tsx, swap the project-route div:
import ProjectPage from './components/ProjectPage'
// ...
{path.length === 0 ? <ProjectsHome /> : <ProjectPage />}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- ProjectPage`
Expected: PASS.

- [ ] **Step 5: Manual check + commit**

`npm run dev`: add a project, open it, see the overview + module board; add a module; drill into a module that has children. Then:

```bash
git add src/components/ProjectOverview.tsx src/components/ViewToggle.tsx src/components/BoardView.tsx src/components/ModuleCard.tsx src/components/ProjectPage.tsx src/App.tsx src/components/ProjectPage.test.tsx
git commit -m "feat: project overview, board view, module cards, drill-down"
```

---

### Task 14: KanbanView with dnd-kit (drag task cards between status columns)

**Files:**
- Create: `src/components/KanbanView.tsx`, `src/components/KanbanColumn.tsx`, `src/components/TaskCard.tsx`
- Modify: `src/components/ProjectPage.tsx` (render `KanbanView` when `view==='kanban'`)
- Test: `src/components/KanbanView.test.tsx`

**Interfaces:**
- Consumes: `@dnd-kit/core` (`DndContext`, `useDroppable`, `useDraggable`, `PointerSensor`, `useSensor`, `useSensors`), `useStore.setStatus`, `leaves`, `STATUS_ORDER`, `STATUS`, `Tag`, `COLORS`.
- Produces:
  - `TaskCard({ node, color })` — draggable (`useDraggable({ id: node.id })`); port `.tcard` markup (left border color, title, tags, module avatar). Apply `transform` from dnd-kit.
  - `KanbanColumn({ status, tasks })` — droppable (`useDroppable({ id: status })`); port `.col`; header with `STATUS[status].label` + count; renders `TaskCard`s.
  - `KanbanView({ node })` — flattens `leaves(node)` (or a "task" = leaf); wraps four `KanbanColumn`s (`STATUS_ORDER`) in a `DndContext`; on drag end, if `over` is a column id, calls `useStore.getState().setStatus(active.id, over.id)`.

- [ ] **Step 1: Write failing test**

Create `src/components/KanbanView.test.tsx`:

```tsx
import { render, screen, act } from '@testing-library/react'
import { KanbanView } from './KanbanView'
import { useStore } from '../store/useStore'
import { findNode } from '../lib/tree'
import { emptyDocument } from '../lib/serialize'

beforeEach(async () => {
  await act(async () => {
    await useStore.getState().init({ load: async () => emptyDocument(), save: async () => {} })
  })
})

test('renders columns and a task under its status', () => {
  let pid = '', tid = ''
  act(() => { pid = useStore.getState().addProject('P') })
  act(() => { tid = useStore.getState().addChildNode(pid, 'SMTP'); useStore.getState().setStatus(tid, 'done') })
  const node = findNode(useStore.getState().doc.roots, pid)!
  render(<KanbanView node={node} />)
  expect(screen.getByText('To do')).toBeInTheDocument()
  expect(screen.getByText('Done')).toBeInTheDocument()
  expect(screen.getByText('SMTP')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- KanbanView`
Expected: FAIL.

- [ ] **Step 3: Implement Kanban components**

Create `TaskCard`, `KanbanColumn`, `KanbanView` porting `.tcard`/`.col`/`.kb` markup. `KanbanView`:

```tsx
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import type { Node, Status } from '../types'
import { STATUS_ORDER } from '../theme'
import { leaves } from '../lib/progress' // re-export leaves from progress or import from tree
import { useStore } from '../store/useStore'
import { KanbanColumn } from './KanbanColumn'

export function KanbanView({ node }: { node: Node }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const tasks = leaves(node)
  function onDragEnd(e: DragEndEvent) {
    if (e.over && STATUS_ORDER.includes(e.over.id as Status)) {
      useStore.getState().setStatus(String(e.active.id), e.over.id as Status)
    }
  }
  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="kb" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, alignItems: 'start' }}>
        {STATUS_ORDER.map(s => (
          <KanbanColumn key={s} status={s} tasks={tasks.filter(t => t.status === s)} />
        ))}
      </div>
    </DndContext>
  )
}
```

(Import `leaves` from `../lib/tree`; the comment above notes either source — use `../lib/tree`.) Then wire `ProjectPage`: `{view === 'board' ? <BoardView node={node} /> : <KanbanView node={node} />}`.

- [ ] **Step 4: Run tests**

Run: `npm test -- KanbanView`
Expected: PASS.

- [ ] **Step 5: Manual DnD check**

`npm run dev`: open a project → Kanban → drag a card to another column; it stays; reload the page (data persists) and the card keeps its new status. Commit:

```bash
git add src/components/KanbanView.tsx src/components/KanbanColumn.tsx src/components/TaskCard.tsx src/components/ProjectPage.tsx src/components/KanbanView.test.tsx
git commit -m "feat: kanban view with drag-to-change-status"
```

---

### Task 15: Board reorder + re-nest with dnd-kit (sortable cards)

**Files:**
- Modify: `src/components/BoardView.tsx` (wrap in `DndContext` + `SortableContext`), `src/components/ModuleCard.tsx` (make sortable + a drop target)
- Create: `src/components/SortableCard.tsx`
- Test: `src/components/BoardView.test.tsx`

**Interfaces:**
- Consumes: `@dnd-kit/sortable` (`SortableContext`, `useSortable`, `arrayMove`, `rectSortingStrategy`), `useStore.reorder`, `useStore.move`.
- Produces:
  - `SortableCard({ id, children })` — wraps a card with `useSortable({ id })`, applies transform/transition, exposes drag listeners on a handle area.
  - `BoardView` change: wrap the module grid in `DndContext` + `SortableContext(items=childIds, strategy=rectSortingStrategy)`. On drag end within the same parent, call `useStore.getState().reorder(parentNode.id, fromIndex, toIndex)` computed via `arrayMove` index lookup.

- [ ] **Step 1: Write failing test (reorder logic via store, exercised through the component's handler)**

Create `src/components/BoardView.test.tsx`:

```tsx
import { act } from '@testing-library/react'
import { useStore } from '../store/useStore'
import { emptyDocument } from '../lib/serialize'

beforeEach(async () => {
  await act(async () => {
    await useStore.getState().init({ load: async () => emptyDocument(), save: async () => {} })
  })
})

test('reorder swaps sibling order in the store', () => {
  let pid = ''
  act(() => { pid = useStore.getState().addProject('P') })
  act(() => { useStore.getState().addChildNode(pid, 'A') })
  act(() => { useStore.getState().addChildNode(pid, 'B') })
  act(() => { useStore.getState().reorder(pid, 0, 1) })
  const kids = useStore.getState().doc.roots[0].children.map(c => c.title)
  expect(kids).toEqual(['B', 'A'])
})
```

(This locks the reorder contract the DnD handler calls; the visual drag itself is verified manually.)

- [ ] **Step 2: Run to verify pass/fail**

Run: `npm test -- BoardView`
Expected: PASS if Task 8's `reorder` is correct (this test guards the contract BoardView depends on). If it fails, fix `reorder` before proceeding.

- [ ] **Step 3: Implement sortable BoardView**

Create `SortableCard.tsx` and wrap `ModuleCard`s in `BoardView` with `DndContext` + `SortableContext`. On `onDragEnd`, map `active.id`/`over.id` to indices in `node.children` and call `reorder(node.id, from, to)`. Keep re-nest (dragging a card onto another card to nest) as a documented follow-up if it complicates v1 — reorder within a parent is the v1 requirement.

- [ ] **Step 4: Manual check**

`npm run dev`: open a project (Board view), drag a module card to a new position; order persists across reload.

- [ ] **Step 5: Commit**

```bash
git add src/components/BoardView.tsx src/components/ModuleCard.tsx src/components/SortableCard.tsx src/components/BoardView.test.tsx
git commit -m "feat: drag-to-reorder cards in board view"
```

---

### Task 16: DetailPanel (enrich on demand)

**Files:**
- Create: `src/components/DetailPanel.tsx`, `src/hooks/useDetail.ts`
- Modify: `src/App.tsx` (host the panel), `src/components/ModuleCard.tsx` + `src/components/TaskCard.tsx` + `src/components/ProjectCard.tsx` (title click opens detail)
- Test: `src/components/DetailPanel.test.tsx`

**Interfaces:**
- Produces:
  - `useDetail`: Zustand `{ openId: string | null; open(id): void; close(): void }`.
  - `DetailPanel()` — reads `openId`; if set, resolves the node and renders a right-side panel: editable title (calls `rename`), description textarea (`patch({description})`), status select (`setStatus`), priority select (`patch({priority})`), due date input (`patch({dueDate})`), tag add/remove against `doc.tagPalette` (`patch({tags})`), notes textarea. Empty fields render as empty inputs (no clutter on cards). A close button and click-outside close it. Slide-in styling: a fixed-height in-flow panel on the right (do not use `position:fixed`; use a flex layout column that occupies the right 340px when open).
- Consumes: `useStore`, `useDetail`, `findNode`, `STATUS`, `Tag`.

- [ ] **Step 1: Write failing test**

Create `src/components/DetailPanel.test.tsx`:

```tsx
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DetailPanel } from './DetailPanel'
import { useDetail } from '../hooks/useDetail'
import { useStore } from '../store/useStore'
import { emptyDocument } from '../lib/serialize'

beforeEach(async () => {
  await act(async () => {
    await useStore.getState().init({ load: async () => emptyDocument(), save: async () => {} })
  })
})

test('edits description of the open node', async () => {
  let pid = ''
  act(() => { pid = useStore.getState().addProject('P') })
  act(() => { useDetail.getState().open(pid) })
  render(<DetailPanel />)
  const box = screen.getByPlaceholderText(/description/i)
  await userEvent.type(box, 'Hello')
  expect(useStore.getState().doc.roots[0].description).toContain('Hello')
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- DetailPanel`
Expected: FAIL.

- [ ] **Step 3: Implement useDetail + DetailPanel + wire title clicks**

Create `useDetail.ts` and `DetailPanel.tsx`. In `ProjectCard`/`ModuleCard`/`TaskCard`, make the title clickable → `useDetail.getState().open(node.id)` (stop propagation so it doesn't also drill/drag). Host `<DetailPanel />` in `App` alongside the main content (App becomes a flex row: main content + panel).

- [ ] **Step 4: Run tests**

Run: `npm test -- DetailPanel`
Expected: PASS.

- [ ] **Step 5: Manual check + commit**

`npm run dev`: click a card title → panel opens; type a description, set priority/status/tags; reload → values persist. Commit:

```bash
git add src/components/DetailPanel.tsx src/hooks/useDetail.ts src/App.tsx src/components/ModuleCard.tsx src/components/TaskCard.tsx src/components/ProjectCard.tsx src/components/DetailPanel.test.tsx
git commit -m "feat: enrich detail panel"
```

---

### Task 17: Export / Import (Tauri dialog + web fallback)

**Files:**
- Create: `src/lib/transfer.ts`
- Modify: `src/App.tsx` (pass real `onExport`/`onImport` to `TopBar`)
- Test: `src/lib/transfer.test.ts`

**Interfaces:**
- Consumes: `useStore.getDoc`/`replaceDoc`, `serialize`/`deserialize`.
- Produces `transfer.ts`:
  - `exportDoc(doc: StoreDoc): Promise<void>` — in Tauri, `save` dialog → `writeTextFile` chosen path; in web, trigger a `Blob` download of `manage-export.json`.
  - `importDoc(): Promise<StoreDoc | null>` — in Tauri, `open` dialog → `readTextFile` → `deserialize`; in web, an `<input type=file>` read → `deserialize`. Returns null if cancelled. Throws on invalid file (surface via alert in the caller).

- [ ] **Step 1: Write failing test (deserialize guard exercised through importer parsing helper)**

Create `src/lib/transfer.test.ts`:

```ts
import { parseImport } from './transfer'
import { emptyDocument, serialize } from './serialize'

test('parseImport accepts a valid document', () => {
  const doc = emptyDocument()
  expect(parseImport(serialize(doc))).toEqual(doc)
})

test('parseImport throws on future version', () => {
  expect(() => parseImport(JSON.stringify({ version: 3, roots: [] }))).toThrow('Unsupported data version')
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- transfer`
Expected: FAIL.

- [ ] **Step 3: Implement transfer.ts**

Export `parseImport = (text: string) => deserialize(text)` plus `exportDoc`/`importDoc` using dynamic `@tauri-apps/plugin-dialog` + `plugin-fs` imports guarded by `'__TAURI_INTERNALS__' in window`, with the web Blob/`<input>` fallback otherwise.

- [ ] **Step 4: Wire App**

In `App.tsx`, set `onExport={() => exportDoc(useStore.getState().doc)}` and `onImport={async () => { const d = await importDoc(); if (d) useStore.getState().replaceDoc(d) }}` (wrap in try/catch → `alert(e.message)`).

- [ ] **Step 5: Run tests + manual check + commit**

Run: `npm test -- transfer` (PASS). Manual: in the running app, Export data → save file; Import it back. Commit:

```bash
git add src/lib/transfer.ts src/App.tsx src/lib/transfer.test.ts
git commit -m "feat: export and import data file"
```

---

### Task 18: Seed sample data (first-run) + full-suite green + manual smoke

**Files:**
- Create: `src/lib/seed.ts`
- Modify: `src/store/useStore.ts` (seed on first run when roots empty — behind a guard so tests using a fake adapter with empty doc are unaffected: only seed when `adapter` is the real one AND doc is empty AND a `manage.seeded` flag is unset)
- Test: `src/lib/seed.test.ts`

**Interfaces:**
- Produces `seed.ts`: `sampleDoc(): StoreDoc` — builds the demo projects (Acme Website, Mobile App v2, Brand Refresh, Team Handbook) with a couple of modules/tasks each, with proper `shortId`s and colors. `init` seeds this only on genuine first run.

- [ ] **Step 1: Write failing test**

Create `src/lib/seed.test.ts`:

```ts
import { sampleDoc } from './seed'

test('sample doc has the four notebook projects', () => {
  const d = sampleDoc()
  expect(d.roots.map(r => r.title)).toEqual(['Acme Website', 'Mobile App v2', 'Brand Refresh', 'Team Handbook'])
  expect(d.roots.every(r => r.shortId.length > 0)).toBe(true)
  expect(d.roots[0].children.length).toBeGreaterThan(0)
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- seed`
Expected: FAIL.

- [ ] **Step 3: Implement seed.ts + first-run seeding**

Build `sampleDoc()` from prototype's data. In `useStore.init`, after load: if `doc.roots.length === 0` and running under Tauri and `localStorage.getItem('manage.seeded') !== '1'`, set the doc to `sampleDoc()`, persist, and set the flag. (Keep unit tests unaffected: the fake adapters in tests inject their own empty docs and jsdom is not Tauri, so seeding is skipped.)

- [ ] **Step 4: Full suite green**

Run: `npm test`
Expected: ALL tests pass.

- [ ] **Step 5: Type check + build**

Run:
```bash
npm run build
```
Expected: `tsc` passes with no errors; Vite builds `dist/`.

- [ ] **Step 6: Manual smoke test in the native app**

Run: `npm run tauri dev`
Verify end-to-end: sample projects appear grouped by status → open one → overview + Board → add module/task → toggle checkboxes (progress ring updates) → switch to Kanban → drag a card between columns → open a title → edit detail fields → drag to reorder in Board → Export then Import → quit and relaunch: all data persisted. Fix anything that fails, re-run tests.

- [ ] **Step 7: Commit**

```bash
git add src/lib/seed.ts src/store/useStore.ts src/lib/seed.test.ts
git commit -m "feat: first-run sample data and final integration"
```

---

## Self-Review

**Spec coverage check (spec → task):**
- Card-first visual UI, tokens/shadows/dotted canvas → Tasks 1, 9, 12, 13.
- One recursive Node, infinite nesting → Tasks 2, 3; drill-down Tasks 11, 13.
- Minimal by default / enrich on demand → Task 16 (DetailPanel).
- Local JSON storage, export/import, version guard → Tasks 6, 7, 17.
- Home grouped by status (swimlanes) → Task 12.
- Project overview page (ring, stats, breakdown) → Task 13.
- Board ⇄ Kanban toggle → Tasks 13, 14.
- Drag-and-drop (Kanban status + board reorder) via dnd-kit → Tasks 14, 15.
- Tags/labels → Tasks 2 (types), 9 (Tag), 16 (edit).
- Avatar menu (Profile+Settings, no logout) → Task 10.
- Progress derivation + status dots → Task 4, used throughout.
- shortId → Task 5.
- Tauri native shell + fs persistence → Tasks 1, 7, 18.
- Tests (unit logic + component behavior + manual smoke) → every task; final green in Task 18.

**Deferred to v1.1 (documented in spec §11, not a gap):** re-nest by drag (Task 15 keeps reorder only), filter/search by tag, canvas connector view, cloud sync/accounts.

**Placeholder scan:** No "TBD"/"implement later"; each code step ships real code or an explicit port-from-`prototype.html` instruction against concrete, committed reference markup.

**Type consistency:** `Node` uses `status` (no `done` field) everywhere; `toggleDone` maps to `status`; `StoreDoc` = `{version,roots,tagPalette}` consistent across serialize/storage/store/transfer/seed; `useNav.path` (string[]) consistent in App/Breadcrumb/ProjectPage; `setStatus(id,status)` signature consistent in store/Kanban.
