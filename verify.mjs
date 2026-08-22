#!/usr/bin/env node
// verify.mjs — renders index.html in a browser and checks every term's entry.
//
// validate.mjs covers the static style rules; this covers what only shows once
// the page is rendered: that each detail view and diagram appear, that the
// counters match the data, and two geometry checks that have caught real
// defects invisible at thumbnail size —
//
//   (a) label clearance — a <text> bbox crossing a box border rather than
//       sitting inside it (Calico's "no match" and "pod IP on the wire")
//   (b) stroke/text collision — a <line>/<path> passing through a label
//       (istiod's arrows through Istio's SPIFFE ID)
//
// Usage:
//   node verify.mjs                  # every term
//   node verify.mjs calico istio     # just these, while adding an entry
//   node verify.mjs --json           # machine-readable
//   npm run verify

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { readTerms } from './_terms.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));

// -----------------------------------------------------------------------------
// CLI
// -----------------------------------------------------------------------------

const args = process.argv.slice(2);
const flags = {
  json:  args.includes('--json'),
  quiet: args.includes('--quiet') || args.includes('-q'),
  help:  args.includes('--help')  || args.includes('-h'),
};

if (flags.help) {
  console.log('Usage: node verify.mjs [term-id ...] [--target=<path>] [--json] [--quiet]');
  console.log('       with no term-id, every term is checked');
  process.exit(0);
}

const KNOWN_FLAGS = ['--json', '--quiet', '-q', '--help', '-h'];
const unknownFlag = args.find(
  (a) => a.startsWith('-') && !KNOWN_FLAGS.includes(a) && !a.startsWith('--target=')
);
if (unknownFlag) {
  console.error(`verify.mjs: unknown flag: ${unknownFlag}`);
  process.exit(2);
}

const wanted = args.filter((a) => !a.startsWith('-'));
const targetFlag = args.find((a) => a.startsWith('--target='));
const source = targetFlag ? path.resolve(targetFlag.slice('--target='.length)) : path.join(root, 'index.html');

if (!fs.existsSync(source)) {
  console.error(`verify.mjs: target not found: ${source}`);
  process.exit(2);
}

const errors = [];
const warnings = [];
const err  = (rule, msg) => errors.push({ rule, msg });
const warn = (rule, msg) => warnings.push({ rule, msg });

// -----------------------------------------------------------------------------
// Static checks — counters and coverage
// -----------------------------------------------------------------------------

let data;
try {
  data = readTerms(source);
} catch (e) {
  console.error(`verify.mjs: ${e.message}`);
  process.exit(2);
}

const { html, TERMS, TYPE_TAGS, PROV_TAGS, DOMAIN_TAGS, DIAGRAM_IDS } = data;
const ids = new Set(TERMS.map((t) => t.id));

// ----- the six static fallback counters, plus the README's term count --------

const counter = (id) => {
  const m = html.match(new RegExp(`id="${id}"[^>]*>\\s*([0-9]+)`));
  return m ? Number(m[1]) : null;
};

const EXPECTED = {
  'toc-count':     TERMS.length,
  'stat-total':    TERMS.length,
  'stat-types':    TYPE_TAGS.length,
  'stat-prov':     PROV_TAGS.length,
  'stat-domains':  DOMAIN_TAGS.length,
  'stat-diagrams': DIAGRAM_IDS.length,
};

for (const [id, expected] of Object.entries(EXPECTED)) {
  const actual = counter(id);
  if (actual === null)          err('counters', `#${id} not found in index.html`);
  else if (actual !== expected) err('counters', `#${id} is ${actual}, should be ${expected}`);
}

const readmePath = path.join(root, 'README.md');
if (fs.existsSync(readmePath)) {
  const m = fs.readFileSync(readmePath, 'utf8').match(/Explains (\d+) /);
  if (!m)                                 err('counters', 'README.md has no "Explains N …" sentence');
  else if (Number(m[1]) !== TERMS.length)  err('counters', `README says "Explains ${m[1]}", should be ${TERMS.length}`);
}

// ----- coverage: diagrams and cross-links ------------------------------------

const diagrams = new Set(DIAGRAM_IDS);
for (const t of TERMS) {
  if (!diagrams.has(t.id)) err('coverage', `${t.id}: no DIAGRAMS.${t.id} function`);
  for (const r of t.related || []) {
    if (!ids.has(r)) err('coverage', `${t.id}: related id "${r}" is not a term`);
  }
}
for (const d of DIAGRAM_IDS) {
  if (!ids.has(d)) warn('coverage', `DIAGRAMS.${d} has no matching term`);
}

// -----------------------------------------------------------------------------
// Which terms to render
// -----------------------------------------------------------------------------

for (const w of wanted) {
  if (!ids.has(w)) {
    console.error(`verify.mjs: unknown term id "${w}"`);
    process.exit(2);
  }
}
const targets = wanted.length ? TERMS.filter((t) => wanted.includes(t.id)) : TERMS;

// -----------------------------------------------------------------------------
// Browser checks
// -----------------------------------------------------------------------------

// _launch.mjs reads PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH at import time, so the
// default has to be set before the dynamic import below — assigning it after a
// static import would be too late. chromium-1148 is the build that works in
// this WSL environment; the bundled build and the `chrome` channel both fail.
const FALLBACK_CHROMIUM = path.join(os.homedir(), '.cache/ms-playwright/chromium-1148/chrome-linux/chrome');
if (!process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH && fs.existsSync(FALLBACK_CHROMIUM)) {
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = FALLBACK_CHROMIUM;
}
const { launchBrowser } = await import(new URL('./_launch.mjs', import.meta.url));

// Runs inside the page, returning every geometry finding for the open diagram.
// Wrapped as an IIFE: page.evaluate() with a string does not auto-invoke.
const PROBE = `(() => {
  const svg = document.querySelector('#detail-content svg.dg');
  if (!svg) return { rendered: false };

  // Everything is measured in screen space. getBBox() reports the box the
  // element would occupy *before* its transform, so a rotated label (tcpip's
  // "encapsulation") claims a horizontal box it does not actually cover, and
  // any stroke near that phantom box reads as a collision.
  const frame = svg.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  const scale = vb.width ? frame.width / vb.width : 1;   // user units -> screen px
  const box = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, r: r.right, y: r.top, bot: r.bottom }; };

  const texts = [...svg.querySelectorAll('text')]
    .filter((t) => t.textContent.trim())
    .map((t) => Object.assign(box(t), { s: t.textContent.trim().slice(0, 44) }));

  // Zone rects are background regions that labels legitimately straddle.
  const rects = [...svg.querySelectorAll('rect')]
    .filter((r) => !/zone/.test(r.getAttribute('class') || ''))
    .filter((r) => r.getAttribute('width') && r.getAttribute('height'))
    .map((r) => Object.assign(box(r), {
      cls: (r.getAttribute('class') || '(no class)') +
           ' [' + r.getAttribute('x') + '..' + (+r.getAttribute('x') + +r.getAttribute('width')) + ']',
    }));

  // (a) a label overlapping a box on both axes but not sitting inside it.
  // The incursion is reported in user units: a label clipping a corner by a
  // pixel is font-metric noise, one buried 15px into a box is a real defect.
  const clearance = [];
  for (const t of texts) for (const q of rects) {
    const ox = Math.min(t.r, q.r) - Math.max(t.x, q.x);
    const oy = Math.min(t.bot, q.bot) - Math.max(t.y, q.y);
    if (ox <= 0 || oy <= 0) continue;
    const inside = t.x >= q.x && t.r <= q.r && t.y >= q.y && t.bot <= q.bot;
    if (inside) continue;
    // Same 2-unit cushion the collision check uses: below that, an overlap is
    // font-metric noise (measured: 0.3px on saml, 1.8px on fapi) rather than a
    // label a reader would see sitting on a box border.
    const by = Math.min(ox, oy) / scale;
    if (by <= 2) continue;
    clearance.push({ text: t.s, rect: q.cls, by: +by.toFixed(1) });
  }

  // (b) a stroke passing through a label — 2 user-unit cushion so touching
  // endpoints do not count
  const cushion = 2 * scale;
  const collisions = [];
  for (const el of svg.querySelectorAll('line, path')) {
    // stroke-bad is the decorative X struck over a broken primitive (pqc's
    // RSA/ECC, and 4 others). It is *meant* to sit on the label it cancels.
    if ((el.getAttribute('class') || '').includes('stroke-bad')) continue;
    const len = el.getTotalLength ? el.getTotalLength() : 0;
    if (!len) continue;
    const m = el.getScreenCTM();
    if (!m) continue;
    for (let i = 0; i <= 200; i++) {
      const raw = el.getPointAtLength(len * i / 200);
      const p = new DOMPoint(raw.x, raw.y).matrixTransform(m);
      for (const t of texts) {
        if (p.x > t.x + cushion && p.x < t.r - cushion && p.y > t.y + cushion && p.y < t.bot - cushion) {
          const cls = el.getAttribute('class') || '(no class)';
          const d = cls + ' ' + el.tagName + ' ' + (el.getAttribute('d') || (el.getAttribute('x1') + ',' + el.getAttribute('y1')));
          if (!collisions.some((h) => h.stroke === d && h.text === t.s)) {
            collisions.push({ stroke: d.slice(0, 56), text: t.s });
          }
        }
      }
    }
  }

  const pad = scale;
  const overflow = texts
    .filter((t) => t.x < frame.left - pad || t.r > frame.right + pad || t.y < frame.top - pad || t.bot > frame.bottom + pad)
    .map((t) => ({ text: t.s, x: Math.round((t.x - frame.left) / scale), right: Math.round((t.r - frame.left) / scale) }));

  return { rendered: true, labels: texts.length, clearance, collisions, overflow };
})()`;

const tocIds = `(() => [...document.querySelectorAll('#toc [data-toc]')].map((e) => e.dataset.toc))()`;

const FILE = pathToFileURL(source).href;
const { browser, label } = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });

let consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push(String(e)));

if (!flags.json) {
  console.log(`verify.mjs: ${label} · ${targets.length} term${targets.length === 1 ? '' : 's'}`);
}

// The TOC is built once from TERMS, so it only needs reading once.
await page.goto(FILE, { waitUntil: 'load' });
await page.waitForSelector('#toc', { timeout: 5000 });
const inToc = new Set(await page.evaluate(tocIds));
for (const t of targets) {
  if (inToc.size && !inToc.has(t.id)) err('toc', `${t.id}: no TOC entry`);
}

for (const t of targets) {
  consoleErrors = [];
  await page.goto(`${FILE}#${t.id}`, { waitUntil: 'load' });

  let found;
  try {
    // A hash change does not reload the document, so the previous term's
    // diagram is still in the DOM and waiting on the selector alone would
    // measure it. showDetail() sets document.title from the term name in the
    // same synchronous block as the innerHTML, so the title is proof that the
    // rendered diagram is this term's.
    const wantTitle = `${t.term} — ZTA Visual Glossary`;
    await page.waitForFunction(`document.title === ${JSON.stringify(wantTitle)}`, null, { timeout: 5000 });
    await page.waitForSelector('#detail-content svg.dg', { timeout: 5000 });
    found = await page.evaluate(PROBE);
  } catch {
    err('render', `${t.id}: detail view did not render (title never became "${t.term}")`);
    continue;
  }

  if (!found.rendered) { err('render', `${t.id}: no diagram rendered in #detail-content`); continue; }
  if (!found.labels)   warn('render', `${t.id}: diagram has no <text> labels`);

  for (const c of found.clearance)  err("clearance", `${t.id}: "${c.text}" crosses ${c.rect} by ${c.by}px`);
  for (const c of found.collisions) err('collision', `${t.id}: ${c.stroke} passes through "${c.text}"`);
  for (const o of found.overflow)   err('overflow',  `${t.id}: "${o.text}" extends outside the viewBox (x ${o.x}..${o.right})`);
  for (const c of consoleErrors)    err('console',   `${t.id}: ${c}`);
}

await browser.close();

// -----------------------------------------------------------------------------
// Report
// -----------------------------------------------------------------------------

const ok = errors.length === 0;
const report = { target: source, terms: targets.length, ok, errors, warnings };

if (flags.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const RED = '\x1b[31m', YEL = '\x1b[33m', GRN = '\x1b[32m', RESET = '\x1b[0m';
  const c = (code, s) => (process.stdout.isTTY ? `${code}${s}${RESET}` : s);

  if (!flags.quiet && warnings.length) {
    console.log(`\n${warnings.length} warning${warnings.length === 1 ? '' : 's'}:`);
    for (const w of warnings) console.log(`  ${c(YEL, '!')} ${w.rule.padEnd(11)} ${w.msg}`);
  }
  if (errors.length) {
    console.log(`\n${errors.length} error${errors.length === 1 ? '' : 's'}:`);
    for (const e of errors) console.log(`  ${c(RED, '✗')} ${e.rule.padEnd(11)} ${e.msg}`);
  } else {
    console.log(c(GRN, '✓ clean — every term renders, no geometry defects'));
  }
}

process.exit(ok ? 0 : 1);
