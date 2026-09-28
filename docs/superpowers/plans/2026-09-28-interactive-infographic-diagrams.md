# Interactive Infographic Diagrams Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn every glossary diagram into a step-through infographic card: numbered step chips, a redrawn diagram whose parts light per step, a "what's happening" panel, and a key-fact callout.

**Architecture:** Tour copy (`steps`, `fact`) lives on each `TERMS` entry. Diagram elements carry `data-s` step tags. One renderer (`tourHtml` + `setStep`) builds the card for any term with `steps` and falls back to today's plain figure otherwise, so migration ships in batches. `validate.mjs` checks the data shape, `verify.mjs` checks the rendered tour, and a fixture test proves both checkers catch what they claim to.

**Tech Stack:** Single-file `index.html` (vanilla JS, inline SVG, CSS custom properties); Node ESM tooling; Playwright (via `_launch.mjs`) for rendered checks.

**Spec:** `docs/superpowers/specs/2026-09-28-interactive-infographic-diagrams-design.md`

## Global Constraints

- One self-contained `index.html`. No build step, no runtime dependency, no external script. Lucide icons are inlined as paths.
- Exactly one `--accent` declaration. No hex in component CSS except `#fff`/`#000`. Colours come only from existing tokens plus `--accent-text`.
- Spacing (margin/padding/gap) only on the 4/8/12/16/24/32/48/64/96 scale, via `var(--space-N)`.
- No emoji anywhere. UK spelling in all copy ("organisation", "centralised", "authorisation").
- Tour copy (`steps[].title`, `steps[].text`, `fact`) states only what the entry's `explainer` already says. No new factual claims.
- 3–5 steps per term. Titles are two to four words. Step text is one or two sentences. `fact` is one sentence.
- Diagram `viewBox` is 720 wide; height as needed (typically 240–320).
- Existing grammar classes stay: `box`, `box-soft`, `box-accent`, `zone`, `zone-accent`, `data`, `flow`, `flow-accent`, `flow-ok`, `flow-bad`, `ah-mut`/`ah-acc`/`ah-ok`/`ah-bad`, `t-b`, `t-sm`, `t-mut`, `t-acc`, `ok`, `bad`, `stroke-ok`, `stroke-bad`, `divider`, `fill-accent`.
- `data-s` elements are never nested inside other `data-s` elements.
- Commits go direct to `main` with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Push only when James asks.
- Gates before every commit: `npm test` exits 0, `npm run test:tour` exits 0, and `npm run verify` exits 0. Check exit codes directly (`echo $?`); never pipe a gate through `tail` and trust the output.

## File map

| File | Change |
|---|---|
| `index.html` | CSS for the card and step states; `ICONS`, `icon()`, `badge()`; `tourHtml()`, `setStep()`; click and keydown wiring; per-term `steps`/`fact` and redrawn `DIAGRAMS` functions |
| `validate.mjs` | `tour-data` structure check (phase 3: mandatory) |
| `verify.mjs` | Geometry probe learns icons and badges; new tour probe and stepping checks; reduced-motion check (phase 3: tour mandatory) |
| `glossary.mjs` | Emits steps and key fact per term |
| `test/tour-fixtures.mjs` | New. Builds good and broken fixtures and asserts the checkers' verdicts |
| `package.json` | `test:tour` script |
| `.claude/skills/add-glossary-term/SKILL.md` | Step 2 rewritten for the tour grammar |
| `CLAUDE.md`, `README.md` | Descriptions of verify and the diagrams (phase 3 for the README) |

---

## Phase 0: infrastructure

### Task 1: Fixture harness and `validate.mjs` tour-data check

**Files:**
- Create: `test/tour-fixtures.mjs`
- Modify: `package.json` (scripts)
- Modify: `validate.mjs` (inside the `if (html.includes('const TERMS = ['))` block, near line 84)

**Interfaces:**
- Produces: `npm run test:tour`; a `tour-data` rule in `validate.mjs`; fixture cases that Task 3 and Task 4 extend.
- The fixtures call `icon()` and `badge()` inside a diagram function. Those helpers arrive in Task 3, so the verify-side cases stay commented out until then (see step 1).

- [ ] **Step 1: Write the fixture harness**

Create `test/tour-fixtures.mjs`:

```js
#!/usr/bin/env node
// test/tour-fixtures.mjs — proves validate.mjs and verify.mjs catch broken
// diagram tours. Builds throwaway copies of index.html in a temp dir with a
// synthetic tour on the WireGuard entry (its diagram is replaced wholesale, so
// the fixture does not depend on the real drawing), then runs each checker and
// asserts the exit code and the rule it reports.
//
// Usage: npm run test:tour

import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const GOOD_STEPS = `steps: [
        { title: "Peer A", text: "Peer A is identified by its public key." },
        { title: "Peer B", text: "Peer B is identified by its public key." },
        { title: "The tunnel", text: "The two peers exchange encrypted packets." }
      ],
      fact: "Each peer is known only by its public key."`;

// Appends tour fields at the end of the wireguard entry. Later keys win in an
// object literal, so this overrides any real tour the entry has by then.
function withTour(html, tour) {
  const at = html.indexOf('id: "wireguard"');
  const close = html.indexOf('\n    }', at);
  return html.slice(0, close) + `,\n      ${tour}` + html.slice(close);
}

function withDiagram(html, svg) {
  return html.replace(/ {4}wireguard: \(\) => `[\s\S]*?<\/svg>`/, `    wireguard: () => \`${svg}\``);
}

const svg = ({ b = '2', badgeAt = '360, 100', nestBadge = false } = {}) => {
  const bdg = `\${badge(3, ${badgeAt}, 3)}`;
  return `
      <svg class="dg" viewBox="0 0 720 200" role="img" xmlns="http://www.w3.org/2000/svg" aria-label="fixture">
        <g data-s="1"><rect class="box" x="40" y="60" width="200" height="80" rx="10"/>\${icon('user', 56, 76)}<text class="t-b" x="92" y="94">Peer A</text>${nestBadge ? bdg : ''}</g>
        <g data-s="${b}"><rect class="box" x="480" y="60" width="200" height="80" rx="10"/><text class="t-b" x="500" y="94">Peer B</text></g>
        <line class="flow" data-s="3" x1="240" y1="100" x2="478" y2="100" marker-end="url(#ah-mut)"/>
        ${nestBadge ? '' : bdg}
      </svg>`;
};

const CASES = [
  // [name, html, checker, expected exit, rule expected in the report]
  ['good tour validates', withDiagram(withTour(base, GOOD_STEPS), svg()), 'validate', 0, null],
  ['two steps rejected', withTour(base, `steps: [{ title: "A", text: "a" }, { title: "B", text: "b" }], fact: "f"`), 'validate', 1, 'tour-data'],
  ['empty step text rejected', withTour(base, `steps: [{ title: "A", text: "a" }, { title: "B", text: " " }, { title: "C", text: "c" }], fact: "f"`), 'validate', 1, 'tour-data'],
  ['missing fact rejected', withTour(base, `steps: [{ title: "A", text: "a" }, { title: "B", text: "b" }, { title: "C", text: "c" }]`), 'validate', 1, 'tour-data'],
  // Task 3 uncomments this one once icon()/badge() and the card exist.
  // ['good tour verifies', withDiagram(withTour(base, GOOD_STEPS), svg()), 'verify', 0, null],
  // Task 4 uncomments these four together with the checks that catch them.
  // ['step that lights nothing', withDiagram(withTour(base, GOOD_STEPS), svg({ b: '1' })), 'verify', 1, 'tour'],
  // ['step number out of range', withDiagram(withTour(base, GOOD_STEPS), svg({ b: '2 4' })), 'verify', 1, 'tour'],
  // ['nested data-s', withDiagram(withTour(base, GOOD_STEPS), svg({ nestBadge: true })), 'verify', 1, 'tour'],
  // ['badge over a label', withDiagram(withTour(base, GOOD_STEPS), svg({ badgeAt: '120, 90' })), 'verify', 1, 'badge'],
];

// --emit <path>: write the good fixture page to disk for eyeballing, then stop.
const emitAt = process.argv.indexOf('--emit');
if (emitAt !== -1) {
  fs.writeFileSync(process.argv[emitAt + 1], withDiagram(withTour(base, GOOD_STEPS), svg()));
  console.log(`wrote the good fixture to ${process.argv[emitAt + 1]}`);
  process.exit(0);
}

let failed = 0;
for (const [name, html, checker, wantCode, wantRule] of CASES) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tour-'));
  const file = path.join(dir, 'index.html');
  fs.writeFileSync(file, html);
  const args = checker === 'validate'
    ? [path.join(root, 'validate.mjs'), file, '--json']
    : [path.join(root, 'verify.mjs'), 'wireguard', `--target=${file}`, '--json'];
  const r = spawnSync('node', args, { encoding: 'utf8' });
  fs.rmSync(dir, { recursive: true, force: true });

  let rules = [];
  try { rules = (JSON.parse(r.stdout).errors || []).map((e) => e.rule); } catch { /* non-JSON output */ }
  const codeOk = r.status === wantCode;
  const ruleOk = wantRule === null || rules.includes(wantRule);
  if (codeOk && ruleOk) console.log(`  ok    ${name}`);
  else {
    failed++;
    console.log(`  FAIL  ${name}: exit ${r.status} (want ${wantCode}), rules [${rules.join(', ')}]${wantRule ? ` (want ${wantRule})` : ''}`);
    if (!r.stdout.trim().startsWith('{')) console.log((r.stdout + r.stderr).split('\n').slice(0, 8).map((l) => '        ' + l).join('\n'));
  }
}
console.log(failed ? `\n${failed} fixture case(s) failed` : '\nall fixture cases pass');
process.exit(failed ? 1 : 0);
```

Add to `package.json` `scripts`:

```json
    "test:tour": "node test/tour-fixtures.mjs",
```

`validate.mjs --json` already exists (`validate.mjs:11`) and reports `{ errors: [{ rule, msg }] }`, the same shape as `verify.mjs --json`, so the harness reads both the same way.

- [ ] **Step 2: Run the harness and confirm the three reject cases fail**

Run: `npm run test:tour; echo "exit $?"`
Expected: `good tour validates` ok. `two steps rejected`, `empty step text rejected` and `missing fact rejected` FAIL with exit 0 (want 1). Exit 1.

- [ ] **Step 3: Add the `tour-data` check to `validate.mjs`**

Inside the `if (html.includes('const TERMS = [')) {` block, after the `diagramIds` try/catch, add:

```js
  // Diagram tours: a term that has steps or a fact must have both, with 3–5
  // steps that each carry a title and text. Phase 3 of the infographic
  // rollout makes this mandatory for every term.
  let terms = [];
  try { terms = extractArray(html, 'TERMS'); } catch { /* reported above */ }
  for (const t of terms) {
    if (t.steps === undefined && t.fact === undefined) continue;
    const where = t.id || '(no id)';
    if (!Array.isArray(t.steps) || t.steps.length < 3 || t.steps.length > 5) {
      err('tour-data', `${where}: steps must be an array of 3–5 entries`);
    } else {
      t.steps.forEach((s, i) => {
        if (!s || !String(s.title || '').trim() || !String(s.text || '').trim()) {
          err('tour-data', `${where}: step ${i + 1} needs a non-empty title and text`);
        }
      });
    }
    if (!String(t.fact || '').trim()) err('tour-data', `${where}: a term with steps needs a non-empty fact`);
  }
```

- [ ] **Step 4: Run the harness and the linter**

Run: `npm run test:tour; echo "exit $?"` and then `npm test; echo "exit $?"`
Expected: all four cases ok, exit 0. `npm test` clean, exit 0.

- [ ] **Step 5: Commit**

```bash
git add test/tour-fixtures.mjs package.json validate.mjs
git commit -m "feat: validate diagram tour data and add a fixture harness

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 2: `glossary.mjs` emits steps and key facts

**Files:**
- Modify: `glossary.mjs` (header lines and the per-entry loop)

**Interfaces:**
- Consumes: `t.steps` (array of `{title, text}`) and `t.fact` (string) from Task 1's data shape.

- [ ] **Step 1: Record the current output**

Run: `npm run glossary && cp glossary.txt "$TMPDIR/glossary.before.txt"`. If `TMPDIR` is unset, use the session scratchpad.

- [ ] **Step 2: Implement**

In the `lines` header array, after `'         [type tags] · aliases',` add:

```js
  '         1. step — text        (terms with a diagram tour)',
  '         Key fact: …',
```

In the loop, after the `[types]` line and before `lines.push('')`:

```js
  if (t.steps) {
    t.steps.forEach((s, i) => lines.push(`    ${i + 1}. ${s.title} — ${s.text}`));
    lines.push(`    Key fact: ${t.fact}`);
  }
```

- [ ] **Step 3: Verify**

Run: `npm run glossary && diff "$TMPDIR/glossary.before.txt" glossary.txt`
Expected: "wrote 100 terms", and the diff shows only the two new header lines, since no term has steps yet.

- [ ] **Step 4: Commit**

```bash
git add glossary.mjs glossary.txt
git commit -m "feat: include diagram tour steps in glossary.txt

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 3: Tour card renderer, grammar helpers and styles in `index.html`

**Files:**
- Modify: `index.html`, in five places:
  - CSS, immediately after `.m-bad { fill: var(--state-bad); }` (~line 473)
  - `ICONS`/`icon`/`badge`, immediately before `const DIAGRAMS = {`
  - `diagramHtml()` (~line 4242), plus new `tourHtml()` and `setStep()` beside it
  - `showDetail()` (~line 4341)
  - the `els.detailContent` click listener (~line 4388), plus a new keydown listener after it
- Modify: `test/tour-fixtures.mjs` (uncomment the `good tour verifies` case only)

**Interfaces:**
- Produces:
  - `icon(name: string, x: number, y: number) => string`: a 24×24 Lucide icon at (x, y) in `<g class="ico">`.
  - `badge(n: number, x: number, y: number, steps: string) => string`: a numbered circle of radius 10 centred at (x, y), in `<g class="badge" data-s="steps">`.
  - `ICONS`: map of name to Lucide inner SVG markup.
  - `tourHtml(e, svg) => string`: the card markup.
  - `setStep(fig: HTMLElement, k: number)`: lights step k.
- DOM contract used by `verify.mjs` (Task 4):
  - `#detail-content .tour`, with `data-tour="<id>"`
  - `.tour-chip[data-step="k"][aria-pressed]`
  - `.tour-num`, `.tour-title`, `.tour-text`, `.tour-fact`
  - lit elements carry `.on`, unlit tagged elements carry `.dim`

- [ ] **Step 1: Uncomment the positive verify case and watch it fail**

In `test/tour-fixtures.mjs`, uncomment `good tour verifies` only. The four negative cases stay commented until Task 4.
Run: `npm run test:tour; echo "exit $?"`
Expected: `good tour verifies` FAILs, because the page throws `icon is not defined` and verify reports `console` or `render`. Exit 1.

- [ ] **Step 2: Add the CSS**

Immediately after `.m-bad { fill: var(--state-bad); }`:

```css
    /* ==================================================================
       Step-through tour card: wraps a diagram when its term has steps
       ================================================================== */
    .tour-chips {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: var(--space-2); margin-bottom: var(--space-5);
    }
    .tour-chip {
      display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-1);
      padding: var(--space-2) var(--space-3);
      background: var(--surface); color: var(--text-muted);
      border: 1px solid var(--border); border-radius: var(--radius);
      font: inherit; font-size: var(--fs-small); text-align: left; cursor: pointer;
      transition: color var(--transition), border-color var(--transition), background-color var(--transition);
    }
    .tour-chip b { font-size: 20px; line-height: 1; }
    .tour-chip:hover { border-color: var(--accent); color: var(--text); }
    .tour-chip[aria-pressed="true"] { background: var(--accent-soft); border-color: var(--accent); color: var(--text); }
    .tour-chip[aria-pressed="true"] b { color: var(--accent-text); }
    .tour-chip:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    .tour-panel {
      display: flex; gap: var(--space-4); align-items: flex-start;
      margin-top: var(--space-5); padding-left: var(--space-4); border-left: 3px solid var(--accent);
    }
    .tour-num { font-size: 40px; font-weight: 800; line-height: 1; color: var(--accent-text); font-variant-numeric: tabular-nums; }
    .tour-title { font-weight: 700; margin: 0 0 var(--space-1); }
    .tour-text { margin: 0; line-height: 1.5; }
    .tour-fact {
      margin: var(--space-4) 0 0; padding: var(--space-3) var(--space-4);
      background: var(--accent-soft); border-radius: var(--radius);
      font-size: var(--fs-small); line-height: 1.5;
    }
    .tour-fact b { color: var(--accent-text); margin-right: var(--space-1); }
    .tour-print { display: none; }
    /* step states on the diagram itself */
    .dg [data-s] { transition: opacity var(--transition); }
    .dg .dim { opacity: .22; }
    .dg .on > :is(.box, .box-soft), .dg :is(.box, .box-soft).on { fill: var(--accent-soft); stroke: var(--accent); }
    .dg .flow.on { stroke: var(--accent); }
    .dg .flow.on[marker-end] { marker-end: url(#ah-acc); }
    .dg .flow.on[marker-start] { marker-start: url(#ah-acc); }
    .dg .on:is(.flow, .flow-accent, .flow-ok, .flow-bad) { stroke-width: 2.5; stroke-dasharray: 7 5; animation: tour-dash 900ms linear infinite; }
    @keyframes tour-dash { to { stroke-dashoffset: -24; } }
    .dg .ico { fill: none; stroke: var(--text); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .dg .on .ico { stroke: var(--accent-text); }
    .dg .badge circle { fill: var(--surface); stroke: var(--border-strong); stroke-width: 1.5; }
    .dg .badge text { fill: var(--text-muted); font-size: 11px; font-weight: 700; }
    .dg .badge.on circle { fill: var(--accent); stroke: var(--accent); }
    .dg .badge.on text { fill: #fff; }
    @media print {
      .tour-chips, .tour-panel { display: none; }
      .tour-print { display: block; margin: var(--space-4) 0 0; }
      .dg .dim { opacity: 1; }
      .dg .on { animation: none; }
    }
```

The existing global `prefers-reduced-motion` rule (`animation: none !important; transition: none !important`) already stops the dash and the fade. No extra rule is needed.

- [ ] **Step 3: Add `ICONS`, `icon()` and `badge()` before `const DIAGRAMS = {`**

```js
  /* ====================================================================
     Diagram helpers. ICONS holds only the Lucide paths the diagrams use
     (Lucide, ISC licence: https://lucide.dev). Paste an icon's inner markup
     from https://unpkg.com/lucide-static@latest/icons/<name>.svg when a new
     one is needed. icon() places it on a 24×24 grid; badge() draws the
     numbered step marker that matches a tour chip.
     ==================================================================== */
  const ICONS = {
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    server: '<rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/>',
    "key-round": '<path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/>'
  };
  const icon = (name, x, y) => `<g class="ico" transform="translate(${x} ${y})">${ICONS[name]}</g>`;
  const badge = (n, x, y, steps) =>
    `<g class="badge" data-s="${steps}"><circle cx="${x}" cy="${y}" r="10"/><text x="${x}" y="${y + 4}" text-anchor="middle">${n}</text></g>`;
```

Before committing, check these three strings against the lucide-static files:

```bash
for n in user server key-round; do curl -s "https://unpkg.com/lucide-static@latest/icons/$n.svg" | sed -n '/<svg/,/<\/svg>/p' | grep -v '<svg\|</svg>'; done
```

Replace any string that differs with the fetched inner markup.

- [ ] **Step 4: Add `tourHtml()` and `setStep()`, and branch `diagramHtml()`**

Replace `diagramHtml` with:

```js
  function diagramHtml(e) {
    const fn = DIAGRAMS[e.id];
    const svg = fn ? fn() : fallbackDiagram(e);
    if (e.steps) return tourHtml(e, svg);
    return `<figure class="diagram-frame" aria-labelledby="dgcap-${e.id}">${svg}<figcaption id="dgcap-${e.id}">${esc(e.caption || (e.term + " — schematic"))}</figcaption></figure>`;
  }
  // Step-through card. setStep() fills the panel, so it starts empty here.
  function tourHtml(e, svg) {
    const chips = e.steps.map((s, i) =>
      `<button class="tour-chip" type="button" data-step="${i + 1}" aria-pressed="false" tabindex="-1"><b>${i + 1}</b><span>${esc(s.title)}</span></button>`).join("");
    const all = e.steps.map(s => `<li><b>${esc(s.title)}</b> — ${esc(s.text)}</li>`).join("");
    return `<figure class="diagram-frame tour" aria-labelledby="dgcap-${e.id}" data-tour="${e.id}">
      <div class="tour-chips" role="group" aria-label="Diagram steps">${chips}</div>
      ${svg}
      <div class="tour-panel" aria-live="polite"><span class="tour-num"></span><div><p class="tour-title"></p><p class="tour-text"></p></div></div>
      <ol class="tour-print">${all}</ol>
      <p class="tour-fact"><b>Key fact</b>${esc(e.fact)}</p>
      <figcaption id="dgcap-${e.id}">${esc(e.caption || (e.term + " — schematic"))}</figcaption></figure>`;
  }
  function setStep(fig, k) {
    const e = byId[fig.dataset.tour];
    fig.querySelectorAll("[data-s]").forEach(el => {
      const on = el.dataset.s.trim().split(/\s+/).includes(String(k));
      el.classList.toggle("on", on);
      el.classList.toggle("dim", !on);
    });
    fig.querySelectorAll(".tour-chip").forEach(c => {
      const cur = Number(c.dataset.step) === k;
      c.setAttribute("aria-pressed", String(cur));
      c.tabIndex = cur ? 0 : -1;
    });
    fig.querySelector(".tour-num").textContent = k;
    fig.querySelector(".tour-title").textContent = e.steps[k - 1].title;
    fig.querySelector(".tour-text").textContent = e.steps[k - 1].text;
  }
```

- [ ] **Step 5: Select step 1 on open, and wire the click and keyboard handlers**

In `showDetail(e)`, directly after `els.detailContent.innerHTML = detailHtml(e);`:

```js
    const tour = els.detailContent.querySelector(".tour");
    if (tour) setStep(tour, 1);
```

At the top of the `els.detailContent.addEventListener("click", (ev) => {` body:

```js
    const step = ev.target.closest(".tour-chip");
    if (step) { setStep(step.closest(".tour"), Number(step.dataset.step)); return; }
```

After that listener, add:

```js
  // Tour chips: Left/Right move between steps (Enter/Space are native to buttons)
  els.detailContent.addEventListener("keydown", (ev) => {
    const chip = ev.target.closest(".tour-chip");
    if (!chip || (ev.key !== "ArrowRight" && ev.key !== "ArrowLeft")) return;
    const fig = chip.closest(".tour");
    const n = fig.querySelectorAll(".tour-chip").length;
    const k = ((Number(chip.dataset.step) - 1 + (ev.key === "ArrowRight" ? 1 : -1) + n) % n) + 1;
    setStep(fig, k);
    fig.querySelector(`.tour-chip[data-step="${k}"]`).focus();
    ev.preventDefault();
  });
```

- [ ] **Step 6: Run all three gates**

Run: `npm run test:tour; echo "exit $?"`, `npm test; echo "exit $?"`, `npm run verify; echo "exit $?"`
Expected: all exit 0. The five fixture cases pass. No real term has `steps`, so every term takes the unchanged figure path.

- [ ] **Step 7: Check the fixture card by eye**

Write the good fixture into a directory of its own inside the session scratchpad (`$SP` below), then capture it:

```bash
mkdir -p "$SP/fx" && node test/tour-fixtures.mjs --emit "$SP/fx/index.html"
cat > "$SP/fx-shot.mjs" <<EOF
const { launchBrowser } = await import('$PWD/_launch.mjs');
const { browser } = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
for (const theme of ['light', 'dark']) for (const k of [1, 3]) {
  await page.goto('file://$SP/fx/index.html#wireguard');
  await page.waitForSelector('#detail-content .tour');
  await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
  await page.click('#detail-content .tour-chip[data-step="' + k + '"]');
  await page.waitForTimeout(400);
  await page.locator('#detail-content .tour').screenshot({ path: '$SP/fx-' + theme + '-' + k + '.png' });
}
await browser.close();
EOF
node "$SP/fx-shot.mjs"
```

Read the four PNGs.
Expected:
- chips 1–3, with 1 pressed at step 1
- at step 1, Peer A is lit and Peer B and the line are dimmed, and the panel shows "1 / Peer A / Peer A is identified…"
- the key fact renders
- at step 3, the line is accent-coloured with a moving dash, and badge 3 is filled blue with a white numeral
- both themes are legible

- [ ] **Step 8: Commit**

```bash
git add index.html test/tour-fixtures.mjs
git commit -m "feat: render step-through tour cards for terms with diagram steps

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 4: `verify.mjs` tour checks and badge/icon-aware geometry

**Files:**
- Modify: `verify.mjs`, in three places:
  - the `PROBE` string (~lines 153–245)
  - a new `TOUR_PROBE` constant after `PROBE`
  - the per-term loop (~line 256 onward)
- Modify: the `verify.mjs` header comment (checks list)

**Interfaces:**
- Consumes: the DOM contract from Task 3.
- Produces: new error rules `tour` and `badge`. The fixture harness asserts on both names.

- [ ] **Step 1: Uncomment the four negative verify cases and watch them fail**

In `test/tour-fixtures.mjs`, uncomment `step that lights nothing`, `step number out of range`, `nested data-s` and `badge over a label`.
Run: `npm run test:tour; echo "exit $?"`
Expected: `good tour verifies` ok. The four new cases FAIL with exit 0 (want 1), because verify does not check them yet.

- [ ] **Step 2: Teach `PROBE` about icons and badges**

In `PROBE`, replace the `texts` definition with:

```js
  // Badge numerals are part of the badge, not labels: a flow is meant to run
  // under its badge. Icons count as labels, so a stroke must not cross one.
  const texts = [...svg.querySelectorAll('text')]
    .filter((t) => t.textContent.trim() && !t.closest('.badge'))
    .map((t) => Object.assign(box(t), { s: t.textContent.trim().slice(0, 44) }));
  const icons = [...svg.querySelectorAll('.ico')].map((g) => Object.assign(box(g), { s: 'icon' }));
  const badges = [...svg.querySelectorAll('.badge')].map((g) => Object.assign(box(g), { s: 'badge ' + g.textContent.trim() }));
```

In the clearance loop, change `for (const t of texts) for (const q of rects) {` to:

```js
  for (const t of [...texts, ...icons, ...badges]) for (const q of rects) {
```

In the collision loop, skip strokes that belong to icons or badges, and test against icons as well as texts. Change the head of the loop body and the inner `for (const t of texts)`:

```js
  for (const el of svg.querySelectorAll('line, path')) {
    if (el.closest('.ico, .badge')) continue;
```

and

```js
      for (const t of [...texts, ...icons]) {
```

Before the `return`, add the badge-over-label check:

```js
  // A badge sitting on a label hides it: overlap beyond the 2-unit cushion.
  const badgeHits = [];
  for (const b of badges) for (const t of [...texts, ...icons]) {
    const ox = Math.min(b.r, t.r) - Math.max(b.x, t.x);
    const oy = Math.min(b.bot, t.bot) - Math.max(b.y, t.y);
    if (ox > 2 * scale && oy > 2 * scale) badgeHits.push({ badge: b.s, text: t.s });
  }
```

and extend the return to `return { rendered: true, labels: texts.length, clearance, collisions, overflow, badgeHits };`.

- [ ] **Step 3: Add `TOUR_PROBE`**

After `PROBE`:

```js
// Reads the tour card's structure. Stepping is driven from Node (real clicks),
// so this only reports what is in the DOM right now.
const TOUR_PROBE = `(() => {
  const fig = document.querySelector('#detail-content .tour');
  if (!fig) return { card: false };
  const tags = [...fig.querySelectorAll('svg.dg [data-s]')];
  return {
    card: true,
    chips: fig.querySelectorAll('.tour-chip').length,
    nums: tags.flatMap((el) => el.dataset.s.trim().split(/\\s+/).map(Number)),
    nested: tags.filter((el) => el.parentElement.closest('[data-s]')).length,
    lit: tags.map((el, i) => el.classList.contains('on') ? i : -1).filter((i) => i >= 0).join(','),
    pressed: [...fig.querySelectorAll('.tour-chip[aria-pressed="true"]')].map((c) => c.dataset.step).join(','),
    text: fig.querySelector('.tour-text').textContent,
    focused: document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.step || '' : '',
  };
})()`;
```

- [ ] **Step 4: Report the new geometry findings and run the tour checks in the per-term loop**

After the existing `for (const o of found.overflow)` line, add:

```js
  for (const b of found.badgeHits)  err('badge', `${t.id}: ${b.badge} covers "${b.text}"`);

  if (t.steps) {
    const n = t.steps.length;
    const tour = await page.evaluate(TOUR_PROBE);
    if (!tour.card) { err('tour', `${t.id}: has steps but no tour card rendered`); }
    else {
      if (tour.chips !== n) err('tour', `${t.id}: ${tour.chips} chips for ${n} steps`);
      for (let k = 1; k <= n; k++) if (!tour.nums.includes(k)) err('tour', `${t.id}: step ${k} lights nothing`);
      for (const x of new Set(tour.nums)) if (!(Number.isInteger(x) && x >= 1 && x <= n)) err('tour', `${t.id}: data-s names step ${x}, but there are ${n}`);
      if (tour.nested) err('tour', `${t.id}: ${tour.nested} data-s element(s) nested inside another`);

      // Drive every step with a real click; each must press its chip, show its
      // own text, and light a different set from the step before.
      let prevLit = null;
      for (let k = 1; k <= n; k++) {
        await page.click(`#detail-content .tour-chip[data-step="${k}"]`);
        const s = await page.evaluate(TOUR_PROBE);
        if (s.pressed !== String(k)) err('tour', `${t.id}: after clicking step ${k}, pressed chip is "${s.pressed}"`);
        if (s.text !== t.steps[k - 1].text) err('tour', `${t.id}: step ${k} panel text does not match steps[${k - 1}].text`);
        if (prevLit !== null && s.lit === prevLit) err('tour', `${t.id}: step ${k} lights the same elements as step ${k - 1}`);
        prevLit = s.lit;
      }

      // Keyboard: from step 1, ArrowRight focuses and selects step 2.
      await page.click('#detail-content .tour-chip[data-step="1"]');
      await page.keyboard.press('ArrowRight');
      const kb = await page.evaluate(TOUR_PROBE);
      if (kb.focused !== '2' || kb.pressed !== '2') err('tour', `${t.id}: ArrowRight from step 1 gave focus "${kb.focused}", pressed "${kb.pressed}"`);

      // Reduced motion: nothing may still be animating.
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const running = await page.evaluate(`document.getAnimations().length`);
      if (running) err('tour', `${t.id}: ${running} animation(s) running under reduced motion`);
      await page.emulateMedia({ reducedMotion: 'no-preference' });
    }
  }
```

The existing `for (const c of consoleErrors)` line must stay after this block, so errors raised while stepping are reported. Move it below the block if it currently sits above it.

- [ ] **Step 5: Update the header comment**

Add to the checks list at the top of `verify.mjs`:

```js
//   (c) diagram tours — for a term with steps: chip count, every step lights
//       something, no out-of-range or nested data-s, each click shows its own
//       text and lit set, ArrowRight moves focus, no animation under reduced
//       motion; badges must not cover a label
```

- [ ] **Step 6: Run the harness, full verify and linter**

Run: `npm run test:tour; echo "exit $?"`, then `npm run verify; echo "exit $?"`, then `npm test; echo "exit $?"`
Expected: all nine fixture cases ok, and the other two gates clean. Each exits 0.

- [ ] **Step 7: Commit**

```bash
git add verify.mjs test/tour-fixtures.mjs
git commit -m "feat: verify diagram tours and badge and icon geometry

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 5: Skill and CLAUDE.md describe the tour grammar

**Files:**
- Modify: `.claude/skills/add-glossary-term/SKILL.md` (step 1 example and step 2)
- Modify: `CLAUDE.md` (Verification section)

- [ ] **Step 1: Update the skill**

In step 1's example object, add after `caption`:

```js
  steps: [
    { title: "Two to four words", text: "One or two sentences, only what the explainer says." },
    …  // 3–5 steps
  ],
  fact: "One sentence from the explainer worth remembering."
```

Replace step 2's opening paragraph and grammar list with:

```markdown
## 2. Append the diagram and its tour

Add a matching `DIAGRAMS.<id>` function returning inline SVG, `viewBox` 720 wide and
~240–320 tall. Every diagram is a step-through tour: the term's `steps` drive numbered
chips, and each diagram element that belongs to a step carries `data-s="1 3"`.

- shapes — `box`, `box-accent`, `zone-accent`
- flows — `flow`, `flow-accent`, `flow-ok`, `flow-bad`
- arrowheads — `ah-acc`, `ah-ok`, `ah-bad`, `ah-mut`
- text — `t-b`, `t-sm`, `t-mut`, `t-acc` (accent — never a `fill="var(--accent)"`
  attribute, which the `.dg text` rule silently overrides)
- icons — `${icon('server', x, y)}`: a 24px Lucide icon at the top-left of a main box,
  with its label shifted right. Add a missing icon to `ICONS` from lucide-static.
- badges — `${badge(n, x, y, 'n')}`: one numbered circle per step, on the element or
  arrow that step centres on.

Rules: 3–5 steps; every step lights something; tag a component's `<g>`, never both a
group and its children (no nested `data-s`); a flow may run under its badge, but a
badge must not cover a label; the drawing must read correctly fully lit (print).
Tour copy states only what the explainer says.
```

In step 6, add after the check (b) bullet:

```markdown
- **(c) Diagram tour** — chips match `steps`, each step lights something, clicks and
  ArrowRight work, nothing animates under reduced motion, no badge covers a label.
```

- [ ] **Step 2: Update CLAUDE.md**

In the Verification section's `verify.mjs` paragraph, after "no connector runs through a label.", add: "For a term with `steps` it also drives the diagram tour: every chip, the panel text, keyboard stepping and reduced motion." After the code block's `npm run glossary` line, add `npm run test:tour     # proves validate/verify catch broken tours`.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/add-glossary-term/SKILL.md CLAUDE.md
git commit -m "docs: describe the diagram tour grammar in the skill and CLAUDE.md

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Phase 0 checkpoint:** all three gates exit 0, and every term still renders exactly as before. Stop and report to James before Phase 1.

---

## Phase 1: pilot

### Task 6: Redraw the five pilot diagrams

**Files:**
- Modify: `index.html`: the `TERMS` entries and `DIAGRAMS` functions for `kerberos`, `pki`, `rbac`, `dpu`, `dora`; add any `ICONS` entries they use
- Modify: `glossary.txt` (regenerated)

**Interfaces:**
- Consumes: `icon`, `badge`, `ICONS` (Task 3), the tour checks (Task 4), and the grammar rules in the skill (Task 5).

**Step outlines.** Draft copy only from the entry's own explainer and caption. Titles below are fixed; write the `text` from the cited explainer sentence. The brainstorming mock-up's "encrypted timestamp" and "10 hours" are not in the Kerberos explainer, so they must not appear.

| id | steps (titles) | fact (from explainer) | icons |
|---|---|---|---|
| kerberos | Log in once · Receive a TGT · Swap for a service ticket · Present the ticket | The password never crosses the network. | user, key-round, server |
| pki | Trusted root · Intermediate CA · Server certificate · Walk the chain | Get the root of trust wrong and everything built on it is compromised. | shield-check, file-badge, globe |
| rbac | RBAC: user to role · RBAC: role to permissions · ABAC: four attributes · Policy engine decides | Zero Trust leans toward ABAC because trust should depend on live context, not a static role. | user, users, list-checks, scale |
| dpu | Traffic hits the DPU first · Its own cores and OS · Security on the card · Host compromised, policy holds | Even if the host OS is completely compromised, the enforcement on the DPU stays intact. | network, cpu, shield, server |
| dora | Financial entity · Register of information · ESAs supervise · Critical provider designated · Lead Overseer reaches the provider | Oversight buys visibility, not diversification. | building-2, file-text, landmark, cloud |

For each of the five terms, in this order (kerberos, pki, rbac, dpu, dora):

- [ ] **Step 1: Fetch any icons not yet in `ICONS`**

```bash
curl -s "https://unpkg.com/lucide-static@latest/icons/<name>.svg" | sed -n '/<svg/,/<\/svg>/p' | grep -v '<svg\|</svg>'
```

Add each as `"<name>": '<inner markup>'`, joined onto one line.

- [ ] **Step 2: Add `steps` and `fact` to the entry**, after `caption`, using the titles and fact above. Keep UK spelling.

- [ ] **Step 3: Redraw the `DIAGRAMS.<id>` function from scratch** on a 720-wide canvas:
  - Draw the full picture first. It must read correctly fully lit.
  - Give each main component a `<g data-s="…">` containing its rect, `icon()` and labels.
  - Route each step's arrow with room for its `badge()`.
  - Tag each flow with its step(s).
  - Set `aria-label` to the caption text.

- [ ] **Step 4: Run the gates for the term**

Run: `npm test; echo "exit $?"` then `npm run verify <id>; echo "exit $?"`
Expected: both exit 0. Fix every `clearance`, `collision`, `badge` or `tour` finding before moving on.

- [ ] **Step 5: Read the captures**

Screenshot `#detail-content .tour` for `<id>` in light and dark, at step 1 and at the last step, into the scratchpad, and read all four. Check:
  - the lit set tells that step's story
  - the dimmed parts are still legible as context
  - the panel text matches the drawing
  - nothing claims more than the explainer

After all five terms:

- [ ] **Step 6: Full gates and glossary**

Run: `npm test; echo $?`, `npm run test:tour; echo $?`, `npm run verify; echo $?`, `npm run glossary`
Expected: all exit 0, "wrote 100 terms". `glossary.txt` now lists steps for the five pilot terms.

- [ ] **Step 7: Commit**

```bash
git add index.html glossary.txt
git commit -m "feat: redraw the pilot diagrams as step-through infographics

Kerberos, PKI, RBAC & ABAC, DPU and DORA: one each of a flow, a hierarchy,
a comparison, a layered architecture and a supervision map.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
node screenshot.mjs ./index.html
git add screenshots/
git commit -m "chore: refresh screenshots for the pilot diagram redraw

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

If `git status` shows no screenshot change, skip the second commit and say so.

- [ ] **Step 8: Pilot review gate.** Stop. Show James the five terms, in the browser or through the visual companion. Any grammar change he asks for is made in Tasks 3–5's code and the five pilots, and committed, before Phase 2 starts.

---

## Phase 2: batches

Each batch task below follows the same procedure. It is restated in every task so each can be executed alone.

### Task 7: Batch 1, Addressing, Platforms and Kubernetes (15)

Ids: `tcpip dns bgp vlan nat dhcp docker kubernetes react django doca keda ebpf cilium calico`

- [ ] **Step 1:** For each id, write 3–5 `steps` and a `fact` drawn only from its explainer, add any icons it needs to `ICONS` from lucide-static, and redraw its `DIAGRAMS` function in the pilot's grammar.
- [ ] **Step 2:** Per id: `npm run verify <id>; echo $?` exits 0, and the four captures (light/dark × first/last step) are read against the checklist in Task 6 step 5.
- [ ] **Step 3:** `npm test; echo $?`, `npm run test:tour; echo $?`, `npm run verify; echo $?` all exit 0; `npm run glossary` reports 100 terms.
- [ ] **Step 4:** Commit `feat: redraw the addressing, platform and Kubernetes diagrams as step-through infographics` (`index.html`, `glossary.txt`). Then run `node screenshot.mjs ./index.html` and commit `chore: refresh screenshots for the addressing, platform and Kubernetes redraw` (`screenshots/`), skipping it if nothing changed. Both commits carry the trailer.
- [ ] **Step 5:** Stop for James's review. Push only if asked.

### Task 8: Batch 2, Transport & Web (12)

Ids: `http grpc mqtt quic cors websockets webtransport websec pac alpaca cntlm envoy`

- [ ] **Step 1:** For each id, write 3–5 `steps` and a `fact` drawn only from its explainer, add any icons it needs to `ICONS` from lucide-static, and redraw its `DIAGRAMS` function in the pilot's grammar.
- [ ] **Step 2:** Per id: `npm run verify <id>; echo $?` exits 0, and the four captures (light/dark × first/last step) are read against the checklist in Task 6 step 5.
- [ ] **Step 3:** `npm test; echo $?`, `npm run test:tour; echo $?`, `npm run verify; echo $?` all exit 0; `npm run glossary` reports 100 terms.
- [ ] **Step 4:** Commit `feat: redraw the transport and web diagrams as step-through infographics` (`index.html`, `glossary.txt`). Then run `node screenshot.mjs ./index.html` and commit `chore: refresh screenshots for the transport and web redraw` (`screenshots/`), skipping it if nothing changed. Both commits carry the trailer.
- [ ] **Step 5:** Stop for James's review. Push only if asked.

### Task 9: Batch 3, Secure Channels & Crypto (10)

Ids: `tls vpn wireguard ssh ipsec mtls vault pqc tailscale tpm`

`test/tour-fixtures.mjs` replaces the WireGuard diagram wholesale and appends its own tour fields, so the fixture is unaffected by this redraw. Confirm with `npm run test:tour`.

- [ ] **Step 1:** For each id, write 3–5 `steps` and a `fact` drawn only from its explainer, add any icons it needs to `ICONS` from lucide-static, and redraw its `DIAGRAMS` function in the pilot's grammar.
- [ ] **Step 2:** Per id: `npm run verify <id>; echo $?` exits 0, and the four captures (light/dark × first/last step) are read against the checklist in Task 6 step 5.
- [ ] **Step 3:** `npm test; echo $?`, `npm run test:tour; echo $?`, `npm run verify; echo $?` all exit 0; `npm run glossary` reports 100 terms.
- [ ] **Step 4:** Commit `feat: redraw the secure channel and crypto diagrams as step-through infographics` (`index.html`, `glossary.txt`). Then run `node screenshot.mjs ./index.html` and commit `chore: refresh screenshots for the secure channel and crypto redraw` (`screenshots/`), skipping it if nothing changed. Both commits carry the trailer.
- [ ] **Step 5:** Stop for James's review. Push only if asked.

### Task 10: Batch 4, Identity & Access I (10)

Ids: `oauth jwt saml radius spiffe idp pkce oidc scim mfa`

- [ ] **Step 1:** For each id, write 3–5 `steps` and a `fact` drawn only from its explainer, add any icons it needs to `ICONS` from lucide-static, and redraw its `DIAGRAMS` function in the pilot's grammar.
- [ ] **Step 2:** Per id: `npm run verify <id>; echo $?` exits 0, and the four captures (light/dark × first/last step) are read against the checklist in Task 6 step 5.
- [ ] **Step 3:** `npm test; echo $?`, `npm run test:tour; echo $?`, `npm run verify; echo $?` all exit 0; `npm run glossary` reports 100 terms.
- [ ] **Step 4:** Commit `feat: redraw the first identity and access diagrams as step-through infographics` (`index.html`, `glossary.txt`). Then run `node screenshot.mjs ./index.html` and commit `chore: refresh screenshots for the first identity and access redraw` (`screenshots/`), skipping it if nothing changed. Both commits carry the trailer.
- [ ] **Step 5:** Stop for James's review. Push only if asked.

### Task 11: Batch 5, Identity & Access II (9)

Ids: `ldap pam bola obo paseto cyberark fapi fido2 immuta`

- [ ] **Step 1:** For each id, write 3–5 `steps` and a `fact` drawn only from its explainer, add any icons it needs to `ICONS` from lucide-static, and redraw its `DIAGRAMS` function in the pilot's grammar.
- [ ] **Step 2:** Per id: `npm run verify <id>; echo $?` exits 0, and the four captures (light/dark × first/last step) are read against the checklist in Task 6 step 5.
- [ ] **Step 3:** `npm test; echo $?`, `npm run test:tour; echo $?`, `npm run verify; echo $?` all exit 0; `npm run glossary` reports 100 terms.
- [ ] **Step 4:** Commit `feat: redraw the remaining identity and access diagrams as step-through infographics` (`index.html`, `glossary.txt`). Then run `node screenshot.mjs ./index.html` and commit `chore: refresh screenshots for the remaining identity and access redraw` (`screenshots/`), skipping it if nothing changed. Both commits carry the trailer.
- [ ] **Step 5:** Stop for James's review. Push only if asked.

### Task 12: Batch 6, Zero-Trust Core and Detection & Response (15)

Ids: `zerotrust microseg peppdp openziti opa servicemesh nist207 ztna istio siem edr idsips soar dlp sentrywire`

- [ ] **Step 1:** For each id, write 3–5 `steps` and a `fact` drawn only from its explainer, add any icons it needs to `ICONS` from lucide-static, and redraw its `DIAGRAMS` function in the pilot's grammar.
- [ ] **Step 2:** Per id: `npm run verify <id>; echo $?` exits 0, and the four captures (light/dark × first/last step) are read against the checklist in Task 6 step 5.
- [ ] **Step 3:** `npm test; echo $?`, `npm run test:tour; echo $?`, `npm run verify; echo $?` all exit 0; `npm run glossary` reports 100 terms.
- [ ] **Step 4:** Commit `feat: redraw the zero-trust core and detection diagrams as step-through infographics` (`index.html`, `glossary.txt`). Then run `node screenshot.mjs ./index.html` and commit `chore: refresh screenshots for the zero-trust core and detection redraw` (`screenshots/`), skipping it if nothing changed. Both commits carry the trailer.
- [ ] **Step 5:** Stop for James's review. Push only if asked.

### Task 13: Batch 7, Network Edge & Ops (13)

Ids: `firewall loadbalancer sase sdwan waf apigateway casb bluefield supernic ovs ovn ndlp sbc`

- [ ] **Step 1:** For each id, write 3–5 `steps` and a `fact` drawn only from its explainer, add any icons it needs to `ICONS` from lucide-static, and redraw its `DIAGRAMS` function in the pilot's grammar.
- [ ] **Step 2:** Per id: `npm run verify <id>; echo $?` exits 0, and the four captures (light/dark × first/last step) are read against the checklist in Task 6 step 5.
- [ ] **Step 3:** `npm test; echo $?`, `npm run test:tour; echo $?`, `npm run verify; echo $?` all exit 0; `npm run glossary` reports 100 terms.
- [ ] **Step 4:** Commit `feat: redraw the network edge diagrams as step-through infographics` (`index.html`, `glossary.txt`). Then run `node screenshot.mjs ./index.html` and commit `chore: refresh screenshots for the network edge redraw` (`screenshots/`), skipping it if nothing changed. Both commits carry the trailer.
- [ ] **Step 5:** Stop for James's review. Push only if asked.

### Task 14: Batch 8, Governance and AI & Models (11)

Ids: `sbom cve owasp sigstore spinnaker rlhf dpo rag lora qlora coreweave`

- [ ] **Step 1:** For each id, write 3–5 `steps` and a `fact` drawn only from its explainer, add any icons it needs to `ICONS` from lucide-static, and redraw its `DIAGRAMS` function in the pilot's grammar.
- [ ] **Step 2:** Per id: `npm run verify <id>; echo $?` exits 0, and the four captures (light/dark × first/last step) are read against the checklist in Task 6 step 5.
- [ ] **Step 3:** `npm test; echo $?`, `npm run test:tour; echo $?`, `npm run verify; echo $?` all exit 0; `npm run glossary` reports 100 terms.
- [ ] **Step 4:** Commit `feat: redraw the governance and AI diagrams as step-through infographics` (`index.html`, `glossary.txt`). Then run `node screenshot.mjs ./index.html` and commit `chore: refresh screenshots for the governance and AI redraw` (`screenshots/`), skipping it if nothing changed. Both commits carry the trailer.
- [ ] **Step 5:** Stop for James's review. Push only if asked.

Batch sizes: 15 + 12 + 10 + 10 + 9 + 15 + 13 + 11 = 95, plus the 5 pilots = 100.

---

## Phase 3: lock-in

### Task 15: Make tours mandatory and remove the fallback

**Files:**
- Modify: `validate.mjs` (the `tour-data` loop)
- Modify: `verify.mjs` (per-term loop)
- Modify: `index.html` (`diagramHtml`)
- Modify: `README.md` (About paragraph)
- Modify: `test/tour-fixtures.mjs` (add a no-tour case)

- [ ] **Step 1: Add a failing fixture case**

In `CASES`, add a case that strips WireGuard's steps and fact. After Phase 2 every term has a tour, so this must now be rejected:

```js
  ['term without a tour rejected',
    base.replace(/(id: "wireguard"[\s\S]*?)\n\s*steps: \[[\s\S]*?\],\n\s*fact: "[^"]*"/, '$1'),
    'validate', 1, 'tour-data'],
```

Run: `npm run test:tour; echo $?`. Expected: that case FAILs with exit 0 (want 1).

- [ ] **Step 2: Make the checks mandatory**

In `validate.mjs`, delete the line `if (t.steps === undefined && t.fact === undefined) continue;`.

In `verify.mjs`, change `if (t.steps) {` to:

```js
  if (!t.steps) err('tour', `${t.id}: no steps — every diagram is a tour`);
  else {
```

The block keeps its single opening brace (now on the `else`), so its existing closing brace still matches.

- [ ] **Step 3: Remove the plain-figure fallback**

In `index.html`, `diagramHtml` becomes:

```js
  function diagramHtml(e) {
    const fn = DIAGRAMS[e.id];
    return tourHtml(e, fn ? fn() : fallbackDiagram(e));
  }
```

- [ ] **Step 4: Update the README**

In the About paragraph, replace "and a custom inline-SVG diagram" with "and a custom inline-SVG diagram you can step through, part by part".

- [ ] **Step 5: Gates**

Run: `npm run test:tour; echo $?`, `npm test; echo $?`, `npm run verify; echo $?`
Expected: all exit 0.

- [ ] **Step 6: Commit**

```bash
git add validate.mjs verify.mjs index.html README.md test/tour-fixtures.mjs
git commit -m "feat: make diagram tours mandatory for every term

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Stop for James's review. Push only if asked.
