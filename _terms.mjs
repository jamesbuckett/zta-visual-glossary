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

// The keys of `const DIAGRAMS = { ... }` — one function per term id. Read as
// text rather than evaluated, because the functions close over DOM helpers.
export function diagramIds(html) {
  const start = html.indexOf('const DIAGRAMS = {');
  if (start === -1) throw new Error('could not find `const DIAGRAMS = {` in index.html');
  const block = html.slice(start, html.indexOf('\n  };', start));
  return [...block.matchAll(/^ {4}([A-Za-z0-9_]+):\s*\(\)\s*=>/gm)].map((m) => m[1]);
}

// Everything verify.mjs and glossary.mjs need, in one read.
export function readTerms(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  return {
    html,
    TERMS:       extractArray(html, 'TERMS'),
    TYPE_TAGS:   extractArray(html, 'TYPE_TAGS'),
    PROV_TAGS:   extractArray(html, 'PROV_TAGS'),
    DOMAIN_TAGS: extractArray(html, 'DOMAIN_TAGS'),
    DIAGRAM_IDS: diagramIds(html),
    CALM:        extractObject(html, 'CALM'),
  };
}
