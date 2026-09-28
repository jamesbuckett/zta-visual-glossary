# Interactive infographic diagrams — design

Date: 2026-09-28
Status: approved in brainstorming, awaiting spec review

## Goal

Replace the 100 static schematic diagrams with step-through infographic cards. Every
term's detail view shows a guided tour of its diagram: numbered step chips, a redrawn
diagram whose relevant parts light up per step, a "what's happening" panel, and a
key-fact callout. Every diagram is redrawn from scratch in the new visual grammar.

## Decisions

| Question | Decision |
|---|---|
| Interaction model | Step-through: chips select a step; the step's elements light, the rest dim |
| Visual style | Option C "infographic card": chips, diagram, panel with large numeral, key-fact callout |
| Non-sequential diagrams | Guided tour: 3–5 steps that walk the diagram's parts in reading order |
| Redraw depth | Full redraw of all 100 diagrams |
| Data model | `steps` and `fact` on each `TERMS` entry; `data-s` tags in the SVG; one shared renderer |
| Layout | Stacked, not side by side: the detail view is 880px, and a side panel would shrink 11px labels to ~8px |

## 1. Component and data model

### Data

Each `TERMS` entry gains:

```js
steps: [{ title: "Log in", text: "The client proves it knows…" }, …],  // 3–5 entries
fact: "The password never crosses the network…"
```

- `title`: two to four words, shown on the chip and as the panel heading.
- `text`: one or two sentences, shown in the panel.
- `fact`: one sentence, shown in the callout.
- All three draw only on claims already in the entry's verified `explainer`. No new
  factual claims enter through tour copy. UK spelling and the no-emoji rule apply.

### SVG tagging

Every diagram element that takes part in the tour carries `data-s` with the space-separated
step numbers it belongs to, e.g. `data-s="1 3"`. Untagged elements (title line, legend,
footnote) are never dimmed.

### Renderer

`tourCard(entry, svg)` replaces the `<figure>` builder near `index.html:4245`. It emits, in
order:

1. Step chips: `<button>` elements numbered 1..N, each showing the number and the title.
2. The diagram, full width of the 880px detail column.
3. The panel: large numeral, step title, step text, in an `aria-live="polite"` region.
4. The key-fact callout.
5. The caption, as today's `figcaption`.

Terms without `steps` fall back to today's plain `<figure>` (see §4).

### Behaviour

- One delegated click and keydown handler on `#detail-content`.
- Step 1 is selected when a term opens.
- Selecting step k sets `.on` on elements whose `data-s` includes k and `.dim` on the other
  tagged elements. Active flows get an animated dash.
- Arrow Left/Right move between chips (roving focus); Enter/Space select.
- `prefers-reduced-motion: reduce` disables the dash animation and the opacity transition.
- Print shows the diagram fully lit with every step listed. This needs a new `@media print`
  block, since the page has no print styles today.
- Without JS nothing renders, as today (the `noscript` note covers it).

### Styling

New grammar classes `.dg .on`, `.dg .dim`, `.dg .badge`, `.dg .ico` and the card CSS,
built only on existing tokens. There's still exactly one `--accent` and no stray hex.

## 2. Visual grammar for the redraw

- **Canvas:** `viewBox` 720 wide, height as needed (typically 240–320). Rendered at the
  full 880px column, 11px labels display at ~13px.
- **Icons:** a shared `ICONS` map of only the Lucide paths in use (user, server, key,
  shield, lock, cloud, network, database, file-check, cpu, …), inlined once. `icon(name, x, y)`
  places a 24px icon at the top-left of a main box and the label shifts right. Actor and
  component boxes get icons; small annotation boxes do not.
- **Badges:** `badge(n, x, y, steps)` draws a numbered circle on the element or arrow each
  step centres on. There's one badge per step, and it matches the chip number.
- **Existing classes stay:** `box`, `box-accent`, `zone-accent`, `flow`, `flow-accent`,
  `flow-ok`, `flow-bad`, `ah-*`, `t-b`, `t-sm`, `t-mut`, `t-acc`.
- **Rules for every redraw:**
  - 3–5 steps. Every step lights at least one element, and every `data-s` value is a real step.
  - Routing leaves room for badges. Badges and icons pass the same geometry checks as labels.
  - One accent. No colour meaning beyond accent / ok / bad.
  - The diagram reads correctly fully lit.
  - It stays accurate to the explainer. Where the drawing simplifies, the caption says so.

## 3. Tooling and verification

### `validate.mjs`

- Structure (new): any term with `steps` has 3–5 entries with non-empty `title` and `text`,
  and a non-empty `fact`.
- The existing emoji check already scans the whole file, so it covers the new copy without
  changes. `validate.mjs` has no spelling check. UK spelling in tour copy stays a review
  responsibility, as it is for explainers today.

### `verify.mjs`, per term with `steps`

1. The card renders with chip count equal to `steps.length`.
2. Every step 1..N lights at least one element. No `data-s` names a step above N.
3. Clicking each chip changes the panel text and the lit set. Arrow keys move chip focus.
   The console stays clean throughout.
4. The existing geometry checks (label clearance, stroke/text collision) run on the fully
   lit diagram, extended to badges and icons. Icons count as labels for the stroke check.
5. Under emulated reduced motion, no element has a running animation.

### Other tooling

- **`glossary.mjs`:** appends each term's steps and key fact to `glossary.txt`.
- **`add-glossary-term` skill:** step 2 is rewritten for the new grammar (icons, badges,
  `data-s`, steps, fact).
- **Review captures:** light and dark captures of each redrawn term at step 1 and at the
  last step, taken to the scratchpad and read before each batch commit. They aren't committed.

## 4. Rollout

- **Coexistence:** the renderer falls back to the plain `<figure>` for any term without
  `steps`, so every commit is shippable. The new `verify.mjs` checks apply only to terms
  with `steps` until phase 3.
- **Phase 0, infrastructure.** Renderer, card CSS, `ICONS`/`icon`/`badge`, stepping JS,
  validator/verifier/generator extensions, skill update. No diagram is migrated. Done when
  `npm test` and a full `npm run verify` are clean with every term on the fallback.
- **Phase 1, pilot.** Five terms chosen to stress each shape:
  - Kerberos: a flow.
  - PKI: a hierarchy.
  - RBAC & ABAC: a comparison.
  - DPU: a layered architecture.
  - DORA: a supervision map.

  James reviews the pilot in the browser before any further migration, and grammar changes
  land here.
- **Phase 2, batches.** The remaining 95 terms in batches of ~15, grouped by domain. Each
  batch is two commits:
  1. `feat: redraw the <domain> diagrams as step-through infographics`: `index.html`,
     `glossary.txt`.
  2. `chore: refresh screenshots for the <domain> redraw`: `screenshots/`.

  Stop for review after each batch. Push only when James asks.
- **Phase 3, lock-in.** Remove the fallback. Make `steps` and `fact` mandatory in
  `validate.mjs` and `verify.mjs`. Update the README's description of the diagrams.

## Out of scope

- Changes to the browse grid, filters, TOC, or term cards.
- New terms, tags, or changes to explainer prose.
- Hover tooltips or any interaction beyond step-through.
- Splitting `index.html` or adding a build step or runtime dependency.

## Risks

- **Volume:** ~100 redraws and 300–500 steps of copy over several sessions. The pilot gate
  exists to settle the grammar before the volume.
- **Accuracy drift:** redraws can quietly change what a diagram claims. Mitigation: tour copy
  is sourced from the verified explainer, and each batch's captures are read, not just
  geometry-checked.
- **File size:** `index.html` grows by the icon map, card code and tour copy. Watch it, but
  no limit is set.
