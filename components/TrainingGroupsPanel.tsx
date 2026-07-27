import { useEffect, useState, type CSSProperties } from "react"

import {
	SYNC_TRAINING_GROUPS_MESSAGE,
	type SyncTrainingGroupsResponse
} from "~lib/messages"
import {
	createGroup,
	deleteGroup,
	EMPTY_TRAINING_GROUPS_STORE,
	loadTrainingGroupsStore,
	renameGroup,
	saveTrainingGroupsStore,
	setSwimmerGroup,
	type StoredGroup,
	type StoredSwimmer,
	type TrainingGroupsStore
} from "~lib/trainingGroups"

const UNASSIGNED_KEY = "__unassigned__"

const styles: Record<string, CSSProperties> = {
	label: {
		fontSize: 12,
		fontWeight: 600,
		textTransform: "uppercase",
		letterSpacing: 0.5,
		color: "var(--qol-text)",
		opacity: 0.65,
		marginBottom: 10
	},
	syncRow: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: 10
	},
	muted: { fontSize: 11, color: "var(--qol-text)", opacity: 0.65 },
	error: { fontSize: 11, color: "#c0392b", marginBottom: 8 },
	button: {
		fontSize: 12,
		fontFamily: "inherit",
		padding: "5px 10px",
		borderRadius: 5,
		border: "1px solid var(--qol-border)",
		background: "var(--qol-bg-elevated)",
		color: "var(--qol-text)",
		cursor: "pointer",
		whiteSpace: "nowrap"
	},
	textInput: {
		flex: 1,
		fontSize: 13,
		fontFamily: "inherit",
		padding: "6px 8px",
		borderRadius: 5,
		border: "1px solid var(--qol-border)",
		background: "var(--qol-bg-elevated)",
		color: "var(--qol-text)"
	},
	addRow: { display: "flex", gap: 6, marginBottom: 10 },
	listWrap: {
		maxHeight: 280,
		overflowY: "auto",
		border: "1px solid var(--qol-border)",
		borderRadius: 6
	},
	emptyText: {
		fontSize: 12,
		color: "var(--qol-text)",
		opacity: 0.65,
		padding: 14,
		textAlign: "center"
	},
	groupHeader: {
		display: "flex",
		alignItems: "center",
		gap: 8,
		padding: "8px 10px",
		cursor: "pointer",
		borderBottom: "1px solid var(--qol-border)"
	},
	dot: { width: 10, height: 10, borderRadius: "50%", flexShrink: 0 },
	chevron: {
		fontSize: 9,
		color: "var(--qol-text)",
		opacity: 0.65,
		width: 10,
		flexShrink: 0
	},
	groupName: {
		flex: 1,
		fontSize: 13,
		fontWeight: 600,
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap"
	},
	renameInput: {
		flex: 1,
		fontSize: 13,
		fontFamily: "inherit",
		padding: "3px 6px",
		borderRadius: 4,
		border: "1px solid var(--qol-border)",
		background: "var(--qol-bg-elevated)",
		color: "var(--qol-text)"
	},
	count: {
		fontSize: 11,
		color: "var(--qol-text)",
		opacity: 0.65,
		flexShrink: 0
	},
	iconButton: {
		fontSize: 11,
		color: "var(--qol-text)",
		opacity: 0.65,
		background: "none",
		border: "none",
		cursor: "pointer",
		padding: "2px 4px",
		flexShrink: 0
	},
	memberRow: {
		display: "flex",
		alignItems: "center",
		gap: 8,
		padding: "6px 10px 6px 28px",
		borderBottom: "1px solid var(--qol-border)"
	},
	memberName: {
		flex: 1,
		fontSize: 12,
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap"
	},
	memberAge: {
		fontSize: 11,
		color: "var(--qol-text)",
		opacity: 0.65,
		width: 22,
		textAlign: "right"
	},
	moveSelect: {
		fontSize: 11,
		fontFamily: "inherit",
		padding: "3px 4px",
		borderRadius: 4,
		border: "1px solid var(--qol-border)",
		background: "var(--qol-bg-elevated)",
		color: "var(--qol-text)",
		maxWidth: 110
	}
}

function formatLastSynced(timestamp: number | null): string {
	if (!timestamp) return "Never synced from site"

	const minutes = Math.round((Date.now() - timestamp) / 60000)
	if (minutes < 1) return "Synced just now"
	if (minutes < 60) return `Synced ${minutes}m ago`

	const hours = Math.round(minutes / 60)
	if (hours < 24) return `Synced ${hours}h ago`

	return `Synced ${Math.round(hours / 24)}d ago`
}

function membersOf(
	roster: StoredSwimmer[],
	groupId: string | null
): StoredSwimmer[] {
	return roster
		.filter((s) => s.groupId === groupId)
		.sort((a, b) => a.lastName.localeCompare(b.lastName))
}

export default function TrainingGroupsPanel() {
	const [store, setStore] = useState<TrainingGroupsStore>(
		EMPTY_TRAINING_GROUPS_STORE
	)
	const [loaded, setLoaded] = useState(false)
	const [syncing, setSyncing] = useState(false)
	const [syncError, setSyncError] = useState<string | null>(null)
	const [expanded, setExpanded] = useState<Set<string>>(new Set())
	const [newGroupName, setNewGroupName] = useState("")
	const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null)
	const [renameValue, setRenameValue] = useState("")
	const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

	useEffect(() => {
		loadTrainingGroupsStore().then((s) => {
			setStore(s)
			setLoaded(true)
		})
	}, [])

	async function persist(next: TrainingGroupsStore) {
		setStore(next)
		await saveTrainingGroupsStore(next)
	}

	async function handleSync() {
		setSyncing(true)
		setSyncError(null)

		try {
			const tabs = await chrome.tabs.query({
				url: "*://sports.active.com/*"
			})
			const tabId = tabs.find((t) => t.id != null)?.id

			if (tabId == null) {
				setSyncError("Open Active Swim Manager in a tab, then try again.")
				return
			}

			const response = (await chrome.tabs.sendMessage(tabId, {
				type: SYNC_TRAINING_GROUPS_MESSAGE
			})) as SyncTrainingGroupsResponse | undefined

			if (response?.ok && response.store) {
				setStore(response.store)
			} else {
				setSyncError(
					response?.error ?? "Sync failed. Try reloading the site tab."
				)
			}
		} catch {
			setSyncError(
				"Couldn't reach the Active Swim Manager tab. Make sure it's open and loaded."
			)
		} finally {
			setSyncing(false)
		}
	}

	function toggleExpanded(key: string) {
		setExpanded((prev) => {
			const next = new Set(prev)
			if (next.has(key)) next.delete(key)
			else next.add(key)
			return next
		})
	}

	function handleAddGroup() {
		const name = newGroupName.trim()
		if (!name) return
		persist(createGroup(store, name))
		setNewGroupName("")
	}

	function startRename(group: StoredGroup) {
		setRenamingGroupId(group.id)
		setRenameValue(group.name)
	}

	function commitRename() {
		if (renamingGroupId) {
			persist(renameGroup(store, renamingGroupId, renameValue))
		}
		setRenamingGroupId(null)
	}

	function handleDelete(groupId: string) {
		persist(deleteGroup(store, groupId))
		setConfirmDeleteId(null)
	}

	function moveSwimmer(swimmerId: string, groupId: string | null) {
		persist(setSwimmerGroup(store, swimmerId, groupId))
	}

	const sortedGroups = [...store.groups].sort((a, b) =>
		a.name.localeCompare(b.name)
	)
	const unassigned = membersOf(store.roster, null)
	const isEmpty = sortedGroups.length === 0 && unassigned.length === 0

	function renderMoveSelect(swimmer: StoredSwimmer) {
		return (
			<select
				value={swimmer.groupId ?? ""}
				onClick={(e) => e.stopPropagation()}
				onChange={(e) => moveSwimmer(swimmer.id, e.target.value || null)}
				style={styles.moveSelect}>
				<option value="">Unassigned</option>
				{sortedGroups.map((g) => (
					<option key={g.id} value={g.id}>
						{g.name}
					</option>
				))}
			</select>
		)
	}

	function renderMembers(members: StoredSwimmer[]) {
		if (!members.length) {
			return (
				<div style={{ ...styles.emptyText, textAlign: "left", padding: "8px 10px 8px 28px" }}>
					No swimmers
				</div>
			)
		}

		return members.map((swimmer) => (
			<div key={swimmer.id} style={styles.memberRow}>
				<span style={styles.memberName} title={`${swimmer.firstName} ${swimmer.lastName}`}>
					{swimmer.firstName} {swimmer.lastName}
				</span>
				<span style={styles.memberAge}>{swimmer.age ?? ""}</span>
				{renderMoveSelect(swimmer)}
			</div>
		))
	}

	function renderGroupCard(group: StoredGroup) {
		const isExpanded = expanded.has(group.id)
		const members = membersOf(store.roster, group.id)
		const isRenaming = renamingGroupId === group.id
		const isConfirmingDelete = confirmDeleteId === group.id

		return (
			<div key={group.id}>
				<div
					style={styles.groupHeader}
					onClick={() => !isRenaming && toggleExpanded(group.id)}>
					<span style={styles.chevron}>{isExpanded ? "▾" : "▸"}</span>
					<span style={{ ...styles.dot, background: group.color }} />

					{isRenaming ? (
						<input
							autoFocus
							value={renameValue}
							onChange={(e) => setRenameValue(e.target.value)}
							onClick={(e) => e.stopPropagation()}
							onBlur={commitRename}
							onKeyDown={(e) => {
								if (e.key === "Enter") commitRename()
								if (e.key === "Escape") setRenamingGroupId(null)
							}}
							style={styles.renameInput}
						/>
					) : (
						<span style={styles.groupName} title={group.name}>
							{group.name}
						</span>
					)}

					{!isRenaming && <span style={styles.count}>{members.length}</span>}

					{isConfirmingDelete ? (
						<>
							<span style={{ fontSize: 11, color: "#c0392b" }}>Delete?</span>
							<button
								style={styles.iconButton}
								onClick={(e) => {
									e.stopPropagation()
									handleDelete(group.id)
								}}>
								Yes
							</button>
							<button
								style={styles.iconButton}
								onClick={(e) => {
									e.stopPropagation()
									setConfirmDeleteId(null)
								}}>
								No
							</button>
						</>
					) : (
						!isRenaming && (
							<>
								<button
									style={styles.iconButton}
									title="Rename group"
									onClick={(e) => {
										e.stopPropagation()
										startRename(group)
									}}>
									{"✎"}
								</button>
								<button
									style={styles.iconButton}
									title="Delete group"
									onClick={(e) => {
										e.stopPropagation()
										setConfirmDeleteId(group.id)
									}}>
									{"✕"}
								</button>
							</>
						)
					)}
				</div>

				{isExpanded && renderMembers(members)}
			</div>
		)
	}

	function renderUnassignedCard() {
		const isExpanded = expanded.has(UNASSIGNED_KEY)

		return (
			<div key={UNASSIGNED_KEY}>
				<div
					style={styles.groupHeader}
					onClick={() => toggleExpanded(UNASSIGNED_KEY)}>
					<span style={styles.chevron}>{isExpanded ? "▾" : "▸"}</span>
					<span style={{ ...styles.dot, background: "#aaaaaa" }} />
					<span style={styles.groupName}>Unassigned</span>
					<span style={styles.count}>{unassigned.length}</span>
				</div>

				{isExpanded && renderMembers(unassigned)}
			</div>
		)
	}

	return (
		<div>
			<div style={styles.label}>Training Groups</div>

			<div style={styles.syncRow}>
				<span style={styles.muted}>
					{loaded ? formatLastSynced(store.lastSyncedAt) : "Loading…"}
				</span>
				<button
					style={styles.button}
					disabled={!loaded || syncing}
					onClick={handleSync}>
					{syncing ? "Syncing…" : "Sync now"}
				</button>
			</div>

			{syncError && <div style={styles.error}>{syncError}</div>}

			<div style={styles.addRow}>
				<input
					value={newGroupName}
					disabled={!loaded}
					onChange={(e) => setNewGroupName(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") handleAddGroup()
					}}
					placeholder="New group name"
					style={styles.textInput}
				/>
				<button
					style={styles.button}
					disabled={!loaded || !newGroupName.trim()}
					onClick={handleAddGroup}>
					Add
				</button>
			</div>

			<div style={styles.listWrap}>
				{isEmpty ? (
					<div style={styles.emptyText}>
						{loaded
							? "No group data yet. Open Active Swim Manager and hit “Sync now”."
							: "Loading…"}
					</div>
				) : (
					<>
						{sortedGroups.map(renderGroupCard)}
						{unassigned.length > 0 && renderUnassignedCard()}
					</>
				)}
			</div>
		</div>
	)
}
