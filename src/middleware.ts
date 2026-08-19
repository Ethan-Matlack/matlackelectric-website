import { defineMiddleware } from "astro:middleware";

// TODO: remove once DNS/routing has fully cut over to the new site and this
// domain no longer needs a placeholder. See SPLASH-CUTOVER.md for the
// full back-out steps (this file plus a few related config changes).
const SPLASH_HOSTNAMES = new Set(["matlackelectric.com", "www.matlackelectric.com"]);

const SPLASH_HTML = `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>Matlack Electric</title>
		<meta name="description" content="Matlack Electric's website is under construction. Check back soon." />
		<meta name="robots" content="noindex" />
		<style>
			* { box-sizing: border-box; }
			body {
				margin: 0;
				min-height: 100vh;
				display: flex;
				align-items: center;
				justify-content: center;
				font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
				color: #1e293b;
				background-color: #f8fafc;
				text-align: center;
				padding: 1.5rem;
			}
			.card { max-width: 32rem; }
			h1 { font-size: 1.5rem; font-weight: 700; margin: 0 0 0.75rem; }
			p { color: #64748b; line-height: 1.6; margin: 0 0 1.5rem; }
			.contact { font-weight: 600; }
			.contact a { color: #334155; text-decoration: underline; }
		</style>
	</head>
	<body>
		<div class="card">
			<h1>Matlack Electric</h1>
			<p>I've moved to Chattanooga, TN and I'm building a brand new website. Check back soon. If you're here from Chester County, PA - I'll miss you! Please reach out with any questions.</p>
			<p class="contact">
				<a href="tel:+16107567752">(610) 756-7752</a> &middot;
				<a href="mailto:info@matlackelectric.com">info@matlackelectric.com</a>
			</p>
		</div>
	</body>
</html>
`;

export const onRequest = defineMiddleware((context, next) => {
	if (SPLASH_HOSTNAMES.has(context.url.hostname)) {
		return new Response(SPLASH_HTML, {
			headers: { "content-type": "text/html; charset=utf-8" },
		});
	}
	return next();
});
