# Matlack Electric

Main website for Matlack Electric, a residential electrical contractor now based
in Chattanooga, TN (relocated from PA in 2026 - see `/we-moved`). Built with
[Astro](https://astro.build), deployed to
[Cloudflare Workers](https://workers.cloudflare.com/).

## Tests

Lighthouse scores for the production homepage, updated automatically after every push to `main` (see `.github/workflows/lighthouse-production.yaml`) - not from a PR preview, so these track whatever's actually live.

![Performance](https://img.shields.io/badge/endpoint?url=https://gist.githubusercontent.com/Ethan-Matlack/f241a8d7f1960694987ed02c109ada56/raw/lighthouse-performance.json)
![Accessibility](https://img.shields.io/badge/endpoint?url=https://gist.githubusercontent.com/Ethan-Matlack/f241a8d7f1960694987ed02c109ada56/raw/lighthouse-accessibility.json)
![Best Practices](https://img.shields.io/badge/endpoint?url=https://gist.githubusercontent.com/Ethan-Matlack/f241a8d7f1960694987ed02c109ada56/raw/lighthouse-best-practices.json)
![SEO](https://img.shields.io/badge/endpoint?url=https://gist.githubusercontent.com/Ethan-Matlack/f241a8d7f1960694987ed02c109ada56/raw/lighthouse-seo.json)

Every PR into `main` also gets a fuller Lighthouse report (including Core Web Vitals) posted as a comment - see `.github/workflows/lighthouse-ci.yaml`.

## Current Status

This project serves `new.matlackelectric.com` - the real future site. The
primary domain `matlackelectric.com` is currently served by a separate,
dedicated Cloudflare Worker (outside this repo) showing a temporary "we've
moved" placeholder while this new site is built. This project has no involvement
in that splash page.

When `new.matlackelectric.com` is ready to retire in favor of the apex domain,
that's just a routing change (point `matlackelectric.com` at this Worker instead
of the splash one, update `wrangler.json`'s `routes` and `astro.config.mjs`'s
`site` accordingly) - no code changes needed here.

## Tech Stack

- <img src="https://skillicons.dev/icons?i=astro" width="20" height="20" alt="" /> **[Astro 5](https://astro.build)** Entirely static output, pre-rendered at build time.
- <img src="https://skillicons.dev/icons?i=react" width="20" height="20" alt="" /> <img src="https://skillicons.dev/icons?i=threejs" width="20" height="20" alt="" /> **[@astrojs/react](https://docs.astro.build/en/guides/integrations-guide/react/)** +
  **[React Three Fiber](https://r3f.docs.pmnd.rs/)** +
  **[three.js](https://threejs.org/)** Built for the homepage's interactive 3D
  hero (`RoomHeroR3F.tsx`), see [Notable features](#notable-features)
- **[@astrojs/sitemap](https://docs.astro.build/en/guides/integrations-guide/sitemap/)** Used for improving search engine crawler reliability.
- <img src="https://skillicons.dev/icons?i=cloudflare" width="20" height="20" alt="" /> **[Cloudflare Workers](https://workers.cloudflare.com/)** via
  `@astrojs/cloudflare` +
  **[Wrangler](https://developers.cloudflare.com/workers/wrangler/)** -
  hosting/deploy

## 3rd-Party Integrations

- **[JobTread](https://www.jobtread.com/)** embedded form - the contact page's
  lead-capture form is a third-party widget, not a custom form handler

## Project Structure

```text
├── public/
│   ├── images/                Static images, incl. bg-homepage.webp (current
│   │                           homepage background) and hero-poster.jpg
│   │                           (paused R3F hero's loading poster)
│   └── models/                 kitchen-transformed.glb - the paused 3D hero's
│                                room model (MIT-licensed, from pmndrs/examples)
├── src/
│   ├── components/
│   │   ├── RoomHeroR3F.tsx     The paused homepage 3D hero (see below)
│   │   ├── CardLink.astro      Whole-tile clickable card (Services grid)
│   │   ├── BackToIndexFab.astro / BackToTopFab.astro
│   │   │                        Floating "back" buttons for detail pages /
│   │   │                        the portfolio index (see below)
│   │   └── Header.astro / Footer.astro / BaseHead.astro
│   ├── layouts/
│   │   ├── Layout.astro              Base page shell (Header/main/Footer)
│   │   ├── ServiceLayout.astro        Template for /services/* detail pages
│   │   └── PortfolioProjectLayout.astro   Template for /portfolio/<slug>/ pages
│   ├── data/
│   │   ├── portfolio.ts        All portfolio project data - see below
│   │   └── PORTFOLIO.md        Guide for adding a new portfolio project
│   ├── images/portfolio/<slug>/   Photos per portfolio project - see below
│   ├── pages/                  File-based routes: index, about, services (+
│   │                            services/*), partners, portfolio (+ the
│   │                            portfolio/[slug] dynamic route), contact,
│   │                            we-moved, 404
│   └── styles/global.css       All site CSS - design tokens in :root, one
│                                stylesheet, no CSS modules/framework
├── astro.config.mjs             Astro + integrations + Cloudflare adapter config
├── wrangler.json                 Cloudflare Worker config (routes, assets, etc.)
└── worker-configuration.d.ts     Auto-generated by `npm run cf-typegen` - commit after regenerating, don't hand-edit
```

## Notable Features

### Portfolio - `src/data/portfolio.ts` + `src/pages/portfolio/`

Every portfolio project is a plain data entry, not a hand-written page - see
`PORTFOLIO.md` for the full guide. In short:

- **One dynamic route** (`src/pages/portfolio/[slug].astro`) generates every
  project's page at build time via `getStaticPaths()`. Adding a new project
  never means creating a new file.
- **Content blocks** - each project's page body is an ordered array of typed
  blocks (`text`, `image`, `split`, `testimonial`) in `portfolio.ts`, rendered
  by `PortfolioProjectBody.astro`. Arrange them in whatever order tells that
  project's story and omit or duplicate blocks freely.
- **Photos are filesystem-driven** - drop files in
  `src/images/portfolio/<slug>/`, with one named `COVER.*` for the tile/hero
  thumbnail. `projectImages()` globs the folder automatically (cover first, then
  the rest sorted by filename) - no per-photo import statements, and a block
  referencing a photo that no longer exists falls back to a placeholder with a
  console warning instead of breaking the page.
- **Tag filtering** - the portfolio index's tag chips are a single-select toggle
  group (vanilla JS, no framework) filtering the alternating project rows by
  `data-tags`.

### Homepage Hero - currently static, built for R3F

`src/pages/index.astro` is currently a static background image
(`bg-homepage.webp`, blurred via a `::before` pseudo-element) with a text splash
overlay - see [To-do](#to-do) for why the interactive 3D hero below it is
commented out rather than deleted.

#### Paused: interactive 3D hero - `src/components/RoomHeroR3F.tsx`

An interactive kitchen/dining scene rendered with react-three-fiber, built and
mostly working, but disabled pending a performance fix (see [To-do](#to-do)):

- **Camera "shots"** - the homepage default view plus Shading, Lighting,
  Controls, and Networking shots, switchable via the nav pills at the bottom of
  the hero (or on a timer - see `SHOT_TRIGGER_MODE`). Transitions are an eased
  slerp/lerp between fixed start/end poses, not a continuous damp (see the
  file's comments for why - a couple of subtle three.js gotchas are documented
  in-line where they were solved).
- **Controls shot** - a 2D HTML panel styled like a 4-button Lutron RadioRA 3
  keypad (All On / Entertain / Relax / All Off) that actually dims the pendant
  and undercabinet lights in the scene, plus a Day/Night toggle that swaps the
  scene background and ambient light. Both reset to their defaults when you
  navigate away from this shot.
- **Loading poster** - `public/images/hero-poster.jpg` is a pre-rendered
  screenshot of the default shot, meant to be set as the hero's CSS background
  so something is visible instantly, before React hydrates and the ~2MB GLB
  model downloads. **If the default shot's camera, lighting, or the model itself
  ever changes before this is reactivated, this image goes stale and needs to be
  regenerated manually** - there's no build-time automation for this by design.

### Header Nav - `src/components/Header.astro`


The link row collapses to a hamburger dropdown based on measured available width
(not a fixed breakpoint), computed by an `is:inline` script that runs
synchronously as the parser reaches it. That's deliberate, not the Astro
default: a normal processed `<script>` compiles to a deferred `type="module"`,
which on a full page load (e.g. clicking the logo) let the header paint once in
its full-desktop-nav layout before the fit check could run, flashing the wrong
layout on mobile. `is:inline` skips that.

### 404 Page - `src/pages/404.astro`

Detects whether the visitor arrived via another page on this site
(`document.referrer` same-origin) versus a direct visit or external link. If
they navigated from elsewhere on the site, the button reads "Go Back" and calls
`history.back()` instead of linking to the homepage.

## Cloudflare Workers

Config lives in `wrangler.json`:

- **Custom domains**: only `new.matlackelectric.com` routes to this Worker (see
  [Current status](#current-status) - the primary domain routes to a separate
  splash Worker for now).
- **Assets**: `dist/` is served via the `ASSETS` binding, with no worker invoked
  for static asset requests (the default) - the whole site is prerendered static
  output, so there's no per-request logic that needs to run first.
- **Observability**: enabled, with source maps uploaded on deploy - errors in
  the Cloudflare dashboard should resolve to real source locations.
- **Compatibility**: `nodejs_compat` flag is on (some dependencies expect Node
  built-ins).

## To-Do

### Before Going Live

- [x] Fix homepage LCP (image preload + compression) - Lighthouse 100 across the
      board.
- [x] Fix mobile nav flashing the full desktop menu on a full page load (the
      `is:inline` fit-check fix - see [Notable features](#notable-features)).
- [x] Add a referrer-based "Go Back" button to the 404 page.
- [x] Rebuild the portfolio system around a single dynamic route, a
      content-block data model, filesystem-driven photos, and tag filter chips
      (see [Notable features](#notable-features)).
- [x] Rename `CaseStudyLayout`/`CaseStudyBody` to
      `PortfolioProjectLayout`/`PortfolioProjectBody` for consistent naming.
- [ ] Cut the primary domains over to this Worker once the site is production
      ready - update `wrangler.json`'s `routes` and `astro.config.mjs`'s `site`
      to point at `matlackelectric.com` instead of `new.matlackelectric.com`.
- [ ] Write real content blocks for every portfolio project - most entries in
      `portfolio.ts` are still tile-only stubs (`content: []`, grid card + basic
      info, no written project page yet). See `PORTFOLIO.md`.
- [ ] Add a `COVER.*` photo for every portfolio project - most are still falling
      back to a placeholder image (with a build-time console warning) on both
      the portfolio grid and their own page.

### Eventually

- [ ] Reintroduce the R3F homepage hero once its performance issues are solved.
      It was pulled from the homepage (currently just commented out in
      `index.astro`, not deleted) because Lighthouse/real-world testing showed
      the ~2MB GLB + three.js/react-three-fiber bundle cost too much on slower
      devices/connections - a `requestIdleCallback`-based deferral attempt
      didn't meaningfully help TBT and was rolled back. Bringing it back needs
      an actual reduction in what ships (smaller/compressed model, lighter
      dependency footprint, and/or splitting it so the splash/nav overlays below
      don't share a load gate with three.js - see the next item) rather than
      another scheduling trick.
- [ ] Splash/nav overlays share a load gate with three.js (relevant once the
      hero is reactivated). `RoomHeroR3F.tsx` is one `client:only="react"`
      island, so the lightweight splash text and shot-nav pills can't paint
      until the _entire_ bundle (React, react-three-fiber, drei, three.js,
      postprocessing) has downloaded, parsed, and hydrated - even though neither
      overlay actually depends on any of that. Measured on a fresh dev server:
      overlays hit `opacity: 1` at ~628ms, well before the 3D canvas is ready at
      ~1340ms, so they're not gated on the _render_ - just stuck waiting on the
      same JS load as the 3D library code they don't need. Fixing this for real
      means splitting the overlay UI into its own smaller island (or dropping
      `client:only` in favor of SSR, since the overlays don't need the browser)
      so it isn't sharing a load gate with three.js.
- [ ] Camera shot compositions for Shading/Lighting/Controls/Networking in
      `RoomHeroR3F.tsx` are reasonable starting frames, not final pixel-tuned
      compositions (per the file's own comments) - worth a pass with real design
      eyes on it once the hero is back in use.
- [ ] Stale comments in `RoomHeroR3F.tsx` - a couple of comments near the top
      still reference a `WindowLight` component and a "ceiling" shot that were
      both removed/renamed (it's now the Networking/`AccessPoint` shot); needs a
      cleanup pass so the comments match the current code.
- [ ] EV charging / generators / battery backup service lines have no presence
      in the 3D hero - a kitchen interior doesn't naturally fit them. Worth
      deciding whether that's fine (they're covered elsewhere on the site) or
      whether they need their own treatment.
- [ ] No recessed-can lighting in the GLB model - if that fixture type matters
      for the Lighting shot, it'd need modeling or a different fixture choice.
