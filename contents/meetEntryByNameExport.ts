import icon from "data-base64:~assets/icon.png"
import type { PlasmoCSConfig } from "plasmo"

import {
	buildEntryCsv,
	DEFAULT_ENTRY_COLUMN_KEYS,
	ENTRY_COLUMNS,
	resolveEntryColumns,
	type EntryRow
} from "~lib/meetEntryByNameFormat"
import { ENTRY_BY_NAME_COLUMNS_STORAGE_KEY } from "~lib/storage"

export const config: PlasmoCSConfig = {
	matches: ["*://sports.active.com/*"],
	run_at: "document_idle"
}

const BAR_ID = "qol-entrybyname-export-bar"
const STATUS_ID = "qol-entrybyname-export-status"
const BACKDROP_ID = "qol-entrybyname-export-modal-backdrop"
const BUTTON_STYLE_ID = "qol-entrybyname-export-btn-style"
const PREVIEW_ROW_LIMIT = 5

// Brand purple from the extension icon -- used to make the injected export
// button read as an ASM Toolkit feature rather than a native site control.
const BRAND_COLOR = "#7c3aed"
const BRAND_COLOR_HOVER = "#8b5cf6"

// Uses a class-on-class selector (higher specificity than darkMode.ts's
// plain ".btn" rules) so the brand styling wins regardless of theme.
function injectButtonStyle() {
	if (document.getElementById(BUTTON_STYLE_ID)) return

	const style = document.createElement("style")
	style.id = BUTTON_STYLE_ID
	style.textContent = `
		.btn.qol-entrybyname-export-btn {
			background-color: ${BRAND_COLOR} !important;
			background-image: none !important;
			color: #ffffff !important;
			border: none !important;
			display: inline-flex !important;
			align-items: center !important;
			gap: 7px !important;
			font-weight: 600 !important;
			box-shadow: 0 1px 4px rgba(124, 58, 237, 0.45) !important;
		}

		.btn.qol-entrybyname-export-btn:hover {
			background-color: ${BRAND_COLOR_HOVER} !important;
		}

		.qol-entrybyname-export-icon {
			width: 15px;
			height: 15px;
			border-radius: 3px;
			display: inline-block;
			flex: none;
		}
	`
	;(document.head || document.documentElement).appendChild(style)
}

// The user's chosen column subset/order, loaded from storage on init and
// updated whenever they apply changes in the columns modal.
let selectedColumnKeys: string[] = DEFAULT_ENTRY_COLUMN_KEYS.slice()

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

function runExport(rows: EntryRow[], columnKeys: string[]) {
	if (!rows.length) {
		setStatus("no declared entries found on this page", true)
		return
	}

	const csv = buildEntryCsv(rows, columnKeys)
	downloadCsv(csv, exportFilename(getMeetTitle()))

	const swimmerCount = new Set(rows.map((row) => row.swimmer)).size
	setStatus(`exported ${rows.length} entries for ${swimmerCount} swimmers`)
}

function loadColumnPrefs(): Promise<string[]> {
	return new Promise((resolve) => {
		chrome.storage.sync.get([ENTRY_BY_NAME_COLUMNS_STORAGE_KEY], (result) => {
			const stored = result[ENTRY_BY_NAME_COLUMNS_STORAGE_KEY] as
				| string[]
				| undefined
			const valid = stored?.filter((key) =>
				ENTRY_COLUMNS.some((column) => column.key === key)
			)
			resolve(valid?.length ? valid : DEFAULT_ENTRY_COLUMN_KEYS.slice())
		})
	})
}

function saveColumnPrefs(keys: string[]) {
	chrome.storage.sync.set({ [ENTRY_BY_NAME_COLUMNS_STORAGE_KEY]: keys })
}

function closeColumnsModal() {
	document.getElementById(BACKDROP_ID)?.remove()
	document.removeEventListener("keydown", onModalKeydown)
}

function onModalKeydown(event: KeyboardEvent) {
	if (event.key === "Escape") closeColumnsModal()
}

function renderPreview(container: HTMLElement, columnKeys: string[], rows: EntryRow[]) {
	container.replaceChildren()

	if (!columnKeys.length) {
		const empty = document.createElement("div")
		empty.textContent = "select at least one column"
		empty.style.cssText = "padding: 12px; font-style: italic;"
		container.appendChild(empty)
		return
	}

	const columns = resolveEntryColumns(columnKeys)
	const table = document.createElement("table")
	table.style.cssText =
		"width: 100%; border-collapse: collapse; font-size: 13px;"

	const thead = document.createElement("thead")
	const headRow = document.createElement("tr")
	for (const column of columns) {
		const th = document.createElement("th")
		th.textContent = column.header
		th.style.cssText =
			"text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--qol-border, #d5d5d5); background: var(--qol-bg-alt, #f7f7f7); white-space: nowrap;"
		headRow.appendChild(th)
	}
	thead.appendChild(headRow)

	const tbody = document.createElement("tbody")
	if (!rows.length) {
		const tr = document.createElement("tr")
		const td = document.createElement("td")
		td.colSpan = columns.length
		td.textContent = "no declared entries found on this page yet"
		td.style.cssText = "padding: 8px; font-style: italic;"
		tr.appendChild(td)
		tbody.appendChild(tr)
	} else {
		for (const row of rows.slice(0, PREVIEW_ROW_LIMIT)) {
			const tr = document.createElement("tr")
			for (const column of columns) {
				const td = document.createElement("td")
				td.textContent = column.value(row)
				td.style.cssText =
					"padding: 6px 8px; border-bottom: 1px solid var(--qol-border, #d5d5d5); white-space: nowrap;"
				tr.appendChild(td)
			}
			tbody.appendChild(tr)
		}
	}

	table.append(thead, tbody)
	container.appendChild(table)

	if (rows.length > PREVIEW_ROW_LIMIT) {
		const note = document.createElement("div")
		note.textContent = `showing ${PREVIEW_ROW_LIMIT} of ${rows.length} rows`
		note.style.cssText = "padding: 6px 8px; font-size: 12px; font-style: italic;"
		container.appendChild(note)
	}
}

function buildColumnsModal(rows: EntryRow[]) {
	const backdrop = document.createElement("div")
	backdrop.id = BACKDROP_ID
	backdrop.style.cssText =
		"position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 999999;"

	const box = document.createElement("div")
	box.style.cssText =
		"width: min(640px, 92vw); max-height: 85vh; overflow-y: auto; border-radius: 8px; padding: 20px; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.35); background: var(--qol-bg-elevated, #ffffff); color: var(--qol-text, #1e1e1e);"

	const title = document.createElement("h3")
	title.textContent = "Customize CSV export"
	title.style.cssText = "margin: 0 0 4px 0;"

	const subtitle = document.createElement("div")
	subtitle.textContent = "Choose which columns to include."
	subtitle.style.cssText = "margin: 0 0 12px 0; font-size: 13px;"

	const columnsList = document.createElement("div")
	columnsList.style.cssText =
		"display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px;"

	const checkboxes: HTMLInputElement[] = []

	function checkedKeys(): string[] {
		return checkboxes.filter((cb) => cb.checked).map((cb) => cb.value)
	}

	for (const column of ENTRY_COLUMNS) {
		const label = document.createElement("label")
		label.style.cssText =
			"display: flex; align-items: center; gap: 8px; cursor: pointer;"

		const checkbox = document.createElement("input")
		checkbox.type = "checkbox"
		checkbox.value = column.key
		checkbox.checked = selectedColumnKeys.includes(column.key)
		checkbox.style.margin = "0"
		checkboxes.push(checkbox)

		label.append(checkbox, document.createTextNode(column.header))
		columnsList.appendChild(label)
	}

	const previewLabel = document.createElement("div")
	previewLabel.textContent = "Preview"
	previewLabel.style.cssText = "font-weight: 600; margin-bottom: 6px;"

	const previewWrap = document.createElement("div")
	previewWrap.style.cssText =
		"overflow-x: auto; border: 1px solid var(--qol-border, #d5d5d5); border-radius: 6px; margin-bottom: 16px;"

	for (const checkbox of checkboxes) {
		checkbox.addEventListener("change", () =>
			renderPreview(previewWrap, checkedKeys(), rows)
		)
	}

	renderPreview(previewWrap, checkedKeys(), rows)

	const footer = document.createElement("div")
	footer.style.cssText = "display: flex; justify-content: flex-end; gap: 8px;"

	const cancelButton = document.createElement("button")
	cancelButton.textContent = "Cancel"
	cancelButton.className = "btn"
	cancelButton.addEventListener("click", closeColumnsModal)

	const applyButton = document.createElement("button")
	applyButton.textContent = "Export CSV"
	applyButton.className = "btn btn-primary"
	applyButton.addEventListener("click", () => {
		const keys = checkedKeys()
		if (!keys.length) return

		selectedColumnKeys = keys
		saveColumnPrefs(keys)
		closeColumnsModal()
		runExport(rows, keys)
	})

	footer.append(cancelButton, applyButton)
	box.append(title, subtitle, columnsList, previewLabel, previewWrap, footer)
	backdrop.appendChild(box)

	backdrop.addEventListener("click", (event) => {
		if (event.target === backdrop) closeColumnsModal()
	})

	return backdrop
}

function onExportClick() {
	closeColumnsModal()
	document.body.appendChild(buildColumnsModal(collectEntryRows()))
	document.addEventListener("keydown", onModalKeydown)
}

function buildExportBar() {
	const bar = document.createElement("div")
	bar.id = BAR_ID
	bar.style.cssText =
		"display: flex; align-items: center; flex-wrap: wrap; gap: 10px; padding: 8px 0; margin-bottom: 6px;"

	const button = document.createElement("button")
	button.className = "btn qol-entrybyname-export-btn"
	button.title = "ASM Toolkit feature"
	button.addEventListener("click", onExportClick)

	const buttonIcon = document.createElement("img")
	buttonIcon.src = icon
	buttonIcon.alt = ""
	buttonIcon.className = "qol-entrybyname-export-icon"

	button.append(buttonIcon, document.createTextNode("Export entries CSV"))

	const status = document.createElement("span")
	status.id = STATUS_ID
	status.style.fontStyle = "italic"

	bar.append(button, status)
	return bar
}

function ensureExportBar() {
	if (!isMeetEntryByNamePage()) return

	injectButtonStyle()
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

loadColumnPrefs().then((keys) => {
	selectedColumnKeys = keys
})

init()

// handle SPA navigation changes
window.addEventListener("hashchange", init)
