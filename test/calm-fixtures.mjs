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
