// See PORTFOLIO.md (this folder) for how to add a new project - covers the
// image folder setup and the content block format below.
import type { ImageMetadata } from "astro";
// Placeholder used until a project has a COVER photo of its own.
import placeholder from "../images/placeholder_640x400.svg";

// Every project's photos live under its own src/images/portfolio/<slug>/
// folder - globbed once here, keyed by full relative path (which includes
// the slug segment). coverImage() and projectImages() below both just
// filter this down by slug, so dropping a file into the right folder is
// all that's needed - no import line, and no filename to reference, per
// project.
const portfolioImages = import.meta.glob<{ default: ImageMetadata }>(
	"../images/portfolio/*/*.{jpg,jpeg,png,webp}",
	{ eager: true },
);

// The card/hero thumbnail - the file named COVER.* (any extension above)
// inside the project's folder. Falls back to the placeholder (with a
// build-time warning, not a hard failure) for any project that doesn't
// have one yet, since that's the normal state for a project still being
// built out.
function coverImage(slug: string): ImageMetadata {
	const entry = Object.entries(portfolioImages).find(([path]) => path.includes(`/portfolio/${slug}/COVER.`));
	if (!entry) {
		console.warn(`No COVER image found for portfolio project "${slug}" - using the placeholder.`);
		return placeholder;
	}
	return entry[1].default;
}

// Every photo in a project's folder, for use in that project's own
// portfolio page body content - COVER first (images[0]), then the rest
// sorted by filename, so a folder's 1.webp/2.webp/3.webp land at
// images[1]/images[2]/images[3] (matching the filenames, not off by one)
// and the cover photo can still be reused in the body if a page wants it.
export function projectImages(slug: string): ImageMetadata[] {
	const rest = Object.entries(portfolioImages)
		.filter(([path]) => path.includes(`/portfolio/${slug}/`) && !path.includes("/COVER."))
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([, mod]) => mod.default);
	return [coverImage(slug), ...rest];
}

export const PORTFOLIO_TAGS = ["Addition", "Kitchen", "Bathroom", "Basement", "Office", "Gym", "Sunroom", "Outdoors"] as const;

export type PortfolioTag = (typeof PORTFOLIO_TAGS)[number];

// The building blocks a portfolio project page's body can be assembled
// from - see PORTFOLIO.md for the full guide to each block type.
// PortfolioProjectBody.astro turns an array of these (in order) into the
// actual markup. `image` on the image/split blocks is an index into that
// project's projectImages(slug) array (0 = cover, 1 = "1.webp", ...). `src`
// on a video block is a plain public/ path instead - videos aren't run
// through astro:assets (there's no resizing/format conversion to do for
// them the way there is for images), so they just live under
// public/videos/portfolio/<slug>/ and get referenced directly, the same
// way any other unprocessed static file in public/ would be. Add a new
// variant here (and handle it in PortfolioProjectBody.astro) if a project
// ever needs a shape none of these five cover.
export type ContentBlock =
	| { type: "text"; text: string }
	| { type: "image"; image: number; caption?: string }
	| { type: "split"; image: number; heading: string; text: string; reverse?: boolean }
	| { type: "video"; src: string; caption?: string }
	| { type: "testimonial"; quote: string; author: string; role?: string };

export interface PortfolioProject {
	slug: string;
	title: string;
	description: string;
	tags: PortfolioTag[];
	image: ImageMetadata;
	content: ContentBlock[];
}

type PortfolioProjectInput = Omit<PortfolioProject, "image">;

// ===================================================================================
// ===================================================================================
// ACTUAL CONTENT STARTS HERE - see PORTFOLIO.md for how to add a new project, and the
// ContentBlock type above for how to build out a project page's body content.
// ===================================================================================
// ===================================================================================

const portfolioProjectInputs: PortfolioProjectInput[] = [
	{
		slug: "mont-clare-addition",
		title: "Mont Clare Addition",
		description: "This addition features a new kitchen, dining room, and living room, as well as a small home office nook.",
		tags: ["Addition", "Kitchen", "Office"],
		content: [
			{
				type: "text",
				text: "This addition replaced the home's old kitchen and dining room entirely and added a brand new living room alongside them. Everything in the new footprint needed wiring and lighting built from scratch. To make things uniquely challenging, the homeowners (understandably) wanted minimal downtime of their existing kitchen, so the existing wiring had to left in place while the new wiring was pulled and installed in the addition, then the old kitchen was demoed and the new kitchen was ready to go with minimal loss of use of their home.",
			},
			{
				type: "split",
				image: 0,
				heading: "Kitchen & Dining",
				text: "Recessed lighting throughout the kitchen and dining area pairs with a mix of pendant fixtures and recessed over the island, sized to actually light the counter and seating below instead of just filling the ceiling.",
			},
			{
				type: "split",
				image: 1,
				heading: "New Living Room",
				text: "The new living is a bright and open space, flowing right into the kitchen and dining area allowing for that desirable open-concept feel.",
				reverse: true,
			},
			{
				type: "split",
				image: 2,
				heading: "Office Nook",
				text: "A small office nook was added to the area that used to be the old kitchen, with a desk and floating shelving built into the wall. Integrated under-shelf lighting for this space is both functional and beautiful.",
			},
			{
				type: "video",
				src: "/videos/portfolio/mont-clare-addition/video.mp4",
				caption: "A look at the finished addition, from the air and from inside.",
			},
		],
	},
	{
		slug: "conshohocken-addition",
		title: "Conshohocken Addition",
		description: "A stunning kitchen & dining addition with innovative custom beam uplighting, cabinet lighting, and smart home integration.",
		tags: ["Addition", "Kitchen"],
		content: [
			{
				type: "text",
				text: "This project added a full kitchen and dining space onto the back of the home, and the brief from day one was lighting-first: the exposed beams overhead needed to be a feature, not just something to work around, and the whole space needed to dim and scene together instead of being switched room by room.",
			},
			{
				type: "split",
				image: 1,
				heading: "Beam Uplighting",
				text: "Concealed fixtures run the length of each exposed beam, washing light upward instead of down — the beams read as a design feature after dark instead of disappearing into shadow.",
			},
			{
				type: "split",
				image: 2,
				heading: "Cabinet Lighting",
				text: "Undercabinet and toe-kick lighting throughout the kitchen, all on the same dimming system as the beams — task lighting where it's needed without a separate switch plate for every zone.",
				reverse: true,
			},
			{
				type: "image",
				image: 3,
				caption: "The addition at night, beams, cabinets, and general lighting all on one Lutron scene.",
			},
			{
				type: "text",
				text: 'Everything in the addition — beams, cabinets, general lighting — is tied into a single Lutron RadioRA 3 system, so the whole space moves between "cooking," "dinner," and "off" with one keypad press instead of six switches.',
			},
			{
				type: "testimonial",
				quote: "A quote from the client or builder about how great we are! :)",
				author: "CLIENT NAME",
				role: "CLIENT ROLE",
			},
		],
	},
	{
		slug: "garnet-valley-kitchen",
		title: "Garnet Valley Kitchen",
		description: "A full kitchen remodel focused on brightening a dim, closed-in layout with a new ceiling lighting plan and pendant lighting over the island.",
		tags: ["Kitchen"],
		content: [
			{
				type: "text",
				text: "This kitchen remodel focused on brightening a layout that had good bones but felt dim and closed-in - heavy, patterned granite and golden maple cabinetry were absorbing what natural light the window wall let in.",
			},
			{
				type: "split",
				image: 1,
				heading: "Before",
				text: "Golden maple cabinetry, a patterned granite, and only a handful of old 6in recessed cans made this kitchen feel dim and closed-in, despite the decent number of windows.",
			},
			{
				type: "split",
				image: 2,
				heading: "Full Rewire",
				text: "The kitchen went down to the studs for a full rewire - every light, outlet, and switch in the new layout runs on wiring pulled fresh for this remodel, not spliced onto whatever the original kitchen had.",
				reverse: true,
			},
			{
				type: "split",
				image: 0,
				heading: "Brand New Pendant & Recessed Lighting",
				text: "Glass and brass pendants over the island pair with a full ceiling plan of recessed lighting - layered light in place of the dim lighting the kitchen had before.",
			},
			{
				type: "text",
				text: "This kitchen also recieved a completely new appliance package including a range hood, dishwasher, fridge, and under-cabinet microwave, all of which recieved completely new wiring.",
			},
			{
				type: "testimonial",
				quote: "Practical function: a better cooking workflow, improved storage, and reliable lighting.",
				author: "Homeowner",
				role: "Name withheld for privacy",
			},
		],
	},
	{
		slug: "west-chester-kitchen",
		title: "West Chester Kitchen",
		description: "This warm and inviting kitchen remodel features a beautiful selection of light fixtures, and a Lutron Caseta system to control them.",
		tags: ["Kitchen"],
		content: [
			{
				type: "text",
				text: "This whole-kitchen remodel opened up the layout - removing soffits, widening openings, and reworking the island - to create the open, light-filled feel the homeowners were after. The electrical scope followed the same brief: new wiring and lighting circuits throughout, built around fixtures that read as considered rather than an afterthought.",
			},
			{
				type: "split",
				image: 3,
				heading: "Pendant Lighting",
				text: "A pair of earthen pottery pendants hang over the island on exposed brass stems, sized and spaced to anchor the space without crowding the sightline through to the dining room and deck beyond.",
			},
			{
				type: "split",
				image: 1,
				heading: "Recessed Lighting",
				text: "New recessed cans throughout the kitchen and dining area. Several of these are Elco's trimless option, which is a more modern look than the traditional trim ring and blends into the ceiling instead of standing out.",
				reverse: true,
			},
			{
				type: "image",
				image: 2,
				caption: "Lutron's screwless wallplates and keypads are a clean, modern look that matches the kitchen's aesthetic. The Caseta system allows the whole kitchen to dim and scene together instead of being switched room by room.",
			},
			{
				type: "text",
				text: "Notice something missing from this kitchen? No outlets on the backsplash. The homeowners wanted a clean, uninterrupted backsplash, so we used outlet strips tucked under the cabinets instead to allow the backsplash to take center stage. The Caseta system also helped with this endevour by allowing us to hide some switches and use Pico remotes for a more minimal look, without sacrificing functionality.",
			},
			{
				type: "testimonial",
				quote: "We wanted light, open sweeping sightlines, guests moving freely, and something timeless.",
				author: "Homeowners",
				role: "Names withheld for privacy",
			},
		],
	},
	// {
	// 	slug: "structurex-pavilion",
	// 	title: "StructureX Pavilion",
	// 	description: "Brand new outdoor living space with a motorized pavilion and kitchen. Complete with infared heaters, ceilings fans, and a custom lighting design.",
	// 	tags: ["Outdoors"],
	// 	content: [],
	// },
	// {
	// 	slug: "three-story-addition",
	// 	title: "Three-Story Addition",
	// 	description: "A massive three-story addition with a new kitchen, dining room, home office, master closet, and home gym.",
	// 	tags: ["Addition", "Kitchen", "Office", "Gym"],
	// 	content: [],
	// },
	// {
	// 	slug: "wilmington-basement-remodel",
	// 	title: "Wilmington Basement Remodel",
	// 	description: "From an unfinished space to a brand new home theater, mini-bar, full bathroom, home gym, and shuffleboard area!",
	// 	tags: ["Basement", "Gym", "Bathroom"],
	// 	content: [],
	// },
	// {
	// 	slug: "pheasant-run-fire-restoration",
	// 	title: "Pheasant Run Fire Restoration",
	// 	description: "A partial home restoration after a fire, including a new garage, bathroom, laundry room, and outdoor living space.",
	// 	tags: ["Bathroom", "Outdoors"],
	// 	content: [],
	// },
	// {
	// 	slug: "glenmoore-basement-remodel",
	// 	title: "Glenmoore Basement Remodel",
	// 	description: "Basement turned in-law suite with a full kitchen, bathroom, living space, and bedroom.",
	// 	tags: ["Basement", "Kitchen", "Bathroom"],
	// 	content: [],
	// },
	// {
	// 	slug: "malvern-outdoor-living",
	// 	title: "Malvern Outdoor Living",
	// 	description: "A beautiful outdoor living space with a screened-in porch complete with heaters, motorized screens, and a TV, as well as an outdoor kitchen.",
	// 	tags: ["Outdoors"],
	// 	content: [],
	// },
	// {
	// 	slug: "sarum-farm-sunroom",
	// 	title: "Sarum Farm Sunroom",
	// 	description: "Large deck with a sunroom addition.",
	// 	tags: ["Outdoors"],
	// 	content: [],
	// },
	// {
	// 	slug: "lima-deck",
	// 	title: "Lima Deck",
	// 	description: "A spacious deck with a covered porch.",
	// 	tags: ["Outdoors"],
	// 	content: [],
	// },
	// {
	// 	slug: "old-post-kitchen",
	// 	title: "Old Post Kitchen",
	// 	description: "DESCRIPTION",
	// 	tags: ["Kitchen"],
	// 	content: [],
	// },
	// {
	// 	slug: "west-chester-sunroom",
	// 	title: "West Chester Sunroom",
	// 	description: "DESCRIPTION",
	// 	tags: ["Sunroom"],
	// 	content: [],
	// },
	// {
	// 	slug: "ryans-run-addition",
	// 	title: "Ryans Run Addition",
	// 	description: "DESCRIPTION",
	// 	tags: ["Addition"],
	// 	content: [],
	// },
	// {
	// 	slug: "hoylake-sunroom",
	// 	title: "Hoylake Sunroom",
	// 	description: "DESCRIPTION",
	// 	tags: ["Sunroom"],
	// 	content: [],
	// },
];

export const portfolioProjects: PortfolioProject[] = portfolioProjectInputs.map((project) => ({
	...project,
	image: coverImage(project.slug),
}));
