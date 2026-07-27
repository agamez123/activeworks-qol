import type { PlasmoCSConfig } from "plasmo"

import {
	SYNC_TRAINING_GROUPS_MESSAGE,
	type SyncTrainingGroupsRequest,
	type SyncTrainingGroupsResponse
} from "~lib/messages"
import { syncTrainingGroups } from "~lib/trainingGroupsSync"

// Runs on every sports.active.com page (not just People) so the popup can
// trigger a sync from whichever tab happens to be open. The actual fetch
// needs the CSRF token/agency id that pageContext.ts sniffs onto the shared
// DOM, which only exist in a real site tab -- the popup has no access to it.
export const config: PlasmoCSConfig = {
	matches: ["*://sports.active.com/*"],
	run_at: "document_idle"
}

chrome.runtime.onMessage.addListener(
	(
		message: SyncTrainingGroupsRequest,
		_sender,
		sendResponse: (response: SyncTrainingGroupsResponse) => void
	) => {
		if (message?.type !== SYNC_TRAINING_GROUPS_MESSAGE) return

		syncTrainingGroups()
			.then((store) => {
				if (store) {
					sendResponse({ ok: true, store })
				} else {
					sendResponse({
						ok: false,
						error: "No group data available for this club yet."
					})
				}
			})
			.catch((err) => {
				sendResponse({
					ok: false,
					error: err instanceof Error ? err.message : String(err)
				})
			})

		// Keep the message channel open for the async response above.
		return true
	}
)
