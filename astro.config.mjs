// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

import cloudflare from "@astrojs/cloudflare";

import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
    site: "https://matlackelectric.com",
    integrations: [sitemap(), react()],
    adapter: cloudflare({
        platformProxy: {
            enabled: true,
        },
    }),
});