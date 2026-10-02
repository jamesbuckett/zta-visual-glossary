# Flash-card takeaways — design

Date: 2026-10-02
Status: approved in brainstorming, awaiting spec review

## Goal

Replace the explainer prose in each term's detail view with a grid of flash-card
takeaways: three to five short tiles a reader can scan in seconds, the last of which is
always the term's limitation. The full explainer stays one click away in a collapsed
disclosure, so no content is lost.

The detail view becomes: title → TL;DR → infographic → takeaway tiles → full explainer
(collapsed) → tags → source → related terms.

## Decisions

| Question | Decision |
|---|---|
| Card format | Static takeaway tiles in a grid, all readable at once. No flip, no deck. |
| Card content | A new authored `takeaways` field on every term, written from the existing explainer |
| Explainer prose | Kept on the page, collapsed under the tiles in a "Full explainer" disclosure |
| Explainer data | Unchanged. It remains the verified source that tour, fact and takeaway copy draw on |
| `glossary.txt` | Unchanged. Takeaways are not added to it |

Why authored copy rather than splitting the explainer or reusing the tour, measured on the
104 terms as of this date:

- Explainer sentences have a median of 26 words and a maximum of 91, too long for a tile.
- 162 of the 583 follow-on sentences (every sentence after an explainer's first) open with
  "It", "This", "The limitation" or similar, so they lose their subject when cut apart.
- In a typical entry about 60% of the explainer's sentences are already restated by the
  tour steps directly above, so reusing the steps would repeat what is on screen.

## 1. Data model

Each `TERMS` entry gains:

```js
takeaways: [
  { title: "Both sides prove identity", text: "Where ordinary TLS has only the server present a certificate, mutual TLS requires the client to present one as well." },
  …                                       // 3–5 entries; the last is the limitation
]
```

- `title`: two to four words. A hyphenated word counts as one, as for tour titles.
- `text`: one sentence, at most 30 words.
- Three to five takeaways per term.
- **The last takeaway is always the limitation**: what the technology does not solve, drawn
  from the limitation that closes the explainer.
- Takeaways state only what the entry's verified `explainer` says. No new factual claim
  enters through a takeaway. UK spelling and the no-emoji rule apply.
- No takeaway `text` repeats a tour step's `text` or the `fact` word for word. The tiles
  compress the explainer; they do not copy the tour. A step sentence with only a word or
  two inserted, dropped or swapped counts as a repeat.
- Every card names its subject. None opens with a bare "It" or "Its", because tiles are
  read one at a time.

The last two rules were sharpened at the pilot's second-pass review (2 October 2026), and
the worked example below was rewritten to meet them.

Worked example (mTLS):

| Tile | Title | Text |
|---|---|---|
| 01 | Both sides prove identity | Where ordinary TLS has only the server present a certificate, mutual TLS requires the client to present one as well. |
| 02 | Verified before data flows | Neither side sends application data until each has verified the other, so authentication runs both ways and needs no passwords. |
| 03 | Zero-trust cornerstone | mTLS underpins zero-trust service-to-service traffic and service meshes, where every workload carries its own cryptographic identity. |
| Limitation | Identity, not permission | mTLS proves which workload is at each end, not what it may do; authorisation is a separate check, and every certificate must be issued, rotated and revoked. |

## 2. Page

### Markup

`detailHtml` in `index.html` emits, after the infographic and in place of the open
`.explainer` block:

1. A `Takeaways` heading: an `<h2 class="detail-section-label">`, matching the tags, source
   and related-terms headings.
2. The tiles: a `<ul class="takeaways">` with one `<li class="takeaway">` per entry. Each
   holds an eyebrow, the title as an `<h3>`, and the text as a `<p>`.
   - The eyebrow is the tile's two-digit number (`01`, `02`, …).
   - The last tile's eyebrow reads `Limitation` instead, and the tile carries a
     `takeaway-limit` class.
3. The disclosure: `<details class="explainer-more">` with `<summary>Full explainer</summary>`
   and the existing `.explainer` paragraphs inside. Closed when a term opens.

A term without `takeaways` renders its `.explainer` open, exactly as today (see §4).

### Styling

Built only on existing tokens: still exactly one `--accent`, no stray hex, on-scale spacing.

- Grid: one column on phones, two columns from 560px, the same breakpoint the term grid
  uses. The detail column is at most 880px, so two is the ceiling.
- When the number of tiles is odd, the last tile spans both columns.
- Tile: `--surface` background, 1px `--border`, `--radius-lg`, like the TL;DR box.
- The limitation tile takes the 4px accent left border the TL;DR box uses. The word
  "Limitation" carries the meaning, so nothing depends on colour alone.
- Tiles are static. No hover state, no pointer cursor, no animation.
- The summary gets a visible focus ring and a chevron that turns when open.

### Behaviour

- The disclosure is the only interactive element added. It is a native `<details>`, so
  keyboard and screen-reader behaviour come from the browser.
- Printing opens the disclosure and returns it to its prior state afterwards, so a printed
  entry carries the tiles and the full explainer.
- Search is unaffected: it does not read the explainer today and will not read takeaways.
- Without JS nothing renders, as today.

## 3. Tooling and verification

### `validate.mjs`

A new `takeaways-data` rule, alongside `tour-data`. For any term with `takeaways`:

- three to five entries, each with a non-empty `title` and `text`;
- each `title` has two to four words;
- each `text` has at most 30 words;
- no `text` equals a step `text` or the `fact`, compared case-insensitively with whitespace
  collapsed.

"One sentence" and "the last takeaway is the limitation" are not machine-checked. Sentence
detection breaks on "e.g.", version numbers and RFC references, and a limitation cannot be
recognised by pattern. Both stay review rules, as the explainer's own limitation rule is.

### `verify.mjs`, per term with `takeaways`

1. The number of rendered tiles equals `takeaways.length`.
2. Each tile's title and text equal the data, in order.
3. Only the last tile carries the limitation eyebrow and class.
4. The disclosure exists, is closed when the term opens, and holds the explainer paragraphs.
5. No tile's content overflows its tile horizontally.

### Fixtures

A new `test/takeaways-fixtures.mjs`, run by `npm run test:takeaways`, built the way
`test/tour-fixtures.mjs` is. It proves the checkers catch: two takeaways, six takeaways, a
one-word title, a five-word title, a 31-word text, and a text copied from a tour step. It
also proves a good set validates and verifies clean. Phase 3 adds the "term without
takeaways" case.

### Docs

- **`add-glossary-term` skill:** the step 1 template gains `takeaways` with its rules.
- **`CLAUDE.md`:** the invariants gain the takeaway rules; the verification section gains
  `npm run test:takeaways`.

### Review captures

Light and dark captures of each batch's terms, at desktop and phone width, taken to the
scratchpad and read before each batch commit. They are not committed.

## 4. Rollout

- **Coexistence:** the renderer falls back to the open explainer for any term without
  `takeaways`, so every commit is shippable. The new checks apply only to terms with
  `takeaways` until phase 3.
- **Phase 0, infrastructure.** Renderer, tile and disclosure CSS, the print handling, the
  validator and verifier rules, the fixtures, and the skill and `CLAUDE.md` updates. No term
  is migrated. Done when `npm test`, a full `npm run verify`, `npm run test:tour` and
  `npm run test:takeaways` are clean with every term on the fallback.
- **Phase 1, pilot.** Five terms chosen to stress the copy rules:
  - BGP: the shortest explainer (57 words).
  - Calico: the longest (536 words, four paragraphs).
  - Envoy: the most paragraphs (five).
  - mTLS: a typical short entry, and the worked example above.
  - HAR: the newest entry, with a multi-sentence limitation.

  One commit: `feat: add pilot takeaways for five terms`. James reviews the pilot in the
  browser before any further authoring. Changes to the copy rules or the tile design land
  here.
- **Phase 2, batches.** The remaining 99 terms in four batches, grouped by each term's
  first domain:
  1. Zero-Trust Core, Identity & Access.
  2. Secure Channels & Crypto, Transport & Web.
  3. Addressing & Routing, Network Edge & Ops, Kubernetes.
  4. Platforms & Apps, Detection & Response, Governance & Supply Chain, AI & Models.

  One commit per batch: `feat: add takeaways for the <domains> terms (part N of 4)`,
  touching `index.html` only. Every card in a batch gets a second-pass check against its
  explainer before the commit. Stop for review after each batch. Push only when James asks.
- **Phase 3, lock-in.** Remove the fallback. Make `takeaways` mandatory in `validate.mjs`
  and `verify.mjs`. Update the README sentence, the hero lede and the meta description,
  which today say "a TL;DR, an explainer, and a diagram". Refresh the committed screenshots
  once, in their own `chore:` commit, since the lede sits on the browse view.

## Out of scope

- Flip cards, a one-card deck, or any interaction on the tiles.
- Search over takeaways.
- Changes to `glossary.txt`, the browse grid, filters, TOC or term cards.
- Per-tile icons.
- New terms or tags, or any change to existing explainer, tour or fact copy.
- Splitting `index.html` or adding a build step or runtime dependency.

## Risks

- **Volume:** roughly 420 tiles of copy across 104 terms. The pilot gate exists to settle
  the copy rules before the volume.
- **Accuracy drift:** compressing a sentence can quietly change its claim. Mitigation:
  takeaways are sourced from the verified explainer, the full explainer stays on the page,
  and every card gets a second-pass check against its explainer.
- **Overlap with the tour:** for short entries the tour already covers most of the
  explainer, so tiles and steps will share substance. The no-verbatim rule keeps the wording
  distinct; the pilot's BGP and mTLS entries show whether that is enough.
- **File size:** `index.html` grows by the takeaway copy and the tile code. Watch it, but no
  limit is set.
