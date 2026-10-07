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
//   (c) diagram tours — for a term with steps: chip count, every step lights
//       something, no out-of-range or nested data-s, each click shows its own
//       text and lit set, ArrowRight moves focus, no animation under reduced
//       motion; badges must not cover a label
//   (d) takeaway tiles — for every term: tiles match the data and
//       hold no stray markup, only the last is marked as the limitation (and
//       named so in the accessibility tree, once), the full explainer sits in
//       a closed disclosure that opens for print, and nothing overflows at
//       1440px or 375px
//
//   (e) CALM model — for a term with a model: every node drawn once, under
//       its name, in the outline its type calls for; every connects and
//       interacts relationship drawn as a connector between the right two
//       nodes; every contained node inside its container; the flow in the
//       tour's order; and no box, zone or flow left untagged; and every
//       node's type word (rule calm-type) present, inside its outline, and
//       clear of every other label, icon and badge
//
// A real run waits for the page's web fonts before it measures anything, and
// reports a `fonts` error if they never load: geometry in fallback fonts is not
// the geometry a reader sees (envoy's badge 3 passed in one and failed in the
// other).
//
// Usage:
//   node verify.mjs                  # every term
//   node verify.mjs calico istio     # just these, while adding an entry
//   node verify.mjs --json           # machine-readable
//   node verify.mjs --offline        # no network; for the fixture suites only
//   node verify.mjs --calm-out=<dir> # also save each term's CALM download there
//   npm run verify

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { readTerms } from './_terms.mjs';
import { relationshipShape, CALM_SCHEMA, NOTE_KINDS } from './_calm.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));

// -----------------------------------------------------------------------------
// CLI
// -----------------------------------------------------------------------------

const args = process.argv.slice(2);
const flags = {
  json:  args.includes('--json'),
  quiet: args.includes('--quiet') || args.includes('-q'),
  help:  args.includes('--help')  || args.includes('-h'),
  offline: args.includes('--offline'),
};

if (flags.help) {
  console.log('Usage: node verify.mjs [term-id ...] [--target=<path>] [--json] [--quiet] [--offline] [--calm-out=<dir>]');
  console.log('       with no term-id, every term is checked');
  console.log('       --offline answers every network request with an empty response (fixture suites only)');
  console.log('       without it, the run waits for the web fonts and reports a fonts error if they do not load');
  process.exit(0);
}

const KNOWN_FLAGS = ['--json', '--quiet', '-q', '--help', '-h', '--offline'];
const unknownFlag = args.find(
  (a) => a.startsWith('-') && !KNOWN_FLAGS.includes(a) && !a.startsWith('--target=') && !a.startsWith('--calm-out=')
);
if (unknownFlag) {
  console.error(`verify.mjs: unknown flag: ${unknownFlag}`);
  process.exit(2);
}

const wanted = args.filter((a) => !a.startsWith('-'));
const targetFlag = args.find((a) => a.startsWith('--target='));
const calmOutFlag = args.find((a) => a.startsWith('--calm-out='));
const calmOut = calmOutFlag ? path.resolve(calmOutFlag.slice('--calm-out='.length)) : null;
if (calmOut) fs.mkdirSync(calmOut, { recursive: true });
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

const { html, TERMS, TYPE_TAGS, PROV_TAGS, DOMAIN_TAGS, DIAGRAM_IDS, CALM } = data;
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
// Checked here rather than in the browser loop: without takeaways the detail
// view cannot render at all, so the loop would only report a render failure.
for (const t of TERMS) {
  if (!Array.isArray(t.takeaways) || t.takeaways.length === 0) err('takeaways', `${t.id}: no takeaways — every term has tiles`);
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

  // Badge numerals are part of the badge, not labels: a flow is meant to run
  // under its badge. Icons count as labels, so a stroke must not cross one.
  const texts = [...svg.querySelectorAll('text')]
    .filter((t) => t.textContent.trim() && !t.closest('.badge'))
    .map((t) => Object.assign(box(t), { s: t.textContent.trim().slice(0, 44) }));
  const icons = [...svg.querySelectorAll('.ico')].map((g) => Object.assign(box(g), { s: 'icon' }));
  const badges = [...svg.querySelectorAll('.badge')].map((g) => Object.assign(box(g), { s: 'badge ' + g.textContent.trim() }));

  // Zone rects are background regions that labels legitimately straddle.
  // An icon's own <rect> strokes (server, cpu, network) are part of the icon,
  // not boxes, and would otherwise report the icon as crossing itself.
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

  // (a) a label overlapping a box on both axes but not sitting inside it.
  // The incursion is reported in user units: a label clipping a corner by a
  // pixel is font-metric noise, one buried 15px into a box is a real defect.
  const clearance = [];
  for (const t of [...texts, ...icons, ...badges]) for (const q of rects) {
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
    if (el.closest('.ico, .badge')) continue;
    // stroke-bad is the decorative X struck over a broken primitive (pqc's
    // RSA/ECC, and 4 others). It is *meant* to sit on the label it cancels.
    if ((el.getAttribute('class') || '').includes('stroke-bad')) continue;
    // A node's own outline, rim or fold is not a stroke crossing its label.
    if ((el.getAttribute('class') || '').split(' ').includes('shape')) continue;
    const len = el.getTotalLength ? el.getTotalLength() : 0;
    if (!len) continue;
    const m = el.getScreenCTM();
    if (!m) continue;
    for (let i = 0; i <= 200; i++) {
      const raw = el.getPointAtLength(len * i / 200);
      const p = new DOMPoint(raw.x, raw.y).matrixTransform(m);
      for (const t of [...texts, ...icons]) {
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

  // A badge sitting on a label hides it: overlap beyond the 2-unit cushion.
  const badgeHits = [];
  for (const b of badges) for (const t of [...texts, ...icons]) {
    const ox = Math.min(b.r, t.r) - Math.max(b.x, t.x);
    const oy = Math.min(b.bot, t.bot) - Math.max(b.y, t.y);
    if (ox > 2 * scale && oy > 2 * scale) badgeHits.push({ badge: b.s, text: t.s });
  }

  return { rendered: true, labels: texts.length, clearance, collisions, overflow, badgeHits };
})()`;

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

// Reads the takeaway tiles and the explainer disclosure as rendered. A tile
// holds exactly three elements (eyebrow, title, text), plus the hidden prefix
// in the limitation tile's heading; more means the copy was parsed as markup.
// `title` is the heading's own text, without that prefix. `full` is whether a
// tile spans the whole grid.
const TAKEAWAYS_PROBE = `(() => {
  const root = document.querySelector('#detail-content');
  const list = root.querySelector('.takeaways');
  const more = root.querySelector('.explainer-more');
  const explainer = root.querySelector('.explainer');
  const width = list ? list.getBoundingClientRect().width : 0;
  return {
    tiles: [...root.querySelectorAll('.takeaways > .takeaway')].map((li) => ({
      eyebrow: (li.querySelector('.takeaway-eyebrow') || li).textContent.trim(),
      title: [...(li.querySelector('h3') || li).childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(''),
      text: (li.querySelector('p') || li).textContent,
      limit: li.classList.contains('takeaway-limit'),
      elements: li.querySelectorAll('*').length,
      overflow: li.scrollWidth > li.clientWidth + 1,
      full: Math.abs(li.getBoundingClientRect().width - width) < 2,
    })),
    heading: (() => {
      const h = list ? list.previousElementSibling : null;
      return !!(h && h.matches('h2.detail-section-label') && h.textContent.trim() === 'Takeaways');
    })(),
    more: !!more,
    open: more ? more.open : null,
    paraTexts: explainer ? [...explainer.querySelectorAll('p')].map((p) => p.textContent) : [],
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
    return Number(el.getAttribute('rx')) >= 16 ? 'rounded box' : 'square box';
  };
  const steps = (el) => { const s = el.closest('[data-s]'); return s ? s.dataset.s.trim().split(/\\s+/).map(Number).sort((a, b) => a - b) : []; };
  const point = (el, at) => { const p = el.getPointAtLength(at); const q = new DOMPoint(p.x, p.y).matrixTransform(el.getScreenCTM()); return { x: q.x, y: q.y }; };
  const where = (el) => (el.getAttribute('class') || el.tagName) + ' at ' +
    ['x', 'y', 'x1', 'y1', 'd'].map((a) => el.getAttribute(a)).filter(Boolean).join(',').slice(0, 40);

  // What a node's type word must keep clear of: every other label, icon and
  // badge, each with the words a report names it by.
  const owner = (el) => { const g = el.closest('[data-calm]'); return g ? ' of "' + g.dataset.calm + '"' : ''; };
  const marks = [
    ...[...svg.querySelectorAll('text')].filter((t) => !t.closest('.badge'))
      .map((t) => ({ el: t, s: t.matches('.calm-type') ? 'the type word' + owner(t) : '"' + t.textContent.trim().slice(0, 44) + '"' })),
    ...[...svg.querySelectorAll('.ico')].map((g) => ({ el: g, s: 'the icon' + owner(g) })),
    ...[...svg.querySelectorAll('.badge')].map((g) => ({ el: g, s: 'badge ' + g.textContent.trim() })),
  ].map((m) => Object.assign(m, rect(m.el)));
  // A mark is in the way when it shares the word's line, overlapping it by
  // more than the usual 2-unit cushion vertically, and either overlaps it or
  // sits under 3 units beside it: the page leaves 4 between a word and the
  // text beside it, so a word that only just misses was placed with no clear
  // corner. Stacked lines, whose boxes touch, are not in the way. Returns the
  // horizontal overlap in user units (negative for a gap), or null.
  const crowds = (a, b) => {
    const ox = Math.min(a.r, b.r) - Math.max(a.x, b.x), oy = Math.min(a.b, b.b) - Math.max(a.y, b.y);
    return oy > 2 * scale && ox > -3 * scale ? ox / scale : null;
  };
  const typeWords = (el, outline) => [...el.querySelectorAll('text.calm-type')].map((t) => {
    const w = rect(t), o = outline ? rect(outline) : null;
    return {
      s: t.textContent,
      inside: !!o && w.x >= o.x && w.r <= o.r && w.y >= o.y && w.b <= o.b,
      crowded: marks.filter((m) => m.el !== t).map((m) => ({ s: m.s, by: crowds(w, m) })).filter((m) => m.by !== null),
    };
  });

  const nodes = [], connectors = [];
  for (const el of svg.querySelectorAll('[data-calm]')) {
    const id = el.dataset.calm;
    if (el.matches(FLOWS)) {
      const a = point(el, 0), b = point(el, el.getTotalLength());
      const head = el.hasAttribute('marker-end'), tail = el.hasAttribute('marker-start');
      // Read tail to head. A lone marker-start means the line was drawn backwards.
      const back = tail && !head;
      connectors.push({ id, from: back ? b : a, to: back ? a : b, twoWay: head && tail, arrow: head || tail, steps: steps(el) });
    } else {
      const outline = el.matches(SHAPES) ? el : [...el.querySelectorAll(SHAPES)].find((s) => !s.closest('.ico'));
      nodes.push({
        id, box: rect(el),
        outline: outline ? rect(outline) : null, shape: outline ? kind(outline) : null,
        texts: [...el.querySelectorAll('text')].map((t) => t.textContent.trim()),
        words: typeWords(el, outline),
        nested: !!el.parentElement.closest('[data-calm]'),
      });
    }
  }
  const loose = (sel) => [...svg.querySelectorAll(sel)].filter((el) => !el.closest('.ico') && !el.closest('[data-note]'));
  const untagged = [
    ...loose(SHAPES).filter((el) => !el.closest('[data-calm]')),
    ...loose(FLOWS).filter((el) => !el.hasAttribute('data-calm')),
  ].map(where);
  const notes = [...svg.querySelectorAll('[data-note]')].map((el) => el.dataset.note);
  return { nodes, connectors, untagged, notes, tol: 6 * scale };
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
  const typeBad = (msg) => err('calm-type', `${id}: ${msg}`);
  const nodeIds = new Set(model.nodes.map((n) => n['unique-id']));
  const rels = new Map((model.relationships || []).map((r) => [r['unique-id'], relationshipShape(r)]));

  for (const u of d.untagged) bad(`untagged ${u} — tag it data-calm, move it into a node's group, or mark it data-note`);
  for (const n of new Set(d.notes)) {
    if (!NOTE_KINDS.includes(n)) bad(`data-note="${n}" is not one of ${NOTE_KINDS.join(', ')}`);
  }
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

    // The type word the page draws from the model: one, reading the type,
    // inside the outline, on nothing else.
    const word = node['node-type'].replace(/-/g, ' ').toUpperCase();
    if (!g.words.length) typeBad(`node "${nid}" has no type word — the page should draw "${word}" in it`);
    else if (g.words.length > 1) typeBad(`node "${nid}" has ${g.words.length} type words, want one`);
    for (const w of g.words) {
      if (w.s !== word) typeBad(`node "${nid}": its type word reads "${w.s}", want "${word}"`);
      if (g.shape && !w.inside) typeBad(`node "${nid}": its type word "${w.s}" is not inside its outline`);
      for (const o of w.crowded) {
        const what = o.by > 0 ? `overlaps ${o.s}` : `sits ${(-o.by).toFixed(1)} units beside ${o.s}`;
        typeBad(`node "${nid}": its type word "${w.s}" ${what} — give the node a clear corner`);
      }
    }
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
    pool.set(rid, lines.filter((c) => c.dir).sort((a, b) => (a.steps[0] ?? Infinity) - (b.steps[0] ?? Infinity)));
  }

  // The flow is a sub-story of the tour. Each transition needs a lit connector
  // of its own, drawn in its direction, and the transitions follow the tour: a
  // connector lit at several steps can serve a transition at any of them. A
  // two-way arrow needs a transition each way, and a connector drawn against
  // its relationship's direction needs a destination-to-source one. The tour
  // may also light a connector that is no transition, to show structure.
  const flow = (model.flows || [])[0];
  const arrowsLit = d.connectors.filter((c) => c.arrow && c.steps.length && rels.has(c.id));
  if (!flow && arrowsLit.length) bad(`the tour lights ${arrowsLit.length} arrow(s) but the model has no flow`);

  const wants = (flow ? flow.transitions : []).map((t) => ({
    n: t['sequence-number'], rid: t['relationship-unique-id'],
    dir: t.direction === 'destination-to-source' ? 'reverse' : 'forward',
  }));
  const allLines = [...pool.values()].flat();
  // The directions that must be claimed by a transition.
  const owed = (c) => (c.dir === 'both' ? ['forward', 'reverse'] : c.dir === 'reverse' ? ['reverse'] : []);

  // True if every transition from the i-th on can take a connector, with the
  // steps never going backwards and every owed direction claimed. Claims are
  // left in place on success and undone on failure.
  const fits = (i, prev) => {
    if (i === wants.length) return allLines.every((c) => owed(c).every((dir) => c[dir]));
    const w = wants[i];
    for (const c of pool.get(w.rid) || []) {
      if (c[w.dir] || !(c.dir === w.dir || c.dir === 'both')) continue;
      const at = c.steps.find((s) => s >= prev);
      if (at === undefined) continue;
      c[w.dir] = true;
      if (fits(i + 1, at)) return true;
      c[w.dir] = false;
    }
    return false;
  };

  if (fits(0, 0)) return;

  // No pairing works. Walk the transitions first-fit to say why.
  let prev = 0;
  for (const w of wants) {
    const c = (pool.get(w.rid) || []).find((x) => !x[w.dir] && (x.dir === w.dir || x.dir === 'both'));
    if (!c) { bad(`transition ${w.n} over "${w.rid}" has no ${w.dir} connector of its own`); continue; }
    c[w.dir] = true;
    const at = c.steps.find((s) => s >= prev);
    if (!c.steps.length) bad(`transition ${w.n}'s connector is never lit by the tour`);
    else if (at === undefined) bad(`flow order contradicts the tour: transition ${w.n} is lit no later than step ${c.steps[c.steps.length - 1]}, after one lit at step ${prev}`);
    else prev = at;
  }
  for (const c of allLines) {
    if (c.dir === 'reverse' && !c.reverse) bad(`a "${c.id}" connector is drawn against the relationship's direction with no destination-to-source transition`);
    if (c.dir === 'both' && !(c.forward && c.reverse)) {
      bad(`a two-way "${c.id}" connector needs a transition in each direction; draw it one-way if the model has no return traffic`);
    }
  }
}

// Reads the "CALM model" disclosure as rendered. `markup` counts the elements
// inside the JSON block: one, the <code>, unless the JSON was parsed as HTML.
const CALM_BOX_PROBE = `(() => {
  const d = document.querySelector('#detail-content .calm-more');
  if (!d) return { present: false };
  const pre = d.querySelector('.calm-json');
  const prev = d.previousElementSibling;
  return {
    present: true, open: d.open,
    counts: (d.querySelector('.calm-counts') || d).textContent.trim(),
    text: pre ? pre.textContent : '',
    markup: pre ? pre.querySelectorAll('*').length : 0,
    copy: !!d.querySelector('button[data-calm-copy]'),
    download: !!d.querySelector('button[data-calm-download]'),
    afterExplainer: !!(prev && prev.matches('.explainer-more')),
    focusable: !!pre && pre.tabIndex === 0 && pre.getAttribute('role') === 'region' && !!pre.getAttribute('aria-label'),
    overflow: d.scrollWidth > d.clientWidth + 1 || d.getBoundingClientRect().right > document.documentElement.clientWidth + 1,
    rendered: ['button[data-calm-copy]', 'button[data-calm-download]', '.calm-json'].every((s) => { const el = d.querySelector(s); return !!el && el.getClientRects().length > 0; }),
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
  root.querySelector('.calm-status').textContent = '';
  stub(undefined);
  const missing = await press();
  return { ok, refused, missing, wrote: wrote[0] };
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
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const steps = (model.flows || []).reduce((n, f) => n + f.transitions.length, 0);
  const wantCounts = [plural(model.nodes.length, 'node'), plural(model.relationships.length, 'relationship'), ...(steps ? [plural(steps, 'flow step')] : [])].join(' · ');
  if (box.counts !== wantCounts) bad(`the counts line reads "${box.counts}", want "${wantCounts}"`);
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

  if (copied.missing !== 'Copy failed') bad(`a missing clipboard is not reported (status "${copied.missing}", want "Copy failed")`);

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 5000 }),
    page.click('#detail-content [data-calm-download]'),
  ]).catch(() => [null]);
  if (!download) bad('Download does not start a download');
  else {
    const name = download.suggestedFilename();
    if (name !== `${t.id}.calm.json`) bad(`Download saves "${name}", want "${t.id}.calm.json"`);
    const saved = await download.path();
    if (!saved || fs.readFileSync(saved, 'utf8') !== box.text + '\n') bad('Download does not save the JSON the disclosure shows');
    if (calmOut) await download.saveAs(path.join(calmOut, `${t.id}.calm.json`));
    await download.delete();
  }

  await page.setViewportSize({ width: 375, height: 812 });
  const narrow = await page.evaluate(CALM_BOX_PROBE);
  if (!narrow.present || !narrow.open) bad('the CALM disclosure is not present and open at 375px');
  else {
    if (narrow.text !== box.text) bad('the disclosure JSON changes at 375px');
    if (!narrow.rendered) bad('Copy, Download or the JSON block is not rendered at 375px');
    if (!narrow.focusable) bad('the JSON block cannot be reached by keyboard at 375px');
    if (narrow.overflow) bad('the open disclosure overflows at 375px');
  }
  await page.setViewportSize({ width: 1440, height: 1200 });
}

const tocIds = `(() => [...document.querySelectorAll('#toc [data-toc]')].map((e) => e.dataset.toc))()`;

// Lays the page out so every face its text needs is requested, waits for font
// loading to settle, then returns the families the page's font stylesheet names
// (its family= parameters, so nothing is hard-coded here) that have no loaded
// face. The wait is capped: a font request that hangs must not hang the run.
const FONTS_PROBE = `(async () => {
  document.body.getBoundingClientRect();
  await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 10000))]);
  const want = [...document.querySelectorAll('link[rel="stylesheet"]')]
    .flatMap((l) => new URL(l.href).searchParams.getAll('family')).map((f) => f.split(':')[0]);
  const loaded = new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, '')));
  return want.filter((f) => !loaded.has(f));
})()`;

const FILE = pathToFileURL(source).href;
const { browser, label } = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });

// --offline: answer every request that is not a local file with an empty
// response, so the run cannot wait on the network. The fixture suites use it.
// The page then renders in its fallback fonts, which is why a real run must
// not: the geometry checks measure text in the page's own fonts. An empty
// reply rather than an abort, because an aborted request logs a console error.
if (flags.offline) {
  await page.route((url) => url.protocol !== 'file:' && url.protocol !== 'blob:', (route) => route.fulfill({
    status: 200,
    contentType: route.request().resourceType() === 'stylesheet' ? 'text/css' : 'text/plain',
    body: '',
  }));
}

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

// A real run measures the page's own fonts: wait for them, and say so if they
// never arrive rather than pass on fallback metrics. --offline renders fallback
// fonts by design, so it is exempt.
let waitForFonts = !flags.offline;
if (waitForFonts) {
  const missing = await page.evaluate(FONTS_PROBE);
  if (missing.length) {
    err('fonts', `web fonts did not load (${missing.join(', ')}) — geometry was measured in fallback fonts`);
    waitForFonts = false;   // one capped wait for the run, not one per term
  }
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
    const wantTitle = `${t.term} — Visual Tech Glossary`;
    await page.waitForFunction(`document.title === ${JSON.stringify(wantTitle)}`, null, { timeout: 5000 });
    await page.waitForSelector('#detail-content svg.dg', { timeout: 5000 });
    // This term's text may need a face that nothing before it did.
    if (waitForFonts) await page.evaluate(FONTS_PROBE);
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
  for (const b of found.badgeHits)  err('badge', `${t.id}: ${b.badge} covers "${b.text}"`);

  if (!t.steps) err('tour', `${t.id}: no steps — every diagram is a tour`);
  else {
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

  // Takeaway tiles. A term without them was reported by the static check.
  const wantParas = t.explainer.split(/\n\s*\n/).map((p) => p.trim());
  const tk = await page.evaluate(TAKEAWAYS_PROBE);
  if (t.takeaways) {
    const n = t.takeaways.length;
    if (tk.tiles.length !== n) err('takeaways', `${t.id}: ${tk.tiles.length} tiles for ${n} takeaways`);
    if (!tk.heading) err('takeaways', `${t.id}: no "Takeaways" heading directly before the tiles`);
    tk.tiles.forEach((tile, i) => {
      const want = t.takeaways[i];
      if (!want) return;
      const last = i === n - 1;
      const eyebrow = last ? 'Limitation' : String(i + 1).padStart(2, '0');
      const elements = last ? 4 : 3;
      if (tile.elements !== elements) err('takeaways', `${t.id}: tile ${i + 1} holds ${tile.elements} elements, want ${elements} — copy was parsed as markup`);
      if (tile.title !== want.title) err('takeaways', `${t.id}: tile ${i + 1} title does not match takeaways[${i}].title`);
      if (tile.text !== want.text) err('takeaways', `${t.id}: tile ${i + 1} text does not match takeaways[${i}].text`);
      if (tile.limit !== last) err('takeaways', `${t.id}: tile ${i + 1} ${tile.limit ? 'is' : 'is not'} marked as the limitation`);
      if (tile.eyebrow !== eyebrow) err('takeaways', `${t.id}: tile ${i + 1} eyebrow is "${tile.eyebrow}", want "${eyebrow}"`);
      if (tile.overflow) err('takeaways', `${t.id}: tile ${i + 1} overflows at 1440px`);
      if (tile.full !== (last && n % 2 === 1)) err('takeaways', `${t.id}: tile ${i + 1} ${tile.full ? 'spans' : 'does not span'} both columns at 1440px`);
    });

    // What assistive technology gets, read from the accessibility tree: a list
    // of headings names only the last tile as the limitation, and that tile's
    // visible label is not announced a second time.
    if (n && tk.tiles.length === n) {
      const list = page.locator('#detail-content .takeaways');
      const lastTitle = t.takeaways[n - 1].title;
      const named = await list.getByRole('heading', { level: 3, name: `Limitation: ${lastTitle}`, exact: true }).count();
      const prefixed = await list.getByRole('heading', { level: 3, name: /^Limitation: / }).count();
      if (named !== 1 || prefixed !== 1) err('takeaways', `${t.id}: a screen reader's headings should name only the last tile "Limitation: ${lastTitle}" (${named} so named, ${prefixed} with the prefix)`);
      // The tile should expose a heading and a paragraph, and no loose text.
      const exposed = await list.locator('> .takeaway').last().ariaSnapshot();
      if (/\n\s+- text:/.test(exposed)) err('takeaways', `${t.id}: the limitation tile's visible label is announced as well as its heading`);
    }

    if (!tk.more) err('takeaways', `${t.id}: no "Full explainer" disclosure`);
    else {
      if (tk.open) err('takeaways', `${t.id}: disclosure is open when the term opens`);
      if (!tk.inMore) err('takeaways', `${t.id}: the explainer is not inside the disclosure`);
      else if (tk.paraTexts.length !== wantParas.length || tk.paraTexts.some((x, i) => x !== wantParas[i])) {
        err('takeaways', `${t.id}: the disclosure's text does not match the explainer (${tk.paraTexts.length} paragraph(s), want ${wantParas.length})`);
      }

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

  // Check (e). A term without a model is skipped until every term has one.
  const model = CALM[t.id];
  if (model) {
    checkDrawing(t.id, model, await page.evaluate(CALM_PROBE));
    await checkDisclosure(t, model);
  }

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
