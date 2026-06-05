// Shared Chromium launcher used by screenshot.mjs and a11y.mjs.
//
// Tries Google Chrome (via Playwright's `channel: 'chrome'`), then the
// Playwright-bundled Chromium, then a list of common system paths. Returns
// `{ browser, label }`; throws with an install hint when nothing works.
//
// On Ubuntu ARM64 / WSL where `npx playwright install chromium` errors out,
// `sudo snap install chromium` and the snap path (/snap/bin/chromium) is the
// usual rescue. Override via PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH.

import { chromium } from 'playwright';

const FALLBACK_PATHS = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  '/snap/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].filter(Boolean);

export async function launchBrowser(opts = {}) {
  try {
    const browser = await chromium.launch({ channel: 'chrome', ...opts });
    return { browser, label: 'Google Chrome' };
  } catch {}

  try {
    const browser = await chromium.launch(opts);
    return { browser, label: 'bundled Chromium' };
  } catch {}

  for (const executablePath of FALLBACK_PATHS) {
    try {
      const browser = await chromium.launch({ executablePath, ...opts });
      return { browser, label: executablePath };
    } catch {}
  }

  throw new Error(
    'No Chrome/Chromium found. Install via `sudo snap install chromium` or set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH.'
  );
}
