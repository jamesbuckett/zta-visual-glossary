# CLAUDE.md

A browsable visual glossary of IT, networking and zero-trust terms. Everything ships in
one self-contained `index.html` — markup, styles, the `TERMS` data array, and
hand-authored inline SVG diagrams. No build step and no runtime dependencies; the
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
```

`validate.mjs` is the style-guide linter — exactly one accent colour, no stray hex in
component CSS, on-scale spacing values, no emoji — and it also checks that the `TERMS`,
tag-array and `DIAGRAMS` declarations still parse, so an edit that breaks the array is
caught on the write rather than at `npm run glossary`. A project hook runs it after every
`index.html` write, but it is still the gate before committing.

`verify.mjs` is the rendered check: it opens each term's detail view in a headless browser
and asserts the diagram appears, the counters match the data, no label sits across a box
border, and no connector runs through a label. Pass term ids to narrow it
(`npm run verify calico`).

The term count printed by `npm run glossary` is a free cross-check on the counters in
step 4 of the skill.

## Committing

Two commits per term, direct to `main`:

1. `feat: add <Term> to the glossary` — `index.html`, `README.md`, `glossary.txt`
2. `chore: refresh screenshots for the <term> entry` — `screenshots/`

Both carry the `Co-Authored-By` trailer. Push only when James asks.
