# Optional self-hosted Indic fonts

The app renders Devanagari, Gujarati, Telugu and Tamil with system fonts by default
(see `src/features/a11y/indic-fonts.css`). To guarantee identical rendering on every device,
add Noto Sans (SIL Open Font License 1.1 — free to self-host and redistribute) here.

Expected file names (woff2, variable weight preferred):

- `noto-sans-devanagari.woff2`  (Hindi, Marathi)
- `noto-sans-gujarati.woff2`
- `noto-sans-telugu.woff2`
- `noto-sans-tamil.woff2`

## How to add one

1. Download the family from https://fonts.google.com/noto (or github.com/notofonts) — one time,
   on your machine. Do not link to Google Fonts from the site.
2. Subset to the script plus Latin punctuation and convert to woff2, e.g.
   `pyftsubset NotoSansDevanagari-VF.ttf --unicodes="U+0900-097F,U+200C-200D,U+20B9,U+25CC,U+0020-007E" --flavor=woff2 --layout-features='*' --output-file=noto-sans-devanagari.woff2`
   (from `pip install fonttools brotli`). Keep `--layout-features='*'` — Indic shaping needs them.
3. Drop the file in this folder, then uncomment its `url(...)` line in the matching
   `@font-face` in `src/features/a11y/indic-fonts.css` (commented out by default: on an SPA host a
   missing file is answered with index.html, which browsers log as a font decode error). The
   browser only downloads the font when that script is on screen.
4. Keep the OFL licence text alongside (e.g. `OFL.txt`).

Expect roughly 40–120 KB per script after subsetting. With the lines commented out the browser
uses the system stack.
