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
  ['non-string title rejected', () => withTakeaways(base, set(A, B, '{ title: 42, text: "It does not distribute keys for you." }')), 'validate', 1, 'takeaways-data', /non-empty title and text/],
  ['one-word title rejected', () => withTakeaways(base, set(A, B, card('Manual', 'It does not distribute keys for you.'))), 'validate', 1, 'takeaways-data', /has 1 words/],
  ['five-word title rejected', () => withTakeaways(base, set(A, B, card('Keys are yours to manage', 'It does not distribute keys for you.'))), 'validate', 1, 'takeaways-data', /has 5 words/],
  ['31-word text rejected', () => withTakeaways(base, set(A, B, card('Keys are manual', words(31)))), 'validate', 1, 'takeaways-data', /has 31 words/],
  // Upper-cased and double-spaced: the comparison must ignore case and spacing.
  ['text copied from a tour step rejected', () => withTakeaways(base, set(A, B, card('Copied from tour', wireguard.steps[0].text.toUpperCase().replace(/ /g, '  ')))), 'validate', 1, 'takeaways-data', /repeats a tour step/],
  ['text copied from the key fact rejected', () => withTakeaways(base, set(A, B, card('Copied from fact', wireguard.fact))), 'validate', 1, 'takeaways-data', /repeats a tour step/],

  // Rendered checks. Three tiles: the last spans both columns. Four: none does.
  ['good takeaways verify', () => withTakeaways(base, GOOD), 'verify', 0, null],
  ['four takeaways verify', () => withTakeaways(base, set(A, B, D, C)), 'verify', 0, null],
  ['term without takeaways rejected', () => withTakeaways(base, null), 'validate', 1, 'takeaways-data', /array of 3–5/],
  ['term without takeaways caught by verify', () => withTakeaways(base, null), 'verify', 1, 'takeaways', /no takeaways/],
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
    'verify', 1, 'takeaways', /does not open the disclosure/],
  ['tile span rule removed caught',
    () => swap(withTakeaways(base, GOOD), '.takeaway:last-child:nth-child(odd) { grid-column: 1 / -1; }', ''),
    'verify', 1, 'takeaways', /both columns/],
  ['disclosure starting open caught',
    () => swap(withTakeaways(base, GOOD), '<details class="explainer-more">', '<details class="explainer-more" open>'),
    'verify', 1, 'takeaways', /open when the term opens/],
  ['explainer text altered caught',
    () => swap(withTakeaways(base, GOOD), '<div class="explainer">${paras}</div>', '<div class="explainer"><p>x</p></div>'),
    'verify', 1, 'takeaways', /does not match the explainer/],
  ['empty takeaways caught by verify', () => withTakeaways(base, 'takeaways: []'), 'verify', 1, 'takeaways', /no takeaways/],
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
