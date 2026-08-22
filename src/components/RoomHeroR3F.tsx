import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { EffectComposer, N8AO, ToneMapping } from "@react-three/postprocessing";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";

// RectAreaLight (used for the undercabinet strip below) needs its LTC
// lookup textures initialized once before first use, or it renders black.
RectAreaLightUniformsLib.init();

// Styled after pmndrs/examples' "shopping" demo (AO + tone mapping via
// postprocessing, `flat` Canvas so R3F's own tone mapping doesn't double up
// with it) — minus that demo's pointer-follow camera, Bvh, and
// Select/Outline hover-highlight system, none of which apply here since
// there's nothing to hover/select.
//
// Model is pmndrs/examples' own kitchen-transformed.glb (MIT-licensed, same
// repo this whole approach is styled after) — public/models/, loaded as a
// static asset rather than through Vite's src/ pipeline since it's a large
// binary with nothing to transform.
//
// The model has no baked lights (no KHR_lights_punctual) and every material
// is real-time PBR, so it relights like any other three.js scene. There's
// also no real window/glass geometry (the model's only "glass" material is
// on a counter-top bottle prop) — the slatted opening on the left wall is
// just an open cutout, so WindowLight below fakes daylight coming through
// it rather than relying on any actual glazing. There's also no recessed-can
// geometry anywhere in the model — the "ceiling" shot below frames a plain
// ceiling for now; adding actual recessed fixtures there is a follow-up.

const KITCHEN_MODEL_URL = "/models/kitchen-transformed.glb";

// The pendant ("lamp"/"lamp_socket"/"lamp_cord" nodes — one 3-head fixture,
// no per-head sub-nodes) sits by default between the island and the table.
// PENDANT_LOCAL_SHIFT moves it as a rigid group in the model root's local
// space (the whole scene is rotated 90°, so this isn't the same as a
// world-space offset) to hang directly above the table's real center.
// Derived by computing the table's and lamp's actual world-space bbox
// centers at runtime and converting the world delta into local space
// through the root's inverse rotation — verified afterward: the lamp's
// world XZ then exactly matched the table's world XZ.
//
// Note: from the default camera (low, near-eye-level, 25° FOV) a pendant
// exactly above the table's true 3D center still visually reads as hanging
// toward the table's far edge — confirmed this is inherent to the viewing
// angle, not a position error: a ray cast from the camera through the
// table's on-screen center crosses the pendant's height almost immediately
// (camera y=1 is barely above the pendant's y≈0.79), so there's no XZ
// position that makes it look centered on screen without floating somewhere
// nonsensical in 3D.
const PENDANT_LOCAL_SHIFT = new THREE.Vector3(-1.037, 0, -0.021);

// Pendant head positions (light sources) — the same three world-space
// clusters found earlier (x ≈ -0.248 / 0.273 / 0.808, z ≈ -2.7), shifted by
// the same delta applied to the geometry above so the beams stay aligned
// with the visible fixture.
const WORLD_SHIFT = new THREE.Vector3(0, 0, 0);
{
	const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));
	WORLD_SHIFT.copy(PENDANT_LOCAL_SHIFT).applyQuaternion(q);
}
const PENDANT_HEAD_X = [-0.248, 0.273, 0.808].map((x) => x + WORLD_SHIFT.x);
const PENDANT_HEAD_Y = 0.65;
const PENDANT_HEAD_Z = -2.7 + WORLD_SHIFT.z;

// --- Camera shots -----------------------------------------------------
// How shot changes are triggered — flip this one constant to change the
// behavior everywhere. "buttons": nav only, no timer. "auto": cycles on a
// timer, no nav shown. "both": auto-cycles until the visitor clicks a
// button, then stays manual (standard carousel UX) — buttons always shown
// for "buttons" and "both".
type ShotTriggerMode = "buttons" | "auto" | "both";
const SHOT_TRIGGER_MODE: ShotTriggerMode = "buttons";
const AUTO_ADVANCE_MS = 6000;
const CAMERA_TRANSITION_MS = 900;
const DAY_NIGHT_TRANSITION_MS = 500;
const DEFAULT_FOV = 25;

function easeInOutCubic(t: number) {
	return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

type Shot = {
	id: string;
	label: string;
	position: [number, number, number];
	lookAt: [number, number, number];
	fov?: number;
};

// position/lookAt for the 3 new shots were framed from real geometry (probed
// bounding boxes: kitchen/cabinets span x -2.8..2.95, z -4.82..-4.18, floor
// to ceiling at y -1..2.01; room shell spans x -4.01..3.95). Not pixel-perfect
// compositions yet — a reasonable starting frame for each, same as the
// original default shot was when this file started.
const SHOTS: Shot[] = [
	{
		id: "default",
		label: "Overview",
		position: [0.3, 1, 6],
		lookAt: [0.24, 0, -4],
	},
	{
		id: "shading",
		label: "Shading",
		position: [-2, 1.5, 2],
		lookAt: [-4, 1, -1.5],
	},
	{
		id: "lighting",
		label: "Lighting",
		position: [-4, 0, -3],
		lookAt: [0, 0.6, -5.5],
	},
	{
		// Deliberately close to (not identical to) the default shot — the
		// point of this shot is watching the room's lights actually respond
		// to the keypad, not looking at the keypad itself (there's no 3D
		// keypad prop at all; it's a real HTML control panel — see
		// KeypadPanel). Starting values only; meant to be hand-tuned.
		id: "controls",
		label: "Controls",
		position: [1.2, 1.1, 5.2],
		lookAt: [0, 0.3, -3.5],
	},
	{
		id: "networking",
		label: "Networking",
		position: [0, 0.4, -2],
		lookAt: [-2, 1.97, -2],
	},
];

// --- Keypad scenes -----------------------------------------------------
// A 4-button Lutron RadioRA 3-style keypad — All On / Entertain / Relax /
// All Off, top to bottom, matching a real RA3 keypad's typical layout. Each
// scene sets independent levels per controlled fixture (a real Lutron scene
// isn't a single dimmer — different zones sit at different levels within
// the same scene), not one flat multiplier. Only the two fixtures that are
// actually "installed lighting" are controlled — WindowLight (simulated
// daylight) and AccessPoint (not a light at all) are left alone, same as a
// real keypad wouldn't claim to control the sun.
type SceneId = "allOn" | "entertain" | "relax" | "allOff";
type ScenePreset = { id: SceneId; label: string; pendant: number; undercabinet: number };
const SCENES: ScenePreset[] = [
	{ id: "allOn", label: "All On", pendant: 1, undercabinet: 1 },
	{ id: "entertain", label: "Entertain", pendant: 0.9, undercabinet: 0.55 },
	{ id: "relax", label: "Relax", pendant: 0.3, undercabinet: 0.1 },
	{ id: "allOff", label: "All Off", pendant: 0, undercabinet: 0 },
];
const DEFAULT_SCENE_ID: SceneId = "allOn";

function PendantLights({ level = 1 }: { level?: number }) {
	const targets = useMemo(() => PENDANT_HEAD_X.map(() => new THREE.Object3D()), []);
	return (
		<>
			{PENDANT_HEAD_X.map((x, i) => (
				<group key={x}>
					<primitive object={targets[i]} position={[x, -0.3, PENDANT_HEAD_Z]} />
					<spotLight
						position={[x, PENDANT_HEAD_Y, PENDANT_HEAD_Z]}
						target={targets[i]}
						color="#ffd9a0"
						intensity={18 * level}
						distance={4}
						angle={Math.PI / 3.5}
						penumbra={0.6}
						decay={1.5}
						castShadow
						shadow-mapSize={[512, 512]}
						shadow-bias={-0.0005}
					/>
				</group>
			))}
		</>
	);
}

// Undercabinet light strip, mounted along the full run of upper cabinets.
// Position comes from real geometry, not standard-cabinet-proportion
// guesses: histogrammed the "kitchen" mesh's vertex Y positions in 5cm bins
// and found a clean gap in the geometry from y≈-0.15 (countertop) to
// y≈0.80 — nothing in between — so the upper cabinets' underside sits at
// y≈0.80. X run (-2.8 to 2.95) and the cabinets' front-face Z (≈-4.18) are
// from the earlier "kitchen" bbox probe.
//
// A single RectAreaLight instead of a row of spotlights — that's the actual
// three.js primitive for a linear/area emitter (an LED strip diffuser is
// exactly this shape), so it falls off smoothly along the counter with no
// discrete hot spots the way overlapping spotlight cones would produce. The
// housing's lens face is also emissive along its full length so the fixture
// itself reads as one continuous glowing line rather than a row of bulbs.
// Tradeoff: RectAreaLight doesn't support shadows in three.js at all (not a
// choice here, a hard limitation) — same as the spotlight version, which
// skipped shadows anyway since this is a flood wash onto an open counter,
// not lighting through/around solid objects.
const CABINET_X_MIN = -2.7;
const CABINET_X_MAX = 2.85;
const CABINET_SPAN = CABINET_X_MAX - CABINET_X_MIN;
const UNDERCABINET_Y = 0.79;
const UNDERCABINET_Z = -4.5;
const UNDERCABINET_COLOR = "#ffd9a0";

function UndercabinetLights({ level = 1 }: { level?: number }) {
	const centerX = (CABINET_X_MIN + CABINET_X_MAX) / 2;
	return (
		<group>
			{/* Strip housing — thin aluminum-toned channel under the cabinet edge. */}
			<mesh position={[centerX, UNDERCABINET_Y, UNDERCABINET_Z]}>
				<boxGeometry args={[CABINET_SPAN, 0.02, 0.05]} />
				<meshStandardMaterial color="#cbd5e1" roughness={0.4} metalness={0.5} />
			</mesh>
			{/* Lens — the visible glowing line, set just proud of the housing so it
			    isn't z-fighting with it. Its own glow dims with `level` too — a
			    real "off" strip doesn't stay lit just because the room light does. */}
			<mesh position={[centerX, UNDERCABINET_Y - 0.011, UNDERCABINET_Z + 0.02]}>
				<boxGeometry args={[CABINET_SPAN - 0.05, 0.008, 0.02]} />
				<meshStandardMaterial
					color={UNDERCABINET_COLOR}
					emissive={UNDERCABINET_COLOR}
					emissiveIntensity={2 * level}
					roughness={0.3}
				/>
			</mesh>
			<rectAreaLight
				position={[centerX, UNDERCABINET_Y - 0.02, UNDERCABINET_Z + 0.05]}
				rotation={[-Math.PI / 2, 0, 0]}
				width={CABINET_SPAN}
				height={0.06}
				color={UNDERCABINET_COLOR}
				intensity={75 * level}
			/>
		</group>
	);
}

// Ceiling-mounted WiFi access point — round low-profile puck, flush against
// the ceiling. Stands in for low-voltage/networking work (structured
// cabling, WiFi APs), replacing what was a "recessed lighting" shot that
// was redundant with the pendant/undercabinet shots — same fixture type,
// no new service line. Positioned at the "networking" shot's lookAt XZ so
// the existing camera framing centers it without needing new camera work.
// Ceiling height (y≈2.0) is from the earlier "walls"/"kitchen" bbox probes.
// No light source here — real APs don't emit visible light, just a small
// status LED, represented with a tiny emissive disc rather than a THREE.Light.
const AP_POSITION: [number, number, number] = [-2, 1.97, -2];

function AccessPoint() {
	return (
		<group position={AP_POSITION}>
			<mesh>
				<cylinderGeometry args={[0.09, 0.09, 0.02, 32]} />
				<meshStandardMaterial color="#f1f1ec" roughness={0.5} />
			</mesh>
			<mesh position={[0.04, -0.011, 0]} rotation={[-Math.PI / 2, 0, 0]}>
				<circleGeometry args={[0.008, 16]} />
				<meshStandardMaterial color="#34d399" emissive="#34d399" emissiveIntensity={2} />
			</mesh>
		</group>
	);
}

// Day/night — what's visible through the slatted window opening, and the
// room's overall ambient fill.
//
// R3F's WebGLRenderer defaults to alpha: true (confirmed in its source —
// our `gl={{ antialias: false }}` merges with that default, doesn't replace
// it), and with <Sky/> and WindowLight both gone there's nothing setting
// scene.background — so the transparent canvas was showing whatever's
// behind it in the DOM (.hero's CSS background-color, a near-white
// #f8fafc) through any unoccluded region, i.e. the open window slats. That's
// not a lit surface, so no amount of ambientLight tuning could ever change
// it — it was never a lighting problem. Setting an explicit
// scene.background (via the <color> below) both fixes that and gives day/
// night a background to actually toggle between.
const DAY_BACKGROUND = "#dce8f2";
const NIGHT_BACKGROUND = "#0b1220";
const DAY_AMBIENT = 0.5 * Math.PI;
const NIGHT_AMBIENT = 0.05 * Math.PI;

// Fades scene.background and the ambient light's intensity between the day
// and night values, instead of snapping instantly on toggle. Same
// useLayoutEffect-to-capture-start / useFrame-to-lerp shape as CameraRig
// above — see its comments for why useLayoutEffect (not useEffect) matters
// here too.
function DayNightLighting({ isNight }: { isNight: boolean }) {
	const scene = useThree((state) => state.scene);
	const ambientRef = useRef<THREE.AmbientLight>(null);
	// Mutated in place every frame and assigned to scene.background once, on
	// mount — three.js reads its current RGB each render, so there's no need
	// to reassign scene.background on every subsequent frame.
	const currentColor = useRef<THREE.Color | null>(null);

	const targetColor = useMemo(
		() => new THREE.Color(isNight ? NIGHT_BACKGROUND : DAY_BACKGROUND),
		[isNight],
	);
	const targetAmbient = isNight ? NIGHT_AMBIENT : DAY_AMBIENT;

	const startColor = useRef(new THREE.Color());
	const startAmbient = useRef(DAY_AMBIENT);
	const startTime = useRef(0);

	useLayoutEffect(() => {
		if (!currentColor.current) {
			// First mount — snap straight to the initial state, no fade in
			// from nothing.
			currentColor.current = targetColor.clone();
			scene.background = currentColor.current;
			if (ambientRef.current) ambientRef.current.intensity = targetAmbient;
		}
		startColor.current.copy(currentColor.current);
		startAmbient.current = ambientRef.current?.intensity ?? targetAmbient;
		startTime.current = performance.now();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isNight]);

	useFrame(() => {
		if (!currentColor.current) return;
		const t = Math.min(1, (performance.now() - startTime.current) / DAY_NIGHT_TRANSITION_MS);
		const eased = easeInOutCubic(t);
		currentColor.current.lerpColors(startColor.current, targetColor, eased);
		if (ambientRef.current) {
			ambientRef.current.intensity = THREE.MathUtils.lerp(startAmbient.current, targetAmbient, eased);
		}
	});

	return <ambientLight ref={ambientRef} />;
}

function KitchenModel({ onReady }: { onReady?: () => void }) {
	const { scene } = useGLTF(KITCHEN_MODEL_URL);
	useEffect(() => {
		const lamp = scene.getObjectByName("lamp");
		const lampSocket = scene.getObjectByName("lamp_socket");
		const lampCord = scene.getObjectByName("lamp_cord");
		for (const node of [lamp, lampSocket, lampCord]) {
			// useGLTF caches (and reuses) the same mutable scene graph, and
			// React/Astro's dev StrictMode double-invokes effects — without this
			// guard the shift silently applies twice in dev (confirmed: without
			// it, lamp local pos ended up at 2x PENDANT_LOCAL_SHIFT).
			if (node && !node.userData.pendantRepositioned) {
				node.position.add(PENDANT_LOCAL_SHIFT);
				node.userData.pendantRepositioned = true;
			}
		}
		// Without this, lights pass straight through every mesh — the pendant
		// spotlights were lighting the floor right through the table. Every
		// mesh both casts (so the table blocks light from reaching the floor
		// under it) and receives (so that blocked shadow is actually visible).
		scene.traverse((obj) => {
			if ((obj as THREE.Mesh).isMesh) {
				obj.castShadow = true;
				obj.receiveShadow = true;
			}
		});
	}, [scene]);
	// Fires once the model has actually been in a painted frame, not just
	// mounted into the tree (mounting happens before the browser paints) —
	// that's the signal the poster crossfade (see RoomHeroR3F below) waits
	// on so it doesn't swap in a still-empty canvas.
	useEffect(() => {
		const raf = requestAnimationFrame(() => onReady?.());
		return () => cancelAnimationFrame(raf);
	}, [onReady]);
	return <primitive object={scene} rotation={[0, Math.PI / 2, 0]} position={[0, -1, -0.85]} />;
}
useGLTF.preload(KITCHEN_MODEL_URL);

// Eases the camera's position, orientation, and FOV toward whichever shot is
// active, via an explicit start-pose -> target-pose slerp/lerp over a fixed
// duration — not a continuous per-frame damp. Tried maath's damp3/dampQ
// first (its usual role: chasing a moving target every frame, e.g. a
// pointer-follow camera), but dampQ damps each quaternion component
// independently (its own source calls this an "nlerp approx") and that
// breaks down for large rotations: verified via frame-by-frame screenshots
// that it would stall entirely partway through some transitions, never
// reaching the target. THREE.Quaternion.slerpQuaternions between two FIXED
// endpoints has none of that instability — it's exact spherical
// interpolation, not an approximation, and always reaches t=1.
function CameraRig({ shot }: { shot: Shot }) {
	const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera;
	const hasSnapped = useRef(false);
	// Scratch object reused to derive a lookAt quaternion without allocating
	// a new one each shot change — never added to the scene, never rendered.
	// Deliberately a Camera, not a plain Object3D: THREE.Object3D.lookAt()
	// special-cases isCamera/isLight objects (`_m1.lookAt(position, target,
	// up)`, eye-at-position-facing-target) versus every other object type
	// (`_m1.lookAt(target, position, up)`, the reverse) — a mesh's "front"
	// convention is opposite a camera's. Using a plain Object3D here silently
	// computed the 180°-flipped orientation; a throwaway camera instance
	// takes the same branch camera.lookAt() itself would.
	const scratch = useMemo(() => new THREE.PerspectiveCamera(), []);

	const targetPosition = useMemo(() => new THREE.Vector3(...shot.position), [shot]);
	const targetQuaternion = useMemo(() => {
		scratch.position.copy(targetPosition);
		scratch.lookAt(...shot.lookAt);
		return scratch.quaternion.clone();
	}, [shot, scratch, targetPosition]);
	const targetFov = shot.fov ?? DEFAULT_FOV;

	// The pose a transition eases *from* — captured fresh at the start of
	// each transition, including the current (possibly still-mid-flight)
	// pose if a new shot is picked before the last one finished, so
	// interrupting a transition re-targets smoothly instead of jumping.
	const startPosition = useRef(new THREE.Vector3());
	const startQuaternion = useRef(new THREE.Quaternion());
	const startFov = useRef(DEFAULT_FOV);
	const startTime = useRef(0);

	// useLayoutEffect, not useEffect: this has to run synchronously in the
	// same commit as the shot-prop change. useEffect is deferred until after
	// paint, which left a window where a useFrame tick could fire with the
	// *new* shot's target (targetPosition/targetQuaternion are useMemo'd
	// directly off the shot prop, so they update the instant it changes) but
	// the *old* startTime/startPosition refs (not yet reset) — computing
	// t=1 from a stale-but-already-elapsed startTime and snapping instantly
	// to the new target before any easing ran. Confirmed via a frame-by-frame
	// trace: position landed exactly on the new target one tick before
	// startTime even reset, so the "eased" transition that followed was
	// lerping between two already-identical points — invisible, not stuck.
	useLayoutEffect(() => {
		if (!hasSnapped.current) {
			// First mount — snap straight to the initial shot, no easing in
			// from an arbitrary default.
			camera.position.copy(targetPosition);
			camera.quaternion.copy(targetQuaternion);
			camera.fov = targetFov;
			camera.updateProjectionMatrix();
			hasSnapped.current = true;
		}
		startPosition.current.copy(camera.position);
		startQuaternion.current.copy(camera.quaternion);
		startFov.current = camera.fov;
		startTime.current = performance.now();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [shot]);

	useFrame(() => {
		const t = Math.min(1, (performance.now() - startTime.current) / CAMERA_TRANSITION_MS);
		const eased = easeInOutCubic(t);
		camera.position.lerpVectors(startPosition.current, targetPosition, eased);
		camera.quaternion.slerpQuaternions(startQuaternion.current, targetQuaternion, eased);
		camera.fov = THREE.MathUtils.lerp(startFov.current, targetFov, eased);
		camera.updateProjectionMatrix();
	});

	return null;
}

// Landing splash — only on the "default" shot, since it's positioned/worded
// as an introduction to the whole site, not something that makes sense
// while looking at the cabinet lighting or an access point. Stays mounted
// across all shots (not conditionally rendered) and just toggles a class,
// so it can fade with a CSS transition in step with the camera easing
// instead of snapping in/out, and so focus/accessibility state isn't lost
// each time you leave and return to the default shot.
// The Lutron RA3-style keypad panel — real HTML buttons, not a 3D prop, so
// the camera stays on the room and the lighting change itself is what's
// being shown off, not a tiny hard-to-click mesh. A narrow side-anchored
// column (not centered) for the same reason: it should read as a small,
// real control, not the visual focus of the shot. No fade-in delay unlike
// SplashOverlay — that delay suits a landing message easing in after the
// scene settles, but here you clicked "Controls" specifically to get to
// this panel, so it should show up right away.
function KeypadPanel({
	visible,
	activeSceneId,
	onSelect,
}: {
	visible: boolean;
	activeSceneId: SceneId;
	onSelect: (id: SceneId) => void;
}) {
	return (
		<div className={`room-hero-keypad${visible ? " is-visible" : ""}`} aria-hidden={!visible}>
			{SCENES.map((scene) => (
				<button
					key={scene.id}
					type="button"
					className={scene.id === activeSceneId ? "is-active" : ""}
					onClick={() => onSelect(scene.id)}
					tabIndex={visible ? undefined : -1}
				>
					<span className="room-hero-keypad-led" aria-hidden="true" />
					{scene.label}
				</button>
			))}
		</div>
	);
}

// Bottom-left corner, mirroring .room-hero-controls' bottom-right anchor —
// a real RA3 keypad wouldn't have a "day/night" button on it, so this reads
// as its own separate control (more like a schedule/astro override) rather
// than a 5th keypad button. A compact sun/moon slider (loosely inspired by
// the classic checkbox-driven day/night toggle pattern) instead of the
// previous two-button segmented switch, mainly to save space on mobile.
// The actual <input type="checkbox"> stays for real keyboard/screen-reader
// toggle semantics but is visually hidden; the visible track/thumb is
// driven by the isNight prop directly (an .is-night class), matching how
// every other stateful style in this file works (.is-active, .is-visible,
// etc.) rather than introducing :checked-selector-driven CSS as a one-off.
function DayNightToggle({
	visible,
	isNight,
	onChange,
}: {
	visible: boolean;
	isNight: boolean;
	onChange: (isNight: boolean) => void;
}) {
	return (
		<label
			className={`room-hero-daynight${visible ? " is-visible" : ""}${isNight ? " is-night" : ""}`}
		>
			<input
				type="checkbox"
				className="room-hero-daynight-input"
				checked={isNight}
				onChange={(e) => onChange(e.target.checked)}
				tabIndex={visible ? undefined : -1}
				aria-label="Toggle night mode"
			/>
			<span className="room-hero-daynight-track">
				<span className="room-hero-daynight-thumb" />
			</span>
		</label>
	);
}

function SplashOverlay({ visible }: { visible: boolean }) {
	return (
		<div className={`room-hero-splash${visible ? " is-visible" : ""}`} aria-hidden={!visible}>
			<h1>Premier Craftsmanship</h1>
			<p>
				From whole-home rewiring to custom lighting design, smart home control, EV charging, and
				backup power - absolute quality on every project.
			</p>
			<div className="room-hero-splash-actions">
				<a className="btn btn-primary" href="/contact/" tabIndex={visible ? undefined : -1}>
					Get a Quote
				</a>
			</div>
		</div>
	);
}

function ShotNav({
	activeIndex,
	onSelect,
}: {
	activeIndex: number;
	onSelect: (index: number) => void;
}) {
	return (
		<div className="room-hero-shots" role="tablist" aria-label="Room views">
			{SHOTS.map((shot, i) => (
				<button
					key={shot.id}
					type="button"
					role="tab"
					aria-selected={i === activeIndex}
					aria-label={shot.id === "default" ? shot.label : undefined}
					className={i === activeIndex ? "is-active" : ""}
					onClick={() => onSelect(i)}
				>
					{shot.id === "default" ? (
						// "Default"/"Home" both read wrong here — Home already means
						// the site's homepage nav link, and this is the establishing
						// shot, not a distinct service line the way the other tabs
						// are. An eye (view/overview) icon sidesteps needing a label
						// that competes with either meaning, and reads as visually
						// distinct from the row of text tabs on purpose.
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden="true"
						>
							<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
							<circle cx="12" cy="12" r="3" />
						</svg>
					) : (
						shot.label
					)}
				</button>
			))}
		</div>
	);
}

export default function RoomHeroR3F() {
	const [activeIndex, setActiveIndex] = useState(0);
	const [autoAdvancing, setAutoAdvancing] = useState(SHOT_TRIGGER_MODE !== "buttons");
	const [activeSceneId, setActiveSceneId] = useState<SceneId>(DEFAULT_SCENE_ID);
	const [isNight, setIsNight] = useState(false);
	const [isSceneReady, setIsSceneReady] = useState(false);
	// Stable reference — KitchenModel's onReady effect keys off this, and an
	// inline arrow here would re-fire it on every unrelated re-render.
	const handleSceneReady = useCallback(() => setIsSceneReady(true), []);
	const isControlsShot = SHOTS[activeIndex].id === "controls";

	useEffect(() => {
		if (SHOT_TRIGGER_MODE === "buttons" || !autoAdvancing) return;
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		const id = window.setInterval(() => {
			setActiveIndex((i) => (i + 1) % SHOTS.length);
		}, AUTO_ADVANCE_MS);
		return () => window.clearInterval(id);
	}, [autoAdvancing]);

	// The lights only stay however the keypad left them while you're actually
	// on the Controls shot — leaving it (to any other shot, including just
	// passing through on the way elsewhere) puts them back to normal.
	useEffect(() => {
		if (!isControlsShot) {
			setActiveSceneId(DEFAULT_SCENE_ID);
			setIsNight(false);
		}
	}, [isControlsShot]);

	const selectShot = (index: number) => {
		setActiveIndex(index);
		// "both" mode: a manual pick hands control to the visitor permanently.
		if (SHOT_TRIGGER_MODE === "both") setAutoAdvancing(false);
	};

	const activeScene = SCENES.find((s) => s.id === activeSceneId) ?? SCENES[0];

	return (
		<>
			{/* Fades in over the static poster baked into .hero-room's CSS
			    background (see global.css) once the model has actually painted a
			    frame — before that, the poster is what's visible, so there's never
			    a blank flash while the ~2MB GLB downloads and parses. */}
			<div className={`room-hero-canvas-wrap${isSceneReady ? " is-ready" : ""}`}>
				<Canvas
					flat
					shadows
					dpr={[1, 1.5]}
					gl={{ antialias: false }}
					camera={{ position: SHOTS[0].position, fov: SHOTS[0].fov ?? DEFAULT_FOV, near: 1, far: 20 }}
				>
					<DayNightLighting isNight={isNight} />
					<CameraRig shot={SHOTS[activeIndex]} />
					<Suspense fallback={null}>
						<KitchenModel onReady={handleSceneReady} />
					</Suspense>
					<PendantLights level={activeScene.pendant} />
					<UndercabinetLights level={activeScene.undercabinet} />
					<AccessPoint />
					<EffectComposer multisampling={4}>
						<N8AO halfRes aoSamples={5} aoRadius={0.4} distanceFalloff={0.75} intensity={1} />
						<ToneMapping />
					</EffectComposer>
				</Canvas>
			</div>
			<SplashOverlay visible={SHOTS[activeIndex].id === "default"} />
			<div className="room-hero-controls">
				<KeypadPanel visible={isControlsShot} activeSceneId={activeSceneId} onSelect={setActiveSceneId} />
			</div>
			<DayNightToggle visible={isControlsShot} isNight={isNight} onChange={setIsNight} />
			{SHOT_TRIGGER_MODE !== "auto" && <ShotNav activeIndex={activeIndex} onSelect={selectShot} />}
		</>
	);
}
