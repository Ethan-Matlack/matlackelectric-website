// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

import cloudflare from "@astrojs/cloudflare";

import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
    site: "https://matlackelectric.com",
    integrations: [sitemap(), react()],
    // Fully static site: no sessions, so the adapter doesn't add a SESSION KV binding.
    session: false,
    // Astro 7 defaults to "jsx" whitespace, which drops the space before an
    // inline link that starts a new source line. true keeps Astro 5 behaviour.
    compressHTML: true,
    // "compile" keeps image resizing at build time (the v13+ default resizes
    // at runtime through the Cloudflare Images binding instead).
    adapter: cloudflare({ imageService: "compile" }),
});