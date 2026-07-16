import type { PlasmoCSConfig } from "plasmo"

import { buildTailoredCsv, parseReportRows, UNGROUPED_ID } from "~lib/csvFormat"
import { buildTopTimesUrl, fetchTopTimesCsv } from "~lib/ssrsExport"
import {
	fetchTrainingGroups,
	type TrainingGroupData
} from "~lib/trainingGroups"

export const config: PlasmoCSConfig = {
	matches: ["*://sports.active.com/*"],
	run_at: "document_idle"
}

const BAR_ID = "qol-times-export-bar"
const GROUPS_ID = "qol-times-export-groups"
const ALL_TIMES_ID = "qol-times-export-alltimes"
const STATUS_ID = "qol-times-export-status"

const GROUP_FETCH_RETRY_MS = 1500
const GROUP_FETCH_MAX_TRIES = 20

let groupData: TrainingGroupData | null = null
let groupFetchTries = 0
let groupFetchTimer: number | null = null

function isTopTimesByNamePage(): boolean {
	const hash = window.location.hash
	return hash.includes("/reports/ssrs") && hash.includes("type=BY_NAME")
}

// The report results route carries every wizard selection as JSON in the
// hash: #/active/swimming/reports/ssrs?value=<urlencoded JSON>&type=BY_NAME.
// The JSON keys are the SSRS parameter names (P, M, AgeGroup, Top, ...), so
// they can be replayed against the ReportServer directly.
function parseHashReportParams(): Record<string, string | number> | null {
	const hash = window.location.hash
	const queryStart = hash.indexOf("?")
	if (queryStart < 0) return null

	const value = new URLSearchParams(hash.slice(queryStart + 1)).get("value")
	if (!value) return null

	try {
		const parsed = JSON.parse(value)
		return typeof parsed === "object" && parsed ? parsed : null
	} catch {
		return null
	}
}

function setStatus(message: string, isError = false) {
	const status = document.getElementById(STATUS_ID)
	if (!status) return
	status.textContent = message
	status.style.setProperty(
		"color",
		isError ? "#df3560" : "inherit",
		"important"
	)
}

function buildGroupDot(color: string) {
	const dot = document.createElement("span")
	dot.style.cssText = `
			display: inline-block;
			width: 8px;
			height: 8px;
			border-radius: 50%;
			background-color: ${color};
			margin-right: 4px;
	`
	return dot
}

function buildGroupCheckbox(id: string, name: string, color?: string) {
	const label = document.createElement("label")
	label.style.cssText =
		"display: inline-flex; align-items: center; gap: 4px; margin: 0 10px 0 0; cursor: pointer; font-weight: 400;"

	const checkbox = document.createElement("input")
	checkbox.type = "checkbox"
	checkbox.value = id
	checkbox.className = "qol-export-group"
	checkbox.style.margin = "0"

	label.appendChild(checkbox)
	if (color) label.appendChild(buildGroupDot(color))
	label.appendChild(document.createTextNode(name))

	return label
}

function renderGroupCheckboxes() {
	const container = document.getElementById(GROUPS_ID)
	if (!container || !groupData) return

	container.replaceChildren()

	for (const group of groupData.groups) {
		container.appendChild(buildGroupCheckbox(group.id, group.name, group.color))
	}
	container.appendChild(buildGroupCheckbox(UNGROUPED_ID, "Ungrouped"))
}

// Group membership comes from the JSON APIs, which need the CSRF token that
// pageContext.ts sniffs from the site's own requests -- on a fresh page load
// those may not have fired yet, so poll until they have.
function loadGroupData() {
	if (groupData || groupFetchTimer !== null) return

	const attempt = async () => {
		groupFetchTimer = null
		groupFetchTries++

		const data = await fetchTrainingGroups()
		if (data) {
			groupData = data
			renderGroupCheckboxes()
			return
		}

		if (groupFetchTries < GROUP_FETCH_MAX_TRIES) {
			groupFetchTimer = window.setTimeout(attempt, GROUP_FETCH_RETRY_MS)
		} else {
			setStatus("couldn't load training groups (try reloading the page)", true)
		}
	}

	attempt()
}

function selectedGroupIds(): Set<string> {
	const ids = new Set<string>()
	document
		.querySelectorAll<HTMLInputElement>(`#${GROUPS_ID} input.qol-export-group`)
		.forEach((checkbox) => {
			if (checkbox.checked) ids.add(checkbox.value)
		})
	return ids
}

function selectedGroupNames(ids: Set<string>): string[] {
	const names: string[] = []
	for (const group of groupData?.groups ?? []) {
		if (ids.has(group.id)) names.push(group.name)
	}
	if (ids.has(UNGROUPED_ID)) names.push("ungrouped")
	return names
}

function downloadCsv(csv: string, filename: string) {
	const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
	const link = document.createElement("a")
	link.href = url
	link.download = filename
	link.click()
	URL.revokeObjectURL(url)
}

function exportFilename(groupNames: string[]): string {
	const groups =
		groupNames
			.join("+")
			.toLowerCase()
			.replace(/[^\w+]+/g, "-")
			.slice(0, 60) || "all"
	const date = new Date().toISOString().slice(0, 10)
	return `top-times-${groups}-${date}.csv`
}

async function onExportClick() {
	if (!groupData) {
		setStatus("training groups are still loading", true)
		return
	}

	const groups = selectedGroupIds()
	if (!groups.size) {
		setStatus("select at least one group to export", true)
		return
	}

	const params = parseHashReportParams()
	if (!params) {
		setStatus("couldn't read the report parameters from the URL", true)
		return
	}

	const allTimes = document.getElementById(
		ALL_TIMES_ID
	) as HTMLInputElement | null
	if (allTimes?.checked) params.Top = 0

	try {
		setStatus("fetching report CSV…")
		const csvText = await fetchTopTimesCsv(buildTopTimesUrl(params))

		setStatus("formatting…")
		const rows = parseReportRows(csvText, groupData.nameToGroup)
		const { csv, rowCount } = buildTailoredCsv(rows, groups)

		if (!rowCount) {
			setStatus(
				"no times matched the selected groups (report returned " +
					`${rows.length} rows total)`,
				true
			)
			return
		}

		const names = selectedGroupNames(groups)
		downloadCsv(csv, exportFilename(names))
		setStatus(`exported ${rowCount} times (${names.join(", ")})`)
	} catch (err) {
		console.error("QOL: top times export failed", err)
		setStatus(`export failed: ${(err as Error).message}`, true)
	}
}

function buildExportBar() {
	const bar = document.createElement("div")
	bar.id = BAR_ID
	bar.style.cssText =
		"display: flex; align-items: center; flex-wrap: wrap; gap: 10px; padding: 8px 0; margin-bottom: 6px;"

	const label = document.createElement("span")
	label.textContent = "Export times by group:"
	label.style.fontWeight = "600"

	const groups = document.createElement("span")
	groups.id = GROUPS_ID
	groups.style.cssText =
		"display: inline-flex; align-items: center; flex-wrap: wrap;"
	groups.textContent = "loading groups…"

	const allTimesLabel = document.createElement("label")
	allTimesLabel.style.cssText =
		"display: inline-flex; align-items: center; gap: 4px; margin: 0; cursor: pointer; font-weight: 400;"
	const allTimes = document.createElement("input")
	allTimes.type = "checkbox"
	allTimes.id = ALL_TIMES_ID
	allTimes.checked = true
	allTimes.style.margin = "0"
	allTimesLabel.appendChild(allTimes)
	allTimesLabel.appendChild(
		document.createTextNode("All times (not just top N)")
	)

	const button = document.createElement("button")
	button.textContent = "Export tailored CSV"
	button.className = "btn btn-primary"
	button.addEventListener("click", onExportClick)

	const status = document.createElement("span")
	status.id = STATUS_ID
	status.style.fontStyle = "italic"

	bar.append(label, groups, allTimesLabel, button, status)
	return bar
}

function ensureExportBar() {
	if (!isTopTimesByNamePage()) return
	if (document.getElementById(BAR_ID)) return

	const iframe = document.getElementById("reportServiceContainer")
	if (!iframe || !iframe.parentElement) return

	iframe.parentElement.insertBefore(buildExportBar(), iframe)

	loadGroupData()
	renderGroupCheckboxes()
}

function removeExportBar() {
	document.getElementById(BAR_ID)?.remove()
}

// Tracks the observer across init() calls so re-navigating to the report
// page (via hashchange) doesn't stack up duplicate observers.
let pageObserver: MutationObserver | null = null

function init() {
	pageObserver?.disconnect()
	pageObserver = null

	if (!isTopTimesByNamePage()) {
		removeExportBar()
		return
	}

	pageObserver = new MutationObserver(() => ensureExportBar())
	pageObserver.observe(document.body, {
		childList: true,
		subtree: true
	})

	ensureExportBar()
}

init()

// handle SPA navigation changes
window.addEventListener("hashchange", init)
