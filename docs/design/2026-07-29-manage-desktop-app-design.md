# Manage — Visual Project Tracker (Design Spec)

Date: 2026-07-29
Status: Approved pending final review

## 1. Summary

A native macOS desktop app for tracking personal projects, their modules, and
tasks at any depth. The interface is **card-first and visual**: projects and
modules are elevated cards on a dotted canvas, drilled into by clicking. Every
item is minimal by default (name + checkbox + progress) and can be *enriched* on
demand with description, status, priority, due date, and tags.

Data is stored **locally** as a single JSON file on disk. No accounts, no
backend, works fully offline. Export/import keeps the data portable and leaves a
clean path to optional cloud sync later.

## 2. Goals

- Super-visual, card-based UI with real depth (shadows, color, progress rings).
- Infinite nesting: project → module → task → sub-task → … all the same node.
- Minimal by default; rich detail only when the user adds it.
- Instant, offline, native-feeling Mac app.
- Data owned by the user in a portable, exportable file.

## 3. Non-goals (v1)

Accounts/login, cloud sync, sharing/collaboration, notifications, recurring
tasks, calendar integration, mobile build. The avatar menu is Profile +
Settings only (no logout — there is no account to log out of yet).

## 4. Tech stack

- **Frontend:** React + TypeScript + Vite
- **Styling:** Tailwind CSS (custom tokens for the card/shadow/color system)
- **Desktop shell:** Tauri v2 (native macOS window, file-system access)
- **Storage:** single JSON document written to the app data dir via Tauri fs
- **State:** lightweight store (Zustand) holding the node tree in memory,
  persisted to disk on change (debounced).

All prerequisites confirmed installed: Node 20, Rust 1.97, Xcode CLT.

## 5. Data model

One recursive node type at every level. Top-level nodes are "projects" by
convention only — no special type.

```ts
type Node = {
  id: string;            // stable uuid
  shortId: string;       // human id, e.g. "PG-1457" (prefix from ancestor project)
  title: string;         // always shown
  done: boolean;         // the checkbox
  children: Node[];      // infinite nesting

  // visual identity (projects/modules; optional deeper down)
  color?: string;        // ramp key; inherited/auto-assigned
  icon?: string;         // tabler icon name

  // enrich-on-demand (all optional; hidden in UI until set)
  description?: string;
  status?: 'todo' | 'in-progress' | 'done' | 'blocked';
  priority?: 'low' | 'med' | 'high';
  dueDate?: string;      // ISO date
  tags?: string[];
  notes?: string;

  createdAt: string;
  updatedAt: string;
};

type Store = {
  version: 1;            // schema version for safe migrations
  roots: Node[];         // top-level projects
};
```

- **Progress** is derived, not stored: a node's progress = share of descendant
  leaf nodes that are `done` (shown as a ring on cards, a bar in modules, an
  `x/y` pill on rows).
- **Status dot** color derives from progress/status (e.g. green = complete,
  amber = in progress, gray = not started, red = blocked).
- **shortId** uses the root project's prefix + a counter (e.g. `SR-12`), assigned
  on creation, stable thereafter.

## 6. Screens & navigation

Drill-down model with a persistent top bar (logo left, avatar menu right) and a
breadcrumb.

1. **Home (projects board), grouped by status:** project cards laid out in
   status swimlanes — `In progress`, `Planned`, `On hold`, `Done` — each a
   labelled section with a count. A "Group by" control allows Status (default)
   or None (flat grid). Each card: colored top accent, icon, title, optional
   description, progress ring, status dot, footer meta ("3 modules · 12 tasks").
   A dashed "New project" card ends the relevant lane.
2. **Project overview page:** breadcrumb `Projects › Acme Website`. Opens with an
   overview header — large progress ring + name/description on the left, and a
   row of stat tiles on the right (Modules, Tasks, Done, In progress, Blocked),
   plus a thin status-breakdown bar. Below the header is a **view toggle:
   Board | Kanban**.
   - **Board view:** the project's children as module cards (progress bar + top
     checklist items + tag labels), drill-in on click. "New module" card at end.
   - **Kanban view:** the project's tasks laid out as columns by status
     (`To do / In progress / Done / Blocked`); task cards are dragged between
     columns to change status. Column headers show counts.
3. **Deeper levels:** because nesting is infinite, entering *any* card whose
   children themselves have children shows another card board (with its own
   Board/Kanban toggle). Cards whose children are all leaves show those leaves
   as a checklist inside the card.
4. **Leaf items:** plain checkbox rows (checkbox + title + optional tags/pills).

### Avatar menu (top-right)
Avatar (initials or photo) opens a dropdown: profile header (name), Settings
(theme, data-file location), Export / Import, About. No login/logout in v1.

### Detail panel (enrich)
Clicking an item's title opens a right-side detail panel: edit title,
description, status, priority, due date, tags/labels, notes, color/icon (for
project/module-level nodes). Empty fields are never rendered on the cards/rows.

## 6a. Tags / labels

Tags are colored labels (name + color). A per-store tag palette is reused across
items. Tags render as small pills on cards and in Kanban; the detail panel
manages add/remove. Filtering by tag is v1.1.

## 7. Card visual language

Matches the reference card the user provided:

- Elevated white card, `border-radius: 12px`, soft two-layer shadow
  (contact + diffused), hover lifts slightly.
- Colored **top accent bar** in the item's color.
- Icon circle (top-left), title (500 weight) + muted subtitle.
- **Status dot** top-right.
- Tag **badge chips**; muted **shortId** in the card body.
- Footer row separated by a hairline divider with a meta line.
- Dotted-grid **canvas background** behind the cards.
- Full light/dark mode support.

## 8. Core interactions

- Add: "New" card / `+` on a board adds a child; inline title entry.
- Check: toggle `done`; parents show rolled-up progress and auto-complete
  visually when all descendants are done.
- Open: click title → detail panel.
- Collapse: n/a on boards; checklist groups inside a card can collapse.
- Rename inline; delete with confirm.
- **Drag and drop:** reorder cards within a board, drag a card onto another to
  re-nest it, and drag task cards between Kanban columns to change status.
  (Library: dnd-kit for accessible, smooth pointer/keyboard DnD.)
- Export / Import: write/read the full JSON document (backup + sync bridge).

## 9. Persistence

- On any mutation, update the in-memory store and debounce-write the whole JSON
  document to `<appDataDir>/manage/data.json` via Tauri fs.
- On launch, read that file (create an empty store if absent).
- Export = copy the JSON to a user-chosen path; Import = validate `version` +
  shape, then replace/merge.

## 10. Testing

- Unit-test pure logic: progress derivation, shortId assignment, add/move/
  delete tree operations, JSON (de)serialization + schema-version guard.
- Component tests for card board, checklist row, and detail panel behaviors
  (enrich fields hidden until set; check toggles roll up).
- Manual smoke test in the running Tauri app on macOS before calling it done.

## 11. Open items / future (v1.1+)

- Filter/search by tag, priority, due date.
- Optional canvas view with connector lines between cards (mind-map feel,
  matching the notebook sketch and the reference card's connector arrow).
- Optional cloud sync + accounts + login/logout (Option B), reusing the same
  JSON model.
