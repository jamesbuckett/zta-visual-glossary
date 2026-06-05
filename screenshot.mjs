import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { launchBrowser } from './_launch.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// -----------------------------------------------------------------------------
// CLI parsing
// -----------------------------------------------------------------------------

const VALID_MODES = ['full', 'fold', 'section', 'toggle', 'dark'];

const positional = [];
const flags = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === '--help' || a === '-h') {
    printHelp();
    process.exit(0);
  } else if (a.startsWith('--mode=')) {
    flags.mode = a.slice('--mode='.length);
  } else if (a.startsWith('--sel=')) {
    flags.sel = a.slice('--sel='.length);
  } else if (a.startsWith('--')) {
    console.error(`screenshot.mjs: unknown flag: ${a}`);
    printHelp();
    process.exit(1);
  } else {
    positional.push(a);
  }
}

const target = positional[0] || path.join(process.cwd(), 'index.html');
const mode = flags.mode || 'full';
const selector = flags.sel;

if (!VALID_MODES.includes(mode)) {
  console.error(`screenshot.mjs: unknown mode "${mode}". Valid: ${VALID_MODES.join(', ')}`);
  process.exit(1);
}
if (mode === 'section' && !selector) {
  console.error('screenshot.mjs: --mode=section requires --sel=<css-selector>');
  process.exit(1);
}

const isUrl = /^https?:\/\//.test(target);
if (!isUrl && !fs.existsSync(target)) {
  console.error(`screenshot.mjs: target not found: ${target}`);
  process.exit(1);
}

const outDir = path.join(process.cwd(), 'screenshots');
fs.mkdirSync(outDir, { recursive: true });

const url = isUrl ? target : `file://${path.resolve(target)}`;

const viewports = [
  { name: 'mobile',  width: 375,  height: 812,  deviceScaleFactor: 3 },
  { name: 'tablet',  width: 768,  height: 1024, deviceScaleFactor: 2 },
  { name: 'desktop', width: 1440, height: 900,  deviceScaleFactor: 2 },
];

// Chrome canvas limit is ~16384px in any dimension; with @2x/@3x scale
// factors the effective ceiling on CSS-pixel height drops. Stay safe.
const CSS_HEIGHT_CEILING = 5000;

function printHelp() {
  console.log('Usage: node screenshot.mjs [path-or-url] [--mode=<mode>] [--sel=<css>]');
  console.log('');
  console.log('  Defaults to ./index.html when no path is given.');
  console.log('  Output goes to ./screenshots/.');
  console.log('');
  console.log('Modes:');
  console.log('  full      Full-page stitched per viewport (mobile/tablet/desktop).');
  console.log('            The default. The shape to use for the deliverable artifact.');
  console.log('  fold      Above-the-fold viewport-only capture per viewport.');
  console.log('            Fastest way to verify header/hero changes during iteration.');
  console.log('  section   Scroll one element into view and capture its bounding box.');
  console.log('            Requires --sel=<css-selector>. Useful for focused review.');
  console.log('  toggle    Capture each interactive state of the page in turn:');
  console.log('            theme light/dark (if #theme-toggle exists) and');
  console.log('            audience exec/practitioner (if .audience-switch exists).');
  console.log('  dark      Force dark mode via localStorage, then full-page stitched.');
  console.log('');
  console.log('Examples:');
  console.log('  node screenshot.mjs                                # full, default file');
  console.log('  node screenshot.mjs ./index.html --mode=fold       # fold for iteration');
  console.log('  node screenshot.mjs --mode=section --sel=#features # one section');
  console.log('  node screenshot.mjs --mode=toggle                  # all toggle states');
  console.log('  node screenshot.mjs --mode=dark                    # dark-theme deliverable');
}

// -----------------------------------------------------------------------------
// Browser launch — Chrome, then bundled Chromium, then system fallback paths.
// -----------------------------------------------------------------------------

const { browser, label: browserLabel } = await launchBrowser();
console.log(`Browser: ${browserLabel}`);

// -----------------------------------------------------------------------------
// Capture loop
// -----------------------------------------------------------------------------

try {
  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.deviceScaleFactor,
      reducedMotion: 'reduce',
    });

    // For dark mode, set the localStorage flag before page scripts run so the
    // template's theme bootstrap reads it on first paint.
    if (mode === 'dark') {
      await context.addInitScript(() => {
        try { localStorage.setItem('theme', 'dark'); } catch {}
      });
    }

    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);

    switch (mode) {
      case 'full':
        await captureFullPage(page, vp, `${vp.name}.png`);
        break;
      case 'dark':
        await captureFullPage(page, vp, `dark-${vp.name}.png`);
        break;
      case 'fold':
        await captureFold(page, vp, `fold-${vp.name}.png`);
        break;
      case 'section':
        await captureSection(page, vp, selector);
        break;
      case 'toggle':
        await captureToggle(page, vp);
        break;
    }

    await context.close();
  }
} finally {
  await browser.close();
}

// -----------------------------------------------------------------------------
// Capture helpers
// -----------------------------------------------------------------------------

async function captureFullPage(page, vp, filename) {
  const fullHeight = await page.evaluate(() =>
    Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.offsetHeight
    )
  );

  const file = path.join(outDir, filename);

  if (fullHeight <= CSS_HEIGHT_CEILING) {
    await page.screenshot({ path: file, fullPage: true });
    console.log(`Saved ${file} (${vp.width}x${fullHeight})`);
  } else {
    const stitched = await captureTall(page, vp, fullHeight, file);
    if (stitched) {
      console.log(`Saved ${file} (${vp.width}x${fullHeight}, stitched)`);
    } else {
      await page.screenshot({ path: file, fullPage: false });
      console.warn(
        `Saved ${file} (viewport only — page is ${fullHeight}px, install sharp for stitched capture: npm i -D sharp)`
      );
    }
  }
}

async function captureFold(page, vp, filename) {
  const file = path.join(outDir, filename);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`Saved ${file} (${vp.width}x${vp.height}, above-fold)`);
}

async function captureSection(page, vp, sel) {
  const handle = await page.$(sel);
  if (!handle) {
    console.warn(`screenshot.mjs: selector "${sel}" matched nothing at ${vp.name}, skipping`);
    return;
  }
  await handle.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  // Sanitize selector for use in a filename
  const slug = sel.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'section';
  const file = path.join(outDir, `section-${slug}-${vp.name}.png`);
  await handle.screenshot({ path: file });
  console.log(`Saved ${file}`);
}

async function captureToggle(page, vp) {
  // Always capture the default state first.
  const baseFile = path.join(outDir, `toggle-default-${vp.name}.png`);
  await page.screenshot({ path: baseFile, fullPage: false });
  console.log(`Saved ${baseFile}`);

  // Theme toggle, if the template's #theme-toggle button is present.
  const hasThemeToggle = await page.$('#theme-toggle');
  if (hasThemeToggle) {
    await page.click('#theme-toggle');
    await page.waitForTimeout(150);
    const darkFile = path.join(outDir, `toggle-theme-dark-${vp.name}.png`);
    await page.screenshot({ path: darkFile, fullPage: false });
    console.log(`Saved ${darkFile}`);
    // Toggle back to light so subsequent audience captures aren't in dark mode.
    await page.click('#theme-toggle');
    await page.waitForTimeout(120);
  }

  // Audience switcher, if skill-build-educational-site's .audience-switch is present.
  const practitionerRadio = await page.$('.audience-switch [data-audience="practitioner"]');
  if (practitionerRadio) {
    await practitionerRadio.click();
    await page.waitForTimeout(150);
    const pFile = path.join(outDir, `toggle-audience-practitioner-${vp.name}.png`);
    await page.screenshot({ path: pFile, fullPage: false });
    console.log(`Saved ${pFile}`);
  }
}

async function captureTall(page, vp, fullHeight, outPath) {
  let sharp;
  try {
    ({ default: sharp } = await import('sharp'));
  } catch {
    return false;
  }

  const scale = vp.deviceScaleFactor;
  const stepHeight = vp.height;
  const slices = [];
  let y = 0;
  while (y < fullHeight) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(50);
    const remaining = fullHeight - y;
    const clipHeight = Math.min(stepHeight, remaining);
    const buf = await page.screenshot({
      clip: { x: 0, y: 0, width: vp.width, height: clipHeight },
    });
    slices.push({ input: buf, top: y * scale, left: 0 });
    y += stepHeight;
  }

  await sharp({
    create: {
      width: vp.width * scale,
      height: fullHeight * scale,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite(slices)
    .png()
    .toFile(outPath);

  return true;
}
