# Flash-Card Takeaways Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the explainer prose in each term's detail view with three to five flash-card takeaway tiles, the last always the limitation, and keep the full explainer in a collapsed disclosure beneath them.

**Architecture:** Takeaway copy lives in a new `takeaways` array on each `TERMS` entry. One renderer (`takeawaysHtml`) builds the tiles and the disclosure for any term that has the field and falls back to today's open explainer for any term that does not, so every commit ships. `validate.mjs` holds the copy to its shape rules, `verify.mjs` checks the rendered tiles, and a fixture harness proves both checkers catch broken takeaways.

**Tech Stack:** Single-file `index.html` (vanilla JS, CSS custom properties); Node ESM tooling; Playwright (via `_launch.mjs`) for rendered checks; `sharp` for review contact sheets.

**Spec:** `docs/superpowers/specs/2026-10-02-flash-card-takeaways-design.md`

## Global Constraints

- One self-contained `index.html`. No build step, no runtime dependency, no external script.
- Exactly one `--accent` declaration. No hex in component CSS. Colours come only from existing tokens.
- Spacing (margin/padding/gap) only on the 4/8/12/16/24/32/48/64/96 scale, via `var(--space-N)`. `0` is allowed.
- No emoji anywhere. UK spelling in all copy ("authorisation", "sanitised", "organisation").
- Three to five takeaways per term. `title` is two to four words (a hyphenated word counts as one). `text` is one sentence of at most 30 words.
- The last takeaway is always the limitation: what the technology does not solve, drawn from the limitation that closes the explainer.
- Takeaways state only what the entry's `explainer` already says. No new factual claims.
- No takeaway `text` repeats a tour step's `text` or the `fact` word for word.
- Existing `explainer`, `steps` and `fact` copy is not edited. `glossary.txt` is not changed.
- Authoring format: `takeaways: [` opens on its own line at six spaces after the `fact` line, one card per line at eight spaces, and the closing `]` sits alone at six spaces. `test/takeaways-fixtures.mjs` finds the field by that shape.
- A project hook runs `validate.mjs` after every `index.html` write. It is a convenience, not the gate.
- Gates before every commit: `npm test`, `npm run test:tour`, `npm run test:takeaways` and `npm run verify` each exit 0. Check exit codes directly (`npm test; echo $?`); never pipe a gate through `tail` and trust the output.
- Commits go direct to `main` with the trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Push only when James asks.

## Review Focus

Inputs and conditions the spec implies but does not spell out, most likely to bite first. Each is pinned by a test in the task named.

1. **Copy containing `<`, `&` or quotes** (for example "RBAC & ABAC", "TTL < 64") must render as literal text, never as markup. Pinned in Task 2: the good fixture carries `<b>` and `&`, verify asserts each tile holds exactly three elements and that its text equals the data, and the "unescaped copy caught" case proves the check fires.
2. **Phone width and long unbroken tokens** (`GlobalNetworkPolicy`, `projectcalico.org/v3`): at 375px tiles are one column and nothing overflows. Pinned in Task 2: verify repeats the tile probe at 375px, and "overflowing tile caught" proves the check fires.
3. **Opening the explainer, then opening a term again:** the disclosure starts closed every time a term renders. Pinned in Task 2: verify opens it, re-renders the term, and asserts it is closed.
4. **Printing:** the disclosure opens for print and returns to how the reader left it, including when the reader had already opened it. Pinned in Task 2: verify fires `beforeprint`/`afterprint` in both states, and "print does not open the disclosure caught" proves the check fires.
5. **A term still on the fallback, opened after a term with tiles** (phases 0 to 2): no stale heading, tiles or disclosure, and the explainer shows open. Pinned in Task 2: verify's fallback branch, exercised on every full run while both kinds of term exist, and the "fallback term verifies" case.

## File map

| File | Change |
|---|---|
| `index.html` | Tile and disclosure CSS; `takeawaysHtml()`; print handling; the `TERMS` field comment; per-term `takeaways`; phase 3: fallback removed, lede and meta description updated |
| `validate.mjs` | `takeaways-data` rule (phase 3: mandatory) |
| `verify.mjs` | Takeaways probe and checks at 1440px and 375px (phase 3: mandatory) |
| `test/takeaways-fixtures.mjs` | New. Builds good and broken fixtures and asserts the checkers' verdicts |
| `package.json` | `test:takeaways` script |
| `.claude/skills/add-glossary-term/SKILL.md` | Step 1 template and rules gain `takeaways`; step 6 gains check (d) |
| `CLAUDE.md` | Takeaway invariant; `npm run test:takeaways`; verify description |
| `README.md` | Phase 3: the two sentences that describe an entry |
| `screenshots/` | Phase 3: one refresh |

---

## Phase 0: infrastructure

### Task 1: Fixture harness and `validate.mjs` takeaways-data check

**Files:**
- Create: `test/takeaways-fixtures.mjs`
- Modify: `package.json` (scripts)
- Modify: `validate.mjs` (inside the `if (html.includes('const TERMS = ['))` block, directly after the tour-data loop that ends near line 120)

**Interfaces:**
- Produces: `npm run test:takeaways`; a `takeaways-data` rule in `validate.mjs`; the fixture helpers `card`, `set`, `withTakeaways`, `swap` and the `CASES` array that Task 2 and Task 9 extend.
- `CASES` rows are `[name, build, checker, wantCode, wantRule, wantMsg]`: `build` is a function returning the fixture HTML, `checker` is `'validate'` or `'verify'`, `wantRule` is a rule name or `null`, `wantMsg` is a `RegExp` or omitted.

- [ ] **Step 1: Write the fixture harness**

Create `test/takeaways-fixtures.mjs`:

```js
#!/usr/bin/env node
// test/takeaways-fixtures.mjs — proves validate.mjs and verify.mjs catch broken
// takeaway tiles. Builds throwaway copies of index.html in a temp dir with
// synthetic takeaways on the WireGuard entry, then runs each checker and
// asserts the exit code, the rule it reports, and a fragment of the message.
//
// Usage: npm run test:takeaways

import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { readTerms } from '../_terms.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'index.html');
const base = fs.readFileSync(source, 'utf8');
const wireguard = readTerms(source).TERMS.find((t) => t.id === 'wireguard');

const card = (title, text) => `{ title: ${JSON.stringify(title)}, text: ${JSON.stringify(text)} }`;
const set = (...cards) => `takeaways: [\n        ${cards.join(',\n        ')}\n      ]`;
const words = (n) => Array.from({ length: n }, (_, i) => `word${i + 1}`).join(' ') + '.';

// A carries markup and B carries "&", so a renderer that forgets to escape
// fails the "good takeaways verify" case.
const A = card('Keys name peers', 'Keys, not <b>names</b>, identify each peer.');
const B = card('Small & fast', 'It is a fast, minimal VPN protocol.');
const C = card('Keys are manual', 'It does not distribute keys for you.');
const D = card('Current cryptography', 'It is built on current cryptography.');
const GOOD = set(A, B, C);

// Replaces the wireguard entry's takeaways with `takeaways`, or removes them
// when it is null. Works inside the entry's own bounds, so an entry with no
// takeaways cannot make the strip run on into a later term's.
function withTakeaways(html, takeaways) {
  const at = html.indexOf('id: "wireguard"');
  const close = html.indexOf('\n    }', at);
  const entry = html.slice(at, close).replace(/,\n\s*takeaways: \[[\s\S]*?\n {6}\]/, '');
  if (entry.includes('takeaways:')) throw new Error('could not strip the wireguard takeaways — is the closing ] alone at six spaces?');
  return html.slice(0, at) + entry + (takeaways ? `,\n      ${takeaways}` : '') + html.slice(close);
}

// A literal replace that refuses to pass silently when the needle has moved.
function swap(html, from, to) {
  if (!html.includes(from)) throw new Error(`fixture needle not found: ${from}`);
  return html.replace(from, () => to);
}

const CASES = [
  // [name, build, checker, expected exit, rule expected in the report, message fragment]
  ['good takeaways validate', () => withTakeaways(base, GOOD), 'validate', 0, null],
  ['30-word text accepted', () => withTakeaways(base, set(A, B, card('Keys are manual', words(30)))), 'validate', 0, null],
  ['two takeaways rejected', () => withTakeaways(base, set(A, B)), 'validate', 1, 'takeaways-data', /array of 3–5/],
  ['six takeaways rejected', () => withTakeaways(base, set(A, B, C, D, A, B)), 'validate', 1, 'takeaways-data', /array of 3–5/],
  ['takeaways not an array rejected', () => withTakeaways(base, 'takeaways: "none"'), 'validate', 1, 'takeaways-data', /array of 3–5/],
  ['empty text rejected', () => withTakeaways(base, set(A, B, card('Keys are manual', ' '))), 'validate', 1, 'takeaways-data', /non-empty title and text/],
  ['one-word title rejected', () => withTakeaways(base, set(A, B, card('Manual', 'It does not distribute keys for you.'))), 'validate', 1, 'takeaways-data', /has 1 words/],
  ['five-word title rejected', () => withTakeaways(base, set(A, B, card('Keys are yours to manage', 'It does not distribute keys for you.'))), 'validate', 1, 'takeaways-data', /has 5 words/],
  ['31-word text rejected', () => withTakeaways(base, set(A, B, card('Keys are manual', words(31)))), 'validate', 1, 'takeaways-data', /has 31 words/],
  // Upper-cased and double-spaced: the comparison must ignore case and spacing.
  ['text copied from a tour step rejected', () => withTakeaways(base, set(A, B, card('Copied from tour', wireguard.steps[0].text.toUpperCase().replace(/ /g, '  ')))), 'validate', 1, 'takeaways-data', /repeats a tour step/],
  ['text copied from the key fact rejected', () => withTakeaways(base, set(A, B, card('Copied from fact', wireguard.fact))), 'validate', 1, 'takeaways-data', /repeats a tour step/],
];

let failed = 0;
for (const [name, build, checker, wantCode, wantRule, wantMsg] of CASES) {
  let html;
  try { html = build(); } catch (e) { failed++; console.log(`  FAIL  ${name}: ${e.message}`); continue; }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'takeaways-'));
  const file = path.join(dir, 'index.html');
  fs.writeFileSync(file, html);
  const args = checker === 'validate'
    ? [path.join(root, 'validate.mjs'), file, '--json']
    : [path.join(root, 'verify.mjs'), 'wireguard', `--target=${file}`, '--json'];
  const r = spawnSync('node', args, { encoding: 'utf8' });
  fs.rmSync(dir, { recursive: true, force: true });

  let errors = [];
  try { errors = JSON.parse(r.stdout).errors || []; } catch { /* non-JSON output */ }
  const hits = errors.filter((e) => e.rule === wantRule);
  const codeOk = r.status === wantCode;
  const ruleOk = wantRule === null || hits.length > 0;
  const msgOk = !wantMsg || hits.some((e) => wantMsg.test(e.msg));
  if (codeOk && ruleOk && msgOk) console.log(`  ok    ${name}`);
  else {
    failed++;
    console.log(`  FAIL  ${name}: exit ${r.status} (want ${wantCode}), want ${wantRule || 'no rule'}${wantMsg ? ` ${wantMsg}` : ''}`);
    for (const e of errors.slice(0, 6)) console.log(`        ${e.rule}: ${e.msg}`);
    if (!r.stdout.trim().startsWith('{')) console.log((r.stdout + r.stderr).split('\n').slice(0, 8).map((l) => '        ' + l).join('\n'));
  }
}
console.log(failed ? `\n${failed} fixture case(s) failed` : '\nall fixture cases pass');
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Add the npm script**

In `package.json`, replace:

```json
    "test:tour": "node test/tour-fixtures.mjs",
```

with:

```json
    "test:tour": "node test/tour-fixtures.mjs",
    "test:takeaways": "node test/takeaways-fixtures.mjs",
```

- [ ] **Step 3: Run the fixtures to verify they fail**

Run: `npm run test:takeaways; echo $?`

Expected: exit 1. The two accepting cases print `ok`. The nine rejecting cases print `FAIL … exit 0 (want 1)`, because `validate.mjs` has no takeaways rule yet.

- [ ] **Step 4: Add the `takeaways-data` rule**

In `validate.mjs`, find the end of the tour-data loop:

```js
    if (!String(t.fact || '').trim()) err('tour-data', `${where}: a term with steps needs a non-empty fact`);
  }
}
```

and replace it with:

```js
    if (!String(t.fact || '').trim()) err('tour-data', `${where}: a term with steps needs a non-empty fact`);
  }

  // Takeaway tiles: a term with takeaways has 3–5 of them, each a title of two
  // to four words and a text of at most 30 words that does not copy a tour
  // step or the key fact word for word. "One sentence" and "the last one is
  // the limitation" are review rules; neither can be recognised by pattern.
  const flat = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  for (const t of terms) {
    if (t.takeaways === undefined) continue;
    const where = t.id || '(no id)';
    if (!Array.isArray(t.takeaways) || t.takeaways.length < 3 || t.takeaways.length > 5) {
      err('takeaways-data', `${where}: takeaways must be an array of 3–5 entries`);
      continue;
    }
    const steps = Array.isArray(t.steps) ? t.steps : [];
    const tourCopy = new Set([...steps.map((s) => flat(s && s.text)), flat(t.fact)].filter(Boolean));
    t.takeaways.forEach((k, i) => {
      if (!k || !String(k.title || '').trim() || !String(k.text || '').trim()) {
        err('takeaways-data', `${where}: takeaway ${i + 1} needs a non-empty title and text`);
        return;
      }
      const titleWords = k.title.trim().split(/\s+/).length;
      if (titleWords < 2 || titleWords > 4) {
        err('takeaways-data', `${where}: takeaway ${i + 1} title "${k.title}" has ${titleWords} words, want 2–4`);
      }
      const textWords = k.text.trim().split(/\s+/).length;
      if (textWords > 30) {
        err('takeaways-data', `${where}: takeaway ${i + 1} text has ${textWords} words, want at most 30`);
      }
      if (tourCopy.has(flat(k.text))) {
        err('takeaways-data', `${where}: takeaway ${i + 1} text repeats a tour step or the key fact word for word`);
      }
    });
  }
}
```

- [ ] **Step 5: Run the fixtures to verify they pass**

Run: `npm run test:takeaways; echo $?`

Expected: eleven `ok` lines, `all fixture cases pass`, exit 0.

- [ ] **Step 6: Run the gates**

Run each and check the exit code: `npm test; echo $?`, `npm run test:tour; echo $?`, `npm run verify; echo $?`

Expected: each exits 0. No term has `takeaways` yet, so the new rule is silent on the real page.

- [ ] **Step 7: Commit**

```bash
git add test/takeaways-fixtures.mjs package.json validate.mjs
git commit -m "$(cat <<'EOF'
feat: add the takeaways-data check and its fixture harness

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Tile renderer, disclosure and rendered checks

**Files:**
- Modify: `index.html` (CSS after the `.explainer p` rule near line 418; the `TERMS` field comment near line 770; a new `takeawaysHtml()` before `detailHtml()` near line 7969; the explainer block inside `detailHtml()` near line 8005; print handling after the `hashchange` listener near line 8148)
- Modify: `verify.mjs` (header comment; a new probe after `TOUR_PROBE`; a new check block before the console-error line of the per-term loop)
- Modify: `test/takeaways-fixtures.mjs` (verify-side cases appended to `CASES`)

**Interfaces:**
- Consumes: `card`, `set`, `withTakeaways`, `swap`, `words`, `A`, `B`, `C`, `D`, `GOOD` and `CASES` from Task 1.
- Produces: `takeawaysHtml(e)` in `index.html`, returning the tiles and disclosure for a term with `takeaways` and the open `.explainer` otherwise. DOM contract: `h2.detail-section-label` then `ul.takeaways` of `li.takeaway` (each holding exactly `span.takeaway-eyebrow`, `h3`, `p`), the last also `.takeaway-limit`; then `details.explainer-more` holding `summary` and `div.explainer`. A `takeaways` rule in `verify.mjs`.
- The fixtures tamper with three exact strings in `index.html`. Keep them exactly as written below: `<p>${esc(k.text)}</p>`, `i === last ? " takeaway-limit" : ""`, and `d.open = true;`.

- [ ] **Step 1: Add the verify-side fixture cases**

In `test/takeaways-fixtures.mjs`, find the last row of `CASES`:

```js
  ['text copied from the key fact rejected', () => withTakeaways(base, set(A, B, card('Copied from fact', wireguard.fact))), 'validate', 1, 'takeaways-data', /repeats a tour step/],
];
```

and replace it with:

```js
  ['text copied from the key fact rejected', () => withTakeaways(base, set(A, B, card('Copied from fact', wireguard.fact))), 'validate', 1, 'takeaways-data', /repeats a tour step/],

  // Rendered checks. Three tiles: the last spans both columns. Four: none does.
  ['good takeaways verify', () => withTakeaways(base, GOOD), 'verify', 0, null],
  ['four takeaways verify', () => withTakeaways(base, set(A, B, D, C)), 'verify', 0, null],
  ['fallback term verifies', () => withTakeaways(base, null), 'verify', 0, null],
  ['overflowing tile caught',
    () => swap(withTakeaways(base, set(A, B, card('Keys are manual', words(30)))), '</style>', '.takeaway p { white-space: nowrap; }</style>'),
    'verify', 1, 'takeaways', /overflows/],
  ['unescaped copy caught',
    () => swap(withTakeaways(base, GOOD), '<p>${esc(k.text)}</p>', '<p>${k.text}</p>'),
    'verify', 1, 'takeaways', /parsed as markup/],
  ['limitation marker on the wrong tile caught',
    () => swap(withTakeaways(base, GOOD), 'i === last ? " takeaway-limit" : ""', 'i === 0 ? " takeaway-limit" : ""'),
    'verify', 1, 'takeaways', /marked as the limitation/],
  ['print does not open the disclosure caught',
    () => swap(withTakeaways(base, GOOD), 'd.open = true;', ''),
    'verify', 1, 'takeaways', /printing/],
];
```

- [ ] **Step 2: Run the fixtures to verify the new cases fail**

Run: `npm run test:takeaways; echo $?`

Expected: exit 1. The eleven validate cases and `fallback term verifies` print `ok`. `good takeaways verify` and `four takeaways verify` also print `ok` for now, because `verify.mjs` does not look at tiles yet. `overflowing tile caught` fails with `exit 0 (want 1)`. The last three fail with `fixture needle not found`.

- [ ] **Step 3: Add the tile and disclosure CSS**

In `index.html`, find:

```css
    .explainer p { margin-bottom: var(--space-4); }
```

and replace it with:

```css
    .explainer p { margin-bottom: var(--space-4); }

    /* Takeaway tiles: the explainer compressed to three to five cards, the
       last always the limitation. Static, so no hover or pointer styles. */
    .takeaways {
      list-style: none; margin: 0; padding: 0;
      display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--space-4);
    }
    @media (min-width: 560px) {
      .takeaways { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .takeaway:last-child:nth-child(odd) { grid-column: 1 / -1; }
    }
    .takeaway {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: var(--space-5);
      overflow-wrap: anywhere;
    }
    .takeaway-limit { border-left: 4px solid var(--accent); }
    .takeaway-eyebrow {
      display: block; font-family: var(--font-mono); font-size: 11px; font-weight: 700;
      letter-spacing: .1em; text-transform: uppercase; color: var(--text-muted);
      margin-bottom: var(--space-2);
    }
    .takeaway-limit .takeaway-eyebrow { color: var(--accent-text); }
    .takeaway h3 { font-size: 1rem; line-height: 1.4; margin: 0 0 var(--space-2); }
    .takeaway p { margin: 0; font-size: 0.95rem; line-height: 1.5; }

    .explainer-more { margin-top: var(--space-5); }
    .explainer-more summary {
      display: inline-flex; align-items: center; gap: var(--space-2);
      color: var(--text-muted); font-size: var(--fs-small); font-weight: 700;
      cursor: pointer; list-style: none;
    }
    .explainer-more summary::-webkit-details-marker { display: none; }
    .explainer-more summary:hover { color: var(--accent); }
    .explainer-more summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: var(--radius); }
    .explainer-more summary svg { width: 16px; height: 16px; transition: transform var(--transition); }
    .explainer-more[open] summary svg { transform: rotate(90deg); }
    .explainer-more .explainer { margin-top: var(--space-4); }
```

`minmax(0, 1fr)` matters: a plain `1fr` track grows to fit unbreakable content, which would widen the tile instead of letting the overflow check see it.

- [ ] **Step 4: Document the field**

In `index.html`, find:

```js
     source {label, url}, caption, steps[] {title, text}, fact.
```

and replace it with:

```js
     source {label, url}, caption, steps[] {title, text}, fact,
     takeaways[] {title, text} (the last is the limitation).
```

- [ ] **Step 5: Add the renderer**

In `index.html`, find:

```js
  function detailHtml(e) {
```

and replace it with:

```js
  // Takeaway tiles, with the full explainer collapsed beneath them. A term
  // without takeaways shows its explainer open instead.
  function takeawaysHtml(e) {
    const paras = e.explainer.split(/\n\s*\n/).map(p => `<p>${esc(p.trim())}</p>`).join("");
    if (!e.takeaways) return `<div class="explainer">${paras}</div>`;
    const last = e.takeaways.length - 1;
    const tiles = e.takeaways.map((k, i) => `
        <li class="takeaway${i === last ? " takeaway-limit" : ""}">
          <span class="takeaway-eyebrow">${i === last ? "Limitation" : String(i + 1).padStart(2, "0")}</span>
          <h3>${esc(k.title)}</h3>
          <p>${esc(k.text)}</p>
        </li>`).join("");
    return `
      <h2 class="detail-section-label">Takeaways</h2>
      <ul class="takeaways" role="list">${tiles}</ul>
      <details class="explainer-more">
        <summary>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
          Full explainer
        </summary>
        <div class="explainer">${paras}</div>
      </details>`;
  }

  function detailHtml(e) {
```

`role="list"` restores the list semantics that `list-style: none` removes in Safari.

- [ ] **Step 6: Call the renderer from the detail view**

In `index.html`, find:

```js
      ${diagramHtml(e)}
      <div class="explainer">
        ${e.explainer.split(/\n\s*\n/).map(p => `<p>${esc(p.trim())}</p>`).join("")}
      </div>
```

and replace it with:

```js
      ${diagramHtml(e)}
      ${takeawaysHtml(e)}
```

- [ ] **Step 7: Add the print handling**

In `index.html`, find:

```js
  window.addEventListener("hashchange", route);
```

and replace it with:

```js
  window.addEventListener("hashchange", route);

  // Print the full explainer too: open the disclosure for printing, then put
  // it back the way the reader left it.
  let explainerWasOpen = null;
  window.addEventListener("beforeprint", () => {
    const d = els.detailContent.querySelector(".explainer-more");
    if (!d) return;
    explainerWasOpen = d.open;
    d.open = true;
  });
  window.addEventListener("afterprint", () => {
    const d = els.detailContent.querySelector(".explainer-more");
    if (d && explainerWasOpen !== null) d.open = explainerWasOpen;
    explainerWasOpen = null;
  });
```

- [ ] **Step 8: Describe the new check in the `verify.mjs` header**

In `verify.mjs`, find:

```js
//       motion; badges must not cover a label
//
```

and replace it with:

```js
//       motion; badges must not cover a label
//   (d) takeaway tiles — for a term with takeaways: tiles match the data and
//       hold no stray markup, only the last is marked as the limitation, the
//       full explainer sits in a closed disclosure that opens for print, and
//       nothing overflows at 1440px or 375px
//
```

- [ ] **Step 9: Add the takeaways probe**

In `verify.mjs`, find:

```js
const tocIds = `(() => [...document.querySelectorAll('#toc [data-toc]')].map((e) => e.dataset.toc))()`;
```

and replace it with:

```js
// Reads the takeaway tiles and the explainer disclosure as rendered. A tile
// holds exactly three elements (eyebrow, title, text); more means the copy was
// parsed as markup. `full` is whether a tile spans the whole grid.
const TAKEAWAYS_PROBE = `(() => {
  const root = document.querySelector('#detail-content');
  const list = root.querySelector('.takeaways');
  const more = root.querySelector('.explainer-more');
  const explainer = root.querySelector('.explainer');
  const width = list ? list.getBoundingClientRect().width : 0;
  return {
    tiles: [...root.querySelectorAll('.takeaways > .takeaway')].map((li) => ({
      eyebrow: (li.querySelector('.takeaway-eyebrow') || li).textContent.trim(),
      title: (li.querySelector('h3') || li).textContent,
      text: (li.querySelector('p') || li).textContent,
      limit: li.classList.contains('takeaway-limit'),
      elements: li.querySelectorAll('*').length,
      overflow: li.scrollWidth > li.clientWidth + 1,
      full: Math.abs(li.getBoundingClientRect().width - width) < 2,
    })),
    heading: !!root.querySelector('h2.detail-section-label + .takeaways'),
    more: !!more,
    open: more ? more.open : null,
    paras: explainer ? explainer.querySelectorAll('p').length : 0,
    inMore: !!(more && explainer && more.contains(explainer)),
  };
})()`;

// Fires the print events with the disclosure closed, then again after a real
// click has opened it. Print must open it and then put it back either way.
const PRINT_PROBE = `(() => {
  const d = document.querySelector('#detail-content .explainer-more');
  const fire = (name) => window.dispatchEvent(new Event(name));
  fire('beforeprint'); const during = d.open;
  fire('afterprint');  const after = d.open;
  d.querySelector('summary').click(); const clicked = d.open;
  fire('beforeprint'); fire('afterprint'); const kept = d.open;
  return { during, after, clicked, kept };
})()`;

// Renders the current term again, as following a link to it would, and reports
// whether the disclosure came back open.
const REOPEN_PROBE = `(() => {
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  return document.querySelector('#detail-content .explainer-more').open;
})()`;

const tocIds = `(() => [...document.querySelectorAll('#toc [data-toc]')].map((e) => e.dataset.toc))()`;
```

- [ ] **Step 10: Add the takeaways checks to the per-term loop**

In `verify.mjs`, find:

```js
  for (const c of consoleErrors)    err('console',   `${t.id}: ${c}`);
```

and replace it with:

```js
  // Takeaway tiles. Until phase 3 a term may still be on the fallback, which
  // must show its explainer open and no tiles, heading or disclosure.
  const paras = t.explainer.split(/\n\s*\n/).length;
  const tk = await page.evaluate(TAKEAWAYS_PROBE);
  if (!t.takeaways) {
    if (tk.tiles.length || tk.heading || tk.more) err('takeaways', `${t.id}: no takeaways in the data, but tiles, a heading or a disclosure rendered`);
    if (tk.paras !== paras) err('takeaways', `${t.id}: fallback shows ${tk.paras} explainer paragraph(s), want ${paras}`);
  } else {
    const n = t.takeaways.length;
    if (tk.tiles.length !== n) err('takeaways', `${t.id}: ${tk.tiles.length} tiles for ${n} takeaways`);
    if (!tk.heading) err('takeaways', `${t.id}: no "Takeaways" heading directly before the tiles`);
    tk.tiles.forEach((tile, i) => {
      const want = t.takeaways[i];
      if (!want) return;
      const last = i === n - 1;
      const eyebrow = last ? 'Limitation' : String(i + 1).padStart(2, '0');
      if (tile.elements !== 3) err('takeaways', `${t.id}: tile ${i + 1} holds ${tile.elements} elements, want 3 — copy was parsed as markup`);
      if (tile.title !== want.title) err('takeaways', `${t.id}: tile ${i + 1} title does not match takeaways[${i}].title`);
      if (tile.text !== want.text) err('takeaways', `${t.id}: tile ${i + 1} text does not match takeaways[${i}].text`);
      if (tile.limit !== last) err('takeaways', `${t.id}: tile ${i + 1} ${tile.limit ? 'is' : 'is not'} marked as the limitation`);
      if (tile.eyebrow !== eyebrow) err('takeaways', `${t.id}: tile ${i + 1} eyebrow is "${tile.eyebrow}", want "${eyebrow}"`);
      if (tile.overflow) err('takeaways', `${t.id}: tile ${i + 1} overflows at 1440px`);
      if (tile.full !== (last && n % 2 === 1)) err('takeaways', `${t.id}: tile ${i + 1} ${tile.full ? 'spans' : 'does not span'} both columns at 1440px`);
    });

    if (!tk.more) err('takeaways', `${t.id}: no "Full explainer" disclosure`);
    else {
      if (tk.open) err('takeaways', `${t.id}: disclosure is open when the term opens`);
      if (!tk.inMore || tk.paras !== paras) err('takeaways', `${t.id}: disclosure holds ${tk.paras} explainer paragraph(s), want ${paras}`);

      const pr = await page.evaluate(PRINT_PROBE);
      if (!pr.during || pr.after) err('takeaways', `${t.id}: printing does not open the disclosure and close it again (during ${pr.during}, after ${pr.after})`);
      if (!pr.clicked) err('takeaways', `${t.id}: clicking "Full explainer" does not open it`);
      else if (!pr.kept) err('takeaways', `${t.id}: printing closed a disclosure the reader had opened`);

      if (await page.evaluate(REOPEN_PROBE)) err('takeaways', `${t.id}: disclosure is still open after the term is opened again`);
    }

    // Phone width: one column, nothing overflowing.
    await page.setViewportSize({ width: 375, height: 812 });
    const phone = await page.evaluate(TAKEAWAYS_PROBE);
    phone.tiles.forEach((tile, i) => {
      if (tile.overflow) err('takeaways', `${t.id}: tile ${i + 1} overflows at 375px`);
      if (!tile.full) err('takeaways', `${t.id}: tile ${i + 1} is not full width at 375px`);
    });
    await page.setViewportSize({ width: 1440, height: 1200 });
  }

  for (const c of consoleErrors)    err('console',   `${t.id}: ${c}`);
```

- [ ] **Step 11: Run the fixtures to verify they pass**

Run: `npm run test:takeaways; echo $?`

Expected: eighteen `ok` lines, `all fixture cases pass`, exit 0.

If `overflowing tile caught` fails with `exit 0`, the tile is growing instead of overflowing: check both `grid-template-columns` values use `minmax(0, 1fr)`.

- [ ] **Step 12: Look at the good fixture in a browser**

No real term has takeaways yet, so write the good fixture to the scratchpad and capture it. Save this as `<scratchpad>/fixture-shot.mjs` and run it from the repo root with `node <scratchpad>/fixture-shot.mjs <scratchpad>`:

```js
// Scratchpad: capture the WireGuard entry with fixture takeaways, light and
// dark, at 1440px and 375px. Run from the repo root. Not committed.
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const ROOT = process.cwd();
const out = process.argv[2];
const { launchBrowser } = await import(pathToFileURL(path.join(ROOT, '_launch.mjs')).href);

const TAKEAWAYS = `takeaways: [
        { title: "Keys name peers", text: "Keys, not <b>names</b>, identify each peer." },
        { title: "Small & fast", text: "It is a fast, minimal VPN protocol." },
        { title: "Keys are manual", text: "It does not distribute keys for you." }
      ]`;
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const at = html.indexOf('id: "wireguard"');
const close = html.indexOf('\n    }', at);
const file = path.join(out, 'fixture.html');
fs.writeFileSync(file, html.slice(0, close) + `,\n      ${TAKEAWAYS}` + html.slice(close));

const { browser } = await launchBrowser();
try {
  for (const theme of ['light', 'dark']) for (const width of [1440, 375]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    await ctx.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch {} }, theme);
    const page = await ctx.newPage();
    await page.goto(pathToFileURL(file).href + '#wireguard', { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForSelector('#detail-content .takeaways');
    await page.click('#detail-content .explainer-more summary');
    await (await page.$('#detail-content')).screenshot({ path: path.join(out, `fixture-${theme}-${width}.png`) });
    await ctx.close();
  }
} finally {
  await browser.close();
}
```

Read the four PNGs and confirm:
- "TAKEAWAYS" label, then tiles: two columns at 1440px with the third tile spanning both; one column at 375px.
- The first tile shows the literal text `<b>names</b>`; the second title shows `Small & fast`.
- Eyebrows read `01`, `02`, `Limitation`; only the limitation tile has the accent left border.
- "Full explainer" is open with its chevron turned, and the paragraphs sit beneath it.
- Dark theme uses the dark palette throughout; spacing above and below the tiles looks even.

- [ ] **Step 13: Run the gates**

Run each and check the exit code: `npm test; echo $?`, `npm run test:tour; echo $?`, `npm run test:takeaways; echo $?`, `npm run verify; echo $?`

Expected: each exits 0. Every real term is on the fallback, so `verify` exercises the fallback branch 104 times.

- [ ] **Step 14: Commit**

```bash
git add index.html verify.mjs test/takeaways-fixtures.mjs
git commit -m "$(cat <<'EOF'
feat: render takeaway tiles with the full explainer collapsed beneath

A term with takeaways shows them as tiles under its infographic; a term
without still shows its explainer open.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Skill and CLAUDE.md describe takeaways

**Files:**
- Modify: `.claude/skills/add-glossary-term/SKILL.md` (step 1 template and rules; step 6 list)
- Modify: `CLAUDE.md` (Invariants; Verification)

**Interfaces:**
- Consumes: the `takeaways` field and rules from Task 1, and check (d) from Task 2.
- Produces: nothing later tasks call. New terms added after this task carry `takeaways`.

- [ ] **Step 1: Add the field to the skill's template**

In `.claude/skills/add-glossary-term/SKILL.md`, find:

```
  fact: "One sentence from the explainer worth remembering."
}
```

and replace it with:

```
  fact: "One sentence from the explainer worth remembering.",
  takeaways: [
    { title: "Two to four words", text: "One sentence, at most 30 words, only what the explainer says." },
    …  // 3–5 takeaways; the last is the limitation
  ]
}
```

- [ ] **Step 2: Add the takeaway rules to the skill**

In the same file, find:

```
`DOMAIN_TAGS` arrays. UK spelling. See CLAUDE.md for the source-verification rule.
```

and replace it with:

```
`DOMAIN_TAGS` arrays. UK spelling. See CLAUDE.md for the source-verification rule.

`takeaways` are the tiles under the infographic: the explainer compressed to three to
five cards, the last always the limitation. They state only what the explainer says and
never repeat a tour step or the key fact word for word. Keep `takeaways: [` and its
closing `]` on their own lines at six spaces, as above: `test/takeaways-fixtures.mjs`
finds the field by that shape.
```

- [ ] **Step 3: Add check (d) to the skill's verify step**

In the same file, find:

```
- **(c) Diagram tour** — chips match `steps`, each step lights something, clicks and
  ArrowRight work, nothing animates under reduced motion, no badge covers a label.
```

and replace it with:

```
- **(c) Diagram tour** — chips match `steps`, each step lights something, clicks and
  ArrowRight work, nothing animates under reduced motion, no badge covers a label.
- **(d) Takeaway tiles** — tiles match `takeaways`, only the last is marked as the
  limitation, the full explainer sits in a closed disclosure that opens for print, and
  nothing overflows at 1440px or 375px.
```

- [ ] **Step 4: Add the invariant to CLAUDE.md**

In `CLAUDE.md`, find:

```
- **One candid limitation closes every `explainer`** — what the technology does not solve.
  An entry that only sells its subject is not finished.
```

and replace it with:

```
- **One candid limitation closes every `explainer`** — what the technology does not solve.
  An entry that only sells its subject is not finished.
- **Takeaways compress the explainer.** Three to five tiles, each a title of two to four
  words and one sentence of at most 30 words, stating only what the `explainer` says. The
  last tile is always the limitation, and none repeats a tour step or the key fact word
  for word.
```

- [ ] **Step 5: Add the fixture command to CLAUDE.md**

In `CLAUDE.md`, find:

```
npm run test:tour     # proves validate/verify catch broken tours
```

and replace it with:

```
npm run test:tour     # proves validate/verify catch broken tours
npm run test:takeaways  # proves validate/verify catch broken takeaway tiles
```

- [ ] **Step 6: Describe the rendered check in CLAUDE.md**

In `CLAUDE.md`, find:

```
motion. Pass term ids to narrow it (`npm run verify calico`).
```

and replace it with:

```
motion. For a term with `takeaways` it checks the tiles against the data, the limitation
marker, and the collapsed explainer and its print behaviour, at desktop and phone width.
Pass term ids to narrow it (`npm run verify calico`).
```

- [ ] **Step 7: Run the gates**

Run each and check the exit code: `npm test; echo $?`, `npm run test:takeaways; echo $?`

Expected: each exits 0. Neither file is read by the checkers; this confirms nothing else moved.

- [ ] **Step 8: Commit**

```bash
git add .claude/skills/add-glossary-term/SKILL.md CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: describe takeaways in the glossary skill and CLAUDE.md

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 1: pilot

### Task 4: Takeaways for the five pilot terms

**Files:**
- Modify: `index.html` (the `bgp`, `calico`, `envoy`, `mtls` and `har` entries in `TERMS`)
- Create (scratchpad, not committed): `takeaways-sheet.mjs` from Appendix A

**Interfaces:**
- Consumes: the renderer and checkers from Tasks 1 and 2; the capture script in Appendix A.
- Produces: the copy style every batch follows. Changes James asks for at the review land here, and in the Global Constraints if a rule changes.

Each edit below finds an entry's `fact` line, which is the last line of the entry, and adds the `takeaways` field after it.

- [ ] **Step 1: BGP (three tiles, the shortest explainer)**

In `index.html`, find:

```js
      fact: "BGP makes the internet a network of networks."
```

and replace it with:

```js
      fact: "BGP makes the internet a network of networks.",
      takeaways: [
        { title: "Networks advertise reach", text: "Autonomous systems, large independently run networks, use BGP to advertise the IP ranges they can reach and to choose paths between one another." },
        { title: "Policy before distance", text: "Path choice is policy-driven rather than purely shortest-path, reflecting commercial peering and transit relationships." },
        { title: "One misconfiguration away", text: "It takes only one misconfiguration to reroute traffic, or black-hole it, globally." }
      ]
```

- [ ] **Step 2: Calico (five tiles, the longest explainer)**

In `index.html`, find:

```js
      fact: "Calico resolves label selectors into IP sets, so a policy is only as trustworthy as the labels and the IPAM behind it."
```

and replace it with:

```js
      fact: "Calico resolves label selectors into IP sets, so a policy is only as trustworthy as the labels and the IPAM behind it.",
      takeaways: [
        { title: "A Kubernetes network plugin", text: "Kubernetes delegates pod networking to a CNI plugin, and Calico, created and maintained by Tigera under Apache-2.0, is one of the two you are most likely to meet." },
        { title: "Routes, not tunnels", text: "Pod packets cross the wire with their own addresses and no encapsulation, so routers, firewalls and flow collectors see real endpoints." },
        { title: "Overlay when needed", text: "Where the underlay will not carry pod routes, as in most cloud VPCs, Calico falls back to a VXLAN or IP-in-IP overlay." },
        { title: "Ordered, tiered policy", text: "Calico adds explicit deny, a deterministic order and tiers, so a platform team's global rules sit above developers' NetworkPolicies and cannot be overridden." },
        { title: "Identity is an address", text: "Calico enforces on IP sets resolved from labels, a weaker claim than cryptographic workload identity, and its WireGuard encryption protects node-to-node hops only." }
      ]
```

- [ ] **Step 3: Envoy (five tiles, five paragraphs)**

In `index.html`, find:

```js
      fact: "For Zero Trust, Envoy is the textbook Policy Enforcement Point, because the filter chain is exactly where enforcement belongs."
```

and replace it with:

```js
      fact: "For Zero Trust, Envoy is the textbook Policy Enforcement Point, because the filter chain is exactly where enforcement belongs.",
      takeaways: [
        { title: "Proxy beside every workload", text: "Envoy is an L7 proxy that runs out of process next to every workload, so one deployment serves services written in any language." },
        { title: "Built from filters", text: "Nearly everything Envoy does is a filter in a chain between a listener, where connections arrive, and a cluster of upstream hosts." },
        { title: "Configured live over xDS", text: "A management server streams listeners, routes, clusters, endpoints and certificates over gRPC, so configuration changes under live traffic without a restart." },
        { title: "A policy enforcement point", text: "Its filters terminate mTLS, validate JWTs, match RBAC rules and call an external decision point such as OPA for a per-request allow or deny." },
        { title: "Control plane required", text: "Almost nobody maintains its enormous configuration by hand, so adopting Envoy means adopting a control plane, and whoever can push xDS can reroute traffic across every proxy." }
      ]
```

- [ ] **Step 4: mTLS (four tiles, the spec's worked example)**

In `index.html`, find:

```js
      fact: "mTLS is a cornerstone of zero-trust service-to-service communication and of service meshes."
```

and replace it with:

```js
      fact: "mTLS is a cornerstone of zero-trust service-to-service communication and of service meshes.",
      takeaways: [
        { title: "Both sides prove identity", text: "Mutual TLS extends ordinary TLS so the client must present a certificate too." },
        { title: "No passwords needed", text: "Each side verifies the other before any data flows: two-way authentication with no passwords." },
        { title: "Zero-trust cornerstone", text: "It underpins service-to-service traffic in zero-trust networks and service meshes, where every workload carries its own identity." },
        { title: "Identity, not permission", text: "mTLS proves which workload is at each end, not what it may do; authorisation is a separate check." }
      ]
```

- [ ] **Step 5: HAR (five tiles, a multi-sentence limitation)**

In `index.html`, find:

```js
      fact: "A HAR records cookies and Authorization headers in the clear, so a file shared with a support desk can hand over a live session."
```

and replace it with:

```js
      fact: "A HAR records cookies and Authorization headers in the clear, so a file shared with a support desk can hand over a live session.",
      takeaways: [
        { title: "A log of traffic", text: "A HAR file is a JSON log of the HTTP traffic behind a page load, exported by browser developer tools and other HTTP monitoring tools." },
        { title: "One record per request", text: "Each entry records one request and its response: URL, method, headers, cookies, bodies and status, plus a timings breakdown." },
        { title: "Convention, not standard", text: "Version 1.2 is frozen and its W3C draft was abandoned, so HAR is a shared convention rather than a standard." },
        { title: "Chrome sanitises exports", text: "Chrome's default export now leaves out the Cookie, Set-Cookie and Authorization headers; everything else, URLs and bodies included, stays in the file." },
        { title: "Credentials in the file", text: "Cookies and Authorization headers are recorded in the clear, so a shared HAR can hand over a live session, as five Okta customers found in 2023." }
      ]
```

- [ ] **Step 6: Run the checks for the pilot terms**

Run: `npm test; echo $?` then `npm run verify bgp calico envoy mtls har; echo $?`

Expected: each exits 0. If `validate` reports `takeaways-data`, fix the card it names; do not loosen the rule.

- [ ] **Step 7: Second-pass check of every card against its explainer**

For each of the five terms, read the entry's `explainer`, `steps` and `fact`, then each takeaway, and confirm every item on this checklist. Subagent-driven: give a fresh reviewer the five ids and this checklist, without the reasoning behind the cards. Native: do it yourself with only the entry in view.

1. Every claim in the card is stated in the explainer. Nothing is added, sharpened or generalised ("most" has not become "all", "can" has not become "will").
2. The last card is the limitation that closes the explainer, not a feature.
3. Each `text` is one sentence.
4. No card says the same thing as another card of the same term.
5. UK spelling; no emoji; header and protocol names keep their own spelling ("Authorization" the header, "authorisation" the concept).
6. The title is a fair label for its text.

Fix anything the check finds, then repeat Step 6.

- [ ] **Step 8: Take and read the review captures**

Write Appendix A's script to `<scratchpad>/takeaways-sheet.mjs`, then run from the repo root:

```bash
node <scratchpad>/takeaways-sheet.mjs <scratchpad>/pilot bgp calico envoy mtls har
```

Expected: four files, `sheet-light-1440-1.png`, `sheet-light-375-1.png`, `sheet-dark-1440-1.png`, `sheet-dark-375-1.png`.

Read all four and confirm, for every term:
- Tile count matches the data: BGP 3, Calico 5, Envoy 5, mTLS 4, HAR 5.
- At 1440px, a three- or five-tile set ends in a full-width limitation tile; mTLS shows two rows of two.
- No title wraps to more than two lines at 1440px; no text is clipped at either width.
- Tiles in a row are the same height.
- Only the limitation tile has the accent border and the `Limitation` eyebrow.
- Light and dark both read cleanly.

- [ ] **Step 9: Run the gates**

Run each and check the exit code: `npm test; echo $?`, `npm run test:tour; echo $?`, `npm run test:takeaways; echo $?`, `npm run verify; echo $?`

Expected: each exits 0. The full `verify` run now alternates between terms with tiles and terms on the fallback.

- [ ] **Step 10: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
feat: add pilot takeaways for five terms

BGP, Calico, Envoy, mTLS and HAR: the shortest, longest and most
multi-paragraph explainers, a typical short entry and the newest one.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 11: Stop for James's review**

Ask James to open `index.html#bgp`, `#calico`, `#envoy`, `#mtls` and `#har` in a browser. Do not start Task 5 until he approves the pilot. If he changes a copy rule or the tile design, make the change here, update the Global Constraints and the affected checks, and re-run Step 9 before committing. Push only if asked.

---

## Phase 2: batches

Each batch task below follows the same procedure. It is restated in every task so each can be executed alone. Every batch needs Appendix A's capture script; include the appendix when dispatching a batch task to a subagent.

### Task 5: Batch 1, Zero-Trust Core and Identity & Access (30)

Ids: `oauth jwt zerotrust saml radius spiffe microseg peppdp idp pkce oidc openziti scim mfa rbac opa servicemesh nist207 ldap kerberos pam bola ztna obo paseto cyberark fapi fido2 immuta istio`

**Files:**
- Modify: `index.html` (the entries above)

- [ ] **Step 1: Write the takeaways.** For each id, read its `explainer`, `steps` and `fact`, then add a `takeaways` field after its `fact` line (add a comma to the `fact` line). Follow the Global Constraints and the pilot entries' style: three to five cards, titles of two to four words, one sentence of at most 30 words each, only what the explainer says, the last card the limitation, no card copying a step or the fact word for word. Short explainers get three cards; do not pad.
- [ ] **Step 2: Check the data.** `npm test; echo $?` exits 0, and `npm run verify <the ids above>; echo $?` exits 0. Fix the card a `takeaways-data` or `takeaways` error names; do not loosen a rule.
- [ ] **Step 3: Second-pass check.** For every card in the batch, against its own explainer: (1) every claim is stated in the explainer, nothing added, sharpened or generalised; (2) the last card is the explainer's closing limitation, not a feature; (3) each text is one sentence; (4) no two cards of a term say the same thing; (5) UK spelling, no emoji, header and protocol names keep their own spelling; (6) each title is a fair label for its text. Subagent-driven: a fresh reviewer gets the ids and this checklist, not the author's reasoning. Fix what it finds and repeat Step 2.
- [ ] **Step 4: Review captures.** Write Appendix A's script to `<scratchpad>/takeaways-sheet.mjs` if it is not there, run `node <scratchpad>/takeaways-sheet.mjs <scratchpad>/batch1 <the ids above>` from the repo root, and read every sheet: tile count matches the data, an odd set ends in a full-width limitation tile, no title wraps past two lines at 1440px, nothing is clipped, only the limitation tile has the accent border, light and dark both read cleanly.
- [ ] **Step 5: Gates.** `npm test; echo $?`, `npm run test:tour; echo $?`, `npm run test:takeaways; echo $?`, `npm run verify; echo $?` all exit 0.
- [ ] **Step 6: Commit** `feat: add takeaways for the zero-trust core and identity terms (part 1 of 4)` (`index.html` only), with the `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` trailer.
- [ ] **Step 7: Stop for James's review.** Push only if asked.

### Task 6: Batch 2, Secure Channels & Crypto and Transport & Web (23)

Ids: `http tls vpn wireguard grpc mqtt ssh ipsec quic cors websockets webtransport pki websec vault pqc tailscale pac tpm alpaca cntlm http2 fix`

**Files:**
- Modify: `index.html` (the entries above)

Both fixture harnesses rewrite the WireGuard entry. `test/takeaways-fixtures.mjs` strips WireGuard's real takeaways before adding its own, and `test/tour-fixtures.mjs` re-appends the tour after them, so both keep working once WireGuard has takeaways, provided the closing `]` sits alone at six spaces. Step 5 confirms it.

- [ ] **Step 1: Write the takeaways.** For each id, read its `explainer`, `steps` and `fact`, then add a `takeaways` field after its `fact` line (add a comma to the `fact` line). Follow the Global Constraints and the pilot entries' style: three to five cards, titles of two to four words, one sentence of at most 30 words each, only what the explainer says, the last card the limitation, no card copying a step or the fact word for word. Short explainers get three cards; do not pad.
- [ ] **Step 2: Check the data.** `npm test; echo $?` exits 0, and `npm run verify <the ids above>; echo $?` exits 0. Fix the card a `takeaways-data` or `takeaways` error names; do not loosen a rule.
- [ ] **Step 3: Second-pass check.** For every card in the batch, against its own explainer: (1) every claim is stated in the explainer, nothing added, sharpened or generalised; (2) the last card is the explainer's closing limitation, not a feature; (3) each text is one sentence; (4) no two cards of a term say the same thing; (5) UK spelling, no emoji, header and protocol names keep their own spelling; (6) each title is a fair label for its text. Subagent-driven: a fresh reviewer gets the ids and this checklist, not the author's reasoning. Fix what it finds and repeat Step 2.
- [ ] **Step 4: Review captures.** Write Appendix A's script to `<scratchpad>/takeaways-sheet.mjs` if it is not there, run `node <scratchpad>/takeaways-sheet.mjs <scratchpad>/batch2 <the ids above>` from the repo root, and read every sheet: tile count matches the data, an odd set ends in a full-width limitation tile, no title wraps past two lines at 1440px, nothing is clipped, only the limitation tile has the accent border, light and dark both read cleanly.
- [ ] **Step 5: Gates.** `npm test; echo $?`, `npm run test:tour; echo $?`, `npm run test:takeaways; echo $?`, `npm run verify; echo $?` all exit 0.
- [ ] **Step 6: Commit** `feat: add takeaways for the secure channel and web terms (part 2 of 4)` (`index.html` only), with the `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` trailer.
- [ ] **Step 7: Stop for James's review.** Push only if asked.

### Task 7: Batch 3, Addressing & Routing, Network Edge & Ops and Kubernetes (20)

Ids: `tcpip dns vlan nat firewall loadbalancer dhcp sase sdwan waf apigateway cilium casb dpu bluefield supernic ovs ovn ndlp sbc`

**Files:**
- Modify: `index.html` (the entries above)

- [ ] **Step 1: Write the takeaways.** For each id, read its `explainer`, `steps` and `fact`, then add a `takeaways` field after its `fact` line (add a comma to the `fact` line). Follow the Global Constraints and the pilot entries' style: three to five cards, titles of two to four words, one sentence of at most 30 words each, only what the explainer says, the last card the limitation, no card copying a step or the fact word for word. Short explainers get three cards; do not pad.
- [ ] **Step 2: Check the data.** `npm test; echo $?` exits 0, and `npm run verify <the ids above>; echo $?` exits 0. Fix the card a `takeaways-data` or `takeaways` error names; do not loosen a rule.
- [ ] **Step 3: Second-pass check.** For every card in the batch, against its own explainer: (1) every claim is stated in the explainer, nothing added, sharpened or generalised; (2) the last card is the explainer's closing limitation, not a feature; (3) each text is one sentence; (4) no two cards of a term say the same thing; (5) UK spelling, no emoji, header and protocol names keep their own spelling; (6) each title is a fair label for its text. Subagent-driven: a fresh reviewer gets the ids and this checklist, not the author's reasoning. Fix what it finds and repeat Step 2.
- [ ] **Step 4: Review captures.** Write Appendix A's script to `<scratchpad>/takeaways-sheet.mjs` if it is not there, run `node <scratchpad>/takeaways-sheet.mjs <scratchpad>/batch3 <the ids above>` from the repo root, and read every sheet: tile count matches the data, an odd set ends in a full-width limitation tile, no title wraps past two lines at 1440px, nothing is clipped, only the limitation tile has the accent border, light and dark both read cleanly.
- [ ] **Step 5: Gates.** `npm test; echo $?`, `npm run test:tour; echo $?`, `npm run test:takeaways; echo $?`, `npm run verify; echo $?` all exit 0.
- [ ] **Step 6: Commit** `feat: add takeaways for the addressing, network edge and Kubernetes terms (part 3 of 4)` (`index.html` only), with the `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` trailer.
- [ ] **Step 7: Stop for James's review.** Push only if asked.

### Task 8: Batch 4, Platforms & Apps, Detection & Response, Governance & Supply Chain and AI & Models (26)

Ids: `docker kubernetes react django siem edr sbom idsips soar dlp cve owasp sigstore doca rlhf dpo rag keda spinnaker dora ebpf lora qlora sentrywire coreweave amps`

**Files:**
- Modify: `index.html` (the entries above)

- [ ] **Step 1: Write the takeaways.** For each id, read its `explainer`, `steps` and `fact`, then add a `takeaways` field after its `fact` line (add a comma to the `fact` line). Follow the Global Constraints and the pilot entries' style: three to five cards, titles of two to four words, one sentence of at most 30 words each, only what the explainer says, the last card the limitation, no card copying a step or the fact word for word. Short explainers get three cards; do not pad.
- [ ] **Step 2: Check the data.** `npm test; echo $?` exits 0, and `npm run verify <the ids above>; echo $?` exits 0. Fix the card a `takeaways-data` or `takeaways` error names; do not loosen a rule.
- [ ] **Step 3: Second-pass check.** For every card in the batch, against its own explainer: (1) every claim is stated in the explainer, nothing added, sharpened or generalised; (2) the last card is the explainer's closing limitation, not a feature; (3) each text is one sentence; (4) no two cards of a term say the same thing; (5) UK spelling, no emoji, header and protocol names keep their own spelling; (6) each title is a fair label for its text. Subagent-driven: a fresh reviewer gets the ids and this checklist, not the author's reasoning. Fix what it finds and repeat Step 2.
- [ ] **Step 4: Review captures.** Write Appendix A's script to `<scratchpad>/takeaways-sheet.mjs` if it is not there, run `node <scratchpad>/takeaways-sheet.mjs <scratchpad>/batch4 <the ids above>` from the repo root, and read every sheet: tile count matches the data, an odd set ends in a full-width limitation tile, no title wraps past two lines at 1440px, nothing is clipped, only the limitation tile has the accent border, light and dark both read cleanly.
- [ ] **Step 5: Gates.** `npm test; echo $?`, `npm run test:tour; echo $?`, `npm run test:takeaways; echo $?`, `npm run verify; echo $?` all exit 0.
- [ ] **Step 6: Commit** `feat: add takeaways for the platform, detection, governance and AI terms (part 4 of 4)` (`index.html` only), with the `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` trailer.
- [ ] **Step 7: Stop for James's review.** Push only if asked.

Batch sizes: 30 + 23 + 20 + 26 = 99, plus the 5 pilots = 104. If a term has been added since this plan was written, `npm run verify` in Task 9 will name it; give it takeaways in the batch its first domain belongs to.

---

## Phase 3: lock-in

### Task 9: Make takeaways mandatory and remove the fallback

**Files:**
- Modify: `test/takeaways-fixtures.mjs` (two cases)
- Modify: `validate.mjs` (the takeaways-data loop)
- Modify: `verify.mjs` (static coverage section; the per-term takeaways block)
- Modify: `index.html` (`takeawaysHtml()`; the meta description near line 7; the hero lede near line 692)
- Modify: `README.md` (lines 12 and 24)
- Modify: `.claude/skills/add-glossary-term/SKILL.md`, `CLAUDE.md` (no change needed unless a pilot review changed a rule; re-read both and confirm)
- Modify: `screenshots/` (refreshed, separate commit)

**Interfaces:**
- Consumes: every term now has `takeaways` (Tasks 4 to 8).
- Produces: `takeaways` is required by `validate.mjs` and `verify.mjs`; the renderer has no fallback.

- [ ] **Step 1: Confirm every term has takeaways**

Run from the repo root:

```bash
node --input-type=module -e "
import { readTerms } from './_terms.mjs';
const missing = readTerms('./index.html').TERMS.filter((t) => !Array.isArray(t.takeaways)).map((t) => t.id);
console.log(missing.length ? 'missing: ' + missing.join(' ') : 'every term has takeaways');
"
```

Expected: `every term has takeaways`. If any id is listed, give it takeaways using the batch procedure before going on.

- [ ] **Step 2: Flip the fixtures**

In `test/takeaways-fixtures.mjs`, find:

```js
  ['fallback term verifies', () => withTakeaways(base, null), 'verify', 0, null],
```

and replace it with:

```js
  ['term without takeaways rejected', () => withTakeaways(base, null), 'validate', 1, 'takeaways-data', /array of 3–5/],
  ['term without takeaways caught by verify', () => withTakeaways(base, null), 'verify', 1, 'takeaways', /no takeaways/],
```

- [ ] **Step 3: Run the fixtures to verify the new cases fail**

Run: `npm run test:takeaways; echo $?`

Expected: exit 1. The two new cases print `FAIL … exit 0 (want 1)`; the other seventeen print `ok`.

- [ ] **Step 4: Make the field mandatory in `validate.mjs`**

In `validate.mjs`, find:

```js
  // Takeaway tiles: a term with takeaways has 3–5 of them, each a title of two
```

and replace it with:

```js
  // Takeaway tiles: every term has 3–5 takeaways, each a title of two
```

Then find and delete this line:

```js
    if (t.takeaways === undefined) continue;
```

A term with no `takeaways` now fails the `Array.isArray` check on the next line.

- [ ] **Step 5: Make the field mandatory in `verify.mjs`**

In `verify.mjs`, find:

```js
for (const d of DIAGRAM_IDS) {
  if (!ids.has(d)) warn('coverage', `DIAGRAMS.${d} has no matching term`);
}
```

and replace it with:

```js
for (const d of DIAGRAM_IDS) {
  if (!ids.has(d)) warn('coverage', `DIAGRAMS.${d} has no matching term`);
}
// Checked here rather than in the browser loop: without takeaways the detail
// view cannot render at all, so the loop would only report a render failure.
for (const t of TERMS) {
  if (!Array.isArray(t.takeaways)) err('takeaways', `${t.id}: no takeaways — every term has tiles`);
}
```

Then find:

```js
  // Takeaway tiles. Until phase 3 a term may still be on the fallback, which
  // must show its explainer open and no tiles, heading or disclosure.
  const paras = t.explainer.split(/\n\s*\n/).length;
  const tk = await page.evaluate(TAKEAWAYS_PROBE);
  if (!t.takeaways) {
    if (tk.tiles.length || tk.heading || tk.more) err('takeaways', `${t.id}: no takeaways in the data, but tiles, a heading or a disclosure rendered`);
    if (tk.paras !== paras) err('takeaways', `${t.id}: fallback shows ${tk.paras} explainer paragraph(s), want ${paras}`);
  } else {
```

and replace it with:

```js
  // Takeaway tiles. A term without them was reported by the static check.
  const paras = t.explainer.split(/\n\s*\n/).length;
  const tk = await page.evaluate(TAKEAWAYS_PROBE);
  if (t.takeaways) {
```

- [ ] **Step 6: Remove the fallback from the renderer**

In `index.html`, find:

```js
  // Takeaway tiles, with the full explainer collapsed beneath them. A term
  // without takeaways shows its explainer open instead.
  function takeawaysHtml(e) {
    const paras = e.explainer.split(/\n\s*\n/).map(p => `<p>${esc(p.trim())}</p>`).join("");
    if (!e.takeaways) return `<div class="explainer">${paras}</div>`;
```

and replace it with:

```js
  // Takeaway tiles, with the full explainer collapsed beneath them.
  function takeawaysHtml(e) {
    const paras = e.explainer.split(/\n\s*\n/).map(p => `<p>${esc(p.trim())}</p>`).join("");
```

- [ ] **Step 7: Run the fixtures to verify they pass**

Run: `npm run test:takeaways; echo $?`

Expected: nineteen `ok` lines, exit 0. `term without takeaways caught by verify` takes about five seconds longer than the others while the render check times out; that is expected.

- [ ] **Step 8: Update the page's description of an entry**

In `index.html`, find:

```html
Every entry has a TL;DR, an explainer, and a custom inline-SVG diagram.">
```

and replace it with:

```html
Every entry has a TL;DR, a custom inline-SVG diagram, and flash-card takeaways.">
```

Then find:

```html
Every term gets a one-line TL;DR, an explainer, and a custom diagram that does the explaining.
```

and replace it with:

```html
Every term gets a one-line TL;DR, a custom diagram that does the explaining, and flash-card takeaways to remember it by.
```

- [ ] **Step 9: Update the README**

In `README.md`, find:

```
Each entry pairs a one-line TL;DR, an explainer, and a custom inline-SVG diagram you can step through, part by part — so concepts
```

and replace it with:

```
Each entry pairs a one-line TL;DR, a custom inline-SVG diagram you can step through part by part, and flash-card takeaways with the full explainer one click away — so concepts
```

Then find:

```
click any entry to expand its explainer and diagram.
```

and replace it with:

```
click any entry to open its diagram, takeaways and full explainer.
```

- [ ] **Step 10: Re-read the skill and CLAUDE.md**

Read `.claude/skills/add-glossary-term/SKILL.md` and `CLAUDE.md`. Both already describe `takeaways` as part of every entry (Task 3). Confirm nothing in either still describes the explainer as shown open on the page, and that any rule James changed at a review is reflected. Edit only if something is stale.

- [ ] **Step 11: Run the gates**

Run each and check the exit code: `npm test; echo $?`, `npm run test:tour; echo $?`, `npm run test:takeaways; echo $?`, `npm run verify; echo $?`

Expected: each exits 0, with `verify` reporting 104 terms (or the current count).

- [ ] **Step 12: Commit**

```bash
git add index.html validate.mjs verify.mjs test/takeaways-fixtures.mjs README.md
git commit -m "$(cat <<'EOF'
feat: make takeaways mandatory for every term

Removes the open-explainer fallback and updates the page and README
descriptions of an entry.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

If Step 10 changed the skill or `CLAUDE.md`, add them to this commit.

- [ ] **Step 13: Refresh the committed screenshots**

The hero lede sits on the browse view, so the committed screenshots change.

```bash
node screenshot.mjs ./index.html
git add screenshots
git commit -m "$(cat <<'EOF'
chore: refresh screenshots after the takeaways lock-in

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 14: Stop for James's review.** Push only if asked.

---

## Appendix A: review-capture script

Scratchpad only; never committed. It writes contact sheets of the "Takeaways" heading and tiles for the ids given, up to six terms per sheet, for light and dark at 1440px and 375px. Run it from the repo root so it can find `sharp` and `_launch.mjs`.

Save as `<scratchpad>/takeaways-sheet.mjs`:

```js
// takeaways-sheet.mjs — review captures of takeaway tiles. Not committed.
// Run from the repo root:
//   node <scratchpad>/takeaways-sheet.mjs <out-dir> <id> [id ...]
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { pathToFileURL } from 'url';

const ROOT = process.cwd();
const require = createRequire(path.join(ROOT, 'package.json'));
const sharp = require('sharp');
const { launchBrowser } = await import(pathToFileURL(path.join(ROOT, '_launch.mjs')).href);

const [outDir, ...ids] = process.argv.slice(2);
if (!outDir || !ids.length) {
  console.error('usage: takeaways-sheet.mjs <out-dir> <id> [id ...]');
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });
const url = pathToFileURL(path.join(ROOT, 'index.html')).href;
const PER_SHEET = 6;

const { browser } = await launchBrowser();
try {
  for (const theme of ['light', 'dark']) for (const width of [1440, 375]) {
    // A tall viewport keeps a whole set of tiles on screen for one clip.
    const ctx = await browser.newContext({ viewport: { width, height: 2400 }, reducedMotion: 'reduce' });
    await ctx.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch {} }, theme);
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);

    const shots = [];
    for (const id of ids) {
      await page.evaluate((i) => { location.hash = '#' + i; }, id);
      await page.waitForFunction((i) => document.querySelector('.toc-link.is-active')?.dataset.toc === i, id);
      // Name the term in the heading so a sheet can be read without a key.
      const clip = await page.evaluate(() => {
        const list = document.querySelector('#detail-content .takeaways');
        if (!list) return null;
        const head = list.previousElementSibling;
        head.textContent = 'Takeaways — ' + document.querySelector('#detail-content .detail-title').textContent;
        head.scrollIntoView({ block: 'start' });
        const a = head.getBoundingClientRect(), b = list.getBoundingClientRect();
        return { x: Math.max(0, Math.floor(b.left) - 8), y: Math.floor(a.top), width: Math.ceil(b.width) + 16, height: Math.ceil(b.bottom - a.top) + 16 };
      });
      if (!clip) { console.log(`${id}: no takeaways rendered`); continue; }
      clip.width = Math.min(clip.width, width - clip.x);
      shots.push(await page.screenshot({ clip }));
    }

    for (let n = 0; n * PER_SHEET < shots.length; n++) {
      const group = shots.slice(n * PER_SHEET, (n + 1) * PER_SHEET);
      const metas = await Promise.all(group.map((b) => sharp(b).metadata()));
      let top = 0;
      const layers = group.map((input, i) => { const layer = { input, top, left: 0 }; top += metas[i].height; return layer; });
      const background = theme === 'dark' ? { r: 10, g: 10, b: 10, alpha: 1 } : { r: 250, g: 250, b: 250, alpha: 1 };
      const file = path.join(outDir, `sheet-${theme}-${width}-${n + 1}.png`);
      await sharp({ create: { width: Math.max(...metas.map((m) => m.width)), height: top, channels: 4, background } })
        .composite(layers).png().toFile(file);
      console.log(`wrote ${file} (${group.length} terms)`);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
```
