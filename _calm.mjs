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
// The schema every model the page shows or downloads declares.
export const CALM_SCHEMA = 'https://calm.finos.org/release/1.2/meta/calm.json';

// The only values data-note may take: what a drawn mark is, when it is not a
// component or a relationship. verify.mjs rejects any other.
export const NOTE_KINDS = ['call-out', 'footer', 'elided', 'self-loop', 'struck-through', 'becomes'];

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
      if (s.kind === 'interacts') {
        const actor = nodes.find((n) => n['unique-id'] === s.from);
        if (actor && actor['node-type'] !== 'actor') err(`${id}: relationship "${rid}" is interacts, but "${s.from}" is typed ${actor['node-type']}, not actor`);
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
