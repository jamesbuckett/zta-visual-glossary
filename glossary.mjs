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
import { fileURLToPath } from 'url';
import { readTerms } from './_terms.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(root, 'index.html');
const target = path.join(root, 'glossary.txt');

const { TERMS } = readTerms(source);

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
