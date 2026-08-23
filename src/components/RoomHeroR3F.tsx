import { lazy, Suspense, useEffect, useState } from "react";

// The actual scene (RoomHeroR3FScene.tsx) pulls in three.js, @react-three/
// fiber, drei, and postprocessing — over a megabyte of JS. Those are
// static imports at the top of that file, so just importing the module
// forces the browser to fetch, parse, and *execute* all of it before
// React can render anything, regardless of what happens inside the
// component or when its own hooks run.
//
// Under client:only="react" that import used to happen immediately on
// page load, which meant this one component's dependency graph blocked
// the main thread for everyone — including the site header's own
// unrelated script, and the hero's own splash text/keypad, none of which
// need three.js at all.
//
// lazy() + a dynamic import() defers the actual fetch/parse/execute of
// that graph until it's explicitly requested; scheduling that request
// for browser idle time (not immediately on mount) is what keeps it off
// the critical path. There's nothing to show in the meantime — the
// static poster background baked into .hero-room's CSS is already
// covering that (see global.css) — so the Suspense fallback is just null.
const RoomHeroR3FScene = lazy(() => import("./RoomHeroR3FScene"));

export default function RoomHeroR3F() {
	const [shouldLoad, setShouldLoad] = useState(false);

	useEffect(() => {
		if (typeof window.requestIdleCallback === "function") {
			const id = window.requestIdleCallback(() => setShouldLoad(true));
			return () => window.cancelIdleCallback(id);
		}
		// Safari has no requestIdleCallback — a short timeout is the
		// standard fallback for "defer until roughly idle".
		const id = window.setTimeout(() => setShouldLoad(true), 200);
		return () => window.clearTimeout(id);
	}, []);

	if (!shouldLoad) return null;

	return (
		<Suspense fallback={null}>
			<RoomHeroR3FScene />
		</Suspense>
	);
}
