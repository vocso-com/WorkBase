# WorkBase

**A local-first desktop project planner whose status is computed from the work, not reported by hand.**

Built with React, TypeScript and [Tauri](https://tauri.app). Your data is a single
document on your own machine. There is no account, no sign-in, and no server.

---

## The idea

Every project tool fails the same way: the board goes stale, so nobody trusts it, so
people ask in chat instead. The cause is structural — **status is declared**, so a human
has to remember to move things, and humans don't.

WorkBase makes status **computed**. You tick the one leaf task in front of you; every
ancestor derives its own state from below. The top-level view is true because it is
derived from the bottom, where the only honest data lives.

What follows from that:

- **Weighted rollup at any depth.** Progress is a weighted sum of children, not a
  count of checkboxes.
- **Sizes declared by comparison.** You size a task against its siblings, not in hours.
- **Health as a state with evidence.** A project is "at risk" *and it can tell you why*,
  in plain language.
- **Staleness scaled to tempo.** A task that normally moves daily is stale after a day;
  one that moves monthly is not.
- **Scope growth measured from kickoff**, so "we're behind" can be distinguished from
  "we added a third more work."
- **Never automatic completion.** The app advances things to In Progress on its own, but
  finishing is always a human's call.

The full design rationale is in
[docs/superpowers/specs/2026-08-19-computed-status-and-weighted-rollup-design.md](docs/superpowers/specs/2026-08-19-computed-status-and-weighted-rollup-design.md).

## Views

Projects are one tree, shown four ways — **Flow** (a dependency canvas), **Board**,
**Kanban**, and **Columns**. Plus a My Work view that pulls what's due across every
project, full-text search, dependency links with blocked-state propagation, and
multi-format import/export.

## Getting started

```bash
npm install
npm run dev
```

That runs the app in a browser at `http://localhost:5173`, where it stores data in
IndexedDB. For the desktop build you'll need the
[Tauri prerequisites](https://tauri.app/start/prerequisites/) (Rust and your platform's
toolchain), then:

```bash
npm run tauri dev
```

Other scripts:

```bash
npm test          # vitest, 291 tests
npm run typecheck # tsc --noEmit
npm run build     # production web build
```

## Where your data lives

| Build | Location |
| --- | --- |
| Desktop (Tauri) | A JSON document in the OS application-data directory |
| Browser | IndexedDB on that device |

Nothing is uploaded. There is no telemetry and no network call in the app's normal
operation. Export any time from **About → Export your data**.

## Adding a storage backend

Persistence sits behind a two-method interface in
[`src/lib/storage.ts`](src/lib/storage.ts):

```ts
export interface StorageAdapter {
  load(): Promise<StoreDoc>
  save(doc: StoreDoc): Promise<void>
}
```

The app ships two implementations — Tauri filesystem and IndexedDB — and picks one at
startup based on the platform. That's the seam to extend if you want the document to
live somewhere else.

A remote backend (S3, Cloudflare R2, a WebDAV box, your own API) is a third
implementation of the same interface: `save` uploads the serialized document, `load`
fetches it. Two things to plan for if you build one:

- **Credentials.** The renderer is the wrong place for long-lived keys. In a Tauri build,
  keep them in a Rust command; in a browser build, put a small signing endpoint in front
  and hand out short-lived pre-signed URLs.
- **Conflicts.** `save` is last-write-wins against a whole document. Two devices writing
  the same file will clobber each other — this interface has no merge, so a remote adapter
  wants either a single-writer rule or a conflict strategy of its own.

None of that ships here. WorkBase is local-first by design, and the network path is left
as an extension point rather than a feature.

## Layout

```
src/
  components/   React views and modals
  lib/          Domain logic — rollup, health, dependencies, layout, export
  store/        Zustand store; the single writer of the document
  hooks/        View state (nav, tabs, theme, onboarding)
src-tauri/      Rust shell, desktop widget, packaging
docs/           Design specs
```

Domain logic in `src/lib` is deliberately free of React, which is why most of it is
directly testable.

## Contributing

Issues and pull requests are welcome. Please run `npm test` and `npm run typecheck`
before opening a PR.

## License

Apache-2.0 — see [LICENSE](LICENSE).

The license covers the source code. "WorkBase" and "VOCSO", and the logos in `brand/`
and `public/`, are trademarks of VOCSO Technologies Pvt Ltd and are not licensed for use
by forks — see [NOTICE](NOTICE). Please pick your own name and mark.

Built by [VOCSO Technologies](https://vocso.com).
