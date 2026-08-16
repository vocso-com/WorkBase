# Multi-format export + account backup

**Date:** 2026-08-16
**Status:** Built, and extended: CSV was added as a fifth format, per-project export stayed a dropdown while account-level export/import became dialogs, imports resolve collisions per project (add / update / skip), and every export carries the product mark.
**Scope:** 2 of 3. Build after the Flow work lands.

## Problem

Two separate gaps that share machinery:

1. **No way to get work out of a view.** A project can only be looked at inside WorkBase. There is
   no way to put a Flow canvas in a client deck, hand a Kanban snapshot to someone without the
   app, or feed a project's structure into another tool.
2. **Account backup is hidden and undocumented.** Whole-document JSON export/import already exists
   in `src/lib/transfer.ts`, but it is only reachable from the avatar menu, is labelled ambiguously
   ("Export data"), warns about nothing, and is not where a user setting up a second machine would
   look. Settings even tells them to "use Export from the menu" without saying what that produces.

## Goals

1. Every view exports as **Image, PDF, JSON and Markdown**.
2. Settings has an explicit **Export / Import data** section that round-trips a whole account
   between two machines.

## Non-goals

- Cloud sync. This is file-based transfer; sync is a separate, paid product direction.
- Per-view export variants. Markdown and JSON describe the *data*, which is identical across
  views; only Image and PDF are view-dependent.
- Selectable-text PDFs (see the PDF decision below).

---

## Part A: view export

### Formats

**JSON — a portable project, not the whole document.** A new envelope so a project can be moved
into another install and still resolve its stages and tags:

```ts
interface ProjectExport {
  version: 1
  kind: 'project'
  exportedAt: string
  node: Node                       // the project subtree, ids intact
  stages: Stage[]                  // only those referenced by the subtree
  stageLabels?: Record<string,string>
  tagPalette: Tag[]                // only tags used in the subtree
}
```

This is deliberately distinct from the whole-account backup in Part B, which keeps its existing
`StoreDoc` shape. Import of a `ProjectExport` merges: it appends the project to the current
workspace, re-issues `shortId`s against existing roots, and adds any missing stages/tags rather
than overwriting the user's.

**Markdown — a pure function.** `projectToMarkdown(node, stages): string`. `#` project, `##`
module, `- [ ]` / `- [x]` tasks by status, with due date, priority, tags and stage rendered as
inline suffixes, and descriptions as indented blockquotes. Deterministic and fully unit-testable
with no DOM involvement — this is the format that gets the heaviest test coverage because it is
the cheapest to test and the most likely to be diffed by a user.

**Image (PNG) — rasterize the live view.** The important subtlety: **export the full content, not
the visible region.** Flow is pan/zoomed and clipped by its viewport, and Board/Kanban scroll. The
exporter targets the *content* element at natural size (`.fcanvas` for Flow, the scroll container's
full extent elsewhere) with pan/zoom transforms neutralised, then rasterizes at 2× for a crisp
result.

*Decision:* add the `html-to-image` dependency rather than hand-rolling SVG `foreignObject`
serialization. Hand-rolling is possible but the Tabler icon webfont has to be inlined as base64 or
every icon renders as a tofu box, and computed styles have to be walked and inlined by hand — a
lot of fragile code to avoid one small maintained library. Flagged as a decision worth challenging
if adding a dependency is unwelcome.

**PDF — the PNG wrapped in a single page.** A small hand-rolled `src/lib/pdf.ts` (~80 lines) emits
a one-page PDF sized to the image, with no PDF library dependency. Page size follows the image
aspect ratio, capped to a sane max so a wide Flow canvas does not produce an absurd page.

*Accepted tradeoff:* the text in the PDF is not selectable or searchable, because it is a picture.
This is the right call for "hand someone what I'm looking at," which is the actual use. A
text-native PDF rendered from the Markdown is a plausible later addition and would be a second
menu entry, not a replacement.

### Delivery

Both save paths already exist in `transfer.ts` and get factored out into a shared helper: Tauri
uses `plugin-dialog`'s `save()` + `plugin-fs` write; web builds a blob and clicks an anchor. The
helper takes bytes-or-text plus a suggested filename and extension.

Filenames: `<project-slug>-YYYY-MM-DD.<ext>`.

### UI

An **Export** button in the project header opens a small menu: Image · PDF · Markdown · JSON.
Image and PDF show a brief progress state, since rasterizing a large canvas is not instant. A
failure surfaces as an inline error in the menu, not an `alert()`.

### Structure

```
src/lib/export/
  index.ts        # exportView(kind, node, viewEl) — the one entry point the UI calls
  markdown.ts     # projectToMarkdown  (pure, heavily tested)
  json.ts         # toProjectExport / fromProjectExport  (pure, tested)
  image.ts        # DOM → PNG bytes
  pdf.ts          # PNG bytes → PDF bytes
  save.ts         # Tauri / web save, shared with transfer.ts
```

`markdown.ts` and `json.ts` are pure and get real unit tests. `image.ts` and `pdf.ts` are
DOM/binary and get a smoke test each (produces non-empty bytes with the right magic header)
rather than pixel assertions.

---

## Part B: account export / import in Settings

A new **Export & Import data** section in `SettingsModal`, placed directly above the existing
Storage & privacy block, which currently points vaguely at the menu.

**Export** — reuses `exportDoc`, renamed in the UI to "Export account backup", filename
`workbase-backup-YYYY-MM-DD.json`. Alongside it, an explicit statement of what the file contains:
every workspace, project, task, template, label, stage and setting, plus embedded images and
attachments.

**Import** — reuses `importDoc`, behind a `ConfirmDialog` (the app already has one) that says
plainly that importing **replaces everything currently on this device**, and offers "export a
backup first" as the safe path before proceeding. This is the one destructive operation in the
app and today it has no confirmation at all — that is a real bug this section fixes.

**Size caveat, surfaced in the UI:** attachments and images are stored as data-URLs inside the
document, so a backup of an account with many images is large. The section shows the approximate
size of the current document next to the export button so nobody is surprised by a 200MB file.

The avatar-menu entries stay, so existing muscle memory keeps working; both paths call the same
functions.

---

## Open decisions to confirm before building

1. **`html-to-image` dependency** for PNG rasterization, vs. hand-rolled `foreignObject`.
2. **Image-based PDF** (what you see, not selectable) vs. text-native PDF from Markdown.
3. Whether the **Export button** belongs in the project header or inside the existing `NodeMenu`.
