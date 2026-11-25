#!/usr/bin/env node
/**
 * Render share / cover images (GitHub social preview, link previews, slides)
 * in the site's colours, type, and light-beam motif.
 *
 *   node scripts/render-share-images.mjs
 *   node scripts/render-share-images.mjs --photo ~/Pictures/panel.jpg --logo path/to/logo.svg
 *
 * Options:
 *   --out <dir>        Where to write the PNGs (default: docs/images/share)
 *   --photo <file|url> Optional photo for the "beam" design (shown on the right,
 *                      under the beams). Without it the beams fill that side.
 *   --logo <svg>       Optional logo SVG. Without it the wordmark is set in type,
 *                      like the site header. With it the logo is drawn with a CSS
 *                      mask (exact recolouring), sized from its viewBox.
 *
 * Writes two designs at 2:1 (1280x640) and 3:2 (1200x800):
 *   share-beam-*      light surface (like the hero), amber light beams
 *   share-wordmark-*  dark slate (like the footer), light wordmark, centred beams
 *
 * Colours come from the :root tokens in src/styles/global.css (and the beam
 * amber from .light-beam-cone there), so re-running picks up palette changes.
 * Needs Chromium or Chrome installed (set CHROME_PATH if it isn't found) and a
 * network connection for Google Fonts (and for --photo when it's a URL).
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const OUT = resolve(ROOT, option("--out", "docs/images/share"));
const PHOTO = option("--photo");
const LOGO = option("--logo");

// ── browser ────────────────────────────────────────────────────────────────
const candidates = [process.env.CHROME_PATH, "chromium", "chromium-browser", "google-chrome", "google-chrome-stable"];
const browser = candidates.find((c) => c && spawnSync(c, ["--version"], { encoding: "utf8" }).status === 0);
if (!browser) {
	console.error("Chromium/Chrome not found. Install it or set CHROME_PATH.");
	process.exit(1);
}

// ── inputs ─────────────────────────────────────────────────────────────────
const css = readFileSync(resolve(ROOT, "src/styles/global.css"), "utf8");
const tok = (name) => {
	const m = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})\\b`));
	if (!m) throw new Error(`--color-${name} not found in global.css`);
	return m[1];
};
// Roles: light bg = surface, dark bg = primary-dark, text = text, secondary = muted,
// line = border. The amber accent isn't a token; it's the beam colour.
const C = {
	surface: tok("surface"),
	border: tok("border"),
	text: tok("text"),
	muted: tok("muted"),
	primary: tok("primary"),
	dark: tok("primary-dark"),
	light: tok("primary-contrast"),
};
const beamRgb = css.match(/\.light-beam-cone\s*\{[^}]*?rgba\(\s*(\d+\s*,\s*\d+\s*,\s*\d+)/)?.[1];
if (!beamRgb) throw new Error("beam colour not found in .light-beam-cone in global.css");
const amber = (a) => `rgba(${beamRgb},${a})`;
// Footer body text (light slate on the dark background).
const footerText = css.match(/\.site-footer\s*\{[^}]*?\bcolor:\s*(#[0-9a-fA-F]{6})/)?.[1] ?? C.border;

function loadLogo() {
	if (!LOGO) return null;
	const svg = readFileSync(resolve(LOGO));
	const vb = svg.toString("utf8").match(/viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/);
	if (!vb) throw new Error(`${LOGO} has no viewBox; can't size it.`);
	return { url: `data:image/svg+xml;base64,${svg.toString("base64")}`, aspect: `${vb[1]}/${vb[2]}` };
}
const logo = loadLogo();

async function loadPhoto() {
	if (!PHOTO) return null;
	if (!/^https?:/.test(PHOTO)) {
		const type = /\.png$/i.test(PHOTO) ? "image/png" : /\.webp$/i.test(PHOTO) ? "image/webp" : "image/jpeg";
		return `data:${type};base64,${readFileSync(resolve(PHOTO)).toString("base64")}`;
	}
	const res = await fetch(PHOTO);
	if (!res.ok) throw new Error(`GET ${PHOTO} -> ${res.status}`);
	const type = res.headers.get("content-type") ?? "image/jpeg";
	return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
}
const photoUrl = await loadPhoto();

// ── shared pieces ──────────────────────────────────────────────────────────
const fonts = `<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&display=block" rel="stylesheet">`;
const headline = "Premier Electrical Craftsmanship for Your Home";
// Each item is nowrap so the list only breaks between services, never inside
// one (and never at the hyphen in "Whole-home").
const services = [
	"Whole-home wiring",
	"Custom lighting",
	"Lutron smart control",
	"EV charging",
	"Backup power",
];
const urlText = "matlackelectric.com";

const base = (w, h) => `
*{box-sizing:border-box;margin:0}
html,body{width:${w}px;height:${h}px;overflow:hidden;position:relative}
body{font-family:Roboto,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
.eyebrow{font-weight:500;letter-spacing:.16em;text-transform:uppercase}
.beam{position:absolute;top:0;filter:blur(20px)}
.mote{position:absolute;border-radius:50%;filter:blur(1px);transform:translate(-50%,-50%)}`;

// Seeded PRNG so every run places the dust motes identically.
function rng(seed) {
	return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

// A static light cone like LightBeam.astro: apex at (x, 0), full spread `angle`,
// `depth` px tall, plus dust motes kept inside the cone.
function beam({ x, angle, depth, motes = 8, seed = 1, strength = 1 }) {
	// The cone runs 15% past `depth` so its blurred bottom edge falls off-canvas.
	const half = depth * Math.tan(((angle / 2) * Math.PI) / 180);
	const g = `linear-gradient(180deg,${amber(0.45 * strength)} 0%,${amber(0.18 * strength)} 40%,${amber(0)} 90%)`;
	
	const full = depth * 1.15;
	const halfFull = half * 1.15;
	let out = `<div class="beam" style="left:${x - halfFull}px;width:${halfFull * 2}px;height:${full}px;background:${g};clip-path:polygon(${halfFull - 1}px 0,${halfFull + 1}px 0,100% 100%,0 100%)"></div>`;
	const r = rng(seed);
	for (let i = 0; i < motes; i++) {
		const t = 0.22 + r() * 0.6;
		const side = (r() * 2 - 1) * 0.7;
		const fade = t <= 0.4 ? 1 - (t / 0.4) * 0.6 : 0.4 * (1 - (t - 0.4) / 0.35);
		const size = 4 + r() * 4;
		out += `<span class="mote" style="left:${x + side * t * half}px;top:${t * depth}px;width:${size}px;height:${size}px;background:${amber(0.85)};opacity:${(Math.max(fade, 0) * (0.45 + r() * 0.45) * strength).toFixed(2)}"></span>`;
	}
	return out;
}

// Wordmark: the logo SVG (mask-recoloured) if given, otherwise type like the header.
function mark(colour, width, size, maxH) {
	if (logo) {
		return `<div style="width:${width}px;max-width:100%;max-height:${maxH}px;aspect-ratio:${logo.aspect};background:${colour};-webkit-mask:url('${logo.url}') center/contain no-repeat;mask:url('${logo.url}') center/contain no-repeat"></div>`;
	}
	return `<span style="font-weight:900;font-size:${size}px;line-height:1;letter-spacing:-.02em;color:${colour}">Matlack Electric</span>`;
}

// ── designs ────────────────────────────────────────────────────────────────
function beamDesign(w, h) {
	const tall = h / w > 0.6; // 3:2
	const pad = Math.round(h * 0.1);
	const photoW = Math.round(w * 0.36);
	const right = w - pad - photoW / 2; // centre of the right-hand panel
	const beams = photoUrl
		? beam({ x: right - photoW * 0.3, angle: 30, depth: h, motes: 8, seed: 3 }) +
		  beam({ x: right + photoW * 0.3, angle: 22, depth: h, motes: 6, seed: 7, strength: 0.85 })
		: beam({ x: right - 150, angle: 30, depth: h, motes: 11, seed: 3 }) +
		  beam({ x: right + 130, angle: 30, depth: h, motes: 10, seed: 7, strength: 0.9 }) +
		  beam({ x: right - 20, angle: 10, depth: h * 0.95, motes: 5, seed: 11, strength: 0.8 });
	return `<!doctype html><html><head><meta charset="utf-8">${fonts}<style>${base(w, h)}
body{background:${C.surface};color:${C.text}}
.source{position:absolute;top:0;left:0;right:0;height:${Math.round(pad * 0.45)}px;background:#fff;border-bottom:1px solid ${C.border}}
.wrap{position:absolute;inset:${pad}px;display:flex;align-items:center;gap:${Math.round(w * 0.05)}px;z-index:1}
.copy{flex:1;display:flex;flex-direction:column;gap:${tall ? 24 : 18}px;padding-left:${Math.round(w * 0.01)}px}
.by{font-size:${tall ? 19 : 17}px;color:${C.muted}}
.rule{width:64px;height:3px;background:${amber(1)};border-radius:2px}
.line{font-weight:700;font-size:${tall ? 40 : 36}px;line-height:1.2;letter-spacing:-.01em;color:${C.text};max-width:${tall ? 640 : 660}px}
.svc{font-size:${tall ? 21 : 19}px;line-height:1.5;color:${C.muted};max-width:${tall ? 600 : 640}px}
.svc i{font-style:normal;color:${C.border};font-weight:700;padding:0 .1em}
.url{font-size:${tall ? 21 : 19}px;font-weight:700;letter-spacing:.04em;color:${C.primary}}
.photo{flex:none;width:${photoW}px;height:${h - pad * 2}px;border-radius:14px;overflow:hidden;box-shadow:0 4px 12px rgba(15,23,42,.12)}
.photo img{width:100%;height:100%;object-fit:cover;display:block}
.spacer{flex:none;width:${photoW}px}
</style></head><body>
${photoUrl ? "" : beams}
<div class="source"></div>
<div class="wrap">
  <div class="copy">
    ${mark(C.text, tall ? 560 : 520, tall ? 64 : 58, tall ? 140 : 110)}
    <span class="eyebrow by">Residential electrical contractor</span>
    <span class="rule"></span>
    <p class="line">${headline}</p>
    <p class="svc">${services.map((s) => `<span style="white-space:nowrap">${s}</span>`).join(" <i>·</i> ")}</p>
    <span class="url">${urlText}</span>
  </div>
  ${photoUrl ? `<div class="photo"><img src="${photoUrl}" alt=""></div>` : `<div class="spacer"></div>`}
</div>
${photoUrl ? `<div style="position:absolute;inset:${Math.round(pad * 0.45)}px 0 0;z-index:2;pointer-events:none">${beams}</div>` : ""}
</body></html>`;
}

function wordmarkDesign(w, h) {
	const tall = h / w > 0.6;
	const c = w / 2;
	const beams =
		beam({ x: c - w * 0.3, angle: 30, depth: h, motes: 9, seed: 5, strength: 0.9 }) +
		beam({ x: c + w * 0.3, angle: 30, depth: h, motes: 9, seed: 9, strength: 0.9 }) +
		beam({ x: c, angle: 14, depth: h, motes: 5, seed: 13, strength: 0.45 });
	return `<!doctype html><html><head><meta charset="utf-8">${fonts}<style>${base(w, h)}
body{background:${C.dark};color:${C.light};display:grid;place-items:center;text-align:center}
.inner{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:${tall ? 28 : 22}px}
.by{font-size:${tall ? 21 : 19}px;color:${footerText}}
.rule{width:64px;height:3px;background:${amber(1)};border-radius:2px}
.line{text-wrap:balance;font-weight:400;font-size:${tall ? 34 : 30}px;color:${footerText};max-width:${tall ? 900 : 1000}px;line-height:1.3}
.url{font-size:${tall ? 20 : 18}px;font-weight:700;letter-spacing:.06em;color:${C.light};padding:10px 26px;border:1.5px solid ${amber(0.55)};border-radius:999px}
</style></head><body>
${beams}
<div class="inner">
  ${mark(C.light, tall ? 760 : 720, tall ? 104 : 96, tall ? 240 : 180)}
  <span class="eyebrow by">Residential electrical contractor</span>
  <span class="rule"></span>
  <p class="line">${headline}</p>
  <span class="url">${urlText}</span>
</div></body></html>`;
}

// ── render ─────────────────────────────────────────────────────────────────
mkdirSync(OUT, { recursive: true });
const work = mkdtempSync(join(tmpdir(), "share-images-"));
try {
	for (const [name, design] of [["beam", beamDesign], ["wordmark", wordmarkDesign]]) {
		for (const [ratio, w, h] of [["2x1", 1280, 640], ["3x2", 1200, 800]]) {
			const page = join(work, `${name}-${ratio}.html`);
			writeFileSync(page, design(w, h));
			const file = join(OUT, `share-${name}-${ratio}-${w}x${h}.png`);
			const run = spawnSync(
				browser,
				[
					"--headless",
					"--disable-gpu",
					"--hide-scrollbars",
					"--force-device-scale-factor=1",
					`--window-size=${w},${h}`,
					"--virtual-time-budget=10000", // let the web fonts load
					`--user-data-dir=${join(work, "profile")}`,
					`--screenshot=${file}`,
					pathToFileURL(page).href,
				],
				{ encoding: "utf8" },
			);
			if (run.status !== 0 || !existsSync(file)) {
				throw new Error(`Rendering ${name} ${ratio} failed:\n${run.stderr.slice(-1500)}`);
			}
			console.log(`wrote ${file.replace(`${ROOT}/`, "")}`);
		}
	}
} finally {
	rmSync(work, { recursive: true, force: true });
}
