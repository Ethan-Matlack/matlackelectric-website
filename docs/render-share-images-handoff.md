# Hand-off: share / cover image renderer

Port `scripts/render-share-images.mjs` (attached) from the Life at the Nest site into this project. It renders brand-styled PNGs for a GitHub social preview (1280×640) and for link previews or slides (1200×800), using the site's own colours, fonts, and logo. Re-running it after a palette or logo change keeps the images in sync.

Treat the attached script as the reference implementation. Keep its structure and techniques; change the inputs, copy, and designs to fit this site.

## What it produces

Two designs, each at two sizes, written to `docs/images/share/` by default:

| File | Design |
|---|---|
| `share-arch-2x1-1280x640.png`, `share-arch-3x2-1200x800.png` | Light background, logo + tagline + URL on the left, a featured photo on the right (an arch shape on the reference site) |
| `share-wordmark-2x1-1280x640.png`, `share-wordmark-3x2-1200x800.png` | Dark brand background, logo recoloured to the light brand colour, tagline + URL, no photo |

Usage: `node scripts/render-share-images.mjs [--out <dir>] [--photo <file|url>] [--site <url>]`

## How it works

1. **No project dependencies.** It runs the system's Chromium/Chrome in headless mode (`spawnSync`) and screenshots a generated HTML page. It looks for `CHROME_PATH`, then `chromium`, `chromium-browser`, `google-chrome`, and `google-chrome-stable`. Don't add Playwright or Puppeteer.
2. **Colours come from the theme file.** It regex-reads `--color-<name>: #rrggbb` from `src/styles/theme.css`. Only 6-digit hex values are matched, and a missing token throws.
3. **The logo is the site's SVG,** inlined as a base64 data URL. On dark backgrounds it's recoloured with a CSS **mask** (`mask: url(logo) center/contain no-repeat` plus `background: <colour>`), not a filter, so the colour is exact.
4. **The photo defaults to the live homepage hero.** It fetches the homepage, finds the first `<img src>` after `class="hero-media`, strips the Cloudflare `/cdn-cgi/image/<opts>/` prefix to get the original, and requests a large JPEG of it. `--photo` overrides this with a local file or a URL.
5. **Fonts load from Google Fonts** with `display=block`. Chromium's `--virtual-time-budget=10000` gives them time to load before the screenshot.
6. **Each design is a function `(w, h) => html`.** A `tall` flag (h/w > 0.6) adjusts sizes for 3:2.
7. **Chromium flags that matter:** `--headless`, `--hide-scrollbars`, `--force-device-scale-factor=1` (exact pixel size), `--window-size=W,H` (the screenshot size), and a throwaway `--user-data-dir` in a temp folder (avoids profile locks). The temp folder is deleted in `finally`.

## What to change for this site

Work through this list; each item maps to a spot in the script.

- [ ] **Theme path and token names** (`tok(...)` calls). Map this site's palette onto the roles: a light background, a dark background, a heading/text colour, an accent, and a decorative line colour.
- [ ] **Logo path**, and the logo's **aspect ratio** (`aspect-ratio: 341/89.6` is the reference logo's viewBox). Take it from this logo's `viewBox`.
- [ ] **Font families and weights** in the Google Fonts URL and in the CSS `font-family` stacks. Match what `astro.config.mjs` (or the site's font setup) uses.
- [ ] **Copy:** the byline ("With …"), the tagline, and the URL text. The tagline is wrapped in `<span style="white-space:nowrap">` around a hyphenated phrase (see gotchas).
- [ ] **Default `--site` URL** and the **photo selector** (`class="hero-media`). If this site has no obvious homepage photo, make `--photo` required or drop the photo design.
- [ ] **Designs:** the arch shape and the dot texture are specific to the reference brand. Keep the two-design idea (a light one with a photo, a dark one with just the wordmark), but restyle both to fit this site.
- [ ] **Output folder** (`docs/images/share`). Match this repo's convention for non-served assets. Never put them in `public/` unless they're meant to be served.

## Gotchas found the first time

- **`text-wrap: balance` can break inside hyphenated words** ("Make-it-from-" / "scratch"). Wrap such phrases in a `nowrap` span, and only use `balance` where it helps.
- **Arch / pill shapes:** use exact radii (`50% 50% 14px 14px / 40% 40% 14px 14px` for a 4:5 box), not `999px`. Oversized radii make the browser scale every corner down, which nearly squares off the small corners.
- **The fetched photo has a fixed crop** (`width=1100,height=1375,fit=cover` for a 4:5 slot). Change it if the photo slot's shape changes.
- **PNG sizes:** about 550–750 KB with a photo, about 125–150 KB without. That's fine for GitHub; if one becomes a site `og:image`, export a compressed JPG (~150 KB) instead.

## Verify

1. Run the script and confirm it prints four `wrote …` lines.
2. Check the sizes: `file docs/images/share/*.png` should show exactly 1280 x 640 and 1200 x 800.
3. Open every image and check that:
   - the web fonts rendered (no Georgia/system fallback);
   - the logo is crisp and correctly coloured;
   - no text collides with the photo or wraps awkwardly at either size.
4. Re-run after changing a colour in the theme file to confirm the images follow it.

## Using the output

- **GitHub:** repo **Settings → General → Social preview** → upload the 2:1 image. GitHub doesn't read it from the repo.
- **Link previews:** sites crop to about 1.91:1, which only trims a few pixels from 2:1. The 3:2 versions suit taller cards and slides.
