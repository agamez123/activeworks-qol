import { TRAINING_GROUPS_STORAGE_KEY } from "~lib/storage"

// This module intentionally has no dependency on ~contents/pageContext (or
// anything else that touches window.fetch/XHR) - it's imported directly by
// the popup for local group/roster editing, and pulling in pageContext's
// page-sniffing side effects there would be both wrong and wasteful. The
// site-fetching sync logic lives in ~lib/trainingGroupsSync instead, and is
// only ever imported by the content script that runs it.

// ---- Persisted shapes (chrome.storage.local) ----

export interface StoredGroup {
	id: string
	name: string
	color: string
	// User-created groups have no corresponding group on the site.
	custom?: boolean
}

export interface StoredSwimmer {
	id: string
	firstName: string
	lastName: string
	age?: number
	dob?: string
	gender?: string
	groupId: string | null
	// Set once the user explicitly assigns/unassigns this swimmer. Manual
	// assignments always win over whatever the site reports on the next sync.
	manualGroup?: boolean
}

export interface TrainingGroupsStore {
	groups: StoredGroup[]
	roster: StoredSwimmer[]
	// Site-sourced group ids the user has deleted locally, so a later sync
	// doesn't resurrect them.
	deletedApiGroupIds: string[]
	lastSyncedAt: number | null
}

export const EMPTY_TRAINING_GROUPS_STORE: TrainingGroupsStore = {
	groups: [],
	roster: [],
	deletedApiGroupIds: [],
	lastSyncedAt: null
}

// Back-compat shapes consumed by inlinePeople.tsx.
export type GroupInfo = StoredGroup

export interface RosterEntry extends StoredSwimmer {
	group?: StoredGroup
}

export interface TrainingGroupData {
	groups: StoredGroup[]
	nameToGroup: Map<string, StoredGroup>
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

export function colorForGroupId(groupId: string): string {
	let hash = 0
	for (let i = 0; i < groupId.length; i++) {
		hash = (hash * 31 + groupId.charCodeAt(i)) >>> 0
	}
	return GROUP_COLOR_PALETTE[hash % GROUP_COLOR_PALETTE.length]
}

export function normalizeName(name: string): string {
	return name.trim().replace(/\s+/g, " ").toLowerCase()
}

// ---- Persistence ----

export async function loadTrainingGroupsStore(): Promise<TrainingGroupsStore> {
	const result = await chrome.storage.local.get([TRAINING_GROUPS_STORAGE_KEY])
	return (
		(result[TRAINING_GROUPS_STORAGE_KEY] as TrainingGroupsStore | undefined) ??
		EMPTY_TRAINING_GROUPS_STORE
	)
}

export async function saveTrainingGroupsStore(
	store: TrainingGroupsStore
): Promise<void> {
	await chrome.storage.local.set({ [TRAINING_GROUPS_STORAGE_KEY]: store })
}

// Resolves each roster entry's group object and indexes swimmers by
// normalized "First Last" name, for the People-page content script to
// cross-reference against the rendered grid.
export function buildIndexes(store: TrainingGroupsStore): TrainingGroupData {
	const groupById = new Map(store.groups.map((g) => [g.id, g]))
	const nameToGroup = new Map<string, StoredGroup>()

	const roster: RosterEntry[] = store.roster.map((swimmer) => {
		const group = swimmer.groupId ? groupById.get(swimmer.groupId) : undefined
		if (group) {
			nameToGroup.set(
				normalizeName(`${swimmer.firstName} ${swimmer.lastName}`),
				group
			)
		}
		return { ...swimmer, group }
	})

	return {
		groups: [...store.groups].sort((a, b) => a.name.localeCompare(b.name)),
		nameToGroup,
		roster
	}
}

// ---- Local, offline mutations (pure - caller persists the result) ----

export function createGroup(
	store: TrainingGroupsStore,
	name: string
): TrainingGroupsStore {
	const trimmed = name.trim()
	if (!trimmed) return store

	const id = `custom-${crypto.randomUUID()}`
	const group: StoredGroup = {
		id,
		name: trimmed,
		color: colorForGroupId(id),
		custom: true
	}

	return { ...store, groups: [...store.groups, group] }
}

export function renameGroup(
	store: TrainingGroupsStore,
	groupId: string,
	name: string
): TrainingGroupsStore {
	const trimmed = name.trim()
	if (!trimmed) return store

	return {
		...store,
		groups: store.groups.map((g) =>
			g.id === groupId ? { ...g, name: trimmed } : g
		)
	}
}

export function deleteGroup(
	store: TrainingGroupsStore,
	groupId: string
): TrainingGroupsStore {
	const target = store.groups.find((g) => g.id === groupId)
	if (!target) return store

	return {
		...store,
		groups: store.groups.filter((g) => g.id !== groupId),
		roster: store.roster.map((s) =>
			s.groupId === groupId ? { ...s, groupId: null, manualGroup: true } : s
		),
		deletedApiGroupIds: target.custom
			? store.deletedApiGroupIds
			: [...store.deletedApiGroupIds, groupId]
	}
}

export function setSwimmerGroup(
	store: TrainingGroupsStore,
	swimmerId: string,
	groupId: string | null
): TrainingGroupsStore {
	return {
		...store,
		roster: store.roster.map((s) =>
			s.id === swimmerId ? { ...s, groupId, manualGroup: true } : s
		)
	}
}
