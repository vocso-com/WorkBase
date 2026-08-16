# Flow view: default view + richer cards

**Date:** 2026-08-16
**Status:** Approved, ready to plan
**Scope:** 1 of 3. Siblings: multi-format export, template directory. This spec is independent of both.

## Problem

Flow is the view that best shows what WorkBase is — a project as a shaped tree rather than a
list — but it is buried fourth in Settings and is not what a project opens in. Its cards are
also the thinnest in the app: a task card is a status dot, a title and a due chip in 58px of
height, so a canvas of them carries less information than the equivalent Board.

Separately, `Node.dependsOn` has existed since the dependencies work but is invisible in Flow.
The one view whose whole job is showing relationships does not show that relationship.

## Goals

1. A project opens in Flow unless it or the user says otherwise, and Flow is listed first.
2. Flow cards carry enough content to be read without opening the card modal.
3. Dependencies render as edges, making Flow a dependency map and not just an org chart.

## Non-goals

- Changing what any other view looks like.
- Editing dependencies from the canvas (drag one card onto another to create a block). Read-only
  rendering this pass.
- Auto-layout changes. The tidy-tree algorithm in `layoutTree` stays as it is; only node
  measurement and the edge set change.

---

## 1. Flow becomes the default view

Three call sites currently fall back to `'board'`:

| Location | Change |
|---|---|
| `src/hooks/useView.ts:10` | initial `view: 'board'` → `'flow'` |
| `src/hooks/useTabs.ts:76` | `?? 'board'` → `?? 'flow'` |
| `src/components/SettingsModal.tsx:95` | `profile?.defaultView ?? 'board'` → `?? 'flow'` |

`DEFAULT_VIEW_OPTS` in `SettingsModal.tsx` is reordered to **Flow, Board, Kanban, Outline**, and
the in-app view switcher (`TabBar`) is reordered to match so the two never disagree.

**Precedence is unchanged.** A project's own `node.view` still wins over `profile.defaultView`,
which still wins over the built-in fallback. No migration runs and no saved preference is
rewritten.

**Known consequence:** an existing project that never had a view explicitly set now opens in Flow
where it previously opened in Board. This is the intended effect of the change and is one click
to reverse per project, but it does move furniture for anyone already using the app.

### Testing

`useNav.test.ts` / a new `useTabs` case asserts the fallback chain: explicit `node.view` wins;
absent that, `profile.defaultView` wins; absent both, `'flow'`.

---

## 2. Richer cards

### Task card (depth ≥ 2)

Stacked, in order:

1. **Title** — up to 2 lines, clamped.
2. **Description snippet** — `node.description`, up to 2 lines, clamped, muted. Omitted entirely
   when there is no description (the row takes no height).
3. **Footer row** — stage pill (colored background, label from `stageMeta`), `DueChip`, priority
   marker. Rendered only if at least one of the three has a value.
4. **Tag chips** — unchanged from today (first 2 tags).

The 2px status-colored left border and the `color-mix` tinted background stay.

### Module card (depth 1, has children)

Gains the same 2-line description snippet, and the existing `done/total` count is promoted into a
rollup row that also shows the earliest due date among descendants (as a `DueChip`). The icon +
title head and the `ProgressBar` stay.

### Root card (depth 0)

**Unchanged.** The color band, icon, title, `n modules · n tasks` subtitle and `ProgressRing`
already read well and the root is not where information is scarce.

### Sizing: measured per card

`layout.ts` currently hardcodes:

```ts
function nodeH(depth: number): number {
  if (depth === 0) return 94
  if (depth === 1) return 72
  return 58
}
```

This becomes `nodeH(node: Node, depth: number): number`, summing the rows that will actually
render:

```
padding (top + bottom)
+ titleLines  × TITLE_LINE_H
+ descLines   × DESC_LINE_H      (0 when no description)
+ FOOTER_H                       (0 when no stage pill, due and priority)
+ TAGS_H                         (0 when no tags)
```

Line counts come from a **deterministic character-width estimate** against the fixed card width —
`ceil(text.length / charsPerLine)`, capped at 2 — not from DOM measurement. This keeps `layoutTree`
a pure synchronous function that can be unit-tested and cannot shift the canvas after paint.

`NODE_W` goes **224 → 260** so a description has room to be worth showing.

CSS gets matching `-webkit-line-clamp: 2` on title and description, so a render can never exceed
the height the estimate reserved.

**Risk, accepted:** if the rendered font is wider than the estimate assumes, text clamps a line
early rather than overflowing its box. Degraded, not broken. If it proves visibly wrong in
practice the constants are one place to tune.

### Testing

`layout.test.ts` gains cases pinning the computed height for each content combination: bare title;
title + description; title + footer; title + description + footer + tags; and a long title that
must clamp at 2 lines. These are exact-number assertions, so a constant change that shifts layout
cannot land silently.

---

## 3. Dependency edges

`FlowEdge` gains a discriminator:

```ts
export interface FlowEdge {
  id: string
  from: string
  to: string
  color: string
  kind: 'child' | 'dep'
}
```

`layoutTree` emits, in addition to today's parent→child edges, one `kind: 'dep'` edge per
`dependsOn` entry — **but only where both endpoints are present in the laid-out node set**. A
dependency pointing into a collapsed subtree produces no edge, so there are never dangling
connectors. Ids are namespaced (`dep:${from}->${to}`) so they cannot collide with child edge ids.

### Rendering

Child edges stay exactly as today: solid, 3px, colored by the target's color, routed
left→right (or top→bottom) with the existing cubic.

Dep edges are dashed, muted amber, thinner, with an arrowhead marker, and are painted **under**
child edges so the hierarchy stays the dominant read. Because a dependency can point in any
direction — including backwards or across branches — they route as a cubic between the facing
side-midpoints of the two boxes (chosen by comparing box centers), not with the strictly
directional routing child edges use.

### Toggle

A button in `flow-ctl`, next to the orientation toggle. State persists per-project as a new
optional field, matching the existing `flowOrientation` pattern exactly:

```ts
// Node
flowDeps?: boolean   // undefined = on
```

Defaults to on. Absent means on, so no migration is needed and existing documents are unaffected.

### Testing

`layout.test.ts`: a dep edge is emitted for a visible pair; no edge is emitted when the target is
inside a collapsed subtree; dep edge ids never collide with child edge ids; a node with no
`dependsOn` produces no dep edges.

---

## Files touched

| File | Change |
|---|---|
| `src/lib/layout.ts` | content-measured `nodeH`, `NODE_W` 224→260, dep edges, `FlowEdge.kind` |
| `src/lib/layout.test.ts` | height cases, dep edge cases |
| `src/components/FlowView.tsx` | card bodies, dashed edge rendering, deps toggle |
| `src/index.css` | `.fn-task` / `.fn-mod` layout, line clamps, dashed edge styles |
| `src/types.ts` | `Node.flowDeps?: boolean` |
| `src/hooks/useView.ts` | default `'flow'` |
| `src/hooks/useTabs.ts` | fallback `'flow'` |
| `src/components/SettingsModal.tsx` | fallback `'flow'`, option order |
| `src/components/TabBar.tsx` | option order |

## Build order

1. Default-view flip (small, independent, shippable alone).
2. Measured heights in `layout.ts` with tests, before any JSX changes — the layout must be right
   before the cards fill it.
3. Card bodies + CSS.
4. Dep edges + toggle.
