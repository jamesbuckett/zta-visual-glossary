#!/usr/bin/env node
// glossary.mjs — regenerates glossary.txt from the TERMS array in index.html.
//
// glossary.txt is a plain-text reference of every entry: term, expansion,
// TL;DR, type tags and aliases, sorted the same way the page sorts them.
// Re-run it after adding or editing a term so the two stay in sync.
//
// Usage:
//   node glossary.mjs        # rewrites ./glossary.txt, prints the term count
//   npm run glossary

import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(root, 'index.html');
const target = path.join(root, 'glossary.txt');

const html = fs.readFileSync(source, 'utf8');

// ----- pull the TERMS array literal out of the inline <script> ---------------
// The entries use template literals for `explainer`, so this can't be JSON;
// walk to the matching bracket, ignoring anything inside a string.

const start = html.indexOf('const TERMS = [');
if (start === -1) {
  console.error('glossary.mjs: could not find `const TERMS = [` in index.html');
  process.exit(2);
}

const open = html.indexOf('[', start);
let depth = 0, end = open, quote = null;
for (; end < html.length; end++) {
  const c = html[end];
  if (quote) {
    if (c === '\\') end++;
    else if (c === quote) quote = null;
    continue;
  }
  if (c === '"' || c === "'" || c === '`') quote = c;
  else if (c === '[') depth++;
  else if (c === ']' && --depth === 0) break;
}

if (depth !== 0) {
  console.error('glossary.mjs: unbalanced brackets — TERMS array is malformed');
  process.exit(2);
}

// Evaluated in a bare context with no globals: the literal is data from this
// repo's own index.html, and it can't reach anything if that ever changes.
const TERMS = vm.runInNewContext(html.slice(open, end + 1));

// ----- render ----------------------------------------------------------------

const entries = [...TERMS].sort((a, b) => a.term.localeCompare(b.term));
const lines = [
  'ZTA VISUAL GLOSSARY — TERM REFERENCE',
  `${entries.length} terms, alphabetical. Generated from index.html by glossary.mjs.`,
  'Format: TERM — expansion / full name',
  '         TL;DR',
  '         [type tags] · aliases',
  '',
  '='.repeat(72),
  '',
];

for (const t of entries) {
  const aliases = t.aliases?.length ? ` · aka ${t.aliases.join(', ')}` : '';
  lines.push(`${t.term} — ${t.acronym}`);
  lines.push(`    ${t.tldr}`);
  lines.push(`    [${(t.types || []).join(', ')}]${aliases}`);
  lines.push('');
}

fs.writeFileSync(target, lines.join('\n'));
console.log(`glossary.mjs: wrote ${entries.length} terms to ${path.basename(target)}`);
