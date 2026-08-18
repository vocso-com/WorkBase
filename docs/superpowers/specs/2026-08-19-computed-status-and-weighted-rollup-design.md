# Computed Status & Weighted Rollup

**Date:** 2026-08-19
**Branch:** `feat/cloud-sync-collab`
**Status:** Spec — awaiting review, not yet implemented
**Strategy context:** [2026-08-19-product-strategy-and-collaboration-design.md](./2026-08-19-product-strategy-and-collaboration-design.md)

---

## 1. Why

Every project management tool fails the same way: the board goes out of date, so nobody
trusts it, so people ask in Slack instead. The cause is structural — **status is declared**,
so a human must remember to move things, and humans don't.

This feature makes **status computed**. A person ticks only the leaf in front of them; every
ancestor derives its own state. The top-level view is true because it is derived from the
bottom, where the only honest data lives.

This is the product's wedge, and it is entirely local — no sync, no accounts, no schema
restructuring. It ships and proves itself before any infrastructure is built for it.

---

## 2. Scope

### In

- Size classes on any node, set by comparing siblings
- Weighted progress rollup at arbitrary depth
- Templates declaring module weights
- Automatic advancement to In progress; never automatic completion
- **Ready to close** state, surfaced through the nudge widget
- Health states with plain-language evidence
- Staleness scaled to each node's tempo
- Scope-growth handling and its surfaced insight
- `completedAt`, recorded so learned priors are possible later

### Out

- LLM-inferred sizing; learned durations (explicitly rejected — data entry ceremony and
  false precision respectively)
- Collaboration, sync, accounts, the flat-record refactor
- Client portal
- **Won't make it** (reachability) — computation is built, the state stays hidden until
  enough throughput history exists to mean anything

---

## 3. Data model

Additions to `src/types.ts`. All optional, so no migration is required and existing
documents behave exactly as before.

```ts
export type SizeKey = 'S' | 'M' | 'L' | 'XL' | 'XXL'

export interface Node {
  // ...existing
  size?: SizeKey        // explicit weight relative to siblings; absent = inferred
  completedAt?: string  // set when status becomes 'done', cleared when un-done
  baselineWeight?: number  // roots only: total weight captured at kickoff
  baselineAt?: string      // roots only: when that snapshot was taken
}

export interface TemplateModule {
  // ...existing
  size?: SizeKey        // declared prior, applied on instantiation
}
```

---

## 4. Weight resolution

```ts
const SIZE_WEIGHT: Record<SizeKey, number> = {
  S: 0.5, M: 1, L: 2, XL: 4, XXL: 8,
}
```

Doubling from a default of M, so each step is "twice the previous" — explainable in one
sentence. Range covers the motivating case: one XXL beside three M yields 73%, matching a
real 70/10/10/10 split. XL alone tops out at 57%, which is why XXL exists.

**Units must never mix within a sibling set.** The rule:

> If **any** sibling has an explicit `size`, then every sibling in that set uses size
> semantics, and unsized siblings are treated as **M**. Otherwise every sibling uses
> inferred weight.

```ts
function weightOf(node: Node, siblings: Node[]): number {
  if (siblings.some(s => s.size)) return SIZE_WEIGHT[node.size ?? 'M']
  return Math.max(1, leafCount(node))
}
```

Inferred weight is leaf count because people decompose big things more than small things —
*the decomposition is the estimate*, obtained for free from work people were doing anyway.

**A node's own size governs its share of its parent; its children govern how much of that
share is filled.** These are independent, so an explicit size on a node with children is
never in conflict with its subtree.

### 4.1 Comparison is always local

Weights are compared **between siblings only, never globally**. "Build is XXL" is a claim
about Build versus the three modules beside it — it says nothing about the project, and
nothing about any level below. Global share is the product down the path:

```
Build is XXL among 3 M siblings   →  8/11  =  73% of the project
API   is XXL among 3 M siblings   →  8/11  =  73% of Build
                                          =  53% of the project
```

Nobody computes that 53%; it falls out. This is what makes unlimited depth free — a person
sizing a sibling set holds only that set in their head, so cognitive load never grows with
depth.

It is also why mixing is safe *across* levels though forbidden *within* one: shares
normalise to 100% inside each sibling set, so a level using inferred weights composes
correctly with a level below it using explicit sizes.

### 4.2 Evidence may challenge a declaration

A size set at kickoff is a guess made when least was known. Left alone it permanently
suppresses everything learned since — a module marked **L** that later holds 60 of a
project's 66 items would still claim 40% of the weight.

**The declaration wins, but the system surfaces the disagreement:**

> "Build is marked **L**, but it now holds 60 of the project's 66 items. Resize to XXL?"

One click. Structure never silently overrides a human — that is the untrustworthy behaviour
this feature exists to eliminate — but a stale judgment is never left unchallenged either.
Same shape as ready-to-close (§6): **the system detects, the human confirms.**

Threshold for raising it: the inferred share differs from the declared share by more than
one size step.

### 4.3 Sizing stabilises the bar

Because a sized node's share is fixed by its size rather than its leaf count, decomposing
*inside* it does not move the parent's percentage. The scope-growth trap (§9) does not fire
below a sized node — so sizing the modules once at kickoff buys a project bar that stays
steady while the plan fills in underneath. That is exactly the behaviour wanted when a
client is looking at it.

### 4.4 Optional hour calibration

Agencies think in hours because they bill in hours. But naming the sizes in hours breaks
three things: an hour attached to a task becomes a **commitment** people pad against; a
senior's L and a junior's L are different numbers; and it forces absolute estimation
through the back door, destroying the relative comparison that makes sizing fast.

Instead, **one optional number per workspace**: *"an M is about 4 hours here."* Input stays
a three-second sibling comparison; display can speak hours where hours help — tooltips,
project totals, quoting conversations.

- **Off by default**, and always rendered with `≈`
- One number set once, never a field on a task
- Forward-compatible: once completion history exists this calibration **learns itself**
  from real data, which is how the deferred learned-priors work arrives

---

## 5. Progress rollup

Replaces `progressOf` in `src/lib/progress.ts`. Signature and return type are unchanged
(0–100 integer), so all five existing call sites keep working.

```
progress(node):
  leaf  → node.status === 'done' ? 100 : 0
  else  → Σ(weightOf(child) × progress(child)) / Σ weightOf(child)
```

**Considered and rejected: partial credit for `doing` leaves.** Counting an in-progress
leaf as 50% makes the bar move when nothing has been finished. That is precisely the
false comfort this feature exists to eliminate. Leaves are binary.

Non-`done` statuses — including `blocked` and any custom stage — count as not done.

---

## 6. Status advancement

> **Starting is a fact. Finishing is a judgment.**

When someone ticks a task it is objectively true that work has begun on its ancestors — no
interpretation required. Completion is not: "Launch website" with design, build and content
all done is usually *not* done, because residual work in the parent was never decomposed.

**Rule: rollup may advance a node into progress. It may never mark a node complete.**

- **Advancement** — generalise the existing `promoteAncestors` in `src/store/useStore.ts`.
  Any ancestor sitting in `todo` moves to `doing` when work starts beneath it. Never fires
  from an explicit `blocked`, `done`, or custom stage.
- **Ready to close** — a derived state, not a stored status:

```ts
function readyToClose(node: Node): boolean {
  return node.children.length > 0
    && node.status !== 'done'
    && node.children.every(c => c.status === 'done')
}
```

Deliberately requires children to be actually `done`, not themselves ready-to-close, so the
state never cascades up a tree of unconfirmed parents.

**It is pushed, not left to be discovered.** `NudgeWidget` surfaces "Homepage design — all
3 items complete. Close it?" with a one-click confirm. Cost when the parent is a pure
container: one click. Value when it isn't: we didn't lie.

### A completed node that later gains children

Explicit `done` stays authoritative and reads 100% regardless of children — a human said so,
and finishing is a judgment. But adding open items beneath a completed node surfaces the
same detect-and-confirm prompt: *"Homepage design was marked done but has 3 new open items —
reopen?"* Never a silent flip.

### Interaction with dependencies

`src/lib/deps.ts:14` currently treats `progressOf(n) === 100` as a parent being complete.
Under this spec 100% means *ready to close*, not done. **Dependency satisfaction must use
explicit `status === 'done'`**, so a dependent task does not unblock on work its owner has
not confirmed. This is a behaviour change and needs a test.

---

## 7. Health

**States, not scores.** A composite number ("health: 72") is uninterpretable — nobody can
say what would make it 73, so nobody believes it, and the graveyard returns with better
graphics. One headline state, chosen by deterministic precedence:

| # | State | Condition |
|---|---|---|
| 1 | **At risk** | any incomplete descendant past its `dueDate` |
| 2 | **Blocked** | any incomplete descendant has an unmet `dependsOn` |
| 3 | **Stalled** | untouched beyond its tempo (§8) |
| 4 | *Won't make it* | remaining weight not reachable by due date — **hidden until throughput data exists** |
| 5 | **On track** | none of the above |

Evidence accompanies the state in plain language: *"At risk — 3 items overdue, 1 blocked on
client feedback, nothing touched in 6 days."*

**The test for every state: can the reader tell what to do next?** "72" fails. "Blocked on
client feedback since Tuesday" passes.

**Tune conservatively.** If everything reads At risk, the badge means nothing and the whole
mechanism is lost. Under-alerting is far cheaper than alarm fatigue.

---

## 8. Staleness

Staleness must be relative to a node's tempo, not a fixed day count — a task due Thursday
untouched for five days is dead; a six-month project untouched for five days is fine.

```
staleAfter(node):
  has dueDate → max(FLOOR_DAYS, 0.25 × days between createdAt and dueDate)
  no dueDate  → node.children.length > 0 ? PARENT_DAYS : LEAF_DAYS
```

Freshness is the most recent `updatedAt` anywhere in the subtree, so a project is fresh if
*any* work inside it moved.

All thresholds live as named constants in one module so they can be tuned from a single
place. Starting values: `FLOOR_DAYS = 3`, `PARENT_DAYS = 14`, `LEAF_DAYS = 7`.

Staleness is the sleeper feature: the best single predictor that a project is going
sideways, it needs no input from anyone, and no competitor surfaces it.

---

## 9. Scope growth

### The trap

A parent with 2 leaves, 1 done, reads 50%. Someone breaks the remaining leaf into 4
subtasks: now 5 leaves, 1 done — **20%**. The bar more than halved, and the person who
caused it did the most valuable thing anyone can do in this product.

This punishes exactly the behaviour the system depends on. If planning makes people look
worse, they plan outside the tool, the leaf data stops arriving, and every computation
above it starves. **The metric would kill its own input.**

### Handling

1. **The track lengthens; the fill never shrinks.** The completed portion keeps its
   physical size on screen and the bar extends rightward. Visually honest — nothing was
   lost, the job got bigger — and it removes the sting entirely. This does most of the work.
2. **An absolute count beside the ratio.** "12 done" can only ever increase.
3. **Never animate a percentage downward** as a result of decomposition.

### The feature hiding inside it

Baseline weight is captured on a root the first time it enters `doing` (kickoff), stored as
`baselineWeight` / `baselineAt`. Growth is then `(current − baseline) / baseline`.

*"Scope has grown 40% since kickoff"* is the sentence that justifies a change order, and
unbilled scope creep is a top way agencies lose money. Every other tool silently absorbs
scope growth into a percentage nobody examines. Dating it and itemising what was added is
worth paying for on its own.

---

## 10. UI surfaces

Existing components, enriched — no new architecture.

| Surface | Change |
|---|---|
| `ProgressBar`, `ProgressRing` | weighted value; growing track; absolute count |
| `ProjectCard`, `ProjectsHome` | health state + evidence line |
| `ProjectPage`, `AppHeader` | health headline, scope-growth insight |
| `FlowView` | health on cards; sibling sizing |
| `CardModal` | size control; ready-to-close action |
| `NudgeWidget` | ready-to-close prompts |
| `MyWorkPage` | health-ordered rather than date-ordered |

**Sibling sizing is a comparison, not a tag.** The control shows all siblings together and
asks which is the big one — humans are excellent at relative comparison across a small set
and poor at absolute estimation. It appears at project setup and wherever the numbers look
wrong; it is never a required field on a card.

**Hover explains effect, not just value.** A size chip's tooltip reads:

> **L** — twice the default size.
> This module is **40%** of the project (8 of 20 weight).
> *Inferred from 8 sub-items · click to set explicitly*

With hour calibration on (§4.4), it adds `≈8h here`. The progress bar gets the same
treatment: hovering shows which children contribute what, so a number nobody can explain
never appears on screen.

**Inferred weights must be inspectable.** If a bar says 40% and nobody can see why, they
stop trusting it — the exact failure this feature exists to fix. Every computed weight
shows its reasoning and is overridable in one click.

---

## 11. Testing

`src/lib/progress.ts` and its neighbours are pure functions with an existing test file, so
coverage is unit-level and cheap.

- `weightOf` — inferred vs. explicit; the no-mixing rule; unsized siblings default to M
- `progress` — weighted rollup at depth; the 70/10/10/10 case lands at 73%; `blocked` and
  custom stages count as not done; `doing` leaves earn nothing
- `readyToClose` — true only when children are actually `done`; does not cascade
- Advancement — ancestors in `todo` promote; `blocked` / `done` / custom are never overridden
- Health — precedence order; each state's evidence string
- Staleness — tempo scaling for due-dated and undated nodes
- Scope growth — baseline captured once at kickoff; growth arithmetic
- Composition — nested sizes multiply down the path; a level using inferred weights
  composes with a level below using explicit sizes
- Stale-declaration challenge — fires when inferred and declared shares differ by more than
  one size step; never mutates the node on its own
- A completed node gaining open children stays 100% and raises a reopen prompt
- Hour calibration — display only; absent by default; never affects weight arithmetic
- **Regression:** dependencies satisfy on explicit `done`, not on 100% progress (§6)

---

## 12. Deferred

- Learned priors from completion history — `completedAt` is recorded now so this becomes
  possible without a migration
- Reachability / *Won't make it*, pending throughput data
- Cross-project portfolio health
- Everything in the strategy document's collaboration track

---

## 13. Open questions

1. Should `size` be settable on leaves, or only on nodes with children? Leaves are where
   the 10-hour-undecomposed-task problem lives, which argues yes — but it also invites
   sizing every task, which is the ceremony we rejected.
2. Does un-completing a node clear `completedAt`, or keep a history of completions? History
   is more useful for learned priors but is unbounded.
3. Where does the scope-growth insight surface — project header, activity feed, or only in
   an export for the client?
