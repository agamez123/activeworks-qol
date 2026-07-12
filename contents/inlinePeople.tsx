import type { PlasmoCSConfig } from "plasmo"

import { getAgencyId, getCSRF } from "./pageContext"
import { NAVIGATE_EVENT } from "./peopleNavigatorBridge"

export const config: PlasmoCSConfig = {
	matches: ["*://sports.active.com/*"],
	run_at: "document_idle"
}

interface TrainingGroup {
	athleteIds: string[]
	name: string
	id: string
}

interface SwimmerEntry {
	swimmer?: {
		id: string
		firstName: string
		lastName: string
		age?: number
		dob?: string
		gender?: string
	}
}

interface AthleteData {
	swimmers?: SwimmerEntry[]
	programs?: { trainingGroups: TrainingGroup[] }[]
}

interface MeetSummary {
	sportsId?: string
	meetStartDate?: string
}

interface GroupInfo {
	id: string
	name: string
	color: string
}

interface RosterEntry {
	id: string
	firstName: string
	lastName: string
	age?: number
	dob?: string
	gender?: string
	group?: GroupInfo
}

// Palette is indexed by a hash of the group id, so colors stay stable across
// reloads/seasons without hardcoding the actual group names.
const GROUP_COLOR_PALETTE = [
	"#df3560",
	"#45a552",
	"#4363d8",
	"#d18047",
	"#911eb4",
	"#5dbdd3",
	"#e42fdb",
	"#9A6324",
	"#469990",
	"#000075"
]

function colorForGroupId(groupId: string): string {
	let hash = 0
	for (let i = 0; i < groupId.length; i++) {
		hash = (hash * 31 + groupId.charCodeAt(i)) >>> 0
	}
	return GROUP_COLOR_PALETTE[hash % GROUP_COLOR_PALETTE.length]
}

function normalizeName(name: string): string {
	return name.trim().replace(/\s+/g, " ").toLowerCase()
}

function formatDob(dob?: string): string {
	const [y, m, d] = (dob ?? "").split("-")
	if (!y || !m || !d) return dob ?? ""
	return `${y}/${Number(m)}/${Number(d)}`
}

function formatGender(gender?: string): string {
	if (!gender) return ""
	return gender.charAt(0) + gender.slice(1).toLowerCase()
}

// Maps a normalized "First Last" name (as rendered in the People grid) to
// the training group that swimmer belongs to. The full roster (with group
// membership already resolved) backs the group filter view, since the site
// doesn't expose a way to page/filter by group itself.
let nameToGroup: Map<string, GroupInfo> | null = null
let roster: RosterEntry[] = []
let groupList: GroupInfo[] = []

function buildRoster(
	athleteData: AthleteData,
	trainingGroups: TrainingGroup[]
) {
	const idToGroup = new Map<string, GroupInfo>()
	const groups: GroupInfo[] = []

	for (const group of trainingGroups ?? []) {
		const info: GroupInfo = {
			id: group.id,
			name: group.name,
			color: colorForGroupId(group.id)
		}
		groups.push(info)
		for (const athleteId of group.athleteIds) {
			idToGroup.set(athleteId, info)
		}
	}

	const nameMap = new Map<string, GroupInfo>()
	const entries: RosterEntry[] = []

	for (const entry of athleteData?.swimmers ?? []) {
		const swimmer = entry.swimmer
		if (!swimmer?.id) continue

		const group = idToGroup.get(swimmer.id)

		entries.push({
			id: swimmer.id,
			firstName: swimmer.firstName,
			lastName: swimmer.lastName,
			age: swimmer.age,
			dob: swimmer.dob,
			gender: swimmer.gender,
			group
		})

		if (group) {
			nameMap.set(
				normalizeName(`${swimmer.firstName} ${swimmer.lastName}`),
				group
			)
		}
	}

	nameToGroup = nameMap
	roster = entries
	groupList = groups.sort((a, b) => a.name.localeCompare(b.name))
}

async function fetchMeetAttendance(
	meetId: string,
	csrfToken: string
): Promise<AthleteData> {
	const res = await fetch(
		"https://sports.active.com/json/MeetEntryManagementService/readInvitedAthleteAttendance?nonhtml=true",
		{
			method: "POST",
			credentials: "include",
			headers: {
				accept: "*/*",
				"content-type": "application/json",
				"x-requested-with": "XMLHttpRequest",
				"aws-csrftoken": csrfToken
			},
			body: JSON.stringify({ meetId })
		}
	)

	return res.json()
}

// A swimmer only shows up in the attendance list of meets they're actually
// entered in -- junior development swimmers are frequently only entered in
// development meets, never the club's most recent "main" meet -- so a single
// meet's roster misses them. Merging every current-year meet's attendance
// (deduped by swimmer/group id) is what actually gets the full roster.
function mergeAthleteData(datasets: AthleteData[]): AthleteData {
	const swimmerById = new Map<string, SwimmerEntry>()
	const groupById = new Map<string, TrainingGroup>()

	for (const data of datasets) {
		for (const entry of data.swimmers ?? []) {
			if (entry.swimmer?.id) swimmerById.set(entry.swimmer.id, entry)
		}

		for (const group of data.programs?.[0]?.trainingGroups ?? []) {
			const existing = groupById.get(group.id)
			groupById.set(group.id, {
				...group,
				athleteIds: existing
					? Array.from(new Set([...existing.athleteIds, ...group.athleteIds]))
					: group.athleteIds
			})
		}
	}

	return {
		swimmers: Array.from(swimmerById.values()),
		programs: [{ trainingGroups: Array.from(groupById.values()) }]
	}
}

async function getGroupingData() {
	const csrfToken = getCSRF()
	const agencyId = getAgencyId()

	// Both are sniffed (by pageContext.ts) from the page's own outgoing
	// requests. If neither has fired yet -- e.g. this runs before the site's
	// own bootstrap calls do -- bail instead of sending a request that's
	// guaranteed to be rejected or scoped to the wrong agency.
	if (!csrfToken || !agencyId) {
		console.warn(
			"QOL: CSRF token or agency ID not available yet, skipping group fetch"
		)
		return
	}

	try {
		const meetInfoRes = await fetch(
			"https://sports.active.com/json/SportsSwimmingMeetSharingService/findMeetsAttendingForAgency?nonhtml=true",
			{
				method: "POST",
				credentials: "include",
				headers: {
					"content-type": "application/json",
					"aws-csrftoken": csrfToken,
					"x-requested-with": "XMLHttpRequest"
				},
				body: JSON.stringify({
					request: {
						agencyId,
						includeAll: true
					}
				})
			}
		)

		const meetData: MeetSummary[] = await meetInfoRes.json()

		const currentYear = new Date().getFullYear()
		const meetIds = (meetData ?? [])
			.filter(
				(meet) =>
					meet.sportsId &&
					meet.meetStartDate &&
					new Date(meet.meetStartDate).getFullYear() === currentYear
			)
			.map((meet) => meet.sportsId as string)

		if (!meetIds.length) {
			console.warn(
				"QOL: no meets found for this agency in the current year, group filter unavailable"
			)
			return
		}

		// Fetched in parallel and via allSettled so one meet's attendance
		// request failing doesn't blank out the roster from every other meet.
		const results = await Promise.allSettled(
			meetIds.map((meetId) => fetchMeetAttendance(meetId, csrfToken))
		)

		const athleteDataSets: AthleteData[] = []
		for (const result of results) {
			if (result.status === "fulfilled") {
				athleteDataSets.push(result.value)
			} else {
				console.error(
					"QOL: failed to load attendance for a meet",
					result.reason
				)
			}
		}

		const merged = mergeAthleteData(athleteDataSets)
		buildRoster(merged, merged.programs?.[0]?.trainingGroups)
		addGroupingColumn()
	} catch (err) {
		console.error("QOL: failed to load training group data", err)
	}
}

// Table header to mimic the site's own CSS
function buildHeader() {
	const th = document.createElement("th")

	th.dataset.field = "Grouping"
	th.dataset.sortable = "false"
	th.style.cssText = "width:25%"
	th.className = "header"
	th.id = "QOL-Head"

	th.textContent = "Group"

	return th
}

function buildGroupTag(group: GroupInfo) {
	const tag = document.createElement("span")

	tag.textContent = group.name
	tag.title = group.name
	tag.style.cssText = `
				display: inline-block;
				padding: 2px 8px;
				border-radius: 10px;
				font-size: 11px;
				font-weight: 600;
				color: #fff;
				background-color: ${group.color};
				white-space: nowrap;
		`

	return tag
}

// Shared by the native-grid ticker and the synthesized filter table's name
// links so the two "colored dot" renderings can't drift apart.
function buildGroupDot(color: string, className?: string) {
	const dot = document.createElement("span")
	if (className) dot.className = className
	dot.style.cssText = `
				display: inline-block;
				width: 8px;
				height: 8px;
				border-radius: 50%;
				background-color: ${color};
				margin-right: 6px;
		`
	return dot
}

// dark mode's injected stylesheet colors links via `color: ... !important`,
// so an inline color can only win by being !important too -- a plain
// link.style.color assignment would be silently ignored whenever dark mode
// is on. Passing no group clears back to the class/theme's default color.
function applyLinkGroupColor(link: HTMLAnchorElement, group?: GroupInfo) {
	if (group) {
		link.style.setProperty("color", group.color, "important")
	} else {
		link.style.removeProperty("color")
	}
}

function addTickerToNameCell(nameCell: HTMLTableCellElement, group: GroupInfo) {
	const link = nameCell.querySelector<HTMLAnchorElement>("a")
	if (!link) return

	applyLinkGroupColor(link, group)

	if (link.querySelector(".qol-ticker")) return

	const dot = buildGroupDot(group.color, "qol-ticker")
	dot.title = group.name

	link.prepend(dot)
}

function ensureGroupCell(row: HTMLTableRowElement) {
	let cell = row.querySelector<HTMLTableCellElement>(
		":scope > td.qol-group-cell"
	)

	if (!cell) {
		cell = document.createElement("td")
		cell.className = "qol-group-cell"
		cell.style.width = "25%"
		row.appendChild(cell)
	}

	return cell
}

// Cross-references each row's rendered name against the training group data
// (matched by athlete ID upstream, keyed here by normalized name) and injects
// a colored ticker dot next to the name plus a group tag cell.
function tagRows() {
	const rows = document.querySelectorAll<HTMLTableRowElement>(
		"#dataGridAthlete > tbody > tr"
	)

	rows.forEach((row) => {
		// Always keep row cell count in sync with the injected header column.
		const groupCell = ensureGroupCell(row)

		if (!nameToGroup || row.dataset.qolGroupResolved) return

		const nameCell = row.querySelector<HTMLTableCellElement>("td:nth-child(2)")
		const rawName = nameCell?.querySelector("a")?.textContent ?? ""
		const group = nameToGroup.get(normalizeName(rawName))

		if (group) {
			groupCell.appendChild(buildGroupTag(group))
			if (nameCell) addTickerToNameCell(nameCell, group)
		}

		row.dataset.qolGroupResolved = "1"
	})
}

const FILTER_BAR_ID = "qol-group-filter-bar"
const FILTER_SELECT_ID = "qol-group-filter-select"
const FILTER_TABLE_ID = "qol-group-filter-table"

// The sidebar "View" toggle between the Athletes and Parents grids.
const VIEW_ATHLETE_TOGGLE_ID = "athleteFilter"
const VIEW_PARENT_TOGGLE_ID = "parentFilter"

// The site's router assigns each route a "_nid" itself (an in-memory history
// key, populated only inside active.navigator.navigate) and rejects any hash
// it didn't mint that way, bouncing back to peopleHome. So instead of
// building an href by hand, we ask peopleNavigatorBridge.ts (running in the
// page's own JS world) to call the page's own navigate function -- the same
// call the native peopleDetail links make.
function navigateToPeopleDetail(spid: string) {
	window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail: { spid } }))
}

// Rows synthesized for the group filter only carry what the roster data
// gives us (name/age/gender/group) -- the native grid's swim-ID, dive
// certification, and per-row action buttons aren't available here.
function buildFilterTableRow(entry: RosterEntry) {
	const tr = document.createElement("tr")

	const nameTd = document.createElement("td")
	nameTd.style.width = "25%"

	const nameLink = document.createElement("a")
	nameLink.className = "fndArch-LinkBlueOnLightGray"
	nameLink.href = "#"
	nameLink.style.cursor = "pointer"
	nameLink.addEventListener("click", (e) => {
		e.preventDefault()
		navigateToPeopleDetail(entry.id)
	})

	if (entry.group) {
		nameLink.appendChild(buildGroupDot(entry.group.color))
	}
	applyLinkGroupColor(nameLink, entry.group)
	nameLink.appendChild(
		document.createTextNode(`${entry.firstName} ${entry.lastName}`)
	)

	nameTd.appendChild(nameLink)

	const ageTd = document.createElement("td")
	ageTd.style.width = "20%"
	ageTd.textContent =
		entry.age != null ? `${entry.age} (${formatDob(entry.dob)})` : ""

	const genderTd = document.createElement("td")
	genderTd.style.width = "15%"
	genderTd.textContent = formatGender(entry.gender)

	const groupTd = document.createElement("td")
	groupTd.style.width = "25%"
	if (entry.group) groupTd.appendChild(buildGroupTag(entry.group))

	tr.append(nameTd, ageTd, genderTd, groupTd)
	return tr
}

function buildFilterTable() {
	const table = document.createElement("table")
	table.id = FILTER_TABLE_ID
	table.className = "table table-hover"
	table.style.width = "100%"
	table.style.display = "none"

	const thead = document.createElement("thead")
	const headRow = document.createElement("tr")

	for (const [label, width] of [
		["Name", "25%"],
		["Age (birthday)", "20%"],
		["Gender", "15%"],
		["Group", "25%"]
	] as const) {
		const th = document.createElement("th")
		th.textContent = label
		th.className = "header"
		th.style.cssText = `width:${width}`
		headRow.appendChild(th)
	}

	thead.appendChild(headRow)
	table.append(thead, document.createElement("tbody"))

	return table
}

function renderFilteredRows(groupId: string) {
	const tbody = document.querySelector(`#${FILTER_TABLE_ID} > tbody`)
	if (!tbody) return

	tbody.replaceChildren()

	for (const entry of roster.filter((r) => r.group?.id === groupId)) {
		tbody.appendChild(buildFilterTableRow(entry))
	}
}

function setGroupFilter(groupId: string) {
	const nativeTable =
		document.querySelector<HTMLTableElement>("#dataGridAthlete")
	const filterTable = document.getElementById(
		FILTER_TABLE_ID
	) as HTMLTableElement | null
	if (!nativeTable || !filterTable) return

	// The synthesized filter table always renders every matching swimmer in
	// one page, so the native grid's pager (which only ever paginates the
	// native grid) is meaningless while it's showing -- hide it alongside.
	const pagingBar = document.getElementById("pagingBar")

	if (!groupId) {
		nativeTable.style.display = ""
		filterTable.style.display = "none"
		if (pagingBar) pagingBar.style.display = ""
		return
	}

	renderFilteredRows(groupId)
	nativeTable.style.display = "none"
	filterTable.style.display = "table"
	if (pagingBar) pagingBar.style.display = "none"
}

// Guards against a stale filter view surviving a peopleDetail round trip
// (filter by group, click a name, hit back): the site reuses the same
// People-page container across that navigation, so without this the old
// filter table's "display: table" from before you left lingers alongside
// the freshly re-rendered (unfiltered) native grid, and both show at once.
// Called on every fresh entry to the people page so it always starts on "All".
function resetGroupFilterUI() {
	const select = document.getElementById(
		FILTER_SELECT_ID
	) as HTMLSelectElement | null
	if (select) select.value = ""

	setGroupFilter("")
}

function buildFilterBar() {
	const bar = document.createElement("div")
	bar.id = FILTER_BAR_ID
	bar.style.cssText =
		"display: flex; align-items: center; gap: 8px; margin-bottom: 10px;"

	const label = document.createElement("label")
	label.textContent = "Filter by group:"
	label.style.fontWeight = "600"
	label.htmlFor = FILTER_SELECT_ID

	const select = document.createElement("select")
	select.id = FILTER_SELECT_ID

	const allOption = document.createElement("option")
	allOption.value = ""
	allOption.textContent = "All"
	select.appendChild(allOption)

	for (const group of groupList) {
		const option = document.createElement("option")
		option.value = group.id
		option.textContent = group.name
		select.appendChild(option)
	}

	select.addEventListener("change", () => setGroupFilter(select.value))

	bar.append(label, select)
	return bar
}

// Injected once group data is available; the site paginates the native grid
// with no page-size control, so filtering by group is done against our own
// synthesized table instead of the native (only 20-rows-at-a-time) one.
function ensureGroupFilterUI() {
	if (!groupList.length) return
	if (document.getElementById(FILTER_BAR_ID)) return

	const table = document.querySelector<HTMLTableElement>("#dataGridAthlete")
	if (!table || !table.parentElement) return

	table.parentElement.insertBefore(buildFilterBar(), table)
	table.parentElement.insertBefore(buildFilterTable(), table)
}

function setFilterBarVisible(visible: boolean) {
	const bar = document.getElementById(FILTER_BAR_ID)
	if (bar) bar.style.display = visible ? "" : "none"
}

function isParentViewActive(): boolean {
	return (
		document
			.getElementById(VIEW_PARENT_TOGGLE_ID)
			?.classList.contains("selectedLabel") ?? false
	)
}

// Parents is a completely different grid (#dataGridParent) -- neither the
// native swimmer table/pager nor our filter table belong on screen while
// it's active. (resetGroupFilterUI() isn't reused here: it explicitly shows
// the native table via setGroupFilter(""), which is exactly wrong here --
// that's what caused the swimmer table to reappear alongside Parents.)
function hideNativeTableForParentView() {
	const select = document.getElementById(
		FILTER_SELECT_ID
	) as HTMLSelectElement | null
	if (select) select.value = ""

	const nativeTable =
		document.querySelector<HTMLTableElement>("#dataGridAthlete")
	const filterTable = document.getElementById(
		FILTER_TABLE_ID
	) as HTMLTableElement | null
	const pagingBar = document.getElementById("pagingBar")

	if (nativeTable) nativeTable.style.display = "none"
	if (filterTable) filterTable.style.display = "none"
	if (pagingBar) pagingBar.style.display = "none"
}

// The group filter is keyed off swimmer names/IDs, so it's meaningless once
// "Parents" is selected. Hide our filter table and the native swimmer grid
// (or, switching back, reset to "All" -- the same reset used for the
// peopleDetail back-navigation) and hide the dropdown entirely while Parents
// is active; restore it when switching back to Athletes.
function syncGroupFilterToView() {
	const parentView = isParentViewActive()

	if (parentView) {
		hideNativeTableForParentView()
	} else {
		resetGroupFilterUI()
	}

	setFilterBarVisible(!parentView)
}

// Hooked once the sidebar toggle exists; also runs an initial sync in case
// the page loaded with Parents already selected.
function ensureViewToggleHook() {
	const parentToggle = document.getElementById(VIEW_PARENT_TOGGLE_ID)
	const athleteToggle = document.getElementById(VIEW_ATHLETE_TOGGLE_ID)
	if (!parentToggle || !athleteToggle) return
	if (parentToggle.dataset.qolHooked) return

	parentToggle.dataset.qolHooked = "1"
	athleteToggle.dataset.qolHooked = "1"

	parentToggle.addEventListener("click", syncGroupFilterToView)
	athleteToggle.addEventListener("click", syncGroupFilterToView)

	syncGroupFilterToView()
}

function addGroupingColumn() {
	// Inject group header (guarded so re-running on every mutation doesn't duplicate it)
	const thead = document.querySelector("#dataGridAthlete > thead > tr")
	if (thead && !document.querySelector("#QOL-Head")) {
		thead.appendChild(buildHeader())
	}

	ensureGroupFilterUI()
	ensureViewToggleHook()
	tagRows()
}

// Tracks the observer across init() calls so re-navigating to the people
// page (via hashchange) doesn't stack up duplicate observers, each doing
// the same DOM work on every mutation.
let pageObserver: MutationObserver | null = null

function init() {
	pageObserver?.disconnect()
	pageObserver = null

	if (!window.location.hash.includes("/people/peopleHome")) return

	resetGroupFilterUI()

	pageObserver = new MutationObserver(() => addGroupingColumn())
	pageObserver.observe(document.body, {
		childList: true,
		subtree: true
	})

	getGroupingData()
	addGroupingColumn()
}

init()

// handle SPA navigation changes
window.addEventListener("hashchange", init)
