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

// The tailored output format lives here: edit this list to change which
// columns are exported, their order, or their headers.
const OUTPUT_COLUMNS: { header: string; value: (row: EntryRow) => string }[] = [
	{ header: "Swimmer", value: (row) => row.swimmer },
	{ header: "Age", value: (row) => row.age },
	{ header: "Gender", value: (row) => row.gender },
	{ header: "Date", value: (row) => row.date },
	{ header: "Session", value: (row) => row.session },
	{ header: "Event", value: (row) => row.event },
	{ header: "Event Description", value: (row) => row.eventDescription },
	{ header: "Entry Time", value: (row) => row.entryTime }
]

export function buildEntryCsv(rows: EntryRow[]): string {
	return Papa.unparse({
		fields: OUTPUT_COLUMNS.map((column) => column.header),
		data: rows.map((row) => OUTPUT_COLUMNS.map((column) => column.value(row)))
	})
}
