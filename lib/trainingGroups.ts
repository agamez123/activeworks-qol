import { getAgencyId, getCSRF } from "~contents/pageContext"

export interface TrainingGroup {
	athleteIds: string[]
	name: string
	id: string
}

export interface SwimmerEntry {
	swimmer?: {
		id: string
		firstName: string
		lastName: string
		age?: number
		dob?: string
		gender?: string
	}
}

export interface AthleteData {
	swimmers?: SwimmerEntry[]
	programs?: { trainingGroups: TrainingGroup[] }[]
}

interface MeetSummary {
	sportsId?: string
	meetStartDate?: string
}

export interface GroupInfo {
	id: string
	name: string
	color: string
}

export interface RosterEntry {
	id: string
	firstName: string
	lastName: string
	age?: number
	dob?: string
	gender?: string
	group?: GroupInfo
}

export interface TrainingGroupData {
	groups: GroupInfo[]
	nameToGroup: Map<string, GroupInfo>
	roster: RosterEntry[]
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

export function normalizeName(name: string): string {
	return name.trim().replace(/\s+/g, " ").toLowerCase()
}

function buildRoster(
	athleteData: AthleteData,
	trainingGroups: TrainingGroup[]
): TrainingGroupData {
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

	return {
		groups: groups.sort((a, b) => a.name.localeCompare(b.name)),
		nameToGroup: nameMap,
		roster: entries
	}
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

export async function fetchTrainingGroups(): Promise<TrainingGroupData | null> {
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
		return null
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
				"QOL: no meets found for this agency in the current year, group data unavailable"
			)
			return null
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
				console.error("QOL: failed to load attendance for a meet", result.reason)
			}
		}

		const merged = mergeAthleteData(athleteDataSets)
		return buildRoster(merged, merged.programs?.[0]?.trainingGroups)
	} catch (err) {
		console.error("QOL: failed to load training group data", err)
		return null
	}
}
