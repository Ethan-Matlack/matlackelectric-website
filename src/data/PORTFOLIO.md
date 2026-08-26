# Adding a portfolio project

Every project on `/portfolio/` and its own project page (`/portfolio/<slug>/`) comes entirely from one entry in `portfolioProjectInputs` in `portfolio.ts`, plus a folder of photos. There's no page file to create - `src/pages/portfolio/[slug].astro` generates every project's page from this data automatically.

## 1. Add the photos

Create `src/images/portfolio/<slug>/` (the same slug you'll use in the data entry) and drop photos in:

- **`COVER.jpg`/`.png`/`.webp`** - the thumbnail shown on the `/portfolio/` grid and at the top of the project's own page. Optional while a project is still being put together - it falls back to a placeholder (with a build-time console warning) if missing.
- **Everything else**, named however you like - conventionally `1.webp`, `2.webp`, etc. These are what the `image` field on `image`/`split` content blocks below points to.

## 2. Add the data entry

Add an object to `portfolioProjectInputs` in `portfolio.ts`:

```ts
{
	slug: "hyphenated-page-slug", // must match the folder name from step 1
	title: "Friendly Title",
	description: "One or two sentences - this is reused as the portfolio tile's blurb, the page's meta description, AND the project page's hero subtitle.",
	tags: ["Kitchen", "Addition"], // must be values already listed in PORTFOLIO_TAGS above - add a new one there first if you need a tag that doesn't exist yet
	content: [
		// see below - omit entirely (content: []) if the project doesn't have a written project page yet
	],
},
```

`slug`, `title`, `description`, and `tags` are required. `content` is required too, but can be an empty array (`content: []`) for a project that only needs a portfolio-grid tile for now, with no project page body yet.

## 3. Build the `content` array

`content` is an ordered list of blocks - they render on the page in the exact order you list them, so arrange them however tells the project's story. Four block types exist:

**`text`** - a full-width paragraph.
```ts
{ type: "text", text: "..." }
```

**`image`** - a single full-width photo, with an optional caption.
```ts
{ type: "image", image: 0, caption: "..." } // caption is optional
```

**`split`** - a photo next to a heading + paragraph, side by side. Add `reverse: true` to put the photo on the right instead of the left.
```ts
{ type: "split", image: 1, heading: "...", text: "...", reverse: true } // reverse is optional
```

**`testimonial`** - a pull-quote. Just don't include one if the project doesn't have a quote to use - there's no separate "enable testimonial" flag, it only shows up if you add this block.
```ts
{ type: "testimonial", quote: "...", author: "...", role: "..." } // role is optional
```

### The `image` field

On `image`/`split` blocks, `image` is a **number**, not a filename - it's the index into that project's photos from step 1, sorted alphabetically, with the cover photo always first:

- `image: 0` → `COVER.*` (yes, you can reuse the cover photo in the body)
- `image: 1` → the first non-cover file alphabetically (e.g. `1.webp`)
- `image: 2` → the second (e.g. `2.webp`)
- ...and so on.

If a block references an index that doesn't exist (a photo got renamed or removed after the block was written), it falls back to the placeholder with a console warning instead of breaking the page - but it's worth fixing when you notice the warning.
