---
name: add-glossary-term
description: >-
  Use when adding a term to the ZTA visual glossary or editing an existing entry's data or
  diagram — triggers on "add <X> to the glossary", "add <X>", "new entry for <X>", "add a
  term", "add a domain/type tag". Covers the TERMS entry, the inline-SVG diagram, reverse
  cross-links, the six counters, glossary.txt, the browser verification loop, and the
  two-commit convention. Skip for changes that touch no term — styling, README-only edits,
  or work on the tooling scripts.
---

# Add a glossary term

Established over the nDLP and SBC entries (July 2026) and held since. Follow the steps in
order. Grid and TOC sort alphabetically at runtime, so array position is cosmetic —
append new entries at the end.

## 1. Append the `TERMS` entry

Add an object to `const TERMS` in `index.html`:

```js
{
  id: "kebab-id", term: "Display Name", acronym: "Expansion If Any",
  aliases: ["searchable synonym"],
  tldr: "One line, plain language.",
  explainer: `Two to four sentences ... closing with one candid limitation.`,
  types: ["Protocol"], provenance: ["Open Source"], domains: ["Zero-Trust Core"],
  related: ["sibling-id"],
  source: { label: "RFC 9999 — Title", url: "https://..." },
  caption: "What the diagram shows.",
  steps: [
    { title: "Two to four words", text: "One or two sentences, only what the explainer says." },
    …  // 3–5 steps
  ],
  fact: "One sentence from the explainer worth remembering.",
  takeaways: [
    { title: "Two to four words", text: "One sentence, at most 30 words, only what the explainer says." },
    …  // 3–5 takeaways; the last is the limitation
  ]
}
```

`types`, `provenance` and `domains` draw only on the existing `TYPE_TAGS`, `PROV_TAGS` and
`DOMAIN_TAGS` arrays. UK spelling. See CLAUDE.md for the source-verification rule.

`takeaways` are the tiles under the infographic: the explainer compressed to three to
five cards, the last always the limitation. They state only what the explainer says and
never repeat a tour step or the key fact word for word, or with only a word or two
changed. Every card names its subject rather than opening with a bare "It" or "Its",
because tiles are read one at a time. Keep `takeaways: [` and its
closing `]` on their own lines at six spaces, as above: `test/takeaways-fixtures.mjs`
finds the field by that shape.

## 2. Append the diagram and its tour

Add a matching `DIAGRAMS.<id>` function returning inline SVG, `viewBox` 720 wide and
~240–320 tall. Every diagram is a step-through tour: the term's `steps` drive numbered
chips, and each diagram element that belongs to a step carries `data-s="1 3"`.

- shapes — `box`, `box-accent`, `zone-accent`
- flows — `flow`, `flow-accent`, `flow-ok`, `flow-bad`
- boundaries — `divider`, `zone`, `zone-accent` light up too (accent stroke, no moving
  dash), so a boundary or region can be a step's focus: tag it, or its group
- arrowheads — `ah-acc`, `ah-ok`, `ah-bad`, `ah-mut`
- text — `t-b`, `t-sm`, `t-mut`, `t-acc` (accent — never a `fill="var(--accent)"`
  attribute, which the `.dg text` rule silently overrides)
- icons — `${icon('server', x, y)}`: a 24px Lucide icon at the top-left of a main box,
  with its label shifted right. Add a missing icon to `ICONS` from lucide-static.
- badges — `${badge(n, x, y, '1 3')}`: one numbered circle per step, on the element or
  arrow that step centres on; the last argument lists the steps it lights, like `data-s`.

Set `aria-label` to the caption text. Budget label widths at roughly 6.6px per character
for the ~11px mono face. Build a table or aligned columns from one `<text>` per cell,
each at its own `x`: SVG collapses a run of spaces to one, so space-padded columns render
squashed together.

Rules: 3–5 steps; every step lights something; tag a component's `<g>`, never both a
group and its children (no nested `data-s`); a flow may run under its badge, but a
badge must not cover a label; no icon repeated within one diagram unless the things are
the same kind; the drawing must read correctly fully lit (print).
Tour copy states only what the explainer says.

## 3. Cross-link

Add a reverse `related:` entry on the closest sibling term, so the link works both ways.

## 4. Bump the six counters and the README

Static fallbacks in the committed HTML: `toc-count`, `stat-total`, `stat-types`,
`stat-prov`, `stat-domains`, `stat-diagrams` — plus the term count in the README's
"Explains N …" sentence.

All six are overwritten at runtime from `TERMS` / `TYPE_TAGS` / `PROV_TAGS` /
`DOMAIN_TAGS`, so a stale number only shows pre-JS. Before that wiring existed they drifted
silently and were wrong on the "AI & Models" commit — bump them anyway.

## 5. Regenerate `glossary.txt`

```bash
npm run glossary
```

It prints the term count, which cross-checks step 4. Commit the result alongside
`index.html` and `README.md`.

## 6. Verify

```bash
npm test               # validate.mjs — style-guide linter, must exit clean
npm run verify <id>    # the rendered checks for your term
```

`verify.mjs` replaces the scratchpad harness this step used to describe. For your term it
asserts the detail view and diagram render, the TOC entry exists, the console is clean,
and runs the two geometry checks that have caught defects invisible at thumbnail size:

- **(a) Label clearance** — every `<text>` against every non-zone `<rect>`; a label
  overlapping a box without sitting inside it, by more than 2 units, is an error. Caught
  Calico's "no match" and "pod IP on the wire".
- **(b) Stroke/text collision** — ~200 samples along every `<line>`/`<path>`; none may land
  inside a label. Caught istiod's arrows striking through Istio's SPIFFE ID line, which
  check (a) could not see.
- **(c) Diagram tour** — chips match `steps`, each step lights something, clicks and
  ArrowRight work, nothing animates under reduced motion, no badge covers a label.
- **(d) Takeaway tiles** — tiles match `takeaways`, only the last is marked as the
  limitation, the full explainer sits in a closed disclosure that opens for print, and
  nothing overflows at 1440px or 375px.

It also re-checks the step 4 counters, so a bare `npm run verify` catches drift you missed.

Two things worth knowing if you extend it: measure in **screen space**
(`getBoundingClientRect`, and map `getPointAtLength` results through `getScreenCTM`) —
`getBBox()` ignores transforms and reports a phantom horizontal box for rotated text. And
`stroke-bad` lines are the decorative X struck over a broken primitive, so they are
excluded from check (b) by design.

Finally, read the light and dark element screenshots of `#detail-content` — the geometry
checks do not judge whether the diagram is *right*, only that nothing collides.

## 7. Refresh the committed screenshots

```bash
node screenshot.mjs ./index.html
```

No env prefix needed: `_launch.mjs` falls through to `/snap/bin/chromium`, and `verify.mjs`
sets the override itself. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` only if that fallback
chain ever comes up empty.

## 8. Commit

Two commits, direct to `main`, both with the `Co-Authored-By` trailer:

1. `feat: add <Term> to the glossary` — `index.html`, `README.md`, `glossary.txt`
2. `chore: refresh screenshots for the <term> entry` — `screenshots/`

Push only when James asks.
