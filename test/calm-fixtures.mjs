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
  ['download with different content caught', () => swap(page(), 'new Blob([text + "\\n"]', 'new Blob(["{}"]'), 'verify', 1, 'calm', /does not save the JSON/],
  ['controls hidden at phone width caught',
    () => swap(page(), '</style>', '@media (max-width: 400px) { .calm-actions { display: none; } }</style>'), 'verify', 1, 'calm', /375px/],
  ['missing clipboard not reported caught',
    () => swap(page(), 'Promise.resolve().then(() => navigator.clipboard.writeText(text))', 'navigator.clipboard.writeText(text)'), 'verify', 1, 'calm', /missing clipboard/],
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
