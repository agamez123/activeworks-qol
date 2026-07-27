import { getAgencyId, getCSRF } from "~contents/pageContext"
import {
	colorForGroupId,
	loadTrainingGroupsStore,
	saveTrainingGroupsStore,
	type StoredGroup,
	type StoredSwimmer,
	type TrainingGroupsStore
} from "~lib/trainingGroups"

// Only imported by contents/trainingGroupsSync.ts. Depends on
// ~contents/pageContext (which hooks window.fetch/XHR as a side effect to
// sniff the site's CSRF token/agency id), so this must never be imported
// from the popup - see the note at the top of ~lib/trainingGroups.

// ---- Raw shapes returned by the site's own API ----

interface ApiTrainingGroup {
	athleteIds: string[]
	name: string
	id: string
}

interface ApiSwimmerEntry {
	swimmer?: {
		id: string
		firstName: string
		lastName: string
		age?: number
		dob?: string
		gender?: string
	}
}

interface ApiAthleteData {
	swimmers?: ApiSwimmerEntry[]
	programs?: { trainingGroups: ApiTrainingGroup[] }[]
}

interface MeetSummary {
	sportsId?: string
	meetStartDate?: string
}

async function fetchMeetAttendance(
	meetId: string,
	csrfToken: string
): Promise<ApiAthleteData> {
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
function mergeAthleteData(datasets: ApiAthleteData[]): ApiAthleteData {
	const swimmerById = new Map<string, ApiSwimmerEntry>()
	const groupById = new Map<string, ApiTrainingGroup>()

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

function buildFreshRosterAndGroups(data: ApiAthleteData): {
	groups: StoredGroup[]
	roster: StoredSwimmer[]
} {
	const trainingGroups = data.programs?.[0]?.trainingGroups ?? []
	const idToGroupId = new Map<string, string>()
	const groups: StoredGroup[] = []

	for (const group of trainingGroups) {
		groups.push({
			id: group.id,
			name: group.name,
			color: colorForGroupId(group.id)
		})
		for (const athleteId of group.athleteIds) {
			idToGroupId.set(athleteId, group.id)
		}
	}

	const roster: StoredSwimmer[] = []
	for (const entry of data.swimmers ?? []) {
		const swimmer = entry.swimmer
		if (!swimmer?.id) continue

		roster.push({
			id: swimmer.id,
			firstName: swimmer.firstName,
			lastName: swimmer.lastName,
			age: swimmer.age,
			dob: swimmer.dob,
			gender: swimmer.gender,
			groupId: idToGroupId.get(swimmer.id) ?? null
		})
	}

	return { groups, roster }
}

async function fetchFreshFromAPI(): Promise<{
	groups: StoredGroup[]
	roster: StoredSwimmer[]
} | null> {
	const csrfToken = getCSRF()
	const agencyId = getAgencyId()

	// Both are sniffed (by pageContext.ts) from the page's own outgoing
	// requests. If neither has fired yet -- e.g. this runs before the site's
	// own bootstrap calls do -- bail instead of sending a request that's
	// guaranteed to be rejected or scoped to the wrong agency.
	if (!csrfToken || !agencyId) {
		console.warn(
			"QOL: CSRF token or agency ID not available yet, skipping group sync"
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

		const athleteDataSets: ApiAthleteData[] = []
		for (const result of results) {
			if (result.status === "fulfilled") {
				athleteDataSets.push(result.value)
			} else {
				console.error("QOL: failed to load attendance for a meet", result.reason)
			}
		}

		const merged = mergeAthleteData(athleteDataSets)
		return buildFreshRosterAndGroups(merged)
	} catch (err) {
		console.error("QOL: failed to load training group data", err)
		return null
	}
}

// ---- Merging a fresh fetch into the locally-edited store ----

function mergeStores(
	existing: TrainingGroupsStore,
	fetched: { groups: StoredGroup[]; roster: StoredSwimmer[] }
): TrainingGroupsStore {
	const deletedApiGroupIds = new Set(existing.deletedApiGroupIds)
	const existingGroupIds = new Set(existing.groups.map((g) => g.id))

	const groups = [...existing.groups]
	for (const group of fetched.groups) {
		if (existingGroupIds.has(group.id) || deletedApiGroupIds.has(group.id)) {
			continue
		}
		groups.push(group)
	}

	const validGroupIds = new Set(groups.map((g) => g.id))
	const existingById = new Map(existing.roster.map((s) => [s.id, s]))
	const roster: StoredSwimmer[] = []
	const seen = new Set<string>()

	for (const fresh of fetched.roster) {
		seen.add(fresh.id)
		const prior = existingById.get(fresh.id)

		if (prior?.manualGroup) {
			// Manual assignment wins; still pick up refreshed bio fields
			// (age/dob change every birthday) and drop a dangling group
			// reference if that group was deleted since.
			roster.push({
				...fresh,
				groupId: validGroupIds.has(prior.groupId ?? "") ? prior.groupId : null,
				manualGroup: true
			})
		} else {
			roster.push(fresh)
		}
	}

	// Swimmers the fresh fetch didn't report (e.g. not entered in any
	// current-year meet yet) are kept as-is rather than dropped.
	for (const prior of existing.roster) {
		if (seen.has(prior.id)) continue
		roster.push(
			validGroupIds.has(prior.groupId ?? "") ? prior : { ...prior, groupId: null }
		)
	}

	return {
		groups,
		roster,
		deletedApiGroupIds: [...deletedApiGroupIds],
		lastSyncedAt: Date.now()
	}
}

export async function syncTrainingGroups(): Promise<TrainingGroupsStore | null> {
	const fetched = await fetchFreshFromAPI()
	if (!fetched) return null

	const existing = await loadTrainingGroupsStore()
	const merged = mergeStores(existing, fetched)
	await saveTrainingGroupsStore(merged)
	return merged
}
