---
name: add-glossary-term
description: >-
  Use when adding a term to the Visual Tech Glossary or editing an existing entry's data or
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
because tiles are read one at a time. A limitation that spans several sentences goes
into the one last card, ending on the residual risk, and a partial mitigation never gets
a card of its own. Qualifiers such as "in practice", "can" and "most", and the condition
a guarantee depends on, survive the compression.

`npm test` checks only the count, the title length, the 30-word cap and word-for-word
copies. The rest are review rules: after writing the cards, re-read each one against the
explainer and confirm it adds, sharpens or generalises nothing, that the last card is the
explainer's closing limitation, and that no card is a step or the fact lightly reworded.

Keep `takeaways: [` and its closing `]` on their own lines at six spaces in `index.html`:
`test/takeaways-fixtures.mjs` finds the field by that shape.

## 2. Append the diagram and its tour

Add a matching `DIAGRAMS.<id>` function returning inline SVG, `viewBox` 720 wide and
~240–320 tall. Every diagram is a step-through tour: the term's `steps` drive numbered
chips, and each diagram element that belongs to a step carries `data-s="1 3"`.

- shapes — `box`, `box-accent`, `box-soft`, `zone`, `zone-accent`, and two outlines that
  are not a rect: `${cyl(x, y, w, h)}` for a data store and `${doc(x, y, w, h)}` for a
  data asset. Both take `'box-accent'` as a fifth argument. Which one a node gets is set
  by its CALM node type: see step 2b.
- flows — `flow`, `flow-accent`, `flow-ok`, `flow-bad`. Every flow animates in drawing
  order, so draw each line from source to destination, arrowhead or not. A two-way
  arrow (both markers) sways; `flow-bad` lurches and stalls.
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

## 2b. Write the CALM model and tag the drawing

Every diagram has a model in `const CALM`, keyed by term id, in the FINOS CALM 1.2
format. Write the model from the explainer, then make the drawing match it. The page
adds `$schema` and `metadata` itself; store only `nodes`, `relationships` and `flows`.

```js
kebabid: {
  "nodes": [
    { "unique-id": "client", "node-type": "actor", "name": "Client", "description": "One sentence from the explainer." }
  ],
  "relationships": [
    { "unique-id": "client-resolver", "description": "What passes between them.",
      "relationship-type": { "interacts": { "actor": "client", "nodes": ["resolver"] } } }
  ],
  "flows": [
    { "unique-id": "resolve", "name": "Recursive resolution", "description": "The caption, or a sentence from the explainer.",
      "transitions": [
        { "relationship-unique-id": "client-resolver", "sequence-number": 1, "description": "The client asks." }
      ] }
  ]
}
```

**Nodes.** `name` is the title drawn in the shape, word for word, in one `<text>`.
`description` is one sentence that says only what the explainer says, and that still
makes sense read on its own in the downloaded JSON: name the thing, never "it". Pick the
built-in `node-type` that honestly fits; otherwise use a custom kebab-case type such as
`layer`. Two rules settle the common cases:

- `actor` is for people and organisations only. A client machine or program is a
  `system`, or a `webclient` if it is a browser or an app's user interface.
- When a built-in name collides with the term's own vocabulary, use a custom type. A
  Kubernetes pod is a `pod`, not a `service`, because a Service is a different
  Kubernetes object.

The type sets the outline:

| Node type | Outline |
|---|---|
| `actor`, `webclient` | `<rect class="box" … rx="20"/>` |
| `service`, `system`, any custom type | `<rect class="box" … rx="8"/>` (any `rx` under 16 counts as square) |
| `database`, `ldap` | `${cyl(x, y, w, h)}` |
| `data-asset` | `${doc(x, y, w, h)}` |
| `network`, `ecosystem` | `<rect class="zone" …/>` |
| a container through `deployed-in` | `<rect class="zone" …/>`, whatever its type |
| a container through `composed-of` | `<rect class="box-soft" …/>`, whatever its type |

**Relationships.** Use `connects` (source to destination) between two nodes,
`interacts` (actor to node) for a node typed `actor` and what it uses, `deployed-in` for a node that
runs inside another, `composed-of` for a node that is a part of another. A request and
its reply are one relationship. Set `protocol` only if it is one of CALM's twelve (HTTP,
HTTPS, FTP, SFTP, JDBC, WebSocket, SocketIO, LDAP, AMQP, TLS, mTLS, TCP); otherwise name
the protocol in the description. Every node must appear in at least one relationship. A
node is a container through one of the two kinds, never both. Write each description so
it makes sense on its own, as for nodes.

**Flow.** Write one flow if any tour step lights a connector, none otherwise. List the
transitions in the order the tour lights their connectors, numbered 1 to N. Every arrow the tour lights is a transition; an arrow that is not part of the flow carries no `data-s`. A reply is a
transition with `"direction": "destination-to-source"`. Each transition needs a
connector of its own drawn in its direction. A two-way
arrow stands for a request and its reply, so it must have one transition each way; draw a
link with no reply in the model one-way.

**Tagging.**

- Each node is one `<g data-calm="<node id>">` holding its outline, icon and labels. A
  sequence diagram's lifeline goes in its node's group. The first outline in the group
  is the one the shape rule checks.
- A container's group holds its outline and its own label only. Its children are sibling
  groups drawn inside it. Never nest one `data-calm` in another.
- Each connector is one `<line>` or `<path>` carrying `data-calm="<relationship id>"`,
  drawn from one node's edge to the other's. Redraw a shared trunk as separate
  full-length lines.
- `data-calm` and `data-s` go on the same element.
- Anything else drawn with a `box`, `zone` or `flow` class is not part of the
  architecture and says so with `data-note` on it or its group. The value is one of six,
  and `verify.mjs` rejects any other:
  - `call-out`: a box or arrow that explains a part of the drawing
  - `footer`: a strip of text under the drawing, usually the limitation
  - `elided`: a row or box standing for things the explainer does not name
  - `self-loop`: a line from a component back to itself
  - `struck-through`: the X struck over a broken primitive
  - `becomes`: an arrow joining the same thing at two moments, or a thing and what it
    turns into
- Free text, dividers and badges need no tag.

If the drawing disagrees with the explainer, the drawing changes. If the model shows
the explainer itself may be wrong, report it; do not edit the explainer here.

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
- **(e) CALM model** — every node drawn once under its name, in the outline its type
  calls for; every `connects` and `interacts` relationship drawn as a connector between
  the right two nodes; contained nodes inside their container; the flow in the tour's
  order; nothing with a `box`, `zone` or `flow` class left untagged. It also checks the
  "CALM model" disclosure: its JSON, Copy, Download and print.

It also re-checks the step 4 counters, so a bare `npm run verify` catches drift you missed.

`npm test` checks the model itself: it validates against the vendored CALM 1.2 schema,
and its ids and references hold. To check a model with FINOS's own tool, save the
downloads and run the CLI over one:

```bash
node verify.mjs <id> --calm-out=/path/outside/the/repo
npx --yes @finos/calm-cli@1.60.1 validate -a /path/outside/the/repo/<id>.calm.json
```

Two things worth knowing if you extend it: measure in **screen space**
(`getBoundingClientRect`, and map `getPointAtLength` results through `getScreenCTM`) —
`getBBox()` ignores transforms and reports a phantom horizontal box for rotated text. And
`stroke-bad` lines are the decorative X struck over a broken primitive, so they are
excluded from check (b) by design.

Finally, read the light and dark element screenshots of `#detail-content` — the geometry
checks do not judge whether the diagram is *right*, only that nothing collides.

## 7. Refresh the committed screenshots

```bash
node screenshot.mjs ./index.html               # desktop.png, tablet.png, mobile.png
node screenshot.mjs ./index.html --mode=dark   # dark-desktop.png, dark-tablet.png, dark-mobile.png
```

Run both: the default mode writes only the three light files, and the dark set is a
separate pass. `git status` should show all six files in `screenshots/` modified before
the screenshots commit.

No env prefix needed: `_launch.mjs` falls through to `/snap/bin/chromium`, and `verify.mjs`
sets the override itself. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` only if that fallback
chain ever comes up empty.

## 8. Commit

Two commits, direct to `main`, both with the `Co-Authored-By` trailer:

1. `feat: add <Term> to the glossary` — `index.html`, `README.md`, `glossary.txt`
2. `chore: refresh screenshots for the <term> entry` — `screenshots/`

Push only when James asks.
