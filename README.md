# ZTA Visual Glossary

[![License](https://img.shields.io/github/license/jamesbuckett/zta-visual-glossary)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/jamesbuckett/zta-visual-glossary?style=social)](https://github.com/jamesbuckett/zta-visual-glossary/stargazers)
[![Last commit](https://img.shields.io/github/last-commit/jamesbuckett/zta-visual-glossary)](https://github.com/jamesbuckett/zta-visual-glossary/commits)
[![Open issues](https://img.shields.io/github/issues/jamesbuckett/zta-visual-glossary)](https://github.com/jamesbuckett/zta-visual-glossary/issues)

> A browsable, searchable visual glossary of IT, networking, and zero-trust terms.

## About

Explains 88 IT, networking, and zero-trust terms on one self-contained HTML page. Each entry pairs a one-line TL;DR, a tight explainer, and a custom inline-SVG diagram — so concepts like TLS, mTLS, SPIFFE/SPIRE, and microsegmentation are something you can see, not just read. Browse the full set from a sticky A–Z table-of-contents sidebar, filter with search, or jump straight to any term. No build step and no dependencies: open `index.html` in a browser or visit the [live page](https://zta-visual-glossary.vercel.app).

## Usage

No install and no build — the glossary is a single self-contained HTML file.

```bash
# Open it directly
xdg-open index.html      # Linux
open index.html          # macOS
```

Use the search box to filter terms, the sticky A–Z sidebar to jump around, and click any entry to expand its explainer and diagram. Prefer not to download it? Visit the [live page](https://zta-visual-glossary.vercel.app).

For grepping or quick reference, [glossary.txt](glossary.txt) lists every term in plain text — expansion, TL;DR, type tags, and aliases. Regenerate it after editing a term:

```bash
npm run glossary
```

## Project Structure

```text
index.html       # the whole glossary — markup, styles, term data, and inline SVGs
glossary.txt     # plain-text listing of every term, generated from index.html
glossary.mjs     # regenerates glossary.txt (npm run glossary)
screenshot.mjs   # Playwright capture across desktop / tablet / mobile viewports
validate.mjs     # static linter enforcing the style-guide design rules
_launch.mjs      # shared Chromium launcher used by the tooling
screenshots/     # generated preview images
```

## Contributing

Issues and pull requests welcome. Please open an issue first to discuss substantial changes.

## License

[MIT](LICENSE) © 2026 James Buckett
