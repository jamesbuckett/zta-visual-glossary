# CLAUDE.md

A browsable visual glossary of IT, AI, networking and security terms. Everything ships in
one self-contained `index.html` — markup, styles, the `TERMS` data array,
hand-authored inline SVG diagrams, and the `CALM` models behind them. No build step and no runtime dependencies; the
`.mjs` files at the root are tooling, not part of the page.

## Adding or editing a term

Use the `add-glossary-term` skill (`.claude/skills/add-glossary-term/`). It carries the
full procedure — the six counters that silently drift, the diagram grammar, and the
verification loop.

## Invariants

- **Closed tag vocabularies.** `types`, `provenance` and `domains` may only use values
  already listed in `TYPE_TAGS` / `PROV_TAGS` / `DOMAIN_TAGS`. Introducing a new tag is a
  deliberate, separate change — never a side effect of adding a term.
- **UK spelling** throughout the prose ("organisation", "centralised").
- **One candid limitation closes every `explainer`** — what the technology does not solve.
  An entry that only sells its subject is not finished.
- **Takeaways compress the explainer.** Three to five tiles, each a title of two to four
  words and one sentence of at most 30 words, stating only what the `explainer` says. The
  last tile is always the limitation. None repeats a tour step or the key fact word for
  word, or with only a word or two changed, and every tile names its subject rather than
  opening with a bare "It" or "Its". A limitation that spans several sentences goes into
  that one last tile, ending on the residual risk, and a partial mitigation never gets a
  tile of its own. Qualifiers ("in practice", "can", "most") and the condition a guarantee
  depends on survive the compression. `validate.mjs` checks only the count, the title
  length, the 30-word cap and word-for-word copies; the rest are review rules, so re-read
  each card against the explainer.
- **Every diagram has a CALM model and matches it.** The model in `CALM` is written from
  the explainer in the FINOS CALM 1.2 format; the drawing's shapes, connectors and
  containment follow it, tagged with `data-calm`. Anything drawn that is not a component
  or a relationship is marked `data-note`. A model claims only what the explainer says.
  `verify.mjs` checks the match; whether the model is a fair reading of the explainer is
  a review rule.
- **Sources must be verified live**, and authoritative: NIST / IETF / the standards body
  itself preferred, a vendor glossary acceptable. When WebFetch returns 404 or an empty
  body for a site that ought to be authoritative (`eur-lex.europa.eu`,
  `docs.cyberark.com` are both known cases), curl the status before downgrading to a
  weaker source — any 2xx means live, and a 202 is bot mitigation rather than failure.
  Take the substance from a fetchable mirror if you must, but cite the canonical URL.
- **No emoji** anywhere in the page.

## Verification

```bash
npm test              # validate.mjs against index.html — must exit clean before any commit
npm run verify        # renders every term in a browser and checks its diagram geometry
npm run glossary      # regenerates glossary.txt, prints the term count
npm run test:tour     # proves validate/verify catch broken tours
npm run test:takeaways  # proves validate/verify catch broken takeaway tiles
npm run test:calm     # proves validate/verify catch broken CALM models and drawings
```

`validate.mjs` is the style-guide linter — exactly one accent colour, no stray hex in
component CSS, on-scale spacing values, no emoji — and it also checks that the `TERMS`,
tag-array and `DIAGRAMS` declarations still parse, so an edit that breaks the array is
caught on the write rather than at `npm run glossary`. It validates every model in `CALM` against the vendored CALM 1.2 schema
(`test/calm-schema/1.2/`, through `ajv`) and checks its references. A project hook runs it after every
`index.html` write, but it is still the gate before committing.

`verify.mjs` is the rendered check: it opens each term's detail view in a headless
browser and asserts the diagram appears, the counters match the data, no label sits
across a box border, and no connector runs through a label. For a term with `steps` it
also drives the diagram tour: every chip, the panel text, keyboard stepping and reduced
motion. It also checks every term's takeaway tiles against the data, the limitation
marker, and the collapsed explainer and its print behaviour, at desktop and phone width.
For a term with a CALM model it compares the drawing with the model (shapes, connectors,
containment, flow order), and checks the model disclosure and that every node's type
word sits clear.
Pass term ids to narrow it (`npm run verify calico`).

The three fixture suites run `verify.mjs` with `--offline`, which answers every network
request with an empty response, so they never wait on Google Fonts. Do not use the flag
for a real run: the geometry checks measure text in the page's own fonts. A real run
waits for those fonts before measuring and reports a `fonts` error if they do not load,
so it cannot pass without access to Google Fonts.

The term count printed by `npm run glossary` is a free cross-check on the counters in
step 4 of the skill.

## Committing

Two commits per term, direct to `main`:

1. `feat: add <Term> to the glossary` — `index.html`, `README.md`, `glossary.txt`
2. `chore: refresh screenshots for the <term> entry` — `screenshots/`

Both carry the `Co-Authored-By` trailer. Push only when James asks.
