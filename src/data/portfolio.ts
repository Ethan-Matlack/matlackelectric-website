import type { ImageMetadata } from "astro";
// Placeholder used until a project has a real photo - see the image() calls
// below.
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

export const PORTFOLIO_TAGS = ["Addition", "Kitchen", "Bathroom", "Sunroom", "Outdoors"] as const;

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
		slug: "citrone-addition",
		title: "Citrone Addition",
		description: "A stunning kitchen & dining addition with custom beam uplighting, cabinet lighting, and smart home integration.",
		tags: ["Kitchen", "Addition"],
		image: image("citrone1.webp"),
	},
	// The four projects below link to case-study pages that don't exist yet.
	// TODO: assign real tags and build out src/pages/portfolio/*.astro for each.
	{
		slug: "stafford-renovation",
		title: "Stafford Renovation",
		description: "A description of Project 2.",
		tags: ["Kitchen"],
		image: placeholder,
	},
	{
		slug: "structurex-pavilion",
		title: "StructureX Pavilion",
		description: "A description of Project 3.",
		tags: ["Outdoors"],
		image: placeholder,
	},
	{
		slug: "bizarro-addition",
		title: "Bizarro Addition",
		description: "A description of Project 3.",
		tags: ["Addition"],
		image: placeholder,
	},
	{
		slug: "christiano-addition",
		title: "Christiano Kitchen Addition",
		description: "A description of Project 3.",
		tags: ["Kitchen", "Addition"],
		image: placeholder,
	},
];
