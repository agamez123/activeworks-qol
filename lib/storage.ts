// Shared chrome.storage keys. Kept in one place so popup.tsx (the writer)
// and the content scripts that read the setting can't drift out of sync.

export type Theme =
	| "light"
	| "dark"
	| "tan"
	| "ocean"
	| "forest"
	| "grape"
	| "crimson"
	| "amber"
	| "lagoon"
	| "slate"
	| "midnight"
	| "graphite"
	| "rose"

export const THEME_STORAGE_KEY = "theme"

export const DEFAULT_THEME: Theme = "dark"

// Pre-multi-theme installs stored a plain on/off boolean under this key.
// Kept only so those preferences migrate into the new theme key instead of
// silently resetting to the default.
export const LEGACY_DARK_MODE_STORAGE_KEY = "darkModeEnabled"

export type StoredThemeResult = {
	[THEME_STORAGE_KEY]?: Theme
	[LEGACY_DARK_MODE_STORAGE_KEY]?: boolean
}

export function resolveStoredTheme(stored: StoredThemeResult): Theme {
	if (stored[THEME_STORAGE_KEY]) return stored[THEME_STORAGE_KEY]
	if (stored[LEGACY_DARK_MODE_STORAGE_KEY] === false) return "light"
	return DEFAULT_THEME
}

// Training group roster/groups cache lives in chrome.storage.local (not
// sync) - a full club roster can run well past sync's 8KB-per-item quota.
export const TRAINING_GROUPS_STORAGE_KEY = "trainingGroupsStore"

// User's chosen column subset/order for the EntryByName CSV export (an
// array of EntryColumn keys, see lib/meetEntryByNameFormat.ts).
export const ENTRY_BY_NAME_COLUMNS_STORAGE_KEY = "entryByNameExportColumns"
