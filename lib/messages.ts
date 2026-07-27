// Runtime messages sent from the popup to the content script running on a
// sports.active.com tab (the only place the site's CSRF token/agency id are
// readable), asking it to sync training groups from the site.
import type { TrainingGroupsStore } from "~lib/trainingGroups"

export const SYNC_TRAINING_GROUPS_MESSAGE = "qol-sync-training-groups"

export interface SyncTrainingGroupsRequest {
	type: typeof SYNC_TRAINING_GROUPS_MESSAGE
}

export interface SyncTrainingGroupsResponse {
	ok: boolean
	store?: TrainingGroupsStore
	error?: string
}
