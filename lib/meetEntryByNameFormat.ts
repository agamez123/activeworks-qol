import Papa from "papaparse"

export interface EntryRow {
	swimmer: string
	age: string
	gender: string
	date: string
	session: string
	event: string
	eventDescription: string
	entryTime: string
}

export interface EntryColumn {
	key: string
	header: string
	value: (row: EntryRow) => string
}

// The full set of exportable columns, in their default order. The export
// modal (contents/meetEntryByNameExport.ts) lets the user pick a subset of
// these; edit this list to change what's available, its default order, or
// column headers.
export const ENTRY_COLUMNS: EntryColumn[] = [
	{ key: "swimmer", header: "Swimmer", value: (row) => row.swimmer },
	{ key: "age", header: "Age", value: (row) => row.age },
	{ key: "gender", header: "Gender", value: (row) => row.gender },
	{ key: "date", header: "Date", value: (row) => row.date },
	{ key: "session", header: "Session", value: (row) => row.session },
	{ key: "event", header: "Event", value: (row) => row.event },
	{
		key: "eventDescription",
		header: "Event Description",
		value: (row) => row.eventDescription
	},
	{ key: "entryTime", header: "Entry Time", value: (row) => row.entryTime }
]

export const DEFAULT_ENTRY_COLUMN_KEYS = ENTRY_COLUMNS.map(
	(column) => column.key
)

// Resolves a user-chosen key list against ENTRY_COLUMNS, dropping unknown
// keys (e.g. from a stale storage value after this list changes) and
// preserving the caller's chosen order. Falls back to every column when the
// selection is empty or entirely invalid.
export function resolveEntryColumns(columnKeys?: string[]): EntryColumn[] {
	if (!columnKeys?.length) return ENTRY_COLUMNS

	const byKey = new Map(ENTRY_COLUMNS.map((column) => [column.key, column]))
	const resolved = columnKeys
		.map((key) => byKey.get(key))
		.filter((column): column is EntryColumn => !!column)

	return resolved.length ? resolved : ENTRY_COLUMNS
}

export function buildEntryCsv(rows: EntryRow[], columnKeys?: string[]): string {
	const columns = resolveEntryColumns(columnKeys)
	return Papa.unparse({
		fields: columns.map((column) => column.header),
		data: rows.map((row) => columns.map((column) => column.value(row)))
	})
}
