import Papa from "papaparse"

import { normalizeName, type GroupInfo } from "~lib/trainingGroups"

// Sentinel "group id" for swimmers that don't belong to any training group,
// so the export UI can offer them as an explicit opt-in bucket.
export const UNGROUPED_ID = "__qol_ungrouped__"

// SSRS CSV rendering flattens the report tablix and uses internal textbox
// names ("Textbox72"...) as column headers, which aren't stable or
// documented. Columns are therefore identified by their VALUES: the swimmer
// column holds "First Last (Age) G", times look like "1:41.71S", dates like
// "2026/7/12", etc.
const SWIMMER_RE = /^(.+?)\s*\((\d+)\)\s*([A-Za-z]?)$/
const TIME_RE = /^(?:\d+:)?\d{1,2}\.\d{2}[A-Za-z]{0,3}$/
const DATE_RE = /^\d{4}\/\d{1,2}\/\d{1,2}$/
const ROUND_RE = /^[FPS]$/
const EVENT_RE = /^\d+\s+[A-Za-z]/

const ROUND_NAMES: Record<string, string> = {
	F: "Final",
	P: "Prelims",
	S: "Semis"
}

interface ColumnMap {
	swimmer: number
	event: number
	time: number
	round: number
	date: number
	meet: number
	team: number
}

export interface TimeRow {
	group?: GroupInfo
	swimmer: string
	age: string
	gender: string
	event: string
	time: string
	round: string
	date: string
	meet: string
	team: string
}

// The tailored output format lives here: edit this list to change which
// columns are exported, their order, or their headers.
const OUTPUT_COLUMNS: { header: string; value: (row: TimeRow) => string }[] = [
	{ header: "Group", value: (row) => row.group?.name ?? "" },
	{ header: "Swimmer", value: (row) => row.swimmer },
	{ header: "Age", value: (row) => row.age },
	{ header: "Gender", value: (row) => row.gender },
	{ header: "Event", value: (row) => row.event },
	{ header: "Time", value: (row) => row.time },
	{ header: "Round", value: (row) => ROUND_NAMES[row.round] ?? row.round },
	{ header: "Date", value: (row) => row.date },
	{ header: "Meet", value: (row) => row.meet },
	{ header: "Team", value: (row) => row.team }
]

function countMatches(rows: string[][], col: number, re: RegExp): number {
	let count = 0
	for (const row of rows) {
		const cell = row[col]?.trim()
		if (cell && re.test(cell)) count++
	}
	return count
}

function bestColumn(
	rows: string[][],
	colCount: number,
	re: RegExp,
	claimed: Set<number>
): number {
	let best = -1
	let bestCount = 0
	for (let col = 0; col < colCount; col++) {
		if (claimed.has(col)) continue
		const count = countMatches(rows, col, re)
		if (count > bestCount) {
			best = col
			bestCount = count
		}
	}
	return best
}

function detectColumns(rows: string[][]): ColumnMap | null {
	const colCount = Math.max(...rows.map((row) => row.length))
	if (!isFinite(colCount) || colCount < 4) return null

	const claimed = new Set<number>()
	const claim = (col: number) => {
		if (col >= 0) claimed.add(col)
		return col
	}

	// Claim the most distinctive shapes first so an ambiguous column (a lone
	// "F" could be a round or a gender) can't steal a slot from the column
	// that matches it far more often.
	const time = claim(bestColumn(rows, colCount, TIME_RE, claimed))
	const swimmer = claim(bestColumn(rows, colCount, SWIMMER_RE, claimed))
	const date = claim(bestColumn(rows, colCount, DATE_RE, claimed))
	const event = claim(bestColumn(rows, colCount, EVENT_RE, claimed))
	const round = claim(bestColumn(rows, colCount, ROUND_RE, claimed))

	if (time < 0 || swimmer < 0) return null

	// Meet vs team abbr: both are free text; the meet name is reliably the
	// longer of the two remaining populated columns.
	const textCols: { col: number; avgLen: number }[] = []
	for (let col = 0; col < colCount; col++) {
		if (claimed.has(col)) continue
		let total = 0
		let populated = 0
		for (const row of rows) {
			const cell = row[col]?.trim()
			if (cell) {
				total += cell.length
				populated++
			}
		}
		if (populated > rows.length / 4) {
			textCols.push({ col, avgLen: total / populated })
		}
	}
	textCols.sort((a, b) => b.avgLen - a.avgLen)

	return {
		swimmer,
		event,
		time,
		round,
		date,
		meet: textCols[0]?.col ?? -1,
		team: textCols[1]?.col ?? -1
	}
}

function cell(row: string[], col: number): string {
	return col >= 0 ? (row[col] ?? "").trim() : ""
}

export function parseReportRows(
	csvText: string,
	nameToGroup: Map<string, GroupInfo>
): TimeRow[] {
	const parsed = Papa.parse<string[]>(csvText, { skipEmptyLines: true })
	const rows = parsed.data

	const columns = detectColumns(rows)
	if (!columns) {
		console.error("QOL: could not detect report columns; raw rows:", rows.slice(0, 5))
		throw new Error(
			"couldn't recognize the report's CSV layout (see console for the raw rows)"
		)
	}

	const result: TimeRow[] = []
	let lastSwimmer = ""

	for (const row of rows) {
		// Only detail rows have a time; everything else (page headers, the
		// report's parameter echo, repeated column labels) gets dropped here.
		const time = cell(row, columns.time)
		if (!TIME_RE.test(time)) continue

		// BY_NAME groups rows under a swimmer header; depending on how SSRS
		// flattens it the name is either repeated per row or only present on
		// the group's first row, so carry it forward.
		const rawSwimmer = cell(row, columns.swimmer) || lastSwimmer
		lastSwimmer = rawSwimmer

		const match = SWIMMER_RE.exec(rawSwimmer)
		const name = (match?.[1] ?? rawSwimmer).trim()

		result.push({
			group: nameToGroup.get(normalizeName(name)),
			swimmer: name,
			age: match?.[2] ?? "",
			gender: match?.[3] ?? "",
			event: cell(row, columns.event),
			time,
			round: cell(row, columns.round),
			date: cell(row, columns.date),
			meet: cell(row, columns.meet),
			team: cell(row, columns.team)
		})
	}

	return result
}

export function buildTailoredCsv(
	rows: TimeRow[],
	selectedGroupIds: Set<string>
): { csv: string; rowCount: number } {
	const filtered = rows.filter((row) =>
		row.group
			? selectedGroupIds.has(row.group.id)
			: selectedGroupIds.has(UNGROUPED_ID)
	)

	const csv = Papa.unparse({
		fields: OUTPUT_COLUMNS.map((column) => column.header),
		data: filtered.map((row) =>
			OUTPUT_COLUMNS.map((column) => column.value(row))
		)
	})

	return { csv, rowCount: filtered.length }
}
