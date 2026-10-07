# CALM Models Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every glossary term a CALM 1.2 architecture model that readers can view and download, and redraw each diagram so it matches its model, with tooling that proves the match.

**Architecture:** Models live in a `CALM` map beside `DIAGRAMS` in `index.html`. `_calm.mjs` checks each model against a vendored CALM 1.2 schema (with `ajv`) and checks its cross-references; `validate.mjs` runs it on every write. `verify.mjs` gains check (e), which reads the rendered drawing's `data-calm` tags and compares shapes, connectors and containment with the model, and checks the reader-facing disclosure. Until lock-in, a term without a model behaves exactly as it does today.

**Tech Stack:** Single-file `index.html` (vanilla JS, inline SVG, CSS custom properties); Node ESM tooling; `ajv` 8 (new devDependency); Playwright via `_launch.mjs`; `@finos/calm-cli` 1.60.1 through `npx` as an outside cross-check.

**Spec:** `docs/superpowers/specs/2026-10-06-calm-models-design.md`

**What has been run.** Before this plan was written, two things were run in a scratch directory: the `ajv` set-up used in `_calm.mjs` (same options, same four schema files) against good and bad sample models, and `npx --yes @finos/calm-cli@1.60.1 validate -a <file>` against a good and a bad sample. Both behaved as the plan assumes. Nothing else here has been executed: the page code, the `verify.mjs` probes and the fixtures are written from a close reading of the files, not from a run. Expect the fail-then-pass steps to surface small errors. Fix them where they are and carry on; if a fix changes an interface named in an **Interfaces** block, update the later tasks that consume it.

## Global Constraints

- One self-contained `index.html`. No build step, no runtime dependency, no external script. `.mjs` files at the root are tooling, and any new one must be added to the `single-file` whitelist in `validate.mjs`.
- CALM release 1.2. The page adds `"$schema": "https://calm.finos.org/release/1.2/meta/calm.json"`.
- A stored model holds only `nodes`, `relationships` and, where the tour walks connectors, `flows`. No controls, interfaces, `options`, patterns, decorators, timelines or ADR links.
- Model text (`name`, `description`) states only what the term's `explainer` says. UK spelling. No emoji anywhere.
- Explainers, takeaways, sources and tags are not edited. A suspected error in one is reported, not fixed.
- Exactly one `--accent` declaration. No hex in component CSS. Spacing (margin, padding, gap) only through `var(--space-N)`.
- Diagram `viewBox` stays 720 wide. `data-calm` is never nested inside another `data-calm`, and `data-s` is never nested inside another `data-s`.
- One SVG element per connector, running from one node to the other.
- Commits go direct to `main` with the trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Push only when James asks.
- Gates before every commit that touches `index.html` or the tooling: `npm test`, `npm run test:calm`, `npm run test:tour`, `npm run test:takeaways` and `npm run verify` all exit 0. Check exit codes directly (`echo "exit $?"`); never pipe a gate through `tail` and trust the output. A real `npm run verify` needs Google Fonts; the fixture suites do not.

## Review Focus

Inputs and conditions the spec implies that a reader of the page is likely to hit. Each has a test in the task that owns the code.

1. **Model text containing `<`, `&` or quotes.** The disclosure shows it literally, and Copy and Download give the same characters. Task 3: the fixture model carries `<b>` and `&` in a description; the "unescaped JSON caught" case.
2. **The clipboard refuses the write** (permission denied, or an origin without clipboard access). The reader is told "Copy failed" rather than left guessing. Task 3: the stubbed-clipboard check; the "silent copy failure caught" case.
3. **Printing with the disclosure open.** The JSON prints whole, not clipped to the 420px scroll box. Task 3: the print-media check; the "print clipping caught" case.
4. **A node name containing `&`** (RBAC & ABAC is already a term). The name is matched against the rendered label, not the SVG source's `&amp;`. Task 2: the fixture node "Part & seal" in the good case.
5. **A keyboard-only reader.** The scrolling JSON block can be focused and has an accessible name. Task 3: the `focusable` check; the "JSON block not reachable by keyboard caught" case.

Moving between terms without a reload and then downloading needs no extra test: `verify.mjs` already walks term to term by hash change and checks each download's file name.

## File map

| File | Change |
|---|---|
| `index.html` | The `CALM` map; `cyl()` and `doc()` shape helpers and their CSS; `calmDoc()`, `calmHtml()`, `calmAction()`; disclosure CSS and print rules; `data-calm` and `data-note` tags on every diagram; per-term models |
| `_terms.mjs` | `declSpan()` shared walker, `extractObject()`, `readTerms()` returns `CALM` |
| `_calm.mjs` | New. Schema validation with `ajv`, reference checks, `relationshipShape()`, `CALM_SCHEMA` |
| `validate.mjs` | Runs `checkModels()`; whitelists `_calm.mjs` (phase 4: models mandatory) |
| `verify.mjs` | Geometry probe learns the two new shapes; check (e) model against drawing; disclosure checks; `--calm-out=<dir>` (phase 4: models mandatory) |
| `test/calm-schema/1.2/` | New. The eleven vendored CALM 1.2 schema files and a README |
| `test/calm-fixtures.mjs` | New. Good and broken models, drawings and disclosures, asserting each checker's verdict |
| `test/tour-fixtures.mjs` | Its replacement WireGuard drawing gains a matching synthetic model and `data-calm` tags |
| `package.json`, `package-lock.json` | `ajv` devDependency, `test:calm` script |
| `.claude/skills/add-glossary-term/SKILL.md` | The model step, the grammar additions, check (e) |
| `CLAUDE.md`, `README.md` | Verification commands; at lock-in the invariant, the About sentence and the project structure |

---

## Phase 1: foundation

### Task 1: Model checks in `validate.mjs`

**Files:**
- Create: `test/calm-schema/1.2/*.json` (eleven files), `test/calm-schema/1.2/README.md`
- Create: `_calm.mjs`
- Create: `test/calm-fixtures.mjs`
- Modify: `_terms.mjs` (whole file below)
- Modify: `validate.mjs:16` (imports), `validate.mjs:61-64` (whitelist), `validate.mjs:152` (after the takeaways loop)
- Modify: `index.html:8582` (the empty `CALM` declaration, after `DIAGRAMS`)
- Modify: `package.json`

**Interfaces:**
- Produces, from `_terms.mjs`: `declSpan(html, name, open, close) -> { from, end }` (positions of the opening and closing characters); `extractObject(html, name) -> object`; `readTerms(path)` now also returns `CALM`.
- Produces, from `_calm.mjs`: `checkModels(models, termIds, { requireAll = false }) -> Promise<[{ rule: 'calm-data', msg }]>`; `relationshipShape(rel) -> { kind: 'connects' | 'interacts' | 'deployed-in' | 'composed-of' | 'options', from: string | null, to: string[] }`.
- Produces, in `test/calm-fixtures.mjs`: `GOOD`, `model(f)`, `relType(m, id)`, `withModel(html, m, id)`, `swap(html, from, to)`, the `CASES` array and the runner. Tasks 2 and 3 add cases to it.

- [ ] **Step 1: Vendor the CALM 1.2 schema**

```bash
mkdir -p test/calm-schema/1.2
for f in calm-timeline calm control-requirement control core decorators evidence flow interface timeline units; do
  curl -sf -o "test/calm-schema/1.2/$f.json" "https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/release/1.2/meta/$f.json" || echo "FAILED $f"
done
ls test/calm-schema/1.2 | wc -l
```

Expected: `11` and no `FAILED` line.

Create `test/calm-schema/1.2/README.md`, replacing the date with the day you fetched the files:

```markdown
# CALM 1.2 schema (vendored)

The eleven files of the FINOS Common Architecture Language Model release 1.2, copied
unmodified from
https://github.com/finos/architecture-as-code/tree/main/calm/release/1.2/meta
on 6 October 2026.

`_calm.mjs` validates every model in `index.html` against `core.json`, which refers to
`control.json`, `flow.json` and `interface.json`. The other files are kept so the copy is
the whole release. To move to a later release, vendor it beside this one, then change
`SCHEMA_DIR` and `CALM_SCHEMA` in `_calm.mjs` and the `$schema` URL in `index.html`.
```

- [ ] **Step 2: Add `ajv` and the script**

```bash
npm install --save-dev ajv@^8
```

In `package.json`, add to `scripts` after `"test:takeaways"`:

```json
    "test:calm": "node test/calm-fixtures.mjs",
```

- [ ] **Step 3: Add the empty `CALM` declaration to `index.html`**

Replace:

```js
  };

  /* ====================================================================
     ENGINE — search, filter, routing, rendering. Data-driven; no term
```

With:

```js
  };

  /* ====================================================================
     CALM — one architecture model per term id, in the FINOS Common
     Architecture Language Model 1.2 format. Each diagram is drawn from its
     model, and verify.mjs checks that the two agree. Plain data only:
     quoted keys, no functions, no template literals.
     ==================================================================== */
  const CALM = {
  };

  /* ====================================================================
     ENGINE — search, filter, routing, rendering. Data-driven; no term
```

The comment must not contain the text `const CALM = {`: the tooling finds the declaration by that string.

- [ ] **Step 4: Teach `_terms.mjs` to read an object literal**

Replace everything in `_terms.mjs` above `// The keys of \`const DIAGRAMS = { ... }\`` with:

```js
// _terms.mjs — reads the data declarations out of index.html.
//
// The TERMS entries use template literals for `explainer`, so the array can't
// be parsed as JSON: walk to the matching bracket ignoring anything inside a
// string, then evaluate the literal in a bare context. Shared by glossary.mjs,
// validate.mjs and verify.mjs.

import fs from 'fs';

import vm from 'vm';

// Finds `const <name> = <open>` and walks to the matching closer, respecting
// quoting. Returns the positions of the opening and closing characters. Throws
// with a usable message if the declaration is missing or does not balance.
export function declSpan(html, name, open, close) {
  const start = html.indexOf(`const ${name} = ${open}`);
  if (start === -1) throw new Error(`could not find \`const ${name} = ${open}\` in index.html`);

  const from = html.indexOf(open, start);
  let depth = 0, end = from, quote = null;
  for (; end < html.length; end++) {
    const c = html[end];
    if (quote) {
      if (c === '\\') end++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === open) depth++;
    else if (c === close && --depth === 0) break;
  }

  if (depth !== 0) throw new Error(`unbalanced brackets — ${name} is malformed`);
  return { from, end };
}

// Evaluated in a bare context with no globals: the literal is data from this
// repo's own index.html, and it can't reach anything if that ever changes.
export function extractArray(html, name) {
  const { from, end } = declSpan(html, name, '[', ']');
  return vm.runInNewContext(html.slice(from, end + 1));
}

// The same for an object literal, the CALM map. Parenthesised, because a bare
// `{` opens a block rather than an object.
export function extractObject(html, name) {
  const { from, end } = declSpan(html, name, '{', '}');
  return vm.runInNewContext(`(${html.slice(from, end + 1)})`);
}

```

In `readTerms`, add a line after `DIAGRAM_IDS: diagramIds(html),`:

```js
    CALM:        extractObject(html, 'CALM'),
```

Run:

```bash
node --input-type=module -e 'import { readTerms } from "./_terms.mjs"; const d = readTerms("./index.html"); console.log(d.TERMS.length, Object.keys(d.CALM).length)'
npm run glossary
```

Expected: `105 0`, then `wrote 105 terms`, and `git status --short glossary.txt` prints nothing.

- [ ] **Step 5: Write the failing fixtures**

Create `test/calm-fixtures.mjs`:

```js
#!/usr/bin/env node
// test/calm-fixtures.mjs — proves validate.mjs and verify.mjs catch a broken
// CALM model, a drawing that disagrees with its model, and a broken model
// disclosure. Builds throwaway copies of index.html in a temp dir with a
// synthetic model on the WireGuard entry, then runs each checker and asserts
// the exit code, the rule it reports, and a fragment of the message.
//
// Usage: npm run test:calm

import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { readTerms, declSpan } from '../_terms.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'index.html');
const base = fs.readFileSync(source, 'utf8');
const { CALM } = readTerms(source);

const node = (id, type, name, description) => ({ 'unique-id': id, 'node-type': type, name, description });
const GOOD = {
  nodes: [
    node('user', 'actor', 'User', 'Asks the app a question.'),
    // Markup and an ampersand, so a disclosure that forgets to escape fails.
    node('app', 'service', 'App', 'Answers from the <b>store</b> & the agent.'),
    node('store', 'database', 'Store', 'Holds what the app reads.'),
    node('host', 'system', 'Host', 'Runs the agent.'),
    node('agent', 'service', 'Agent', 'Reports to the app.'),
    node('bundle', 'data-asset', 'Bundle', 'Holds one part.'),
    // An ampersand in a name: it is matched against the rendered label.
    node('part', 'data-asset', 'Part & seal', 'The only part of the bundle.'),
  ],
  relationships: [
    { 'unique-id': 'user-app', description: 'The user uses the app.', 'relationship-type': { interacts: { actor: 'user', nodes: ['app'] } } },
    { 'unique-id': 'app-store', description: 'The app reads the store.', 'relationship-type': { connects: { source: { node: 'app' }, destination: { node: 'store' } } } },
    { 'unique-id': 'agent-app', description: 'The agent reports to the app.', 'relationship-type': { connects: { source: { node: 'agent' }, destination: { node: 'app' } } } },
    { 'unique-id': 'host-agent', description: 'The agent runs on the host.', 'relationship-type': { 'deployed-in': { container: 'host', nodes: ['agent'] } } },
    { 'unique-id': 'bundle-part', description: 'The bundle holds the part.', 'relationship-type': { 'composed-of': { container: 'bundle', nodes: ['part'] } } },
  ],
  flows: [{
    'unique-id': 'ask', name: 'Ask and answer', description: 'The user asks, the app reads and answers.',
    transitions: [
      { 'relationship-unique-id': 'user-app', 'sequence-number': 1, description: 'The user asks.' },
      { 'relationship-unique-id': 'app-store', 'sequence-number': 2, description: 'The app reads the store.' },
      { 'relationship-unique-id': 'app-store', 'sequence-number': 3, description: 'The store answers.', direction: 'destination-to-source' },
      { 'relationship-unique-id': 'agent-app', 'sequence-number': 4, description: 'The agent reports.' },
      { 'relationship-unique-id': 'user-app', 'sequence-number': 5, description: 'The app answers the user.', direction: 'destination-to-source' },
    ],
  }],
};

// A copy of the good model with one thing changed.
const model = (f) => { const m = structuredClone(GOOD); f(m); return m; };
const relType = (m, id) => m.relationships.find((r) => r['unique-id'] === id)['relationship-type'];

// Rewrites the page's CALM declaration: every real model kept, `id` set to
// `m`, or removed when m is null. The map is plain data, so it survives the
// round trip through JSON.
function withModel(html, m, id = 'wireguard') {
  const all = { ...CALM };
  if (m === null) delete all[id]; else all[id] = m;
  const { from, end } = declSpan(html, 'CALM', '{', '}');
  return html.slice(0, from) + JSON.stringify(all, null, 2) + html.slice(end + 1);
}

// A literal replace that refuses to pass silently when the needle has moved.
function swap(html, from, to) {
  if (!html.includes(from)) throw new Error(`fixture needle not found: ${from}`);
  return html.replace(from, () => to);
}

const CASES = [
  // [name, build, checker, expected exit, rule expected in the report, message fragment]
  ['good model validates', () => withModel(base, GOOD), 'validate', 0, null],
  ['term without a model accepted during migration', () => withModel(base, null), 'validate', 0, null],
  ['model for an unknown term id rejected', () => withModel(base, GOOD, 'not-a-term'), 'validate', 1, 'calm-data', /not a term/],
  ['node without a description rejected', () => withModel(base, model((m) => { delete m.nodes[0].description; })), 'validate', 1, 'calm-data', /schema/],
  ['extra top-level key rejected', () => withModel(base, model((m) => { m.metadata = {}; })), 'validate', 1, 'calm-data', /only nodes, relationships and flows/],
  ['relationship naming a missing node rejected',
    () => withModel(base, model((m) => { relType(m, 'app-store').connects.destination.node = 'ghost'; })), 'validate', 1, 'calm-data', /"ghost"/],
  ['transition naming a missing relationship rejected',
    () => withModel(base, model((m) => { m.flows[0].transitions[0]['relationship-unique-id'] = 'nope'; })), 'validate', 1, 'calm-data', /"nope"/],
  ['transition over a containment relationship rejected',
    () => withModel(base, model((m) => { m.flows[0].transitions[0]['relationship-unique-id'] = 'host-agent'; })), 'validate', 1, 'calm-data', /has no connector/],
  ['duplicated unique-id rejected', () => withModel(base, model((m) => { m.nodes[1]['unique-id'] = 'user'; })), 'validate', 1, 'calm-data', /more than once/],
  ['unreferenced node rejected',
    () => withModel(base, model((m) => { m.nodes.push(node('spare', 'service', 'Spare', 'Named by nothing.')); })), 'validate', 1, 'calm-data', /is in no relationship/],
  ['sequence gap rejected', () => withModel(base, model((m) => { m.flows[0].transitions[1]['sequence-number'] = 7; })), 'validate', 1, 'calm-data', /sequence-number 7/],
  ['node containing itself rejected',
    () => withModel(base, model((m) => { relType(m, 'host-agent')['deployed-in'].nodes.push('host'); })), 'validate', 1, 'calm-data', /contains itself/],
  ['container of both kinds rejected',
    () => withModel(base, model((m) => { m.relationships.push({ 'unique-id': 'host-parts', 'relationship-type': { 'composed-of': { container: 'host', nodes: ['agent'] } } }); })),
    'validate', 1, 'calm-data', /both deployed-in and composed-of/],
  ['CALM that does not parse rejected', () => swap(base, 'const CALM = {', 'const CALM = {{'), 'validate', 1, 'data-parse', /CALM/],
];

let failed = 0;
for (const [name, build, checker, wantCode, wantRule, wantMsg] of CASES) {
  let html;
  try { html = build(); } catch (e) { failed++; console.log(`  FAIL  ${name}: ${e.message}`); continue; }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'calm-'));
  const file = path.join(dir, 'index.html');
  fs.writeFileSync(file, html);
  const args = checker === 'validate'
    ? [path.join(root, 'validate.mjs'), file, '--json']
    : [path.join(root, 'verify.mjs'), 'wireguard', `--target=${file}`, '--json', '--offline'];
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

- [ ] **Step 6: Run the fixtures and watch them fail**

Run: `npm run test:calm; echo "exit $?"`
Expected: the two accepted cases print `ok`; every `rejected` case prints `FAIL … exit 0 (want 1)`, because `validate.mjs` does not read `CALM` yet; `exit 1`.

- [ ] **Step 7: Write `_calm.mjs`**

```js
// _calm.mjs — static checks on the CALM models in index.html: each one against
// the CALM 1.2 schema, and the cross-references the schema cannot express.
// validate.mjs runs these on every write. Whether a drawing matches its model
// is a rendered check, in verify.mjs.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const SCHEMA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'test', 'calm-schema', '1.2');
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const TOP_LEVEL = ['nodes', 'relationships', 'flows'];

// core.json is the architecture vocabulary; it refers to the other three.
// strict is off because the schema keeps its definitions under `defs`, a
// keyword ajv's strict mode does not know.
async function schemaValidator() {
  let Ajv2020;
  try {
    ({ default: Ajv2020 } = await import('ajv/dist/2020.js'));
  } catch {
    throw new Error('ajv is not installed — run `npm install`');
  }
  const load = (f) => JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, f), 'utf8'));
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  for (const f of ['control.json', 'flow.json', 'interface.json']) ajv.addSchema(load(f));
  return ajv.compile(load('core.json'));
}

// The node ids a relationship names and how it is drawn: connects and
// interacts as a connector from `from` to one of `to`, deployed-in and
// composed-of as `to` drawn inside `from`.
export function relationshipShape(rel) {
  const t = rel['relationship-type'] || {};
  if (t.connects) return { kind: 'connects', from: t.connects.source.node, to: [t.connects.destination.node] };
  if (t.interacts) return { kind: 'interacts', from: t.interacts.actor, to: t.interacts.nodes };
  if (t['deployed-in']) return { kind: 'deployed-in', from: t['deployed-in'].container, to: t['deployed-in'].nodes };
  if (t['composed-of']) return { kind: 'composed-of', from: t['composed-of'].container, to: t['composed-of'].nodes };
  return { kind: 'options', from: null, to: [] };
}

// Returns [{ rule, msg }]. `requireAll` stays off until every term has a model.
export async function checkModels(models, termIds, { requireAll = false } = {}) {
  const found = [];
  const err = (msg) => found.push({ rule: 'calm-data', msg });

  let validate;
  try { validate = await schemaValidator(); } catch (e) { err(e.message); return found; }

  const known = new Set(termIds);
  for (const id of Object.keys(models)) if (!known.has(id)) err(`${id}: a model for an id that is not a term`);
  if (requireAll) for (const id of termIds) if (!models[id]) err(`${id}: no CALM model — every term has one`);

  for (const [id, m] of Object.entries(models)) {
    if (!m || typeof m !== 'object' || Array.isArray(m)) { err(`${id}: the model is not an object`); continue; }
    const extra = Object.keys(m).filter((k) => !TOP_LEVEL.includes(k));
    if (extra.length) err(`${id}: a stored model holds only nodes, relationships and flows, not ${extra.join(', ')}`);

    if (!validate(m)) {
      for (const e of validate.errors.slice(0, 5)) err(`${id}: schema — ${e.instancePath || '/'} ${e.message}`);
      continue;   // the reference checks below assume the schema's structure
    }

    const nodes = m.nodes || [], rels = m.relationships || [], flows = m.flows || [];
    if (!nodes.length) { err(`${id}: the model has no nodes`); continue; }

    const repeated = (list) => [...new Set(list.filter((x, i) => list.indexOf(x) !== i))];
    const nodeIds = nodes.map((n) => n['unique-id']);
    const relIds = rels.map((r) => r['unique-id']);
    for (const x of repeated(nodeIds)) err(`${id}: node id "${x}" is used more than once`);
    for (const x of repeated(relIds)) err(`${id}: relationship id "${x}" is used more than once`);
    for (const x of [...nodeIds, ...relIds]) if (!KEBAB.test(x)) err(`${id}: "${x}" is not a kebab-case id`);
    for (const n of nodes) {
      if (!n.name.trim() || !n.description.trim()) err(`${id}: node "${n['unique-id']}" needs a non-empty name and description`);
    }

    const isNode = new Set(nodeIds);
    const referenced = new Set();
    const containerKinds = new Map();   // node id -> the containment kinds it holds children through
    const connectors = new Set();       // relationships drawn as a connector
    for (const r of rels) {
      const rid = r['unique-id'];
      const s = relationshipShape(r);
      if (s.kind === 'options') { err(`${id}: relationship "${rid}" uses options, which this glossary does not draw`); continue; }
      for (const n of [s.from, ...s.to]) {
        if (!isNode.has(n)) err(`${id}: relationship "${rid}" names "${n}", which is not a node`);
        referenced.add(n);
      }
      if (s.kind === 'connects' || s.kind === 'interacts') { connectors.add(rid); continue; }
      if (s.to.includes(s.from)) err(`${id}: in relationship "${rid}", node "${s.from}" contains itself`);
      containerKinds.set(s.from, (containerKinds.get(s.from) || new Set()).add(s.kind));
    }
    for (const [n, kinds] of containerKinds) {
      if (kinds.size > 1) err(`${id}: node "${n}" is a container through both deployed-in and composed-of`);
    }
    // The official CLI warns about these, and a node nothing names is not part
    // of the architecture.
    for (const n of nodeIds) if (!referenced.has(n)) err(`${id}: node "${n}" is in no relationship`);

    if (flows.length > 1) err(`${id}: ${flows.length} flows — a model has at most one`);
    for (const f of flows) {
      f.transitions.forEach((t, i) => {
        const rid = t['relationship-unique-id'];
        if (!relIds.includes(rid)) err(`${id}: transition ${i + 1} names "${rid}", which is not a relationship`);
        else if (!connectors.has(rid)) err(`${id}: transition ${i + 1} runs over "${rid}", which is containment and has no connector`);
        if (t['sequence-number'] !== i + 1) err(`${id}: transition ${i + 1} has sequence-number ${t['sequence-number']} — they run 1 to ${f.transitions.length} in order`);
      });
    }
  }
  return found;
}
```

- [ ] **Step 8: Run the checks from `validate.mjs`**

Replace the import on line 16:

```js
import { extractArray, extractObject, diagramIds } from './_terms.mjs';
import { checkModels } from './_calm.mjs';
```

In the `single-file` whitelist, add `'_calm.mjs'`:

```js
    'glossary.mjs', 'verify.mjs', '_terms.mjs', '_calm.mjs',
```

Inside the `if (html.includes('const TERMS = [')) {` block, after the closing brace of the takeaways `for (const t of terms)` loop and before the block's own closing brace, add:

```js

  // CALM models: one architecture per term id, each valid against the CALM 1.2
  // schema and consistent in its own references. Whether a drawing matches
  // its model is a rendered check, in verify.mjs.
  let models = null;
  try { models = extractObject(html, 'CALM'); } catch (e) { err('data-parse', `CALM: ${e.message}`); }
  if (models) {
    for (const f of await checkModels(models, terms.map((t) => t.id), { requireAll: false })) err(f.rule, f.msg);
  }
```

- [ ] **Step 9: Run the fixtures and the other suites**

Run: `npm run test:calm; echo "exit $?"`
Expected: every case `ok`, `all fixture cases pass`, `exit 0`.

Run: `npm test; echo "exit $?"`, `npm run test:tour; echo "exit $?"`, `npm run test:takeaways; echo "exit $?"`, `npm run verify; echo "exit $?"`
Expected: all `exit 0`. The two older suites and the full `verify` prove the `_terms.mjs` refactor changed nothing.

- [ ] **Step 10: Commit**

```bash
git add test/calm-schema _calm.mjs _terms.mjs validate.mjs test/calm-fixtures.mjs index.html package.json package-lock.json
git commit -m "feat: check CALM models in validate.mjs

Vendors the CALM 1.2 schema, validates each model against it with ajv, and
checks the references the schema cannot express. The CALM map starts empty.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Drawing grammar and verify check (e)

**Files:**
- Modify: `index.html:539` (CSS after `.dg .divider`), `index.html:3501` (helpers after `badge`)
- Modify: `verify.mjs` (header comment, import, `data` destructuring, `PROBE`, new `CALM_PROBE`, `wantShape`, `checkDrawing`, the per-term loop)
- Modify: `test/calm-fixtures.mjs` (tour, drawing and the verify cases)
- Modify: `test/tour-fixtures.mjs` (a model and tags for its replacement drawing)

**Interfaces:**
- Consumes: `relationshipShape` from `_calm.mjs`; `readTerms().CALM`, `declSpan` from `_terms.mjs`; `GOOD`, `model`, `withModel`, `swap`, `CASES` in `test/calm-fixtures.mjs` (Task 1).
- Produces, in `index.html`: `cyl(x, y, w, h, cls = 'box')` and `doc(x, y, w, h, cls = 'box')`, each returning SVG markup; classes `shape`, `shape-cyl`, `shape-doc`, `rim`, `fold`; attributes `data-calm` and `data-note`.
- Produces, in `verify.mjs`: rule name `calm`; `CALM_PROBE`; `checkDrawing(id, model, reading)`; shape names `'rounded box'`, `'square box'`, `'cylinder'`, `'document'`, `'dashed zone'`, `'solid container'`.
- Produces, in `test/calm-fixtures.mjs`: `STEPS`, `withTour`, `withDiagram`, `svg(options)`, `page(svgOptions, m)`. Task 3 uses `page()`.

- [ ] **Step 1: Add the drawing fixtures**

In `test/calm-fixtures.mjs`, add after the `swap` function:

```js
const STEPS = `steps: [
        { title: "User asks", text: "The user asks the app." },
        { title: "App reads", text: "The app reads the store." },
        { title: "Agent reports", text: "The agent reports and the app answers." }
      ],
      fact: "The app answers from the store."`;

// Replaces the wireguard entry's tour and drawing, as test/tour-fixtures.mjs
// does, so the fixture does not depend on the real entry.
function withTour(html, tour) {
  html = html.replace(/(id: "wireguard"[\s\S]*?),\n\s*steps: \[[\s\S]*?\],\n\s*fact: "[^"]*"/, '$1');
  const at = html.indexOf('id: "wireguard"');
  const close = html.indexOf('\n    }', at);
  return html.slice(0, close) + `,\n      ${tour}` + html.slice(close);
}
function withDiagram(html, drawing) {
  return html.replace(/ {4}wireguard: \(\) => `[\s\S]*?<\/svg>`/, `    wireguard: () => \`${drawing}\``);
}

// The fixture drawing: an actor, a service, a cylinder, a dashed zone holding
// a service, and a solid container holding a document. Each option plants one
// defect; with none it matches GOOD.
const svg = (o = {}) => {
  const p = {
    storeTag: ' data-calm="store"', storeName: 'Store', storeShape: '${cyl(540, 28, 140, 72)}',
    agentAppTag: 'agent-app', agentAppStep: '3', askEnd: '278', hostWidth: '240', extra: '', nest: false, ...o,
  };
  const agent = '<g data-s="3" data-calm="agent"><rect class="box" x="300" y="180" width="120" height="56" rx="8"/><text class="t-b" x="320" y="214">Agent</text></g>';
  return `
      <svg class="dg" viewBox="0 0 720 280" role="img" xmlns="http://www.w3.org/2000/svg" aria-label="fixture">
        <g data-s="1 3" data-calm="user"><rect class="box" x="24" y="32" width="140" height="64" rx="12"/><text class="t-b" x="44" y="70">User</text></g>
        <g data-s="1 2 3" data-calm="app"><rect class="box" x="280" y="32" width="140" height="64" rx="8"/><text class="t-b" x="300" y="70">App</text></g>
        <g data-s="2"${p.storeTag}>${p.storeShape}<text class="t-b" x="566" y="72">${p.storeName}</text></g>
        <g data-calm="host"><rect class="zone" x="260" y="150" width="${p.hostWidth}" height="110" rx="10"/><text class="t-sm t-mut" x="272" y="168">Host</text>${p.nest ? agent : ''}</g>
        ${p.nest ? '' : agent}
        <g data-calm="bundle"><rect class="box-soft" x="24" y="150" width="180" height="110" rx="8"/><text class="t-sm t-mut" x="36" y="168">Bundle</text></g>
        <g data-calm="part">\${doc(44, 180, 140, 56)}<text class="t-b" x="60" y="214">Part &amp; seal</text></g>
        <line class="flow" data-s="1" data-calm="user-app" x1="166" y1="52" x2="${p.askEnd}" y2="52" marker-end="url(#ah-mut)"/>
        <line class="flow" data-s="3" data-calm="user-app" x1="278" y1="80" x2="166" y2="80" marker-end="url(#ah-mut)"/>
        <line class="flow" data-s="2" data-calm="app-store" x1="422" y1="64" x2="538" y2="64" marker-start="url(#ah-mut)" marker-end="url(#ah-mut)"/>
        <line class="flow" data-s="${p.agentAppStep}" data-calm="${p.agentAppTag}" x1="350" y1="178" x2="350" y2="98" marker-end="url(#ah-mut)"/>
        ${p.extra}
        \${badge(1, 222, 52, '1')}
        \${badge(2, 480, 64, '2')}
        \${badge(3, 350, 124, '3')}
      </svg>`;
};

// The whole fixture page: synthetic tour, drawing and model on wireguard.
const page = (o, m = GOOD) => withModel(withDiagram(withTour(base, STEPS), svg(o)), m);
```

Add to the end of `CASES`:

```js

  // Check (e): the drawing against its model.
  ['good drawing verifies', () => page(), 'verify', 0, null],
  ['term without a model verifies during migration', () => withModel(base, null), 'verify', 0, null],
  ['node not drawn caught', () => page({ storeTag: '' }), 'verify', 1, 'calm', /drawn 0 times/],
  ['title that differs from the name caught', () => page({ storeName: 'Storage' }), 'verify', 1, 'calm', /no label reading "Store"/],
  ['database drawn as a plain box caught',
    () => page({ storeShape: '<rect class="box" x="540" y="28" width="140" height="72" rx="8"/>' }), 'verify', 1, 'calm', /drawn as a square box, want a cylinder/],
  ['connector tagged with an unknown relationship caught', () => page({ agentAppTag: 'agent-nowhere' }), 'verify', 1, 'calm', /"agent-nowhere" is not in the model/],
  ['connector ending on the wrong node caught', () => page({ askEnd: '220' }), 'verify', 1, 'calm', /does not run between/],
  ['child outside its container caught', () => page({ hostWidth: '30' }), 'verify', 1, 'calm', /outside its container/],
  ['untagged box caught', () => page({ extra: '<rect class="box" x="560" y="180" width="120" height="56" rx="8"/>' }), 'verify', 1, 'calm', /untagged/],
  ['untagged flow caught', () => page({ extra: '<line class="flow" x1="620" y1="150" x2="620" y2="250"/>' }), 'verify', 1, 'calm', /untagged/],
  ['box marked data-note accepted',
    () => page({ extra: '<g data-note="call-out"><rect class="box" x="560" y="180" width="120" height="56" rx="8"/></g>' }), 'verify', 0, null],
  ['nested data-calm caught', () => page({ nest: true }), 'verify', 1, 'calm', /nested/],
  ['flow order that contradicts the tour caught', () => page({ agentAppStep: '1' }), 'verify', 1, 'calm', /flow order contradicts the tour/],
  ['reverse connector with no reverse transition caught',
    () => page({}, model((m) => { m.flows[0].transitions.pop(); })), 'verify', 1, 'calm', /against the relationship's direction/],
  ['lit connectors with no flow caught', () => page({}, model((m) => { delete m.flows; })), 'verify', 1, 'calm', /has no flow/],
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npm run test:calm; echo "exit $?"`
Expected: the Task 1 cases stay `ok`, and so does `term without a model verifies during migration`. `good drawing verifies` and `box marked data-note accepted` FAIL with a `render` or `console` error, because the page has no `cyl()` yet. Every `caught` case FAILs for want of a `calm` rule. `exit 1`.

- [ ] **Step 3: Add the shape helpers and their CSS to `index.html`**

After the `.dg .divider { … }` line (line 539), add:

```css
    /* Node outlines beyond the rect: a cylinder is a data store, a folded
       document a data asset. The outline takes .box or .box-accent; the rim
       and the fold are the second stroke each shape needs. */
    .dg :is(.rim, .fold) { fill: none; stroke: var(--border-strong); stroke-width: 1.5; }
    .dg .box-accent + :is(.rim, .fold), .dg .on > :is(.rim, .fold) { stroke: var(--accent); }
```

After the `badge` helper (line 3501), add:

```js
  // Node outlines that are not a plain rect, drawn inside (x, y, w, h). cyl()
  // is a data store and doc() a data asset; cls is "box" or "box-accent".
  const cyl = (x, y, w, h, cls = 'box') =>
    `<path class="${cls} shape shape-cyl" d="M${x} ${y + 8} A${w / 2} 8 0 0 1 ${x + w} ${y + 8} V${y + h - 8} A${w / 2} 8 0 0 1 ${x} ${y + h - 8} Z"/>` +
    `<path class="shape rim" d="M${x} ${y + 8} A${w / 2} 8 0 0 0 ${x + w} ${y + 8}"/>`;
  const doc = (x, y, w, h, cls = 'box') =>
    `<path class="${cls} shape shape-doc" d="M${x} ${y} H${x + w - 12} L${x + w} ${y + 12} V${y + h} H${x} Z"/>` +
    `<path class="shape fold" d="M${x + w - 12} ${y} V${y + 12} H${x + w}"/>`;
```

- [ ] **Step 4: Teach the geometry probe the new shapes**

In `verify.mjs`, inside `PROBE`, replace the `rects` declaration:

```js
  const rects = [...svg.querySelectorAll('rect')]
    .filter((r) => !r.closest('.ico'))
    .filter((r) => !/zone/.test(r.getAttribute('class') || ''))
    .filter((r) => r.getAttribute('width') && r.getAttribute('height'))
    .map((r) => Object.assign(box(r), {
      cls: (r.getAttribute('class') || '(no class)') +
           ' [' + r.getAttribute('x') + '..' + (+r.getAttribute('x') + +r.getAttribute('width')) + ']',
    }));
```

With:

```js
  // A cylinder or a document is a box drawn as a path, so it counts here too.
  const rects = [...svg.querySelectorAll('rect, path.shape-cyl, path.shape-doc')]
    .filter((r) => !r.closest('.ico'))
    .filter((r) => !/zone/.test(r.getAttribute('class') || ''))
    .filter((r) => r.tagName !== 'rect' || (r.getAttribute('width') && r.getAttribute('height')))
    .map((r) => {
      const b = r.getBBox();   // user units; none of these shapes carries a transform
      return Object.assign(box(r), {
        cls: (r.getAttribute('class') || '(no class)') + ' [' + b.x + '..' + (b.x + b.width) + ']',
      });
    });
```

In the same probe, in the `(b)` loop, after the `stroke-bad` line, add:

```js
    // A node's own outline, rim or fold is not a stroke crossing its label.
    if ((el.getAttribute('class') || '').split(' ').includes('shape')) continue;
```

- [ ] **Step 5: Add check (e) to `verify.mjs`**

In the header comment, after the `(d)` paragraph, add:

```js
//   (e) CALM model — for a term with a model: every node drawn once, under
//       its name, in the outline its type calls for; every connects and
//       interacts relationship drawn as a connector between the right two
//       nodes; every contained node inside its container; the flow in the
//       tour's order; and no box, zone or flow left untagged
```

Replace the `_terms.mjs` import with:

```js
import { readTerms } from './_terms.mjs';
import { relationshipShape } from './_calm.mjs';
```

Replace the destructuring of `data`:

```js
const { html, TERMS, TYPE_TAGS, PROV_TAGS, DOMAIN_TAGS, DIAGRAM_IDS, CALM } = data;
```

After the `REOPEN_PROBE` declaration, add:

```js
// Reads the drawing for check (e): every data-calm node group and connector,
// and every box, zone and flow that carries neither a tag nor a data-note.
// Positions are in screen px, and so is tol, the endpoint tolerance.
const CALM_PROBE = `(() => {
  const svg = document.querySelector('#detail-content svg.dg');
  const vb = svg.viewBox.baseVal;
  const scale = vb.width ? svg.getBoundingClientRect().width / vb.width : 1;
  const rect = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, r: r.right, b: r.bottom }; };
  const SHAPES = 'rect.box, rect.box-accent, rect.box-soft, rect.zone, rect.zone-accent, path.shape-cyl, path.shape-doc';
  const FLOWS = '.flow, .flow-accent, .flow-ok, .flow-bad';
  const kind = (el) => {
    const c = el.classList;
    if (c.contains('shape-cyl')) return 'cylinder';
    if (c.contains('shape-doc')) return 'document';
    if (c.contains('zone') || c.contains('zone-accent')) return 'dashed zone';
    if (c.contains('box-soft')) return 'solid container';
    return Number(el.getAttribute('rx')) >= 12 ? 'rounded box' : 'square box';
  };
  const step = (el) => { const s = el.closest('[data-s]'); return s ? Math.min(...s.dataset.s.trim().split(/\\s+/).map(Number)) : null; };
  const point = (el, at) => { const p = el.getPointAtLength(at); const q = new DOMPoint(p.x, p.y).matrixTransform(el.getScreenCTM()); return { x: q.x, y: q.y }; };
  const where = (el) => (el.getAttribute('class') || el.tagName) + ' at ' +
    ['x', 'y', 'x1', 'y1', 'd'].map((a) => el.getAttribute(a)).filter(Boolean).join(',').slice(0, 40);

  const nodes = [], connectors = [];
  for (const el of svg.querySelectorAll('[data-calm]')) {
    const id = el.dataset.calm;
    if (el.matches(FLOWS)) {
      const a = point(el, 0), b = point(el, el.getTotalLength());
      const head = el.hasAttribute('marker-end'), tail = el.hasAttribute('marker-start');
      // Read tail to head. A lone marker-start means the line was drawn backwards.
      const back = tail && !head;
      connectors.push({ id, from: back ? b : a, to: back ? a : b, twoWay: head && tail, step: step(el) });
    } else {
      const outline = el.matches(SHAPES) ? el : [...el.querySelectorAll(SHAPES)].find((s) => !s.closest('.ico'));
      nodes.push({
        id, box: rect(el),
        outline: outline ? rect(outline) : null, shape: outline ? kind(outline) : null,
        texts: [...el.querySelectorAll('text')].map((t) => t.textContent.trim()),
        nested: !!el.parentElement.closest('[data-calm]'),
      });
    }
  }
  const loose = (sel) => [...svg.querySelectorAll(sel)].filter((el) => !el.closest('.ico') && !el.closest('[data-note]'));
  const untagged = [
    ...loose(SHAPES).filter((el) => !el.closest('[data-calm]')),
    ...loose(FLOWS).filter((el) => !el.hasAttribute('data-calm')),
  ].map(where);
  return { nodes, connectors, untagged, tol: 6 * scale };
})()`;

// The outline a node should be drawn with. A container's border follows how
// its children are held; everything else follows the node type.
function wantShape(node, model) {
  for (const r of model.relationships || []) {
    const s = relationshipShape(r);
    if (s.from !== node['unique-id']) continue;
    if (s.kind === 'deployed-in') return 'dashed zone';
    if (s.kind === 'composed-of') return 'solid container';
  }
  const type = node['node-type'];
  if (type === 'actor' || type === 'webclient') return 'rounded box';
  if (type === 'database' || type === 'ldap') return 'cylinder';
  if (type === 'data-asset') return 'document';
  if (type === 'network' || type === 'ecosystem') return 'dashed zone';
  return 'square box';
}

// Check (e): the drawing against its model. `d` is what CALM_PROBE read.
function checkDrawing(id, model, d) {
  const bad = (msg) => err('calm', `${id}: ${msg}`);
  const nodeIds = new Set(model.nodes.map((n) => n['unique-id']));
  const rels = new Map((model.relationships || []).map((r) => [r['unique-id'], relationshipShape(r)]));

  for (const u of d.untagged) bad(`untagged ${u} — tag it data-calm, move it into a node's group, or mark it data-note`);
  for (const n of d.nodes) {
    if (rels.has(n.id)) bad(`"${n.id}" is a relationship, but its data-calm is on a shape rather than a connector`);
    else if (!nodeIds.has(n.id)) bad(`data-calm="${n.id}" is not in the model`);
    if (n.nested) bad(`node "${n.id}" is nested inside another data-calm element`);
  }
  for (const c of d.connectors) {
    if (nodeIds.has(c.id)) bad(`"${c.id}" is a node, but its data-calm is on a connector`);
    else if (!rels.has(c.id)) bad(`data-calm="${c.id}" is not in the model`);
  }

  // Nodes: drawn once, under their name, in the outline their type calls for.
  const drawn = new Map();
  for (const node of model.nodes) {
    const nid = node['unique-id'];
    const hits = d.nodes.filter((n) => n.id === nid);
    if (hits.length !== 1) { bad(`node "${nid}" is drawn ${hits.length} times, want once`); continue; }
    const g = hits[0];
    drawn.set(nid, g);
    if (!g.texts.includes(node.name)) bad(`node "${nid}" has no label reading "${node.name}"`);
    const want = wantShape(node, model);
    if (!g.shape) bad(`node "${nid}" has no outline`);
    else if (g.shape !== want) bad(`node "${nid}" (${node['node-type']}) is drawn as a ${g.shape}, want a ${want}`);
  }

  const on = (p, nid) => {
    const g = drawn.get(nid);
    return !!g && p.x >= g.box.x - d.tol && p.x <= g.box.r + d.tol && p.y >= g.box.y - d.tol && p.y <= g.box.b + d.tol;
  };
  const inside = (a, b) => a.x >= b.x - d.tol && a.r <= b.r + d.tol && a.y >= b.y - d.tol && a.b <= b.b + d.tol;

  // Relationships: containment, or a connector between the right two nodes.
  const pool = new Map();   // relationship id -> its connectors, each with a direction
  for (const [rid, s] of rels) {
    if (s.kind === 'deployed-in' || s.kind === 'composed-of') {
      const outer = drawn.get(s.from);
      for (const child of s.to) {
        const inner = drawn.get(child);
        if (outer && inner && outer.outline && inner.outline && !inside(inner.outline, outer.outline)) {
          bad(`node "${child}" is drawn outside its container "${s.from}"`);
        }
      }
      continue;
    }
    const lines = d.connectors.filter((c) => c.id === rid);
    if (!lines.length) { bad(`relationship "${rid}" has no connector`); continue; }
    const reached = new Set();
    for (const c of lines) {
      const forward = s.to.find((n) => on(c.from, s.from) && on(c.to, n));
      const reverse = s.to.find((n) => on(c.from, n) && on(c.to, s.from));
      if (!forward && !reverse) { bad(`a "${rid}" connector does not run between "${s.from}" and ${s.to.map((n) => `"${n}"`).join(' or ')}`); continue; }
      reached.add(forward || reverse);
      c.dir = c.twoWay ? 'both' : forward ? 'forward' : 'reverse';
    }
    if (lines.every((c) => c.dir)) for (const n of s.to) if (!reached.has(n)) bad(`relationship "${rid}" has no connector reaching "${n}"`);
    pool.set(rid, lines.filter((c) => c.dir).sort((a, b) => (a.step ?? Infinity) - (b.step ?? Infinity)));
  }

  // The flow: each transition has a connector of its own in its direction,
  // and the tour lights them in the flow's order. A two-way arrow serves one
  // transition each way.
  const flow = (model.flows || [])[0];
  const lit = d.connectors.filter((c) => c.step !== null && rels.has(c.id));
  if (!flow && lit.length) bad(`the tour lights ${lit.length} connector(s) but the model has no flow`);
  let prev = 0;
  for (const t of flow ? flow.transitions : []) {
    const rid = t['relationship-unique-id'];
    const want = t.direction === 'destination-to-source' ? 'reverse' : 'forward';
    const n = t['sequence-number'];
    const c = (pool.get(rid) || []).find((x) => !x[want] && (x.dir === want || x.dir === 'both'));
    if (!c) { bad(`transition ${n} over "${rid}" has no ${want} connector of its own`); continue; }
    c[want] = true;
    if (c.step === null) bad(`transition ${n}'s connector is never lit by the tour`);
    else if (c.step < prev) bad(`flow order contradicts the tour: transition ${n} is first lit at step ${c.step}, after one lit at step ${prev}`);
    else prev = c.step;
  }
  for (const [rid, lines] of pool) for (const c of lines) {
    if (c.dir === 'reverse' && !c.reverse) bad(`a "${rid}" connector is drawn against the relationship's direction with no destination-to-source transition`);
  }
}
```

In the per-term loop, immediately before `for (const c of consoleErrors)    err('console',   \`${t.id}: ${c}\`);`, add:

```js
  // Check (e). A term without a model is skipped until every term has one.
  const model = CALM[t.id];
  if (model) checkDrawing(t.id, model, await page.evaluate(CALM_PROBE));

```

- [ ] **Step 6: Give the tour suite's replacement drawing a model**

`test/tour-fixtures.mjs` swaps in its own WireGuard drawing. Once WireGuard has a real model, that drawing would fail check (e), so it carries its own.

Add to the imports:

```js
import { readTerms, declSpan } from '../_terms.mjs';
```

After the `base` declaration, add:

```js
const { CALM } = readTerms(path.join(root, 'index.html'));

// The model of the fixture drawing below. Check (e) compares any modelled
// term's drawing with its model, and this suite replaces the drawing.
const FIXTURE_MODEL = {
  nodes: [
    { 'unique-id': 'peer-a', 'node-type': 'service', name: 'Peer A', description: 'One end of the tunnel.' },
    { 'unique-id': 'peer-b', 'node-type': 'service', name: 'Peer B', description: 'The other end of the tunnel.' },
  ],
  relationships: [
    { 'unique-id': 'tunnel', description: 'The peers exchange encrypted packets.', 'relationship-type': { connects: { source: { node: 'peer-a' }, destination: { node: 'peer-b' } } } },
  ],
  flows: [{
    'unique-id': 'exchange', name: 'Exchange', description: 'The peers exchange encrypted packets.',
    transitions: [{ 'relationship-unique-id': 'tunnel', 'sequence-number': 1, description: 'Peer A sends to peer B.' }],
  }],
};
```

Replace `withDiagram`:

```js
function withDiagram(html, svg) {
  html = html.replace(/ {4}wireguard: \(\) => `[\s\S]*?<\/svg>`/, `    wireguard: () => \`${svg}\``);
  const { from, end } = declSpan(html, 'CALM', '{', '}');
  return html.slice(0, from) + JSON.stringify({ ...CALM, wireguard: FIXTURE_MODEL }, null, 2) + html.slice(end + 1);
}
```

In the `svg` template, tag the two groups and the line:

```js
        <g data-s="1" data-calm="peer-a"><rect class="box" x="40" y="60" width="200" height="80" rx="10"/>\${icon('user', 56, 76)}<text class="t-b" x="92" y="94">Peer A</text>${nestBadge ? bdg : ''}</g>
        <g data-s="${b}" data-calm="peer-b"><rect class="box" x="480" y="60" width="200" height="80" rx="10"/><text class="t-b" x="500" y="94">Peer B</text></g>
        <line class="flow" data-s="3" data-calm="tunnel" x1="240" y1="100" x2="478" y2="100" marker-end="url(#ah-mut)"/>
```

- [ ] **Step 7: Run every suite**

Run: `npm run test:calm; echo "exit $?"`
Expected: every case `ok`, `exit 0`. If `good drawing verifies` reports a `clearance`, `collision` or `badge` finding, the fixture drawing's coordinates need a nudge, not the checker.

Run: `npm test; echo "exit $?"`, `npm run test:tour; echo "exit $?"`, `npm run test:takeaways; echo "exit $?"`, `npm run verify; echo "exit $?"`
Expected: all `exit 0`. The full `verify` proves the probe change left all 105 existing diagrams clean.

- [ ] **Step 8: Commit**

```bash
git add index.html verify.mjs test/calm-fixtures.mjs test/tour-fixtures.mjs
git commit -m "feat: add the CALM drawing grammar and its verify check

Two new node outlines, data-calm and data-note tags, and check (e), which
compares a rendered diagram with its model: shapes by node type, connectors
between the right nodes, containment, and the flow in the tour's order.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: The CALM model disclosure

**Files:**
- Modify: `index.html:452-463` (disclosure CSS), `index.html:619-625` (print CSS), `index.html` after `takeawaysHtml` (new functions), `detailHtml`, the detail click handler
- Modify: `_calm.mjs` (export `CALM_SCHEMA`)
- Modify: `verify.mjs` (flags, `--offline` route, `CALM_BOX_PROBE`, `checkDisclosure`, the per-term loop)
- Modify: `test/calm-fixtures.mjs` (disclosure cases)

**Interfaces:**
- Consumes: `page()`, `swap`, `CASES` from `test/calm-fixtures.mjs`; `checkDrawing`, the `model` variable in the per-term loop (Task 2).
- Produces, in `index.html`: `calmDoc(e) -> object`, `calmHtml(e) -> string`, `calmAction(btn)`; markup `details.calm-more[data-term]`, `button[data-calm-copy]`, `button[data-calm-download]`, `.calm-status`, `pre.calm-json`.
- Produces, in `_calm.mjs`: `CALM_SCHEMA = 'https://calm.finos.org/release/1.2/meta/calm.json'`.
- Produces, in `verify.mjs`: `--calm-out=<dir>`; `checkDisclosure(t, model)`.

- [ ] **Step 1: Add the disclosure fixtures**

Add to the end of `CASES` in `test/calm-fixtures.mjs`:

```js

  // The disclosure: what it shows, and what Copy, Download and print do.
  ['missing disclosure caught', () => swap(page(), '${calmHtml(e)}', ''), 'verify', 1, 'calm', /no "CALM model" disclosure/],
  ['disclosure starting open caught', () => swap(page(), '<details class="calm-more"', '<details open class="calm-more"'), 'verify', 1, 'calm', /open when the term opens/],
  ['disclosure JSON that differs from the model caught', () => swap(page(), '...CALM[e.id],', ''), 'verify', 1, 'calm', /does not match the model/],
  ['unescaped JSON caught',
    () => swap(page(), '<code>${esc(JSON.stringify(calmDoc(e), null, 2))}</code>', '<code>${JSON.stringify(calmDoc(e), null, 2)}</code>'),
    'verify', 1, 'calm', /parsed as markup/],
  ['download named for the wrong term caught', () => swap(page(), '`${box.dataset.term}.calm.json`', '"model.json"'), 'verify', 1, 'calm', /Download saves/],
  ['silent copy failure caught', () => swap(page(), '() => { status.textContent = "Copy failed"; }', '() => {}'), 'verify', 1, 'calm', /refused clipboard write/],
  ['print clipping caught',
    () => swap(page(), '.calm-json { max-height: none; overflow: visible; white-space: pre-wrap; }', ''), 'verify', 1, 'calm', /prints clipped/],
  ['JSON block not reachable by keyboard caught', () => swap(page(), 'class="calm-json" tabindex="0"', 'class="calm-json"'), 'verify', 1, 'calm', /keyboard/],
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npm run test:calm; echo "exit $?"`
Expected: the eight new cases FAIL with `fixture needle not found`, because the page has no disclosure yet. Earlier cases stay `ok`. `exit 1`.

- [ ] **Step 3: Add the disclosure CSS**

Replace the six `.explainer-more summary…` rules (lines 453–462) so both disclosures share them:

```css
    :is(.explainer-more, .calm-more) summary {
      display: inline-flex; align-items: center; gap: var(--space-2);
      color: var(--text-muted); font-size: var(--fs-small); font-weight: 700;
      cursor: pointer; list-style: none;
    }
    :is(.explainer-more, .calm-more) summary::-webkit-details-marker { display: none; }
    :is(.explainer-more, .calm-more) summary:hover { color: var(--accent); }
    :is(.explainer-more, .calm-more) summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: var(--radius); }
    :is(.explainer-more, .calm-more) summary svg { width: 16px; height: 16px; transition: transform var(--transition); }
    :is(.explainer-more, .calm-more)[open] summary svg { transform: rotate(90deg); }
```

After the `.explainer-more .explainer { … }` line, add:

```css

    /* The CALM model behind the diagram: collapsed, with the JSON in a block
       that scrolls inside itself so the page never scrolls sideways. */
    .calm-more { margin-top: var(--space-4); }
    .calm-body { margin-top: var(--space-4); }
    .calm-body p { max-width: 68ch; margin-bottom: var(--space-3); font-size: var(--fs-small); }
    .calm-counts { font-family: var(--font-mono); }
    .calm-counts, .calm-key, .calm-status { color: var(--text-muted); }
    .calm-actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); margin-bottom: var(--space-4); }
    .calm-status { font-size: var(--fs-small); }
    .calm-json {
      margin: 0; padding: var(--space-4); max-height: 420px; overflow: auto;
      background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg);
      font-size: 12px; line-height: 1.5;
    }
    .calm-json:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
```

In the `@media print { … }` block, after `.takeaway { break-inside: avoid; }`, add:

```css
      .calm-json { max-height: none; overflow: visible; white-space: pre-wrap; }
      .calm-actions { display: none; }
```

- [ ] **Step 4: Render the disclosure**

After the closing brace of `takeawaysHtml` and before `function detailHtml(e) {`, add:

```js

  // The model as a reader gets it: the stored model, the schema it follows,
  // and which glossary entry it describes.
  function calmDoc(e) {
    return {
      "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
      ...CALM[e.id],
      "metadata": { "term": e.term, "glossary-id": e.id, "caption": e.caption, "source": e.source.url }
    };
  }
  // The CALM model, collapsed under the explainer. A term with no model yet
  // gets no disclosure.
  function calmHtml(e) {
    const m = CALM[e.id];
    if (!m) return "";
    const count = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
    const steps = (m.flows || []).reduce((n, f) => n + f.transitions.length, 0);
    return `
      <details class="calm-more" data-term="${e.id}">
        <summary>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
          CALM model
        </summary>
        <div class="calm-body">
          <p>This diagram as architecture as code: a model in the FINOS <a href="https://calm.finos.org/" target="_blank" rel="noopener noreferrer">Common Architecture Language Model</a> (CALM), release 1.2.</p>
          <p class="calm-counts">${count(m.nodes.length, "node")} · ${count(m.relationships.length, "relationship")} · ${count(steps, "flow step")}</p>
          <p class="calm-key">Rounded box: actor or client. Square box: service or system. Cylinder: data store. Folded document: data asset. Dashed zone: deployed in. Solid container: composed of.</p>
          <div class="calm-actions">
            <button class="related-pill" type="button" data-calm-copy>Copy</button>
            <button class="related-pill" type="button" data-calm-download>Download</button>
            <span class="calm-status" aria-live="polite"></span>
          </div>
          <pre class="calm-json" tabindex="0" role="region" aria-label="CALM model, JSON"><code>${esc(JSON.stringify(calmDoc(e), null, 2))}</code></pre>
        </div>
      </details>`;
  }
  // Copy or download the model exactly as the disclosure shows it.
  function calmAction(btn) {
    const box = btn.closest(".calm-more");
    const text = box.querySelector(".calm-json").textContent;
    if (btn.hasAttribute("data-calm-copy")) {
      const status = box.querySelector(".calm-status");
      navigator.clipboard.writeText(text).then(
        () => { status.textContent = "Copied"; },
        () => { status.textContent = "Copy failed"; });
      return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text + "\n"], { type: "application/json" }));
    a.download = `${box.dataset.term}.calm.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
  }
```

In `detailHtml`, replace:

```js
      ${takeawaysHtml(e)}
```

With:

```js
      ${takeawaysHtml(e)}
      ${calmHtml(e)}
```

In the detail click handler (`els.detailContent.addEventListener("click", (ev) => {`), add as its first two lines:

```js
    const calmBtn = ev.target.closest("[data-calm-copy], [data-calm-download]");
    if (calmBtn) { calmAction(calmBtn); return; }
```

- [ ] **Step 5: Check the disclosure in `verify.mjs`**

In `_calm.mjs`, after the `TOP_LEVEL` constant, add:

```js
// The schema every model the page shows or downloads declares.
export const CALM_SCHEMA = 'https://calm.finos.org/release/1.2/meta/calm.json';
```

In `verify.mjs`, replace the `_calm.mjs` import:

```js
import { relationshipShape, CALM_SCHEMA } from './_calm.mjs';
```

Extend the usage comment with a line after `--offline`:

```js
//   node verify.mjs --calm-out=<dir> # also save each term's CALM download there
```

Replace the unknown-flag guard and add the new flag after `targetFlag`:

```js
const unknownFlag = args.find(
  (a) => a.startsWith('-') && !KNOWN_FLAGS.includes(a) && !a.startsWith('--target=') && !a.startsWith('--calm-out=')
);
```

```js
const calmOutFlag = args.find((a) => a.startsWith('--calm-out='));
const calmOut = calmOutFlag ? path.resolve(calmOutFlag.slice('--calm-out='.length)) : null;
if (calmOut) fs.mkdirSync(calmOut, { recursive: true });
```

Add `[--calm-out=<dir>]` to the first `--help` line.

In the `--offline` block, let a blob through, since the model download is one:

```js
  await page.route((url) => url.protocol !== 'file:' && url.protocol !== 'blob:', (route) => route.fulfill({
```

After `checkDrawing`, add:

```js
// Reads the "CALM model" disclosure as rendered. `markup` counts the elements
// inside the JSON block: one, the <code>, unless the JSON was parsed as HTML.
const CALM_BOX_PROBE = `(() => {
  const d = document.querySelector('#detail-content .calm-more');
  if (!d) return { present: false };
  const pre = d.querySelector('.calm-json');
  const prev = d.previousElementSibling;
  return {
    present: true, open: d.open,
    text: pre ? pre.textContent : '',
    markup: pre ? pre.querySelectorAll('*').length : 0,
    copy: !!d.querySelector('button[data-calm-copy]'),
    download: !!d.querySelector('button[data-calm-download]'),
    afterExplainer: !!(prev && prev.matches('.explainer-more')),
    focusable: !!pre && pre.tabIndex === 0 && pre.getAttribute('role') === 'region' && !!pre.getAttribute('aria-label'),
    overflow: d.scrollWidth > d.clientWidth + 1 || d.getBoundingClientRect().right > document.documentElement.clientWidth + 1,
    clipped: !!pre && pre.scrollHeight > pre.clientHeight + 1,
  };
})()`;

// Presses Copy twice against a stubbed clipboard, one that accepts and one
// that refuses, and reports the status line each time. A headless browser's
// own clipboard proves nothing; the wiring is what is under test.
const COPY_PROBE = `(async () => {
  const root = document.querySelector('#detail-content .calm-more');
  const wrote = [];
  const press = async () => { root.querySelector('[data-calm-copy]').click(); await new Promise((r) => setTimeout(r, 0)); return root.querySelector('.calm-status').textContent; };
  const stub = (writeText) => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  stub((s) => { wrote.push(s); return Promise.resolve(); });
  const ok = await press();
  stub(() => Promise.reject(new Error('denied')));
  const refused = await press();
  return { ok, refused, wrote: wrote[0] };
})()`;

// The disclosure for one term: what it shows, and what print, Copy and
// Download do with it. Leaves it open, at 1440px.
async function checkDisclosure(t, model) {
  const bad = (msg) => err('calm', `${t.id}: ${msg}`);
  const want = { $schema: CALM_SCHEMA, ...model, metadata: { term: t.term, 'glossary-id': t.id, caption: t.caption, source: t.source.url } };

  let box = await page.evaluate(CALM_BOX_PROBE);
  if (!box.present) { bad('no "CALM model" disclosure'); return; }
  if (box.open) bad('the CALM disclosure is open when the term opens');
  if (!box.afterExplainer) bad('the CALM disclosure does not sit directly after the full explainer');
  if (box.markup !== 1) bad('the model JSON was parsed as markup');
  let shown = null;
  try { shown = JSON.parse(box.text); } catch { bad("the disclosure's JSON does not parse"); }
  if (shown && JSON.stringify(shown) !== JSON.stringify(want)) bad("the disclosure's JSON does not match the model, its $schema and its metadata");
  if (!box.focusable) bad('the JSON block cannot be reached by keyboard: it needs tabindex="0", role="region" and an aria-label');
  if (!box.copy || !box.download) { bad('the disclosure needs a Copy and a Download button'); return; }

  // Print leaves a closed disclosure closed.
  const opened = await page.evaluate(`(() => {
    window.dispatchEvent(new Event('beforeprint'));
    const open = document.querySelector('#detail-content .calm-more').open;
    window.dispatchEvent(new Event('afterprint'));
    return open;
  })()`);
  if (opened) bad('printing opens the CALM disclosure');

  await page.click('#detail-content .calm-more summary');
  box = await page.evaluate(CALM_BOX_PROBE);
  if (!box.open) { bad('clicking "CALM model" does not open it'); return; }
  if (box.overflow) bad('the open disclosure overflows at 1440px');

  // An open one prints whole, not clipped to its scroll box.
  await page.emulateMedia({ media: 'print' });
  if ((await page.evaluate(CALM_BOX_PROBE)).clipped) bad('an open CALM disclosure prints clipped — the JSON block must print whole');
  await page.emulateMedia({ media: null });

  const copied = await page.evaluate(COPY_PROBE);
  if (copied.ok !== 'Copied' || copied.wrote !== box.text) bad('Copy does not put the JSON on the clipboard and say "Copied"');
  if (copied.refused !== 'Copy failed') bad(`a refused clipboard write is not reported (status "${copied.refused}", want "Copy failed")`);

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 5000 }),
    page.click('#detail-content [data-calm-download]'),
  ]).catch(() => [null]);
  if (!download) bad('Download does not start a download');
  else {
    const name = download.suggestedFilename();
    if (name !== `${t.id}.calm.json`) bad(`Download saves "${name}", want "${t.id}.calm.json"`);
    if (calmOut) await download.saveAs(path.join(calmOut, `${t.id}.calm.json`));
    else await download.cancel();
  }

  await page.setViewportSize({ width: 375, height: 812 });
  if ((await page.evaluate(CALM_BOX_PROBE)).overflow) bad('the open disclosure overflows at 375px');
  await page.setViewportSize({ width: 1440, height: 1200 });
}
```

In the per-term loop, replace the Task 2 lines:

```js
  const model = CALM[t.id];
  if (model) checkDrawing(t.id, model, await page.evaluate(CALM_PROBE));
```

With:

```js
  const model = CALM[t.id];
  if (model) {
    checkDrawing(t.id, model, await page.evaluate(CALM_PROBE));
    await checkDisclosure(t, model);
  }
```

- [ ] **Step 6: Run every suite**

Run: `npm run test:calm; echo "exit $?"`
Expected: every case `ok`, `exit 0`.

Run: `npm test; echo "exit $?"`, `npm run test:tour; echo "exit $?"`, `npm run test:takeaways; echo "exit $?"`, `npm run verify; echo "exit $?"`
Expected: all `exit 0`. The tour suite's good case now also exercises the disclosure, because its replacement drawing has a model.

- [ ] **Step 7: Commit**

```bash
git add index.html _calm.mjs verify.mjs test/calm-fixtures.mjs
git commit -m "feat: add the CALM model disclosure

A closed disclosure under the explainer shows each term's model as JSON with
Copy and Download. verify.mjs checks it against the stored model, and that
print, the clipboard and the download behave. --calm-out saves the downloads.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Skill and CLAUDE.md describe the model step

**Files:**
- Modify: `.claude/skills/add-glossary-term/SKILL.md` (step 2 shapes line, new step 2b, step 6)
- Modify: `CLAUDE.md` (Verification)

**Interfaces:**
- Consumes: the grammar from Task 2 and the disclosure from Task 3.
- Produces: step 2b of the skill, which Tasks 5 to 16 follow for every term.

- [ ] **Step 1: Update the shapes line in step 2 of the skill**

Replace:

```markdown
- shapes — `box`, `box-accent`, `zone-accent`
```

With:

```markdown
- shapes — `box`, `box-accent`, `box-soft`, `zone`, `zone-accent`, and two outlines that
  are not a rect: `${cyl(x, y, w, h)}` for a data store and `${doc(x, y, w, h)}` for a
  data asset. Both take `'box-accent'` as a fifth argument. Which one a node gets is set
  by its CALM node type: see step 2b.
```

- [ ] **Step 2: Add step 2b after step 2**

Insert before `## 3. Cross-link`:

````markdown
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
`description` is one sentence that says only what the explainer says. Pick the built-in
`node-type` that honestly fits; otherwise use a custom kebab-case type such as `layer`.
The type sets the outline:

| Node type | Outline |
|---|---|
| `actor`, `webclient` | `<rect class="box" … rx="12"/>` |
| `service`, `system`, any custom type | `<rect class="box" … rx="8"/>` |
| `database`, `ldap` | `${cyl(x, y, w, h)}` |
| `data-asset` | `${doc(x, y, w, h)}` |
| `network`, `ecosystem` | `<rect class="zone" …/>` |
| a container through `deployed-in` | `<rect class="zone" …/>`, whatever its type |
| a container through `composed-of` | `<rect class="box-soft" …/>`, whatever its type |

**Relationships.** Use `connects` (source to destination) between two nodes,
`interacts` (actor to node) for an actor and what it uses, `deployed-in` for a node that
runs inside another, `composed-of` for a node that is a part of another. A request and
its reply are one relationship. Set `protocol` only if it is one of CALM's twelve (HTTP,
HTTPS, FTP, SFTP, JDBC, WebSocket, SocketIO, LDAP, AMQP, TLS, mTLS, TCP); otherwise name
the protocol in the description. Every node must appear in at least one relationship. A
node is a container through one of the two kinds, never both.

**Flow.** Write one flow if any tour step lights a connector, none otherwise. List the
transitions in the order the tour lights their connectors, numbered 1 to N. A reply is a
transition with `"direction": "destination-to-source"`. Each transition needs a
connector of its own drawn in its direction; a two-way arrow serves one transition each
way.

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
  architecture and says so: `data-note="call-out"` on it or its group. Use it for
  call-out boxes, footer strips, elided rows, self-loops and the struck-through X.
  Free text, dividers and badges need no tag.

If the drawing disagrees with the explainer, the drawing changes. If the model shows
the explainer itself may be wrong, report it; do not edit the explainer here.
````

- [ ] **Step 3: Add check (e) to step 6 of the skill**

After the `- **(d) Takeaway tiles** …` bullet, add:

```markdown
- **(e) CALM model** — every node drawn once under its name, in the outline its type
  calls for; every `connects` and `interacts` relationship drawn as a connector between
  the right two nodes; contained nodes inside their container; the flow in the tour's
  order; nothing with a `box`, `zone` or `flow` class left untagged. It also checks the
  "CALM model" disclosure: its JSON, Copy, Download and print.
```

After the sentence `It also re-checks the step 4 counters, so a bare \`npm run verify\` catches drift you missed.`, add a paragraph:

````markdown
`npm test` checks the model itself: it validates against the vendored CALM 1.2 schema,
and its ids and references hold. To check a model with FINOS's own tool, save the
downloads and run the CLI over one:

```bash
node verify.mjs <id> --calm-out=/path/outside/the/repo
npx --yes @finos/calm-cli@1.60.1 validate -a /path/outside/the/repo/<id>.calm.json
```
````

- [ ] **Step 4: Update the Verification section of `CLAUDE.md`**

In the code block, add after the `test:takeaways` line:

```bash
npm run test:calm     # proves validate/verify catch broken CALM models and drawings
```

At the end of the paragraph that begins `` `validate.mjs` is the style-guide linter ``, add this sentence before "A project hook runs it":

```markdown
It validates every model in `CALM` against the vendored CALM 1.2 schema
(`test/calm-schema/1.2/`, through `ajv`) and checks its references.
```

At the end of the paragraph that begins `` `verify.mjs` is the rendered check ``, before "Pass term ids to narrow it", add:

```markdown
For a term with a CALM model it compares the drawing with the model (shapes, connectors,
containment, flow order) and checks the model disclosure.
```

Change `The two fixture suites run` to `The three fixture suites run`.

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/add-glossary-term/SKILL.md CLAUDE.md
git commit -m "docs: describe the CALM model step in the skill and CLAUDE.md

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Phase 2: pilot

### Task 5: Model and redraw the five pilot diagrams

**Files:**
- Modify: `index.html`: the `CALM` map, and `DIAGRAMS.dns`, `DIAGRAMS.kubernetes`, `DIAGRAMS.oauth`, `DIAGRAMS.jwt`, `DIAGRAMS.owasp`

**Interfaces:**
- Consumes: `cyl`, `doc`, `data-calm`, `data-note` (Task 2); the disclosure and `--calm-out` (Task 3); step 2b of the skill (Task 4); the capture script in the appendix.

The pilots cover one each of: a flow with a reply (DNS), `deployed-in` containment (Kubernetes), an actor and a multi-party sequence (OAuth), `composed-of` anatomy with no flow (JWT), and the stretch case (OWASP).

- [ ] **Step 1: Record the starting size**

Run: `wc -c index.html`
Note the number for step 9.

- [ ] **Step 2: DNS**

Add to `CALM`:

```js
    dns: {
      "nodes": [
        { "unique-id": "client", "node-type": "actor", "name": "Client", "description": "Needs the IP address behind a human-readable name such as example.com." },
        { "unique-id": "resolver", "node-type": "service", "name": "Resolver", "description": "Walks the hierarchy and caches answers along the way to stay fast." },
        { "unique-id": "root", "node-type": "service", "name": "Root servers", "description": "The first level of the hierarchy the resolver walks." },
        { "unique-id": "tld", "node-type": "service", "name": "TLD", "description": "The server for the top-level domain, the second level of the hierarchy." },
        { "unique-id": "authoritative", "node-type": "service", "name": "Authoritative", "description": "The authoritative server for the domain, the last level of the hierarchy." },
        { "unique-id": "cache", "node-type": "database", "name": "Cache", "description": "Answers the resolver has cached to stay fast." }
      ],
      "relationships": [
        { "unique-id": "client-resolver", "description": "The client asks the resolver to resolve a name into an IP address.",
          "relationship-type": { "interacts": { "actor": "client", "nodes": ["resolver"] } } },
        { "unique-id": "resolver-root", "description": "The resolver asks the root servers.",
          "relationship-type": { "connects": { "source": { "node": "resolver" }, "destination": { "node": "root" } } } },
        { "unique-id": "resolver-tld", "description": "The resolver asks the server for the top-level domain.",
          "relationship-type": { "connects": { "source": { "node": "resolver" }, "destination": { "node": "tld" } } } },
        { "unique-id": "resolver-authoritative", "description": "The resolver asks the authoritative server for the domain.",
          "relationship-type": { "connects": { "source": { "node": "resolver" }, "destination": { "node": "authoritative" } } } },
        { "unique-id": "resolver-cache", "description": "The resolver caches answers along the way.",
          "relationship-type": { "connects": { "source": { "node": "resolver" }, "destination": { "node": "cache" } } } }
      ],
      "flows": [
        { "unique-id": "resolve", "name": "Recursive resolution",
          "description": "The resolver walks root, TLD, then authoritative, and caches the answer.",
          "transitions": [
            { "relationship-unique-id": "client-resolver", "sequence-number": 1, "description": "The client asks the resolver for the IP address behind a name." },
            { "relationship-unique-id": "resolver-root", "sequence-number": 2, "description": "The resolver starts with the root servers." },
            { "relationship-unique-id": "resolver-tld", "sequence-number": 3, "description": "Next it asks the server for the top-level domain." },
            { "relationship-unique-id": "resolver-authoritative", "sequence-number": 4, "description": "Last it reaches the authoritative server for the domain." },
            { "relationship-unique-id": "resolver-cache", "sequence-number": 5, "description": "The resolver caches the answer." },
            { "relationship-unique-id": "client-resolver", "sequence-number": 6, "description": "The resolver returns the IP address to the client.", "direction": "destination-to-source" }
          ] }
      ]
    },
```

Reshape `DIAGRAMS.dns`:
- Add `data-calm` to the Client and Resolver groups (`client`, `resolver`). In the server `.map`, add an id to each row (`root`, `tld`, `authoritative`) and emit it as `data-calm`.
- Replace the "cached answer" rect with `${cyl(314, 216, 128, 48)}` and a single `<text class="t-b">Cache</text>` inside it; tag the group `cache`. Raise the `viewBox` height if the cylinder needs the room.
- Tag the Client to Resolver line and the reply line `client-resolver`, the three two-way lines `resolver-root`, `resolver-tld`, `resolver-authoritative`, and the Resolver to Cache line `resolver-cache`.
- The "IP address" label stays as free text.

- [ ] **Step 3: Kubernetes**

Add to `CALM`:

```js
    kubernetes: {
      "nodes": [
        { "unique-id": "desired-state", "node-type": "data-asset", "name": "Desired state", "description": "What you declare: how many replicas, which images, what networking." },
        { "unique-id": "control-plane", "node-type": "service", "name": "Control plane", "description": "Continuously reconciles reality to match the desired state." },
        { "unique-id": "worker-1", "node-type": "system", "name": "worker node 1", "description": "A machine in the cluster that runs pods." },
        { "unique-id": "worker-2", "node-type": "system", "name": "worker node 2", "description": "A machine in the cluster that runs pods." },
        { "unique-id": "pod-scheduled-1", "node-type": "service", "name": "Pod", "description": "A pod, the smallest deployable unit, scheduled onto worker node 1." },
        { "unique-id": "pod-failed", "node-type": "service", "name": "Pod", "description": "A pod whose workload has failed." },
        { "unique-id": "pod-on-demand", "node-type": "service", "name": "Pod", "description": "A pod added when the control plane scales on demand." },
        { "unique-id": "pod-scheduled-2", "node-type": "service", "name": "Pod", "description": "A pod, the smallest deployable unit, scheduled onto worker node 2." },
        { "unique-id": "pod-rescheduled", "node-type": "service", "name": "Pod", "description": "The failed workload, rescheduled by the control plane." }
      ],
      "relationships": [
        { "unique-id": "declare", "description": "The desired state is declared to the control plane.",
          "relationship-type": { "connects": { "source": { "node": "desired-state" }, "destination": { "node": "control-plane" } } } },
        { "unique-id": "schedule-1", "description": "The control plane schedules pods onto worker node 1.",
          "relationship-type": { "connects": { "source": { "node": "control-plane" }, "destination": { "node": "worker-1" } } } },
        { "unique-id": "schedule-2", "description": "The control plane schedules pods onto worker node 2.",
          "relationship-type": { "connects": { "source": { "node": "control-plane" }, "destination": { "node": "worker-2" } } } },
        { "unique-id": "worker-1-pods", "description": "Pods run on worker node 1.",
          "relationship-type": { "deployed-in": { "container": "worker-1", "nodes": ["pod-scheduled-1", "pod-failed", "pod-on-demand"] } } },
        { "unique-id": "worker-2-pods", "description": "Pods run on worker node 2.",
          "relationship-type": { "deployed-in": { "container": "worker-2", "nodes": ["pod-scheduled-2", "pod-rescheduled"] } } }
      ],
      "flows": [
        { "unique-id": "reconcile", "name": "Declare and schedule",
          "description": "The control plane reconciles desired state, scheduling pods onto worker nodes.",
          "transitions": [
            { "relationship-unique-id": "declare", "sequence-number": 1, "description": "You declare the desired state." },
            { "relationship-unique-id": "schedule-1", "sequence-number": 2, "description": "The control plane schedules pods onto worker node 1." },
            { "relationship-unique-id": "schedule-2", "sequence-number": 3, "description": "The control plane schedules pods onto worker node 2." }
          ] }
      ]
    },
```

Reshape `DIAGRAMS.kubernetes`:
- "Desired state" becomes `${doc(24, 16, 196, 96)}`, tagged `desired-state`. Tag the Control plane group `control-plane`.
- Add an id to each row of the worker `.map` (`worker-1`, `worker-2`) and of the pod `.map` (in order: `pod-scheduled-1`, `pod-failed`, `pod-on-demand`, `pod-scheduled-2`, `pod-rescheduled`), emitted as `data-calm`.
- Tag the Desired state to Control plane line `declare`, and the two Control plane to worker lines `schedule-1` and `schedule-2`.
- The reconcile loop path gets `data-note="reconcile loop"`. The failed-to-rescheduled line gets `data-note="rescheduled as"`. Neither is a relationship between two components.

- [ ] **Step 4: OAuth**

Add to `CALM`:

```js
    oauth: {
      "nodes": [
        { "unique-id": "user", "node-type": "actor", "name": "You", "description": "Logs in and consents, without handing the app any credentials." },
        { "unique-id": "app", "node-type": "system", "name": "App", "description": "Receives a token to call the API on your behalf." },
        { "unique-id": "authz", "node-type": "service", "name": "Authorisation server", "description": "The resource's authorisation server, which issues the scoped, revocable access token." },
        { "unique-id": "api", "node-type": "service", "name": "API", "description": "The resource the app calls on your behalf." }
      ],
      "relationships": [
        { "unique-id": "user-app", "description": "You use the app, which redirects you to log in.",
          "relationship-type": { "interacts": { "actor": "user", "nodes": ["app"] } } },
        { "unique-id": "user-authz", "description": "You log in to the authorisation server and consent.",
          "relationship-type": { "interacts": { "actor": "user", "nodes": ["authz"] } } },
        { "unique-id": "app-authz", "description": "The app receives a scoped, revocable access token from the authorisation server.",
          "relationship-type": { "connects": { "source": { "node": "app" }, "destination": { "node": "authz" } } } },
        { "unique-id": "app-api", "description": "The app calls the API with the token.",
          "relationship-type": { "connects": { "source": { "node": "app" }, "destination": { "node": "api" } } } }
      ],
      "flows": [
        { "unique-id": "authorisation-code", "name": "Authorisation-code flow",
          "description": "The user consents and the app receives a scoped access token.",
          "transitions": [
            { "relationship-unique-id": "user-app", "sequence-number": 1, "description": "The app redirects you to the authorisation server.", "direction": "destination-to-source" },
            { "relationship-unique-id": "user-authz", "sequence-number": 2, "description": "You log in." },
            { "relationship-unique-id": "user-authz", "sequence-number": 3, "description": "You consent to what the app may do." },
            { "relationship-unique-id": "app-authz", "sequence-number": 4, "description": "The authorisation server issues the app a scoped, revocable access token.", "direction": "destination-to-source" },
            { "relationship-unique-id": "app-api", "sequence-number": 5, "description": "The app uses the token to call the API on your behalf." }
          ] }
      ]
    },
```

Reshape `DIAGRAMS.oauth`:
- Tag the four groups `user`, `app`, `authz`, `api`.
- The authorisation server's title is two `<text>` lines today. Make it one, `Authorisation server`, and widen the box to fit, moving the lines that meet it.
- Tag the App to You "redirect" line `user-app`, the "log in" and "consent" lines `user-authz`, the "scoped access token" line `app-authz`, and the "calls the API" line `app-api`.

- [ ] **Step 5: JWT**

Add to `CALM`:

```js
    jwt: {
      "nodes": [
        { "unique-id": "jwt", "node-type": "data-asset", "name": "JSON Web Token", "description": "Packs claims into three base64url-encoded parts." },
        { "unique-id": "header", "node-type": "data-asset", "name": "header", "description": "The first of the three base64url-encoded parts." },
        { "unique-id": "payload", "node-type": "data-asset", "name": "payload", "description": "Carries the claims: who you are, what you may do, when it expires." },
        { "unique-id": "signature", "node-type": "data-asset", "name": "signature", "description": "Lets anyone with the verification key confirm the token has not been tampered with." }
      ],
      "relationships": [
        { "unique-id": "jwt-parts", "description": "A JSON Web Token is made of a header, a payload and a signature.",
          "relationship-type": { "composed-of": { "container": "jwt", "nodes": ["header", "payload", "signature"] } } }
      ]
    },
```

Reshape `DIAGRAMS.jwt`:
- Add a container group tagged `jwt`: a `<rect class="box-soft" …/>` around the three parts with the label `JSON Web Token`. Move the parts down inside it and everything below them down by the same amount; raise the `viewBox` height to match.
- The three parts become `${doc(…)}` outlines, tagged `header`, `payload`, `signature`. Move each badge off the folded corner.
- "Claims", "Verify" and the bottom strip are explanation, not components: `data-note="call-out"` on each group and on the two arrows that lead to Claims and Verify.
- This model has no flow: the tour lights parts and call-outs, never a connector between components.

- [ ] **Step 6: OWASP**

Add to `CALM`:

```js
    owasp: {
      "nodes": [
        { "unique-id": "top10", "node-type": "data-asset", "name": "OWASP Top 10:2025", "description": "A periodically updated, ranked list of the most critical web application security risks." },
        { "unique-id": "risk-1", "node-type": "risk", "name": "1 · Broken Access Control", "description": "Kept at number one in the 2025 edition." },
        { "unique-id": "risk-3", "node-type": "risk", "name": "3 · Software Supply Chain Failures", "description": "Enters at number three, expanded from 2021's Vulnerable and Outdated Components." },
        { "unique-id": "developers", "node-type": "actor", "name": "Developers", "description": "Code against the list." },
        { "unique-id": "waf-rules", "node-type": "service", "name": "WAF rule sets", "description": "WAFs ship rule sets named after the list." },
        { "unique-id": "auditors", "node-type": "actor", "name": "Auditors", "description": "Check for it." }
      ],
      "relationships": [
        { "unique-id": "top10-risks", "description": "The list ranks the risks.",
          "relationship-type": { "composed-of": { "container": "top10", "nodes": ["risk-1", "risk-3"] } } },
        { "unique-id": "developers-top10", "description": "Developers code against the list.",
          "relationship-type": { "interacts": { "actor": "developers", "nodes": ["top10"] } } },
        { "unique-id": "waf-top10", "description": "WAF rule sets are named after the list.",
          "relationship-type": { "connects": { "source": { "node": "waf-rules" }, "destination": { "node": "top10" } } } },
        { "unique-id": "auditors-top10", "description": "Auditors check for it.",
          "relationship-type": { "interacts": { "actor": "auditors", "nodes": ["top10"] } } }
      ],
      "flows": [
        { "unique-id": "baseline", "name": "A shared baseline",
          "description": "The list is used everywhere as a baseline.",
          "transitions": [
            { "relationship-unique-id": "developers-top10", "sequence-number": 1, "description": "Developers code against it." },
            { "relationship-unique-id": "waf-top10", "sequence-number": 2, "description": "WAFs ship rule sets named after it." },
            { "relationship-unique-id": "auditors-top10", "sequence-number": 3, "description": "Auditors check for it." }
          ] }
      ]
    },
```

Reshape `DIAGRAMS.owasp`:
- The list's dashed `zone` becomes a solid `box-soft`, tagged `top10`. Rows 1 and 3 are tagged `risk-1` and `risk-3`. The "2 · …" and "4 to 10 · …" rows get `data-note="elided rows"`.
- Developers and Auditors are actors: `rx="12"`. Add an id to each row of the consumer `.map` (`developers`, `waf-rules`, `auditors`).
- Reverse the three arrows so each runs from the consumer to the list, and tag them `developers-top10`, `waf-top10`, `auditors-top10`. Move badge 4 if the arrowheads now sit under it.
- The bottom strip gets `data-note="limitation"`.
- This is the stretch case: a ranked list is valid CALM here, but of little use to a CALM tool. Say so in the summary.

- [ ] **Step 7: Gates for each pilot**

After each of steps 2 to 6, run: `npm test; echo "exit $?"` then `npm run verify <id>; echo "exit $?"`
Expected: both `exit 0`. Fix every `calm`, `clearance`, `collision`, `badge` and `tour` finding before the next pilot. If the endpoint tolerance (6 viewBox units in `CALM_PROBE`) rejects a connector that plainly meets its node, move the connector's end; change the tolerance only if several pilots need it, and say so in the summary.

- [ ] **Step 8: Read the captures**

Run the capture script from the appendix for `dns kubernetes oauth jwt owasp`, then read all twenty images. For each term check:
- every shape reads as what the model says it is, and the new outlines sit well with their labels and icons
- the fully lit drawing still tells the explainer's story
- light and dark are both legible
- the open disclosure shows the counts, the key and the JSON, and nothing overflows

- [ ] **Step 9: Cross-check with the official CLI and measure**

Use a fresh directory in your scratchpad for `OUT`:

```bash
OUT=<scratchpad>/calm-out-pilot
node verify.mjs dns kubernetes oauth jwt owasp --calm-out="$OUT"; echo "verify exit $?"
for f in "$OUT"/*.calm.json; do npx --yes @finos/calm-cli@1.60.1 validate -a "$f" > "$f.report" 2>/dev/null; echo "$(basename "$f") exit $?"; done
grep -L '"hasErrors": false' "$OUT"/*.report; grep -L '"hasWarnings": false' "$OUT"/*.report
wc -c index.html
```

Expected: `verify exit 0`; five lines ending `exit 0`; the two `grep -L` commands print nothing. Work out bytes added per model from the two `wc -c` figures and multiply by 105 for the projected growth.

- [ ] **Step 10: Full gates and commit**

Run: `npm test; echo "exit $?"`, `npm run test:calm; echo "exit $?"`, `npm run test:tour; echo "exit $?"`, `npm run test:takeaways; echo "exit $?"`, `npm run verify; echo "exit $?"`, `npm run glossary`
Expected: all `exit 0`; `wrote 105 terms`; `git status --short glossary.txt` prints nothing.

```bash
git add index.html
git commit -m "feat: redraw the pilot diagrams to their CALM models

DNS, Kubernetes, OAuth, JWT and the OWASP Top 10: a flow with a reply,
deployed-in containment, an actor in a sequence, composed-of anatomy with no
flow, and a ranked list as the stretch case.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 11: Pilot review gate.** Stop. Give James: the twenty captures, the five `.calm.json` files, the CLI result, the measured and projected growth of `index.html`, every `data-note` used and why, and the two thin models (JWT has one relationship; OWASP is a list). He views the site on a Chromebook, so offer to publish the captures as a private page or to push on his say-so. Any change he asks for is made in Tasks 2 to 4's code, the skill and the five pilots, and committed, before Phase 3 starts.

---

## Phase 3: batches

Every batch follows "Appendix: batch procedure". Where a batch task's steps and the
appendix differ, the appendix is right.

The pilot review changed six rules after this plan was written: actors are drawn at
`rx="20"`, `actor` is for people and organisations only, a custom type replaces a
built-in name that collides, a two-way arrow needs a transition each way, `data-note`
takes one of six values, and descriptions never lean on "it". Step 2b of the skill and
the spec carry the rules as they stand; where the pilot models printed in Task 5 differ
from `index.html`, `index.html` is right.

Eleven batches, by first-listed domain. Each task restates the procedure so it can be run alone. For every term the rules are in step 2b of `.claude/skills/add-glossary-term/SKILL.md`, and the five pilots in `index.html` are the worked examples.

"Reshape" means: keep every part of the layout that already agrees with the model; redraw what does not (an outline that contradicts its node type, a connector with no relationship, a relationship with no connector, a child outside its container, a shared trunk, a title on two lines); tag every node and connector; mark the rest `data-note`. Leave `steps`, `fact`, `caption` and `takeaways` alone unless the redraw makes one false.

### Task 6: Addressing & Routing (5)

Ids: `tcpip bgp vlan nat dhcp`

- [ ] **Step 1:** For each id, write its model in `CALM` from the explainer, then reshape and tag its `DIAGRAMS` function.
- [ ] **Step 2:** Per id: `npm test; echo "exit $?"` and `npm run verify <id>; echo "exit $?"` both exit 0.
- [ ] **Step 3:** Run the appendix capture script for the batch's ids and read every image, light and dark, against the checklist in Task 5 step 8.
- [ ] **Step 4:** Second pass. Re-read each model against its explainer: no description claims more than the explainer, each node type is the honest one, each `data-note` is something that is not a component or a relationship.
- [ ] **Step 5:** `npm test; echo "exit $?"`, `npm run test:calm; echo "exit $?"`, `npm run test:tour; echo "exit $?"`, `npm run test:takeaways; echo "exit $?"`, `npm run verify; echo "exit $?"` all exit 0. `npm run glossary` reports 105 terms; `glossary.txt` changes only if a tour step was reworded.
- [ ] **Step 6:** Commit `feat: redraw the addressing and routing diagrams to their CALM models` (`index.html`, and `glossary.txt` if it changed), with the trailer.
- [ ] **Step 7:** Stop for James's review with the batch summary: reworded captions or steps, every `data-note` and its reason, every stretch model, any suspected explainer error. Push only if asked.

### Task 7: Transport & Web (15)

Ids: `http grpc mqtt quic cors websockets webtransport websec pac alpaca cntlm envoy http2 fix har`

- [ ] **Step 1:** For each id, write its model in `CALM` from the explainer, then reshape and tag its `DIAGRAMS` function.
- [ ] **Step 2:** Per id: `npm test; echo "exit $?"` and `npm run verify <id>; echo "exit $?"` both exit 0.
- [ ] **Step 3:** Run the appendix capture script for the batch's ids and read every image, light and dark, against the checklist in Task 5 step 8.
- [ ] **Step 4:** Second pass. Re-read each model against its explainer: no description claims more than the explainer, each node type is the honest one, each `data-note` is something that is not a component or a relationship.
- [ ] **Step 5:** `npm test; echo "exit $?"`, `npm run test:calm; echo "exit $?"`, `npm run test:tour; echo "exit $?"`, `npm run test:takeaways; echo "exit $?"`, `npm run verify; echo "exit $?"` all exit 0. `npm run glossary` reports 105 terms; `glossary.txt` changes only if a tour step was reworded.
- [ ] **Step 6:** Commit `feat: redraw the transport and web diagrams to their CALM models` (`index.html`, and `glossary.txt` if it changed), with the trailer.
- [ ] **Step 7:** Stop for James's review with the batch summary: reworded captions or steps, every `data-note` and its reason, every stretch model, any suspected explainer error. Push only if asked.

### Task 8: Secure Channels & Crypto (11)

Ids: `tls vpn wireguard ssh ipsec mtls pki vault pqc tailscale tpm`

All three fixture suites replace WireGuard's model, and two replace its drawing, so they are unaffected by its real model. Step 5 confirms it.

- [ ] **Step 1:** For each id, write its model in `CALM` from the explainer, then reshape and tag its `DIAGRAMS` function.
- [ ] **Step 2:** Per id: `npm test; echo "exit $?"` and `npm run verify <id>; echo "exit $?"` both exit 0.
- [ ] **Step 3:** Run the appendix capture script for the batch's ids and read every image, light and dark, against the checklist in Task 5 step 8.
- [ ] **Step 4:** Second pass. Re-read each model against its explainer: no description claims more than the explainer, each node type is the honest one, each `data-note` is something that is not a component or a relationship.
- [ ] **Step 5:** `npm test; echo "exit $?"`, `npm run test:calm; echo "exit $?"`, `npm run test:tour; echo "exit $?"`, `npm run test:takeaways; echo "exit $?"`, `npm run verify; echo "exit $?"` all exit 0. `npm run glossary` reports 105 terms; `glossary.txt` changes only if a tour step was reworded.
- [ ] **Step 6:** Commit `feat: redraw the secure channel and crypto diagrams to their CALM models` (`index.html`, and `glossary.txt` if it changed), with the trailer.
- [ ] **Step 7:** Stop for James's review with the batch summary: reworded captions or steps, every `data-note` and its reason, every stretch model, any suspected explainer error. Push only if asked.

### Task 8b: Type words on every modelled node

James asked during batch 3 (2026-10-07) for ACTOR, WEBCLIENT, SERVICE, SYSTEM, NETWORK and
the rest to be shown on the nodes they apply to, and accepted the prototype: the word is read
from the term's model when the diagram renders, so every modelled term carries it with no
per-term authoring; compact nodes get room in a tidy pass; a verify check keeps later batches
honest; multi-word types read with a space (`DATA ASSET`). The prototype (code and ten
captures) is in the session scratchpad under `proto/apply.mjs`; it is the reference, read
and adapted, not pasted blind. Runs after Task 8's review closes, before Task 9.

- [ ] **Step 1: Page.** One CSS rule beside the other `.dg` text classes:
      `.dg .calm-type { font-size: 9px; fill: var(--text-muted); letter-spacing: .08em; }`.
      One function, `labelCalmTypes(fig)`, called from `showDetail()` once the detail view
      is unhidden (geometry reads as zero while it is hidden). For each node of
      `CALM[id]`: find its `[data-calm]` group and its outline (`rect` or `path`), append
      `<text class="calm-type">` holding the node type uppercased with hyphens as spaces,
      and place it at the first corner clear of the node's own children (title, sub-labels,
      the icon as a 24 by 24 box at its translate), other nodes' outlines and every badge:
      bottom-right, top-right, bottom-left, top-left; top-right first in a container
      (`zone`, `zone-accent`, `box-soft`), whose own title sits top-left; a cylinder keeps
      clear of its rims (about 20 from the top, 12 from the bottom). With no clear corner,
      bottom-right anyway: the check in step 2 reports it. The word sits inside the node's
      group, so it dims with its node, and inside the outline, so it never crosses a border.
      The key line in the disclosure stays as it is.
- [ ] **Step 2: Check.** A new rule `calm-type` in `verify.mjs` check (e): for a term with a
      model, every node's group holds exactly one `.calm-type` text, its content is the node's
      type word, it lies inside the node's outline, and it overlaps no other text or icon in
      the drawing (screen-space boxes, as the other geometry checks measure). The report names
      the node and what the word overlaps. Confirm the existing clearance and collision checks
      see the word as a label too.
- [ ] **Step 3: Fixtures.** `test/calm-fixtures.mjs` gains two cases: a drawing whose node
      leaves no clear corner (make the box too small for any corner, so the result does not
      depend on the fallback font the offline run measures in) fails `verify` with rule
      `calm-type` and a message naming the overlap; a page whose labelling is disabled (swap
      the function's name) fails with `calm-type` and "no type word". `npm run test:calm`
      exits 0 with both.
- [ ] **Step 4: Tidy pass.** `npm run verify` lists every `calm-type` overlap across the
      modelled terms (36 at this point). For each, give the node room, about 12 units more
      height or a shorter sub-label line, so one corner is clear; every connector still
      lands on its node, the viewBox stays 720 wide, nothing else in the drawing moves unless
      the extra height pushes it. `npm run verify <id>` exits 0 per touched term. Capture every
      modelled term, light and dark, into one directory, and read every image: the word
      legible in both themes, in a sensible corner, nothing crowded or clipped.
- [ ] **Step 5: Docs.** Skill step 2b, after the shape table: every modelled node carries its
      type word, drawn by the page from the model; leave one corner of each node clear of
      title, sub-label, icon and badge, about 12 units high and the word's width (`DATA ASSET`
      is the widest built-in), or `npm run verify` reports `calm-type`. The same sentence in
      the plan's batch-procedure appendix under "Per term" and in the spec's section 2 (with
      the CSS and the call in section 3, the rule in section 4 check (e), the two fixtures in
      section 4 Fixtures). CLAUDE.md's `verify.mjs` paragraph gains "and that every node's
      type word sits clear".
- [ ] **Step 6: Gates and commit.** `npm test`, `npm run test:calm`, `npm run test:tour`,
      `npm run test:takeaways`, `npm run verify` (all 105), `npm run glossary` (105), each
      exit 0 read directly. One commit, `feat: label every modelled node with its CALM type`
      (`index.html`, `verify.mjs`, `test/calm-fixtures.mjs`, the skill, the spec, this plan's
      appendix, `CLAUDE.md`), with the trailer.
- [ ] **Step 7:** Report: the list of nodes the tidy pass touched and how, the two fixture
      names, the capture directory, every gate's exit code. The batch 3 review page is built
      from these captures, so James sees the words there.

### Task 9: Identity & Access, part 1 (10)

Ids: `saml radius spiffe idp pkce oidc scim mfa rbac ldap`

- [ ] **Step 1:** For each id, write its model in `CALM` from the explainer, then reshape and tag its `DIAGRAMS` function.
- [ ] **Step 2:** Per id: `npm test; echo "exit $?"` and `npm run verify <id>; echo "exit $?"` both exit 0.
- [ ] **Step 3:** Run the appendix capture script for the batch's ids and read every image, light and dark, against the checklist in Task 5 step 8.
- [ ] **Step 4:** Second pass. Re-read each model against its explainer: no description claims more than the explainer, each node type is the honest one, each `data-note` is something that is not a component or a relationship.
- [ ] **Step 5:** `npm test; echo "exit $?"`, `npm run test:calm; echo "exit $?"`, `npm run test:tour; echo "exit $?"`, `npm run test:takeaways; echo "exit $?"`, `npm run verify; echo "exit $?"` all exit 0. `npm run glossary` reports 105 terms; `glossary.txt` changes only if a tour step was reworded.
- [ ] **Step 6:** Commit `feat: redraw the first identity and access diagrams to their CALM models` (`index.html`, and `glossary.txt` if it changed), with the trailer.
- [ ] **Step 7:** Stop for James's review with the batch summary: reworded captions or steps, every `data-note` and its reason, every stretch model, any suspected explainer error. Push only if asked.

### Task 10: Identity & Access, part 2 (9)

Ids: `kerberos pam bola obo paseto cyberark fapi fido2 immuta`

- [ ] **Step 1:** For each id, write its model in `CALM` from the explainer, then reshape and tag its `DIAGRAMS` function.
- [ ] **Step 2:** Per id: `npm test; echo "exit $?"` and `npm run verify <id>; echo "exit $?"` both exit 0.
- [ ] **Step 3:** Run the appendix capture script for the batch's ids and read every image, light and dark, against the checklist in Task 5 step 8.
- [ ] **Step 4:** Second pass. Re-read each model against its explainer: no description claims more than the explainer, each node type is the honest one, each `data-note` is something that is not a component or a relationship.
- [ ] **Step 5:** `npm test; echo "exit $?"`, `npm run test:calm; echo "exit $?"`, `npm run test:tour; echo "exit $?"`, `npm run test:takeaways; echo "exit $?"`, `npm run verify; echo "exit $?"` all exit 0. `npm run glossary` reports 105 terms; `glossary.txt` changes only if a tour step was reworded.
- [ ] **Step 6:** Commit `feat: redraw the remaining identity and access diagrams to their CALM models` (`index.html`, and `glossary.txt` if it changed), with the trailer.
- [ ] **Step 7:** Stop for James's review with the batch summary: reworded captions or steps, every `data-note` and its reason, every stretch model, any suspected explainer error. Push only if asked.

### Task 11: Zero-Trust Core (9)

Ids: `zerotrust microseg peppdp openziti opa servicemesh nist207 ztna istio`

- [ ] **Step 1:** For each id, write its model in `CALM` from the explainer, then reshape and tag its `DIAGRAMS` function.
- [ ] **Step 2:** Per id: `npm test; echo "exit $?"` and `npm run verify <id>; echo "exit $?"` both exit 0.
- [ ] **Step 3:** Run the appendix capture script for the batch's ids and read every image, light and dark, against the checklist in Task 5 step 8.
- [ ] **Step 4:** Second pass. Re-read each model against its explainer: no description claims more than the explainer, each node type is the honest one, each `data-note` is something that is not a component or a relationship.
- [ ] **Step 5:** `npm test; echo "exit $?"`, `npm run test:calm; echo "exit $?"`, `npm run test:tour; echo "exit $?"`, `npm run test:takeaways; echo "exit $?"`, `npm run verify; echo "exit $?"` all exit 0. `npm run glossary` reports 105 terms; `glossary.txt` changes only if a tour step was reworded.
- [ ] **Step 6:** Commit `feat: redraw the zero-trust core diagrams to their CALM models` (`index.html`, and `glossary.txt` if it changed), with the trailer.
- [ ] **Step 7:** Stop for James's review with the batch summary: reworded captions or steps, every `data-note` and its reason, every stretch model, any suspected explainer error. Push only if asked.

### Task 12: Network Edge & Ops (14)

Ids: `firewall loadbalancer sase sdwan waf apigateway casb dpu bluefield supernic ovs ovn ndlp sbc`

- [ ] **Step 1:** For each id, write its model in `CALM` from the explainer, then reshape and tag its `DIAGRAMS` function.
- [ ] **Step 2:** Per id: `npm test; echo "exit $?"` and `npm run verify <id>; echo "exit $?"` both exit 0.
- [ ] **Step 3:** Run the appendix capture script for the batch's ids and read every image, light and dark, against the checklist in Task 5 step 8.
- [ ] **Step 4:** Second pass. Re-read each model against its explainer: no description claims more than the explainer, each node type is the honest one, each `data-note` is something that is not a component or a relationship.
- [ ] **Step 5:** `npm test; echo "exit $?"`, `npm run test:calm; echo "exit $?"`, `npm run test:tour; echo "exit $?"`, `npm run test:takeaways; echo "exit $?"`, `npm run verify; echo "exit $?"` all exit 0. `npm run glossary` reports 105 terms; `glossary.txt` changes only if a tour step was reworded.
- [ ] **Step 6:** Commit `feat: redraw the network edge diagrams to their CALM models` (`index.html`, and `glossary.txt` if it changed), with the trailer.
- [ ] **Step 7:** Stop for James's review with the batch summary: reworded captions or steps, every `data-note` and its reason, every stretch model, any suspected explainer error. Push only if asked.

### Task 13: Platforms & Apps, with Kubernetes (9)

Ids: `docker react django doca keda ebpf amps cilium calico`

- [ ] **Step 1:** For each id, write its model in `CALM` from the explainer, then reshape and tag its `DIAGRAMS` function.
- [ ] **Step 2:** Per id: `npm test; echo "exit $?"` and `npm run verify <id>; echo "exit $?"` both exit 0.
- [ ] **Step 3:** Run the appendix capture script for the batch's ids and read every image, light and dark, against the checklist in Task 5 step 8.
- [ ] **Step 4:** Second pass. Re-read each model against its explainer: no description claims more than the explainer, each node type is the honest one, each `data-note` is something that is not a component or a relationship.
- [ ] **Step 5:** `npm test; echo "exit $?"`, `npm run test:calm; echo "exit $?"`, `npm run test:tour; echo "exit $?"`, `npm run test:takeaways; echo "exit $?"`, `npm run verify; echo "exit $?"` all exit 0. `npm run glossary` reports 105 terms; `glossary.txt` changes only if a tour step was reworded.
- [ ] **Step 6:** Commit `feat: redraw the platform and Kubernetes diagrams to their CALM models` (`index.html`, and `glossary.txt` if it changed), with the trailer.
- [ ] **Step 7:** Stop for James's review with the batch summary: reworded captions or steps, every `data-note` and its reason, every stretch model, any suspected explainer error. Push only if asked.

### Task 14: Detection & Response (6)

Ids: `siem edr idsips soar dlp sentrywire`

- [ ] **Step 1:** For each id, write its model in `CALM` from the explainer, then reshape and tag its `DIAGRAMS` function.
- [ ] **Step 2:** Per id: `npm test; echo "exit $?"` and `npm run verify <id>; echo "exit $?"` both exit 0.
- [ ] **Step 3:** Run the appendix capture script for the batch's ids and read every image, light and dark, against the checklist in Task 5 step 8.
- [ ] **Step 4:** Second pass. Re-read each model against its explainer: no description claims more than the explainer, each node type is the honest one, each `data-note` is something that is not a component or a relationship.
- [ ] **Step 5:** `npm test; echo "exit $?"`, `npm run test:calm; echo "exit $?"`, `npm run test:tour; echo "exit $?"`, `npm run test:takeaways; echo "exit $?"`, `npm run verify; echo "exit $?"` all exit 0. `npm run glossary` reports 105 terms; `glossary.txt` changes only if a tour step was reworded.
- [ ] **Step 6:** Commit `feat: redraw the detection and response diagrams to their CALM models` (`index.html`, and `glossary.txt` if it changed), with the trailer.
- [ ] **Step 7:** Stop for James's review with the batch summary: reworded captions or steps, every `data-note` and its reason, every stretch model, any suspected explainer error. Push only if asked.

### Task 15: Governance & Supply Chain (5)

Ids: `sbom cve sigstore spinnaker dora`

- [ ] **Step 1:** For each id, write its model in `CALM` from the explainer, then reshape and tag its `DIAGRAMS` function.
- [ ] **Step 2:** Per id: `npm test; echo "exit $?"` and `npm run verify <id>; echo "exit $?"` both exit 0.
- [ ] **Step 3:** Run the appendix capture script for the batch's ids and read every image, light and dark, against the checklist in Task 5 step 8.
- [ ] **Step 4:** Second pass. Re-read each model against its explainer: no description claims more than the explainer, each node type is the honest one, each `data-note` is something that is not a component or a relationship.
- [ ] **Step 5:** `npm test; echo "exit $?"`, `npm run test:calm; echo "exit $?"`, `npm run test:tour; echo "exit $?"`, `npm run test:takeaways; echo "exit $?"`, `npm run verify; echo "exit $?"` all exit 0. `npm run glossary` reports 105 terms; `glossary.txt` changes only if a tour step was reworded.
- [ ] **Step 6:** Commit `feat: redraw the governance and supply chain diagrams to their CALM models` (`index.html`, and `glossary.txt` if it changed), with the trailer.
- [ ] **Step 7:** Stop for James's review with the batch summary: reworded captions or steps, every `data-note` and its reason, every stretch model, any suspected explainer error. Push only if asked.

### Task 16: AI & Models (7)

Ids: `rlhf dpo rag lora qlora coreweave jev`

- [ ] **Step 1:** For each id, write its model in `CALM` from the explainer, then reshape and tag its `DIAGRAMS` function.
- [ ] **Step 2:** Per id: `npm test; echo "exit $?"` and `npm run verify <id>; echo "exit $?"` both exit 0.
- [ ] **Step 3:** Run the appendix capture script for the batch's ids and read every image, light and dark, against the checklist in Task 5 step 8.
- [ ] **Step 4:** Second pass. Re-read each model against its explainer: no description claims more than the explainer, each node type is the honest one, each `data-note` is something that is not a component or a relationship.
- [ ] **Step 5:** `npm test; echo "exit $?"`, `npm run test:calm; echo "exit $?"`, `npm run test:tour; echo "exit $?"`, `npm run test:takeaways; echo "exit $?"`, `npm run verify; echo "exit $?"` all exit 0. `npm run glossary` reports 105 terms; `glossary.txt` changes only if a tour step was reworded.
- [ ] **Step 6:** Commit `feat: redraw the AI and model diagrams to their CALM models` (`index.html`, and `glossary.txt` if it changed), with the trailer.
- [ ] **Step 7:** Stop for James's review with the batch summary: reworded captions or steps, every `data-note` and its reason, every stretch model, any suspected explainer error. Push only if asked.

Batch sizes: 5 + 15 + 11 + 10 + 9 + 9 + 14 + 9 + 6 + 5 + 7 = 100, plus the 5 pilots = 105.

---

## Phase 4: lock-in

### Task 17: Make models mandatory and close out

**Files:**
- Modify: `test/calm-fixtures.mjs` (two cases flip)
- Modify: `validate.mjs` (`requireAll`)
- Modify: `verify.mjs` (static coverage check)
- Modify: `index.html` (`calmHtml`, the lede, the meta description)
- Modify: `CLAUDE.md`, `.claude/skills/add-glossary-term/SKILL.md`, `README.md`
- Modify: `screenshots/` (six files)

**Interfaces:**
- Consumes: `checkModels(…, { requireAll })` (Task 1); `calmHtml` (Task 3); `--calm-out` (Task 3).

- [ ] **Step 1: Flip the two migration cases so they fail**

In `test/calm-fixtures.mjs`, replace:

```js
  ['term without a model accepted during migration', () => withModel(base, null), 'validate', 0, null],
```

With:

```js
  ['term without a model rejected', () => withModel(base, null), 'validate', 1, 'calm-data', /no CALM model/],
```

And replace:

```js
  ['term without a model verifies during migration', () => withModel(base, null), 'verify', 0, null],
```

With:

```js
  ['term without a model caught by verify', () => withModel(base, null), 'verify', 1, 'calm', /no CALM model/],
```

Run: `npm run test:calm; echo "exit $?"`
Expected: those two cases FAIL with `exit 0 (want 1)`; `exit 1`.

- [ ] **Step 2: Make the checks mandatory**

In `validate.mjs`, change `{ requireAll: false }` to `{ requireAll: true }`.

In `verify.mjs`, after the static takeaways loop (`for (const t of TERMS) { if (!Array.isArray(t.takeaways) …`), add:

```js
// Checked here for the same reason: without a model the detail view cannot
// render its disclosure.
for (const t of TERMS) {
  if (!CALM[t.id]) err('calm', `${t.id}: no CALM model — every term has one`);
}
```

Change the comment above the per-term `const model = CALM[t.id];` to:

```js
  // Check (e). A term without a model was reported by the static check.
```

- [ ] **Step 3: Remove the no-model fallback**

In `index.html`, in `calmHtml`, delete the line `if (!m) return "";` and change the comment above the function to:

```js
  // The CALM model, collapsed under the explainer.
```

- [ ] **Step 4: Run the suites**

Run: `npm run test:calm; echo "exit $?"`, `npm test; echo "exit $?"`, `npm run test:tour; echo "exit $?"`, `npm run test:takeaways; echo "exit $?"`
Expected: all `exit 0`.

- [ ] **Step 5: Official CLI over all 105**

Use a fresh directory in your scratchpad for `OUT`:

```bash
OUT=<scratchpad>/calm-out-all
node verify.mjs --calm-out="$OUT"; echo "verify exit $?"
ls "$OUT"/*.calm.json | wc -l
for f in "$OUT"/*.calm.json; do npx --yes @finos/calm-cli@1.60.1 validate -a "$f" > "$f.report" 2>/dev/null || echo "FAILED $(basename "$f")"; done
grep -L '"hasErrors": false' "$OUT"/*.report; grep -L '"hasWarnings": false' "$OUT"/*.report
```

Expected: `verify exit 0`; `105`; no `FAILED` line; the two `grep -L` commands print nothing. Fix any model the CLI rejects and re-run the term through steps 4 and 5.

- [ ] **Step 6: Update the page copy and the docs**

In `index.html`, the lede becomes:

```html
          <p class="lede">Every term gets a short TL;DR, a custom diagram that does the explaining, flash-card takeaways to remember it by, and a CALM architecture model to download. Built for scanning, searching, and filtering across IT, AI, networking, and security.</p>
```

And the meta description's last sentence becomes:

```
Every entry has a TL;DR, a custom inline-SVG diagram, flash-card takeaways, and a CALM architecture model.
```

In `README.md`, in the About paragraph, replace `and flash-card takeaways with the full explainer one click away — so` with `flash-card takeaways with the full explainer one click away, and a CALM model of the diagram to view or download — so`. In Project Structure, add after the `_terms.mjs` line and update the `test/` line:

```text
_calm.mjs        # checks the CALM models against the vendored CALM 1.2 schema
test/            # fixtures proving validate/verify catch broken tours, takeaways and CALM models, plus the vendored CALM schema
```

In `CLAUDE.md`, change the opening paragraph's list to `markup, styles, the \`TERMS\` data array, hand-authored inline SVG diagrams, and the \`CALM\` models behind them`, and add an invariant after "Takeaways compress the explainer":

```markdown
- **Every diagram has a CALM model and matches it.** The model in `CALM` is written from
  the explainer in the FINOS CALM 1.2 format; the drawing's shapes, connectors and
  containment follow it, tagged with `data-calm`. Anything drawn that is not a component
  or a relationship is marked `data-note`. A model claims only what the explainer says.
  `verify.mjs` checks the match; whether the model is a fair reading of the explainer is
  a review rule.
```

In the skill's step 8, add a sentence after the two-commit list: `The term's CALM model and its data-calm tags are part of commit 1.`

- [ ] **Step 7: Full gates**

Run: `npm test; echo "exit $?"`, `npm run test:calm; echo "exit $?"`, `npm run test:tour; echo "exit $?"`, `npm run test:takeaways; echo "exit $?"`, `npm run verify; echo "exit $?"`, `npm run glossary`
Expected: all `exit 0`; `wrote 105 terms`.

- [ ] **Step 8: Commit**

```bash
git add test/calm-fixtures.mjs validate.mjs verify.mjs index.html README.md CLAUDE.md .claude/skills/add-glossary-term/SKILL.md
git commit -m "feat: make a CALM model mandatory for every term

All 105 models pass FINOS's calm validate with no errors or warnings.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 9: Refresh the committed screenshots**

```bash
node screenshot.mjs ./index.html
node screenshot.mjs ./index.html --mode=dark
git status --short screenshots/
```

Expected: all six files modified, since the lede sits on the browse view.

```bash
git add screenshots/
git commit -m "chore: refresh screenshots after the CALM redraw

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 10:** Change the spec's status line to `implemented; a CALM model became mandatory on <date>` and commit it as `docs: close out the CALM models spec`. Stop for James's review. Push only when he asks.

---

## Appendix: batch procedure

This is the shared procedure for every Phase 3 batch. Each batch task names its term ids
and its commit message; this appendix says how each term is done, and it supersedes a
batch task's step wording where the two differ: it adds a before-capture, an official
CLI run and the format of the batch summary.

### Where the rules and examples are

- **The rules:** step 2b ("Write the CALM model and tag the drawing") of
  `.claude/skills/add-glossary-term/SKILL.md`. Read it in full before you start. It is
  short, and `verify.mjs` enforces most of it.
- **Worked examples:** the five pilot terms in `index.html`. Read at least three of them,
  model and drawing side by side: `CALM.dns` with `DIAGRAMS.dns` (a flow with replies and
  a cylinder), `CALM.kubernetes` with `DIAGRAMS.kubernetes` (containers through
  `deployed-in`, a document, two notes, rows built with `.map` that carry an id column),
  `CALM.oauth` (an actor and `interacts`), `CALM.jwt` (a `composed-of` container, no
  flow, call-outs), `CALM.owasp` (a stretch case).
- **Where models go:** append each new model to the end of `const CALM = {` in
  `index.html`, in the order your brief lists the ids, at four-space indent, formatted
  like the pilots.

### What "reshape" means

Keep every part of a layout that already agrees with the model. Redraw only what does
not: an outline that contradicts its node type, a connector with no relationship, a
relationship with no connector, a child drawn outside its container, a shared trunk, a
title on two lines. Tag every node and connector. Mark the rest `data-note`. The aim is a
diagram at least as clear as today's in which every shape honestly is what the model says.

Do not edit any term's `explainer`, `takeaways` or `source`. Leave `steps`, `fact` and
`caption` alone unless your redraw makes one false; if you must reword one, list it in
your report. If a model shows that an explainer itself may be wrong, report it; do not
fix it.

### Per term

1. **Read the term.** Print its entry and its drawing:

   ```bash
   node --input-type=module -e 'import { readTerms } from "./_terms.mjs"; const { TERMS } = readTerms("./index.html"); const t = TERMS.find((x) => x.id === process.argv[1]); console.log("CAPTION: " + t.caption + "\nEXPLAINER: " + t.explainer.replace(/\s+/g, " ")); t.steps.forEach((s, i) => console.log("  step " + (i + 1) + ": " + s.title + " — " + s.text)); console.log("FACT: " + t.fact);' <id>
   grep -n "^    <id>: () => " index.html
   ```

2. **Write the model from the explainer.** The rules the pilot review settled, which are
   the ones most easily got wrong:
   - `actor` is for people and organisations only. A client machine or program is a
     `system`, or a `webclient` if it is a browser or an app's user interface.
     `interacts` is only for a node typed `actor`; everything else uses `connects`.
   - Use a custom kebab-case type when a built-in name collides with the term's own
     vocabulary (a Kubernetes pod is a `pod`), or when no built-in type honestly fits.
   - A `name` is the title drawn in the shape, word for word, in one `<text>`.
   - Every description states only what the term's own copy says (its explainer first,
     its caption and tour steps where the explainer is silent) and makes sense on its own
     in the downloaded JSON: name the thing, never "it".
   - Something a component reads and writes as it runs (a cache, a lookup table, an
     index, a log) is a `database`. Something made once and handed on or kept (a token, a
     certificate, a manifest, a policy file) is a `data-asset`.
   - You may add a node for something the old drawing only labelled, when the term's copy
     names it. Do not invent a node the copy does not name.
   - `protocol` only if it is one of HTTP, HTTPS, FTP, SFTP, JDBC, WebSocket, SocketIO,
     LDAP, AMQP, TLS, mTLS, TCP. Otherwise name the protocol in the description, unless
     the term is itself that protocol.
   - Every node appears in at least one relationship.
   - Traffic each way over one link is one relationship. The flow is a sub-story of the
     tour: write one when the tour narrates traffic (if it lights any arrow, the model
     has a flow), with the transitions in the order the tour lights their connectors.
     Each transition needs a lit connector of its own, drawn in its direction; a
     connector lit at several steps can serve a transition at any of them. A two-way
     arrow is two transitions, one each way.
   - The tour may also light a connector that is not a transition, to show structure
     ("every device plugs into the switch"). Do not strip or move a step's lighting to
     suit the flow: each tour step should light what it lit before, unless the model
     shows that was wrong.

3. **Reshape and tag the drawing.**
   - Outline by node type: `rx="20"` for `actor` and `webclient`; `rx="8"` for `service`,
     `system` and custom types (any `rx` under 16 counts as square, so small rows may
     keep theirs); `${cyl(x, y, w, h)}` for `database` and `ldap`; `${doc(x, y, w, h)}`
     for `data-asset`; `rect.zone` for `network`, `ecosystem` and a `deployed-in`
     container; `rect.box-soft` for a `composed-of` container. Many existing boxes have
     `rx="12"`; that now counts as square, so set each box by its node's type.
   - Every modelled node carries its type word, drawn by the page from the model; leave
     one corner of each node clear of title, sub-label, icon and badge, about 12 units
     high and the word's width (`DATA ASSET` is the widest built-in; a custom type can be
     wider), or `npm run verify` reports `calm-type`.
   - One `<g data-calm="<node id>">` per node, holding its outline, icon and labels. A
     container's group holds its outline and own label only; children are sibling groups
     drawn inside it. Never nest `data-calm`.
   - One `<line>` or `<path>` per connector, carrying `data-calm="<relationship id>"`,
     ending within 6 viewBox units of each node group's bounding box. A sequence
     diagram's lifeline goes in its node's group.
   - Anything else with a `box`, `zone` or `flow` class takes `data-note`, set to one of:
     `call-out`, `footer`, `elided`, `self-loop`, `struck-through`, `becomes`. A noted
     mark may still carry `data-s`.
   - Colour keeps its meaning: accent is the subject or the secure path, green and red
     are allow and deny. Do not use colour to show node or relationship type.

4. **Gate the term.** `npm test; echo "exit $?"` then `npm run verify <id>; echo "exit $?"`.
   Both exit 0. Fix every `calm`, `calm-type`, `calm-data`, `clearance`, `collision`,
   `badge` and `tour` finding before the next term. Moving a connector's end a few units
   so it meets its node is the intended fix for an endpoint finding.

   If the checker rejects a drawing that you are confident is right and matches its
   model, do not weaken the checker and do not bend a good drawing to satisfy it. Stop
   and report BLOCKED with the term, the finding text, and why you think the checker is
   wrong. Do not edit `verify.mjs`, `validate.mjs`, `_calm.mjs`, `_terms.mjs` or the
   fixture suites in a batch.

### Captures

Save the capture script from "Appendix: review captures" as `$S/capture.mjs`, where `S` is
your session's scratchpad directory.
Before you change anything, capture the batch as it stands:

```bash
node $S/capture.mjs "$PWD" $S/captures-<batch>-before <ids…>
```

After the batch, and after the second pass below, capture it again into
`$S/captures-<batch>` and read every image with
the Read tool: per term, `<id>-light.png` and `<id>-dark.png` (the tour card, every part
visible) and `<id>-calm-light.png` (the open disclosure). For each term check:

- every shape reads as what the model says it is, and any new outline sits well with its
  labels and icon
- the fully lit drawing still tells the story in the caption and steps, and is at least
  as clear as its before-image
- light and dark are both legible, and nothing is crowded, clipped or misaligned
- the disclosure shows the counts, the key and the JSON

### Second pass

Do this before the after-captures, so the disclosure captures show the final JSON.
Re-read each model against its explainer: qualifiers such as "usually", "can" and "most"
survive, as they do in takeaways; no description claims more than the explainer
says or leans on "it"; each node type is the honest one; each `data-note` is on something
that is not a component or a relationship; each transition has a lit arrow of its own;
each tour step still lights what its text describes. When a drawing is restructured,
light a hub node only at the steps whose text is about it or about traffic that touches
it; a hub lit at every step leaves the tour no contrast.

### Official CLI

Run FINOS's own validator over the batch's downloads:

```bash
OUT=$S/calm-out-<batch>
node verify.mjs <ids…> --calm-out="$OUT"; echo "verify exit $?"
for f in "$OUT"/*.calm.json; do npx --yes @finos/calm-cli@1.60.1 validate -a "$f" > "$f.report" 2>/dev/null; echo "$(basename "$f") exit $?"; done
grep -L '"hasErrors": false' "$OUT"/*.report; grep -L '"hasWarnings": false' "$OUT"/*.report
```

Expected: `verify exit 0`, every CLI line `exit 0`, and the two `grep -L` commands print
nothing.

### Batch gates and commit

`npm test`, `npm run test:calm`, `npm run test:tour`, `npm run test:takeaways` and
`npm run verify` (all 105 terms; needs Google Fonts; several minutes, so run it once) all
exit 0, each exit code read directly with `; echo "exit $?"`. `npm run glossary` reports
105 terms; `glossary.txt` changes only if you reworded a tour step.

Commit `index.html` (and `glossary.txt` if it changed) direct to `main` with the message
your brief gives and the trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
Do not push.

### The batch summary (goes in your report)

- Per term: the model in one line (node count, relationship count, flow steps), what you
  redrew and what you kept.
- Every `data-note`: the term, the element, the value, and why it is not a component or
  a relationship.
- Every caption, step or fact you reworded, with before and after (or "none").
- Every stretch model: a term whose model is valid but of little use to a CALM tool, or
  where a node type is a compromise, and why.
- Any explainer you suspect is wrong.
- Anything in the rules that was unclear or that you had to interpret, so the rule can be
  fixed before the next batch.

### SVG facts that have bitten before

- SVG collapses runs of spaces; never pad a label with spaces.
- Budget about 6.6px per character for the 11px mono face and about 8px for the 13px bold.
- `getBBox()` ignores transforms.
- Use the `t-acc` class for accent text, never a `fill="var(--accent)"` attribute.
- Each diagram's `aria-label` is its caption. `viewBox` stays 720 wide.
- A flow may run under its badge, but a badge must not cover a label.

## Appendix: open items for the final review

Minor points task reviews raised and deferred. The final whole-branch review decides which
must be fixed before the work is called done. Tasks 1 to 6 as of 7 October 2026.

Tooling:
- `package-lock.json`: npm changed the root licence from ISC to MIT when `ajv` was added
  (it now matches `package.json`).
- `_calm.mjs`: with more than one flow, the transition checks run on every flow. Correct,
  but noisy, since a model may have only one.
- `verify.mjs` `CALM_PROBE`: it recognises a box or zone only as a `<rect>` or one of the
  two shape helpers, and a flow only by the four flow classes. A `<path class="box">`
  outside a node group would not be reported untagged. No diagram has one today.
- `verify.mjs`: a connector tagged with a `deployed-in` or `composed-of` relationship id
  is accepted silently. A node's box includes badge and label overhang, so the endpoint
  test is slightly loose.
- `verify.mjs`: a line with no markers, drawn against its relationship's direction, is
  read as a reply and asked for a `destination-to-source` transition. The skill says to
  draw every line source to destination, so the message points at the right fix.
- `verify.mjs`: when no pairing of transitions to connectors works, the explanatory walk
  can name a different symptom from the root cause if one relationship has several
  connectors. The search has no memoisation, which is harmless at realistic sizes. The
  "flow order contradicts the tour" message reads awkwardly.
- `verify.mjs`: keyboard reach of the JSON block is checked through its attributes, not
  by pressing keys. The missing-clipboard check stubs the clipboard as an object with no
  `writeText`, not as `undefined`.
- `test/calm-fixtures.mjs`: no case yet for `interacts` with an unreached node, a node
  drawn twice, a wrong container border, a document where a cylinder is wanted, or a
  lone `marker-start`.

Page:
- `calmAction`: the download's object URL is released on a 0 ms timeout; some browsers
  may want longer. The "Copied" or "Copy failed" status never clears, and a repeat is not
  announced again.
- A lit zone gets an accent outline and no fill, so it is fainter than a lit box (BGP).
- NAT: the reply arrowhead at Host C meets the private-network zone's dashed border.

Documents:
- `CLAUDE.md`: two sentences added in Task 4 were not rewrapped. The skill's step 6 intro
  still says "the two geometry checks" though the list runs (a) to (e).
- Some lines added to the skill and the spec after the pilot review are not wrapped like
  the text around them. The protocol exception and the label-to-node rule are in the
  skill and in the spec's Decisions table, but not in the spec's body.

For James, not for the review:
- The TCP/IP explainer never mentions headers or encapsulation, though its caption and
  all four tour steps rest on them. Not edited here.
- Stretch or thin models so far: JWT (one relationship, no flow), OWASP (a list), TCP/IP
  (four layers; the header staircase is a call-out), DHCP (two nodes, one relationship).

## Appendix: review captures

A throwaway script for reading redrawn diagrams. Save it in your scratchpad, not in the repo: `validate.mjs` rejects a stray `.mjs` beside `index.html`.

```js
// capture.mjs — review captures of redrawn diagrams and their CALM disclosure.
// Usage: node capture.mjs <repo-dir> <out-dir> <id> [<id> ...]
// Writes <id>-light.png, <id>-dark.png (the tour card, fully lit, as it
// prints) and <id>-calm-light.png, <id>-calm-dark.png (the open disclosure).
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';

const [repo, out, ...ids] = process.argv.slice(2);
const FALLBACK = path.join(os.homedir(), '.cache/ms-playwright/chromium-1148/chrome-linux/chrome');
if (!process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH && fs.existsSync(FALLBACK)) process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = FALLBACK;
const { launchBrowser } = await import(pathToFileURL(path.join(repo, '_launch.mjs')).href);

const { browser } = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 2 });
fs.mkdirSync(out, { recursive: true });
const file = pathToFileURL(path.join(repo, 'index.html')).href;

for (const id of ids) {
  for (const theme of ['light', 'dark']) {
    // A full load each time, so the previous term's drawing is never captured.
    await page.goto('about:blank');
    await page.goto(`${file}#${id}`, { waitUntil: 'load' });
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
    await page.waitForSelector('#detail-content svg.dg');
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => document.querySelectorAll('#detail-content svg.dg .dim').forEach((el) => el.classList.remove('dim')));
    await page.locator('#detail-content .tour').screenshot({ path: path.join(out, `${id}-${theme}.png`) });
    const calm = page.locator('#detail-content .calm-more');
    if (await calm.count()) {
      await calm.locator('summary').click();
      await calm.screenshot({ path: path.join(out, `${id}-calm-${theme}.png`) });
    }
  }
}
await browser.close();
```

Run it with the repo directory, a fresh output directory in your scratchpad, and the ids:

```bash
node <scratchpad>/capture.mjs "$PWD" <scratchpad>/captures-<batch> dns kubernetes oauth jwt owasp
```
