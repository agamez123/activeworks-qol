import type { PlasmoCSConfig } from "plasmo"

import { buildEntryCsv, type EntryRow } from "~lib/meetEntryByNameFormat"

export const config: PlasmoCSConfig = {
	matches: ["*://sports.active.com/*"],
	run_at: "document_idle"
}

const BAR_ID = "qol-entrybyname-export-bar"
const STATUS_ID = "qol-entrybyname-export-status"

const GENDER_AGE_RE = /^(.+?)\s*\/\s*(\d+)$/

function isMeetEntryByNamePage(): boolean {
	return window.location.hash.includes("/meet/entryByName/")
}

function getMeetTitle(): string {
	return document.querySelector(".meetTitle")?.textContent?.trim() ?? ""
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

// Each swimmer is an accordion: the h6 header table carries name/age/gender/
// attending status, and (when they have entries) the content table lists a
// "Session N" row -- carrying the day's date and start time -- followed by
// one row per event entered that session. Rows are told apart by their third
// cell: a session row's is a plain <span>, an event row's wraps the entry
// time in a <div>.
function parseAccordion(acc: Element): EntryRow[] {
	const swimmer = acc.querySelector(".swimmername")?.textContent?.trim() ?? ""
	if (!swimmer) return []

	const headerCells = Array.from(acc.querySelectorAll("h6 table tr td")).map(
		(td) => (td.textContent ?? "").replace(/\s+/g, " ").trim()
	)

	const genderAgeMatch = GENDER_AGE_RE.exec(headerCells[1] ?? "")
	const gender = genderAgeMatch?.[1] ?? ""
	const age = genderAgeMatch?.[2] ?? ""

	const content = acc.querySelector('[id^="content_"]')
	if (!content) return []

	const rows: EntryRow[] = []
	let session = ""
	let date = ""

	for (const tr of Array.from(content.querySelectorAll("table tr"))) {
		const tds = Array.from(tr.children)
		if (tds.length < 3) continue

		const isSessionRow = !tds[2].querySelector("div")
		const texts = tds.map((td) =>
			(td.textContent ?? "").replace(/\s+/g, " ").trim()
		)

		if (isSessionRow) {
			session = texts[0] ?? ""
			date = (texts[1] ?? "").replace(/^Date:\s*/, "")
			continue
		}

		const event = (texts[0] ?? "").replace(/:$/, "")
		if (!event || event === "--") continue

		rows.push({
			swimmer,
			age,
			gender,
			date,
			session,
			event,
			eventDescription: texts[1] ?? "",
			entryTime: texts[2] ?? ""
		})
	}

	return rows
}

function collectEntryRows(): EntryRow[] {
	const rows: EntryRow[] = []
	for (const acc of Array.from(document.querySelectorAll(".accordion"))) {
		rows.push(...parseAccordion(acc))
	}
	return rows
}

function downloadCsv(csv: string, filename: string) {
	const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
	const link = document.createElement("a")
	link.href = url
	link.download = filename
	link.click()
	URL.revokeObjectURL(url)
}

function exportFilename(meetTitle: string): string {
	const meet =
		meetTitle
			.toLowerCase()
			.replace(/[^\w]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 60) || "meet"
	const date = new Date().toISOString().slice(0, 10)
	return `${meet}-entries-by-name-${date}.csv`
}

function onExportClick() {
	const rows = collectEntryRows()
	if (!rows.length) {
		setStatus("no declared entries found on this page", true)
		return
	}

	const csv = buildEntryCsv(rows)
	downloadCsv(csv, exportFilename(getMeetTitle()))

	const swimmerCount = new Set(rows.map((row) => row.swimmer)).size
	setStatus(`exported ${rows.length} entries for ${swimmerCount} swimmers`)
}

function buildExportBar() {
	const bar = document.createElement("div")
	bar.id = BAR_ID
	bar.style.cssText =
		"display: flex; align-items: center; flex-wrap: wrap; gap: 10px; padding: 8px 0; margin-bottom: 6px;"

	const button = document.createElement("button")
	button.textContent = "Export entries CSV"
	button.className = "btn btn-primary"
	button.addEventListener("click", onExportClick)

	const status = document.createElement("span")
	status.id = STATUS_ID
	status.style.fontStyle = "italic"

	bar.append(button, status)
	return bar
}

function ensureExportBar() {
	if (!isMeetEntryByNamePage()) return
	if (document.getElementById(BAR_ID)) return

	const topLink = document.getElementById("topLink")
	if (!topLink || !topLink.parentElement) return

	topLink.parentElement.insertBefore(buildExportBar(), topLink)
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

	if (!isMeetEntryByNamePage()) {
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
