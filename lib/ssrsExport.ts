// SSRS URL-access rendering via the web portal's ReportViewer.aspx (this
// deployment doesn't expose the bare /ReportServer? endpoint -- hitting that
// path directly gets redirected back to the main page / 403s). This is the
// same path the site's own report iframe uses, confirmed from its `src`.
// Cookie-authenticated, so a plain same-origin fetch with credentials works
// (no CSRF token, unlike the JSON services).
const REPORT_BASE =
	"https://sports.active.com/ReportServer/Pages/ReportViewer.aspx?%2fSwimmingService%2fTop+Times+By+Name&rs:Command=Render&rs:Format=CSV"

// Mirrors the defaults the site's own report wizard submits for "show all".
// Top=0 means ALL times (the wizard's "Top how many? (0=All times)").
const DEFAULT_PARAMS: Record<string, string> = {
	P: "0",
	T: "0",
	M: "0",
	Gender: "0",
	MinAge: "0",
	MaxAge: "109",
	AgeGroup: "0",
	Distance: "0",
	Stroke: "0",
	Course: "0",
	Round: "0",
	Top: "0",
	IsSplits: "False",
	IsEligible: "False",
	StandardId: "0",
	IncGoals: "False",
	IncImprovement: "False",
	IsChronologic: "False",
	Locale: "en_CA"
}

export function buildTopTimesUrl(
	overrides: Record<string, string | number>
): string {
	const params: Record<string, string> = { ...DEFAULT_PARAMS }

	for (const [key, value] of Object.entries(overrides)) {
		if (value == null || value === "") continue
		params[key] = String(value)
	}

	const query = Object.entries(params)
		.map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
		.join("&")

	return `${REPORT_BASE}&${query}`
}

export async function fetchTopTimesCsv(url: string): Promise<string> {
	const res = await fetch(url, { credentials: "include" })

	if (!res.ok) {
		throw new Error(`report request failed (HTTP ${res.status})`)
	}

	const text = await res.text()

	// An auth redirect or a disabled URL-access endpoint answers with an HTML
	// page instead of CSV -- surface that as an error rather than feeding
	// markup into the CSV parser.
	if (text.trimStart().startsWith("<")) {
		throw new Error(
			"got HTML instead of CSV -- open the report URL in a tab to check auth/URL-access"
		)
	}

	return text
}
