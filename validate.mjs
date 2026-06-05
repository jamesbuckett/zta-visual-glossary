#!/usr/bin/env node
// validate.mjs — static linter for skill-style-guide compliant index.html.
//
// Encodes the design rules from SKILL.md as programmatic checks. Run after
// every edit to catch rule violations the eye misses (a second --accent, a
// stray hex in component CSS, an off-scale spacing value, a snuck-in emoji).
//
// Usage:
//   node validate.mjs                # ./index.html, human output, exit 1 on errors
//   node validate.mjs ./foo.html     # explicit target
//   node validate.mjs --json         # machine-readable JSON output
//   node validate.mjs --quiet        # silence warnings, only print errors

import fs from 'fs';
import path from 'path';

// -----------------------------------------------------------------------------
// CLI
// -----------------------------------------------------------------------------

const args = process.argv.slice(2);
const flags = {
  json:  args.includes('--json'),
  quiet: args.includes('--quiet') || args.includes('-q'),
  help:  args.includes('--help')  || args.includes('-h'),
};
const target = args.find((a) => !a.startsWith('-')) || './index.html';

if (flags.help) {
  console.log('Usage: node validate.mjs [path] [--json] [--quiet]');
  console.log('  Lints an index.html against the skill-style-guide rules.');
  console.log('  Exit 0 if clean, 1 if errors found, 2 if the target is missing.');
  process.exit(0);
}

if (!fs.existsSync(target)) {
  console.error(`validate.mjs: target not found: ${target}`);
  process.exit(2);
}

const rawHtml = fs.readFileSync(target, 'utf8');
// Strip HTML comments before scanning so the rules don't fire on documentation
// text like `<!-- mentions <meta name="description"> -->`. Replace each
// comment with same-length whitespace (preserving newlines) so the line
// numbers used in emoji error messages stay accurate.
const html = rawHtml.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
const errors = [];
const warnings = [];
const err  = (rule, msg) => errors.push({ rule, msg });
const warn = (rule, msg) => warnings.push({ rule, msg });

// -----------------------------------------------------------------------------
// Rules
// -----------------------------------------------------------------------------

// ----- single-file: no sibling .css/.js next to index.html ------------------

{
  const dir = path.dirname(path.resolve(target));
  const whitelist = new Set([
    'screenshot.mjs', 'validate.mjs', 'a11y.mjs', 'run-evals.mjs', '_launch.mjs',
  ]);
  const stray = fs.readdirSync(dir).filter((f) => {
    if (whitelist.has(f)) return false;
    return /\.(css|js|mjs|cjs|ts|jsx|tsx)$/.test(f);
  });
  if (stray.length) {
    err('single-file', `unexpected sibling files alongside ${path.basename(target)}: ${stray.join(', ')}`);
  }
}

// ----- structural meta ------------------------------------------------------

if (!/<!doctype\s+html>/i.test(html))            err('doctype',     'missing <!doctype html>');
if (!/<meta\s+charset\s*=/i.test(html))           err('meta-charset','missing <meta charset>');
if (!/<meta\s+name\s*=\s*"viewport"/i.test(html)) err('meta-viewport','missing viewport meta');
if (!/<title>[^<]+<\/title>/i.test(html))         err('title',       'missing or empty <title>');
if (!/<meta\s+name\s*=\s*"description"/i.test(html)) warn('meta-description', 'missing <meta name="description">');
if (!/<html[^>]*\blang\s*=/i.test(html))          warn('html-lang',  'missing lang attribute on <html>');

// ----- light default --------------------------------------------------------

if (/<html[^>]*\bdata-theme\s*=\s*"dark"/i.test(html)) {
  err('light-default', 'static <html> starts in dark mode; light must be the default');
}

// ----- emoji ----------------------------------------------------------------
// Conservative range — catches typical pictographs/symbols, spares ™ © ® ° etc.

const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F02F}]/u;
html.split('\n').forEach((line, i) => {
  if (emoji.test(line)) {
    const ch = line.match(emoji)[0];
    err('no-emoji', `line ${i + 1}: emoji "${ch}" in output — replace with a Lucide SVG`);
  }
});

// ----- external resources: only Google Fonts allowed ------------------------

const externals = [...html.matchAll(/<(?:script|link)[^>]+(?:src|href)\s*=\s*"([^"]+)"/gi)];
const allowedHosts = ['fonts.googleapis.com', 'fonts.gstatic.com'];
for (const [, url] of externals) {
  if (url.startsWith('#') || url.startsWith('/') || url.startsWith('./') || url.startsWith('mailto:')) continue;
  if (allowedHosts.some((h) => url.includes(h))) continue;
  // Specific named offenders get their own error message.
  if (/tailwindcss|tailwind\.css/i.test(url))           err('no-framework', `Tailwind CDN: ${url}`);
  else if (/bootstrap(\.min)?\.(?:js|css)/i.test(url))  err('no-framework', `Bootstrap: ${url}`);
  else if (/jquery/i.test(url))                          err('no-framework', `jQuery: ${url}`);
  else if (/unpkg\.com\/lucide|cdn\.jsdelivr\.net\/.*lucide/i.test(url))
    err('no-framework', `Lucide CDN — inline the SVG instead: ${url}`);
  else warn('external-resource', `unexpected external resource: ${url}`);
}

// ----- CSS analysis ---------------------------------------------------------
// All CSS rules below operate on the <style> block with comments stripped.

const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
const css = styleMatch ? styleMatch[1] : '';
const cssLive = css.replace(/\/\*[\s\S]*?\*\//g, '');

if (!css) {
  err('style-block', 'no <style> block found');
}

// ----- one-accent: exactly one uncommented --accent declaration -------------

const accentCount = (cssLive.match(/--accent\s*:/g) || []).length;
if (accentCount === 0)      err('one-accent', 'no --accent variable defined');
else if (accentCount > 1)   err('one-accent', `--accent declared ${accentCount} times (must be exactly one uncommented)`);

// ----- focus-visible-defined ------------------------------------------------

if (!/:focus-visible/.test(cssLive)) {
  err('focus-visible', 'no :focus-visible style defined — focus rings are required for accessibility');
}

// ----- prefers-reduced-motion respected -------------------------------------

if (/transition\s*:/i.test(cssLive) && !/prefers-reduced-motion\s*:\s*reduce/i.test(cssLive)) {
  warn('reduced-motion', 'transitions are defined but no @media (prefers-reduced-motion: reduce) override');
}

// ----- palette-vars: hex codes only inside :root or [data-theme="dark"] ----

const paletteAllowed = new Set(['#fff', '#ffffff', '#000', '#000000']); // text-on-accent fallbacks
for (const [, body] of cssLive.matchAll(/(?::root|\[data-theme\s*=\s*"dark"\])\s*\{([^}]*)\}/g)) {
  for (const m of body.matchAll(/#[0-9a-f]{3,8}/gi)) paletteAllowed.add(m[0].toLowerCase());
}

// Find hexes anywhere in the live CSS, then filter to those outside the
// allowed palette set. Dedup with occurrence count.
const offendingHex = new Map();
for (const m of cssLive.matchAll(/#[0-9a-f]{3,8}/gi)) {
  const hex = m[0].toLowerCase();
  if (paletteAllowed.has(hex)) continue;
  offendingHex.set(hex, (offendingHex.get(hex) || 0) + 1);
}
for (const [hex, count] of offendingHex) {
  err('palette-vars', `hex ${hex} used in component CSS (${count}x) — bind it to a variable in :root`);
}

// ----- spacing-scale: margin/padding/gap values must be on the scale --------

const spacingScale = new Set([0, 4, 8, 12, 16, 24, 32, 48, 64, 96]);
const spacingPropRe = /^(margin|padding|gap|row-gap|column-gap)(-[a-z-]+)?$/;
const offendingSpacing = new Map();
for (const m of cssLive.matchAll(/(?:^|\s|;|\{)([a-z-]+)\s*:\s*([^;}]+)/gi)) {
  const prop = m[1];
  const value = m[2];
  if (!spacingPropRe.test(prop)) continue;
  if (value.includes('var(') || value.includes('calc(') || value.includes('clamp(')) continue;
  for (const pxm of value.matchAll(/(-?\d+(?:\.\d+)?)px/g)) {
    const n = Math.abs(Number(pxm[1]));
    if (!spacingScale.has(n)) {
      const key = `${pxm[0]} on "${prop}"`;
      offendingSpacing.set(key, (offendingSpacing.get(key) || 0) + 1);
    }
  }
}
for (const [key, count] of offendingSpacing) {
  err('spacing-scale', `${key} (${count}x) — not on the 4/8/12/16/24/32/48/64/96 scale`);
}

// ----- branding: GitHub + Twitter/X + LinkedIn links to jamesbuckett --------

if (!/github\.com\/jamesbuckett/i.test(html))
  err('branding', 'missing GitHub link (github.com/jamesbuckett)');
if (!/(?:twitter|x)\.com\/jamesbuckett/i.test(html))
  err('branding', 'missing Twitter/X link (twitter.com/jamesbuckett or x.com/jamesbuckett)');
if (!/linkedin\.com\/in\/jamesbuckett/i.test(html))
  err('branding', 'missing LinkedIn link (linkedin.com/in/jamesbuckett)');

// -----------------------------------------------------------------------------
// Report
// -----------------------------------------------------------------------------

const ok = errors.length === 0;
const report = { target, ok, errors, warnings };

if (flags.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const RED   = '\x1b[31m';
  const YEL   = '\x1b[33m';
  const GRN   = '\x1b[32m';
  const DIM   = '\x1b[2m';
  const RESET = '\x1b[0m';
  const useColor = process.stdout.isTTY;
  const c = (code, s) => (useColor ? `${code}${s}${RESET}` : s);

  console.log(`${c(DIM, 'target:')} ${target}`);
  if (ok && warnings.length === 0) {
    console.log(c(GRN, '✓ clean — no rule violations'));
  } else {
    if (errors.length) {
      console.log(`\n${c(RED, `${errors.length} error${errors.length === 1 ? '' : 's'}:`)}`);
      for (const { rule, msg } of errors) console.log(`  ${c(RED, '✗')} ${c(DIM, rule.padEnd(16))} ${msg}`);
    }
    if (warnings.length && !flags.quiet) {
      console.log(`\n${c(YEL, `${warnings.length} warning${warnings.length === 1 ? '' : 's'}:`)}`);
      for (const { rule, msg } of warnings) console.log(`  ${c(YEL, '!')} ${c(DIM, rule.padEnd(16))} ${msg}`);
    }
  }
}

process.exit(ok ? 0 : 1);
