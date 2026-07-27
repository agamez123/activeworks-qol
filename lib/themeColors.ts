import type { Theme } from "~lib/storage"

export interface ThemeVars {
	bg: string
	bgAlt: string
	bgElevated: string
	bgHover: string
	bgSelected: string
	border: string
	text: string
	link: string
}

// Color-override themes, shared between the site's dark-mode stylesheet
// (contents/darkMode.ts) and any extension UI (the popup) that needs to
// render itself in the matching theme. "light" isn't listed here -- on the
// site it means "inject no color overrides", but UI that always needs
// concrete colors (like the popup) uses LIGHT_THEME_VARS instead.
export const THEME_VARS: Record<Exclude<Theme, "light">, ThemeVars> = {
	dark: {
		bg: "#1e1e1e",
		bgAlt: "#222222",
		bgElevated: "#2a2a2a",
		bgHover: "#33475a",
		bgSelected: "#244b57",
		border: "#444444",
		text: "#e4e4e4",
		link: "#4dbde9"
	},
	tan: {
		bg: "#f2e8d2",
		bgAlt: "#ecdfbd",
		bgElevated: "#e4d3a8",
		bgHover: "#d3b978",
		bgSelected: "#c7a35a",
		border: "#c9b98a",
		text: "#3b3020",
		link: "#8a5a20"
	},
	ocean: {
		bg: "#101820",
		bgAlt: "#131c26",
		bgElevated: "#1a2530",
		bgHover: "#274860",
		bgSelected: "#1f5c78",
		border: "#33424f",
		text: "#dbe6ee",
		link: "#4fb3e8"
	},
	forest: {
		bg: "#10190f",
		bgAlt: "#131d12",
		bgElevated: "#1c2a1a",
		bgHover: "#2f4a2c",
		bgSelected: "#2e5c34",
		border: "#33402f",
		text: "#ddeadb",
		link: "#6fc26a"
	},
	grape: {
		bg: "#17111f",
		bgAlt: "#1c1526",
		bgElevated: "#271d33",
		bgHover: "#402f52",
		bgSelected: "#4a2e63",
		border: "#3c3049",
		text: "#e6dcee",
		link: "#b980e8"
	},
	crimson: {
		bg: "#1c1112",
		bgAlt: "#221415",
		bgElevated: "#2e1b1c",
		bgHover: "#4a2426",
		bgSelected: "#6e2229",
		border: "#4a3132",
		text: "#f0dcdd",
		link: "#e8596a"
	},
	amber: {
		bg: "#1c1610",
		bgAlt: "#221a12",
		bgElevated: "#2e2318",
		bgHover: "#4a3620",
		bgSelected: "#6e4a1e",
		border: "#4a3c2c",
		text: "#f0e4d4",
		link: "#e8a13f"
	},
	lagoon: {
		bg: "#0e1a1a",
		bgAlt: "#112020",
		bgElevated: "#182c2c",
		bgHover: "#234848",
		bgSelected: "#1f5c5c",
		border: "#2f4242",
		text: "#d8ecec",
		link: "#45c9c9"
	},
	slate: {
		bg: "#14171c",
		bgAlt: "#181c22",
		bgElevated: "#22272e",
		bgHover: "#333c47",
		bgSelected: "#2f4258",
		border: "#3a4048",
		text: "#e2e6ea",
		link: "#6f9ce8"
	},
	midnight: {
		bg: "#10101f",
		bgAlt: "#131327",
		bgElevated: "#1c1c34",
		bgHover: "#2c2c52",
		bgSelected: "#2e2e6e",
		border: "#303050",
		text: "#dfdff0",
		link: "#8484f0"
	},
	graphite: {
		bg: "#191817",
		bgAlt: "#1d1c1b",
		bgElevated: "#292725",
		bgHover: "#423f3b",
		bgSelected: "#55504a",
		border: "#423f3b",
		text: "#ece9e6",
		link: "#c9a876"
	},
	rose: {
		bg: "#1c1116",
		bgAlt: "#22141a",
		bgElevated: "#2e1b24",
		bgHover: "#4a243a",
		bgSelected: "#6e2250",
		border: "#4a3140",
		text: "#f0dce7",
		link: "#e85fae"
	}
}

// The site's own "light" theme is just its native, un-overridden CSS -- but
// UI that always renders itself (the popup) needs actual colors for it.
export const LIGHT_THEME_VARS: ThemeVars = {
	bg: "#ffffff",
	bgAlt: "#f7f7f7",
	bgElevated: "#ffffff",
	bgHover: "#f0f0f0",
	bgSelected: "#eaf1fc",
	border: "#d5d5d5",
	text: "#1e1e1e",
	link: "#2f6fdb"
}

export function themeVarsFor(theme: Theme): ThemeVars {
	return theme === "light" ? LIGHT_THEME_VARS : THEME_VARS[theme]
}
