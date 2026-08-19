# Removing the "We've moved" splash page

Background: `matlackelectric.com` currently shows a placeholder splash page
while the real site is developed at `new.matlackelectric.com`. Both domains
are served by this same Worker/project — a hostname check in
`src/middleware.ts` decides which one a request gets. See the chat/commit
history for why it's built this way (short version: the Cloudflare adapter
only gives middleware the real request's `Host` header when the site is
built with `output: "server"`, not the default static output).

When the new site is ready and `matlackelectric.com` should just serve it
directly, do the following.

## 1. Kill the splash (the part that actually matters)

Delete `src/middleware.ts` entirely, then build and deploy. This alone stops
any request from ever seeing the splash page, regardless of what else you
do below.

## 2. Restore normal static output (recommended cleanup)

The rest of this was only needed to make the middleware's hostname check
work. With the middleware gone, undo it to get back the original
performance profile (build-time prerendering + image optimization instead
of on-demand SSR):

- **`astro.config.mjs`** — remove the `output: "server",` line (falls back
  to Astro's default `"static"` output).
- **`src/pages/blog/[...slug].astro`** — remove the
  `export const prerender = true;` line. It's harmless to leave (redundant
  once static is the default again), but not needed anymore.
- **`wrangler.json`** — remove `"run_worker_first": true` from the `assets`
  block. This was only there to force every request through the Worker
  (and thus the middleware) before Cloudflare's static-asset layer could
  short-circuit it. Without the middleware, you want the opposite: let
  static assets serve directly, skip Worker execution, for speed/cost.

## 3. Tidy up `wrangler.json` routes

The `routes` array currently declares `matlackelectric.com`,
`www.matlackelectric.com`, and `new.matlackelectric.com` as Custom Domains
on this one Worker. Once `new.matlackelectric.com` is retired in favor of
the apex domain, remove that entry (or the whole array, if you'd rather
manage Custom Domains from the Cloudflare dashboard instead of via
`wrangler.json`).

## 4. Verify before deploying

```bash
npm run build
npx wrangler dev --port 8787
curl -H "Host: matlackelectric.com" http://localhost:8787/ | grep '<h1>'
```

Should show the real homepage heading, not the splash. Note: if
`wrangler.json` still has a `routes` array at this point, `wrangler dev`
pins its simulated hostname to the first matching route and ignores the
`Host` header you send — this is a local-dev-only quirk, not a bug. Strip
`routes` from a scratch copy of the config to test hostname behavior
locally if needed; it doesn't affect real production traffic.
