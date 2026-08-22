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
  caption: "What the diagram shows."
}
```

`types`, `provenance` and `domains` draw only on the existing `TYPE_TAGS`, `PROV_TAGS` and
`DOMAIN_TAGS` arrays. UK spelling. See CLAUDE.md for the source-verification rule.

## 2. Append the diagram

Add a matching `DIAGRAMS.<id>` function returning inline SVG, `viewBox` 720×~300. Use the
shared grammar rather than new classes:

- shapes — `box`, `box-accent`, `zone-accent`
- flows — `flow`, `flow-accent`, `flow-ok`, `flow-bad`
- arrowheads — `ah-acc`, `ah-ok`, `ah-bad`, `ah-mut`
- text — `t-b`, `t-sm`, `t-mut`

Set `aria-label` to the caption text. Budget label widths at roughly 6.6px per character
for the ~11px mono face.

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
npm test    # validate.mjs — style-guide linter, must exit clean
```

Then a browser pass. Write a small harness in the scratchpad importing `launchBrowser()`
from `_launch.mjs` — it returns `{ browser, label }`, so destructure it. The bundled
chromium build does not work in this WSL environment; pass the working one on the command
line, because the env var is read at module *import* time and setting it in-script is too
late:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=~/.cache/ms-playwright/chromium-1148/chrome-linux/chrome \
  node scratch-verify.mjs
```

`page.evaluate("() => {...}")` with a string does not auto-invoke — wrap it as an IIFE:
`page.evaluate("(() => {...})()")`.

Assert: the detail view and diagram render, the TOC entry exists, the counts match, and
the console is clean. Selectors: `#search-input`, `#term-grid .term-card .term-name`;
related links are `button.related-pill[data-goto]`, not `<a>`.

Two geometry checks are worth scripting every time — both caught real defects that were
invisible at thumbnail size:

- **(a) Label clearance** — compare each text `getBBox()` against every non-zone `<rect>`;
  flag labels sitting within 2px of a box edge. Caught Calico's "no match" and "pod IP on
  the wire".
- **(b) Stroke/text collision** — sample ~200 points along every `<line>` and `<path>` via
  `getPointAtLength()` and assert none land inside a text bbox. Caught istiod's arrows
  striking straight through Istio's SPIFFE ID line, which check (a) could not see.

Finally, read the light and dark element screenshots of `#detail-content`.

## 7. Refresh the committed screenshots

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=~/.cache/ms-playwright/chromium-1148/chrome-linux/chrome \
  node screenshot.mjs ./index.html
```

## 8. Commit

Two commits, direct to `main`, both with the `Co-Authored-By` trailer:

1. `feat: add <Term> to the glossary` — `index.html`, `README.md`, `glossary.txt`
2. `chore: refresh screenshots for the <term> entry` — `screenshots/`

Push only when James asks.
