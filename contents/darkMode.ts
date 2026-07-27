import type { PlasmoCSConfig } from "plasmo"

import {
	DEFAULT_THEME,
	LEGACY_DARK_MODE_STORAGE_KEY,
	resolveStoredTheme,
	THEME_STORAGE_KEY,
	type Theme
} from "~lib/storage"
import { THEME_VARS, type ThemeVars } from "~lib/themeColors"

export const config: PlasmoCSConfig = {
	matches: ["*://sports.active.com/*"],
	exclude_matches: ["*://sports.active.com/ReportServer/*"],
	all_frames: true,
	run_at: "document_start"
}

const STYLE_ID = "qol-dark-mode"
const TRANSITION_STYLE_ID = "qol-dark-mode-transition"
const ROW_STRIPE_STYLE_ID = "qol-row-stripe"
const LAYOUT_STYLE_ID = "qol-layout-padding"

// Row striping for readability - kept in its own never-removed style tag so
// it applies in light mode too. The dark-mode stylesheet's own row rules are
// injected after this one, so they win the cascade whenever dark mode is on.
const rowStripeCss = `
	tbody tr:nth-child(even) td {
		background-color: #f0f0f0 !important;
	}
`

// The site's own CSS zeroes out this column's side padding
// (.active-swimming-components-PageLayout-wrapTableColumn { padding-left:0;
// padding-right:0 }), which is the main content column on every page (Home,
// People, etc). With no padding, headings/table text sit flush against the
// sidebar divider. Kept in its own never-removed style tag so it applies in
// light mode too.
const layoutPaddingCss = `
	.active-swimming-components-PageLayout-wrapTableColumn {
		padding: 0 20px !important;
	}
`

// Kept in a separate, never-removed style tag so the fade survives
// toggling the main dark-mode stylesheet on/off. Scoped to the exact
// selectors the dark-mode css touches (a universal "*" selector forces the
// browser to repaint every element on every frame, which is what caused
// the jank).
const transitionCss = `
	html,
	body,
	h1, h2, h3, h4, h5, h6,
	label,
	.checkbox,
	.dropdown__button,
	.dropdown__button-text,
	.active-swimming-components-BaseInput,
	.form__instruction,
	.form__label,
	.table,
	tbody > tr > td,
	.viewlabel,
	#tableTitle,
	#headerText,
	#programDetail,
	.item-header,
	.athlete-info,
	.elgDropDownLabel,
	a,
	.fndArch-LinkBlueOnLightGray,
	.btn,
	input,
	select,
	textarea,
	.dropdown__menu,
	.dropdown__menu li,
	.dropdown__menu li a,
	#athleteFilerArea,
	.odd,
	tbody tr,
	tbody tr.selected,
	.sidebar a,
	.pagination > li > span,
	.highcharts-background,
	.header.CollapseAll,
	.header.Itemheader,
	.sectionTitle,
	.accordion,
	.accordion h6,
	.accordion h6 tbody tr td {
		transition: background-color 0.15s ease-in-out, color 0.15s ease-in-out, border-color 0.15s ease-in-out, fill 0.15s ease-in-out !important;
	}
`

function buildThemeCss(vars: ThemeVars) {
	return `
	:root {
		--qol-bg: ${vars.bg};
		--qol-bg-alt: ${vars.bgAlt};
		--qol-bg-elevated: ${vars.bgElevated};
		--qol-bg-hover: ${vars.bgHover};
		--qol-bg-selected: ${vars.bgSelected};
		--qol-border: ${vars.border};
		--qol-text: ${vars.text};
		--qol-link: ${vars.link};
	}

	html,
	body {
		background-color: var(--qol-bg) !important;
		color: var(--qol-text) !important;
	}

	/* Text hardcoded to dark grays/black by the site's own CSS */
	h1, h2, h3, h4, h5, h6,
	label,
	.checkbox,
	.dropdown__button,
	.dropdown__button-text,
	.active-swimming-components-BaseInput,
	.form__instruction,
	.form__label,
	.table,
	tbody > tr > td,
	.viewlabel,
	#tableTitle,
	#headerText,
	#programDetail,
	.item-header,
	.athlete-info,
	.elgDropDownLabel {
		color: var(--qol-text) !important;
	}

	.ageRangeGroup .inputContent {
		background-color: unset !important;
	}

	/* The SSRS report iframe (excluded from dark mode) is transparent by
		 default, so the dark page background behind it shows through until
		 the report's own white content fills it. */
	#reportServiceContainer {
		background-color: #ffffff !important;
	}

	a,
	.fndArch-LinkBlueOnLightGray {
		color: var(--qol-link) !important;
	}

	/* Buttons, inputs, selects that default to light backgrounds */
	.btn,
	input,
	select,
	textarea,
	.dropdown__button {
		background-color: var(--qol-bg-elevated) !important;
		background-image: none !important;
		color: var(--qol-text) !important;
		border-color: var(--qol-border) !important;
	}

	/* Dropdown / combobox menus */
	.dropdown__menu,
	.dropdown__menu li {
		background-color: var(--qol-bg-elevated) !important;
		color: var(--qol-text) !important;
	}

	.dropdown__menu li a {
		color: var(--qol-text) !important;
	}

	.dropdown__menu li:hover {
		background-color: var(--qol-bg-hover) !important;
	}

	#athleteFilerArea {
		background-color: var(--qol-bg-alt) !important;
		background-image: none !important;
	}

	/* Data grid rows - alternate shading for row scannability */
	.odd,
	tbody tr:nth-child(odd) td,
	tbody tr:last-child td {
		background-color: var(--qol-bg-alt) !important;
	}

	tbody tr:nth-child(even) td {
		background-color: var(--qol-bg) !important;
	}

	.table-hover tbody tr:hover,
	tbody tr:hover {
		background-color: var(--qol-bg-hover) !important;
		color: var(--qol-text) !important;
	}

	tbody tr.selected {
		background-color: var(--qol-bg-selected) !important;
		color: var(--qol-text) !important;
	}

	/* Left nav / FAQ sidebar links */
	.sidebar a {
		background-color: var(--qol-bg-elevated) !important;
		color: var(--qol-text) !important;
	}

	/* Pagination */
	.pagination > li > span {
		background-color: var(--qol-bg-elevated) !important;
		border-color: var(--qol-border) !important;
		color: var(--qol-link) !important;
	}

	.pagination > li > span:hover {
		background-color: var(--qol-bg-hover) !important;
	}

	/* Highcharts pie/donut charts (e.g. the Meet Attendance summary) render
		 their own background rect with a hardcoded white fill. */
	.highcharts-background {
		fill: var(--qol-bg-elevated) !important;
	}

	/* MeetEntryByEvent: sidebar filter section headers ("Collapse all",
		 "Event gender", "Event age group", etc.) keep the site's own hardcoded
		 background/text regardless of theme, so they don't follow dark mode. */
	.header.CollapseAll,
	.header.Itemheader,
	.eventByEvent,
	.eventTitle,
    .prePanel {
		background: var(--qol-bg-elevated) !important;
		color: var(--qol-text) !important;
	}

	.session {
		background-color: var(--qol-bg-alt) !important;
	}

	/* MeetEntryByName: each swimmer's collapsible header keeps the site's own
		 hardcoded light-gray background (inline style="background-color:#ebebeb")
		 and border regardless of theme. */
	.accordion h6 {
		background-color: var(--qol-bg-elevated) !important;
	}

	.accordion {
		border-color: var(--qol-border) !important;
	}

	/* The swimmer-info table nested inside the header (div.accordionRenderer.layout)
		 picks up the row-striping background from the generic tbody rules above,
		 which is a different shade than the header's own background, leaving a
		 visible seam. Force it to match the header. */
	.accordion h6 tbody tr td {
		background-color: var(--qol-bg-elevated) !important;
	}

	.session .title {
		color: var(--qol-text) !important;
	}

	.header.Itemheader:hover {
		background: var(--qol-bg-hover) !important;
	}

	.sectionTitle {
		color: var(--qol-text) !important;
	}

	/* Modals render into a portal (.modal-root) appended to <body> with the
		 site's own hardcoded white background/dark text, so they don't inherit
		 the dark-mode rules above. */
	.modal-content,
	.modal-box {
		background-color: var(--qol-bg-elevated) !important;
	}

	.modal-header,
	.modal-footer {
		background-color: var(--qol-bg-elevated) !important;
		color: var(--qol-text) !important;
	}

	.modal-title {
		color: var(--qol-text) !important;
	}

	.modal-body {
		background-color: var(--qol-bg-elevated) !important;
		color: var(--qol-text) !important;
	}

	.modal-close {
		color: var(--qol-text) !important;
	}

	.modal-lists {
		border-color: var(--qol-border) !important;
	}

	/* MeetEntryByEvent: the "eligible events" popup hardcodes the swimmer's
		 name to black text, which is unreadable against the dark modal body. */
	#eligibleEventsPopup .swimmerName {
		color: var(--qol-text) !important;
	}
`
}

// Optimistically dark so there's no flash-of-light for the common case;
// corrected as soon as storage resolves to whatever theme is actually saved.
let theme: Theme = DEFAULT_THEME

// The theme actually reflected in the DOM right now, as opposed to `theme`
// (the desired theme). applyTheme() runs on every DOM mutation anywhere on
// the page (see the MutationObserver below), so it must be a no-op unless
// the theme has actually changed -- otherwise rewriting the stylesheet's
// textContent on every call is itself a mutation, which retriggers the
// observer, which rewrites it again: an infinite loop that pegs the tab.
let appliedTheme: Theme | null = null

function injectTransitionStyle() {
	if (document.getElementById(TRANSITION_STYLE_ID)) return

	const style = document.createElement("style")
	style.id = TRANSITION_STYLE_ID
	style.textContent = transitionCss
	;(document.head || document.documentElement).appendChild(style)
}

function injectRowStripeStyle() {
	if (document.getElementById(ROW_STRIPE_STYLE_ID)) return

	const style = document.createElement("style")
	style.id = ROW_STRIPE_STYLE_ID
	style.textContent = rowStripeCss
	;(document.head || document.documentElement).appendChild(style)
}

function injectLayoutPaddingStyle() {
	if (document.getElementById(LAYOUT_STYLE_ID)) return

	const style = document.createElement("style")
	style.id = LAYOUT_STYLE_ID
	style.textContent = layoutPaddingCss
	;(document.head || document.documentElement).appendChild(style)
}

function injectThemeStyle(vars: ThemeVars) {
	let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null

	if (!style) {
		style = document.createElement("style")
		style.id = STYLE_ID
		;(document.head || document.documentElement).appendChild(style)
	}

	style.textContent = buildThemeCss(vars)
}

function removeStyle() {
	document.getElementById(STYLE_ID)?.remove()
}

// Row striping / layout padding / transitions are structural QoL fixes that
// apply under every theme, including "light" (the site's native colors).
// Only "dark" and "tan" additionally get a color-override stylesheet.
function applyTheme() {
	injectRowStripeStyle()
	injectLayoutPaddingStyle()
	injectTransitionStyle()

	// Re-check actual DOM presence (not just `appliedTheme`) so a stylesheet
	// the site's own bootstrap process rips out of a rebuilt <head> still
	// gets re-injected, even though the desired theme itself hasn't changed.
	const styleTagPresent = document.getElementById(STYLE_ID) !== null
	if (theme === appliedTheme && (theme === "light" || styleTagPresent)) return

	if (theme === "light") {
		removeStyle()
	} else {
		injectThemeStyle(THEME_VARS[theme])
	}

	appliedTheme = theme
}

applyTheme()

chrome.storage.sync.get(
	[THEME_STORAGE_KEY, LEGACY_DARK_MODE_STORAGE_KEY],
	(result) => {
		theme = resolveStoredTheme(result)
		applyTheme()
	}
)

chrome.storage.onChanged.addListener((changes, area) => {
	if (area !== "sync" || !changes[THEME_STORAGE_KEY]) return

	theme = changes[THEME_STORAGE_KEY].newValue ?? DEFAULT_THEME
	applyTheme()
})

// Re-apply if the site's own bootstrap process rebuilds the document
// and drops our injected stylesheet.
const observer = new MutationObserver(() => applyTheme())
observer.observe(document.documentElement, {
	childList: true,
	subtree: true
})

window.addEventListener("hashchange", applyTheme)
