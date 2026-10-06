#!/usr/bin/env node
// test/tour-fixtures.mjs — proves validate.mjs and verify.mjs catch broken
// diagram tours. Builds throwaway copies of index.html in a temp dir with a
// synthetic tour on the WireGuard entry (its diagram is replaced wholesale, so
// the fixture does not depend on the real drawing), then runs each checker and
// asserts the exit code and the rule it reports.
//
// Usage: npm run test:tour

import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { readTerms, declSpan } from '../_terms.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

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

// A local server that accepts connections and never answers. One case points
// the page's font stylesheet at it to prove the suites, which run verify with
// --offline, cannot be held up by the network.
const silent = net.createServer(() => {});
await new Promise((resolve) => silent.listen(0, '127.0.0.1', resolve));
const SILENT_HOST = `http://127.0.0.1:${silent.address().port}/css2`;

const GOOD_STEPS = `steps: [
        { title: "Peer A", text: "Peer A is identified by its public key." },
        { title: "Peer B", text: "Peer B is identified by its public key." },
        { title: "The tunnel", text: "The two peers exchange encrypted packets." }
      ],
      fact: "Each peer is known only by its public key."`;

// Replaces the wireguard entry's tour fields with `tour`. The real tour is
// stripped first, so a case that omits a field (the missing-fact case) really
// omits it rather than inheriting the entry's own.
function withTour(html, tour) {
  html = html.replace(/(id: "wireguard"[\s\S]*?),\n\s*steps: \[[\s\S]*?\],\n\s*fact: "[^"]*"/, '$1');
  const at = html.indexOf('id: "wireguard"');
  const close = html.indexOf('\n    }', at);
  return html.slice(0, close) + `,\n      ${tour}` + html.slice(close);
}

function withDiagram(html, svg) {
  html = html.replace(/ {4}wireguard: \(\) => `[\s\S]*?<\/svg>`/, `    wireguard: () => \`${svg}\``);
  const { from, end } = declSpan(html, 'CALM', '{', '}');
  return html.slice(0, from) + JSON.stringify({ ...CALM, wireguard: FIXTURE_MODEL }, null, 2) + html.slice(end + 1);
}

const svg = ({ b = '2', badgeAt = '360, 100', nestBadge = false } = {}) => {
  const bdg = `\${badge(3, ${badgeAt}, 3)}`;
  return `
      <svg class="dg" viewBox="0 0 720 200" role="img" xmlns="http://www.w3.org/2000/svg" aria-label="fixture">
        <g data-s="1" data-calm="peer-a"><rect class="box" x="40" y="60" width="200" height="80" rx="10"/>\${icon('user', 56, 76)}<text class="t-b" x="92" y="94">Peer A</text>${nestBadge ? bdg : ''}</g>
        <g data-s="${b}" data-calm="peer-b"><rect class="box" x="480" y="60" width="200" height="80" rx="10"/><text class="t-b" x="500" y="94">Peer B</text></g>
        <line class="flow" data-s="3" data-calm="tunnel" x1="240" y1="100" x2="478" y2="100" marker-end="url(#ah-mut)"/>
        ${nestBadge ? '' : bdg}
      </svg>`;
};

const CASES = [
  // [name, html, checker, expected exit, rule expected in the report]
  ['good tour validates', withDiagram(withTour(base, GOOD_STEPS), svg()), 'validate', 0, null],
  ['two steps rejected', withTour(base, `steps: [{ title: "Step A", text: "a" }, { title: "Step B", text: "b" }], fact: "f"`), 'validate', 1, 'tour-data'],
  ['empty step text rejected', withTour(base, `steps: [{ title: "Step A", text: "a" }, { title: "Step B", text: " " }, { title: "Step C", text: "c" }], fact: "f"`), 'validate', 1, 'tour-data'],
  ['non-string step title rejected', withTour(base, `steps: [{ title: 42, text: "a" }, { title: "Step B", text: "b" }, { title: "Step C", text: "c" }], fact: "f"`), 'validate', 1, 'tour-data'],
  ['non-string step text rejected', withTour(base, `steps: [{ title: "Step A", text: 42 }, { title: "Step B", text: "b" }, { title: "Step C", text: "c" }], fact: "f"`), 'validate', 1, 'tour-data'],
  ['missing fact rejected', withTour(base, `steps: [{ title: "Step A", text: "a" }, { title: "Step B", text: "b" }, { title: "Step C", text: "c" }]`), 'validate', 1, 'tour-data'],
  ['non-string fact rejected', withTour(base, `steps: [{ title: "Step A", text: "a" }, { title: "Step B", text: "b" }, { title: "Step C", text: "c" }], fact: 42`), 'validate', 1, 'tour-data'],
  ['one-word title rejected', withTour(base, GOOD_STEPS.replace('title: "Peer A"', 'title: "Peer"')), 'validate', 1, 'tour-data'],
  ['five-word title rejected', withTour(base, GOOD_STEPS.replace('title: "The tunnel"', 'title: "The tunnel between the peers"')), 'validate', 1, 'tour-data'],
  ['term without a tour rejected',
    base.replace(/(id: "wireguard"[\s\S]*?),\n\s*steps: \[[\s\S]*?\],\n\s*fact: "[^"]*"/, '$1'),
    'validate', 1, 'tour-data'],
  ['space-padded label rejected', withDiagram(withTour(base, GOOD_STEPS), svg().replace('>Peer B<', '>Peer    B<')), 'validate', 1, 'svg-whitespace'],
  // Enabled by the Task 4 checks (tour stepping and badge/icon geometry).
  ['good tour verifies', withDiagram(withTour(base, GOOD_STEPS), svg()), 'verify', 0, null],
  // If --offline stopped intercepting requests, this page's load event would
  // never fire and verify would time out after 30 seconds.
  ['offline verify does not wait on a font host that never answers',
    withDiagram(withTour(base, GOOD_STEPS), svg()).replace('https://fonts.googleapis.com/css2', SILENT_HOST),
    'verify', 0, null],
  // A real run measures the page's own fonts, so it must say when they never
  // arrive. A closed local port refuses at once: no network, no waiting.
  ['real verify reports web fonts that never load',
    withDiagram(withTour(base, GOOD_STEPS), svg()).replace('https://fonts.googleapis.com/css2', 'http://127.0.0.1:1/css2'),
    'verify-online', 1, 'fonts'],
  ['step that lights nothing', withDiagram(withTour(base, GOOD_STEPS), svg({ b: '1' })), 'verify', 1, 'tour'],
  ['step number out of range', withDiagram(withTour(base, GOOD_STEPS), svg({ b: '2 4' })), 'verify', 1, 'tour'],
  ['nested data-s', withDiagram(withTour(base, GOOD_STEPS), svg({ nestBadge: true })), 'verify', 1, 'tour'],
  ['badge over a label', withDiagram(withTour(base, GOOD_STEPS), svg({ badgeAt: '120, 90' })), 'verify', 1, 'badge'],
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
    : [path.join(root, 'verify.mjs'), 'wireguard', `--target=${file}`, '--json', ...(checker === 'verify' ? ['--offline'] : [])];
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
