import type { ImageMetadata } from "astro";
// Placeholder used until a project has a real photo
import placeholder from "../images/placeholder_640x400.svg";

// Every file in src/images/portfolio/ is available here, keyed by its full
// relative path - so adding a photo is just dropping the file in that
// folder, no new import line needed. image() below looks one up by
// filename alone.
const portfolioImages = import.meta.glob<{ default: ImageMetadata }>(
	"../images/portfolio/*.{jpg,jpeg,png,webp}",
	{ eager: true },
);

function image(filename: string): ImageMetadata {
	const entry = Object.entries(portfolioImages).find(([path]) => path.endsWith(`/${filename}`));
	if (!entry) {
		throw new Error(`Portfolio image not found: "${filename}" (looked in src/images/portfolio/)`);
	}
	return entry[1].default;
}

export const PORTFOLIO_TAGS = ["Addition", "Kitchen", "Bathroom", "Basement", "Office", "Gym","Sunroom", "Outdoors"] as const;

export type PortfolioTag = (typeof PORTFOLIO_TAGS)[number];

export interface PortfolioProject {
	slug: string;
	title: string;
	description: string;
	tags: PortfolioTag[];
	image: ImageMetadata;
}

export const portfolioProjects: PortfolioProject[] = [
	{
		slug: "mont-clare-addition",
		title: "Mont Clare Addition",
		description: "This addition features a new kitchen, dining room, and living room, as well as a small home office nook.",
		tags: ["Addition", "Kitchen", "Office"],
		image: image("christiano1.webp"),
	},
	{
		slug: "conshohocken-addition",
		title: "Conshohocken Addition",
		description: "A stunning kitchen & dining addition with innovative custom beam uplighting, cabinet lighting, and smart home integration.",
		tags: ["Addition", "Kitchen"],
		image: image("citrone1.webp"),
	},
	{
		slug: "garnet-valley-kitchen",
		title: "Garnet Valley Kitchen",
		description: "A description of Project 3.",
		tags: ["Kitchen"],
		image: image("goracy-watkins1.webp"),
	},
	{
		slug: "west-chester-kitchen",
		title: "West Chester Kitchen",
		description: "This warm and inviting kitchen remodel features a beautiful selection of light fixtures, and a Lutron Caseta system to control them.",
		tags: ["Kitchen"],
		image: image("stratton5.webp"),
	},
	{
		slug: "structurex-pavilion",
		title: "StructureX Pavilion",
		description: "Brand new outdoor living space with a motorized pavilion and kitchen. Complete with infared heaters, ceilings fans, and a custom lighting design.",
		tags: ["Outdoors"],
		image: placeholder,
	},
	{
		slug: "three-story-addition",
		title: "Three-Story Addition",
		description: "A massive three-story addition with a new kitchen, dining room, home office, master closet, and home gym.",
		tags: ["Addition", "Kitchen", "Office", "Gym"],
		image: placeholder,
	},
	{
		slug: "wilmington-basement-remodel",
		title: "Wilmington Basement Remodel",
		description: "From an unfinished space to a brand new home theater, mini-bar, full bathroom, home gym, and shuffleboard area!",
		tags: ["Basement", "Gym", "Bathroom"],
		image: image("thresher4.webp"),
	},
	{
		slug: "pheasant-run-fire-restoration",
		title: "Pheasant Run Fire Restoration",
		description: "A partial home restoration after a fire, including a new garage, bathroom, laundry room, and outdoor living space.",
		tags: ["Bathroom", "Outdoors"],
		image: image("daly1.webp"),
	},
	{
		slug: "glenmoore-basement-remodel",
		title: "Glenmoore Basement Remodel",
		description: "Basement turned in-law suite with a full kitchen, bathroom, living space, and bedroom.",
		tags: ["Basement", "Kitchen", "Bathroom"],
		image: image("forsey2.webp"),
	},
	{
		slug: "malvern-outdoor-living",
		title: "Malvern Outdoor Living",
		description: "A beautiful outdoor living space with a screened-in porch complete with heaters, motorized screens, and a TV, as well as an outdoor kitchen.",
		tags: ["Outdoors"],
		image: image("lotto1.webp"),
	},
	{
		slug: "sarum-farm-sunroom",
		title: "Sarum Farm Sunroom",
		description: "Large deck with a sunroom addition.",
		tags: ["Outdoors"],
		image: image("mohla1.webp"),
	},
	{
		slug: "media-deck",
		title: "Media Deck",
		description: "A spacious deck with a covered porch.",
		tags: ["Outdoors"],
		image: image("ott3.webp"),
	},
	{
		slug: "old-post-kitchen",
		title: "Old Post Kitchen",
		description: "DESCRIPTION",
		tags: ["Kitchen"],
		image: image("platt1.webp"),
	},
	{
		slug: "west-chester-sunroom",
		title: "West Chester Sunroom",
		description: "DESCRIPTION",
		tags: ["Sunroom"],
		image: image("torres1.webp"),
	},
	{
		slug: "ryans-run-addition",
		title: "Ryans Run Addition",
		description: "DESCRIPTION",
		tags: ["Addition"],
		image: image("weis3.webp"),
	},
	{
		slug: "hoylake-sunroom",
		title: "Hoylake Sunroom",
		description: "DESCRIPTION",
		tags: ["Sunroom"],
		image: image("zona4.webp"),
	},
];
