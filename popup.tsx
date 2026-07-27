import icon from "data-base64:~assets/icon.png"
import { useEffect, useState, type CSSProperties } from "react"

import "~popup.css"

import ThemeSelect from "~components/ThemeSelect"
import TrainingGroupsPanel from "~components/TrainingGroupsPanel"
import {
	DEFAULT_THEME,
	LEGACY_DARK_MODE_STORAGE_KEY,
	resolveStoredTheme,
	THEME_STORAGE_KEY,
	type Theme
} from "~lib/storage"
import { themeVarsFor } from "~lib/themeColors"

const THEME_OPTIONS: { value: Theme; label: string; swatch: string }[] = [
	{ value: "light", label: "Light", swatch: "#ffffff" },
	{ value: "dark", label: "Dark", swatch: "#1e1e1e" },
	{ value: "tan", label: "Tan", swatch: "#e4d3a8" },
	{ value: "ocean", label: "Ocean", swatch: "#4fb3e8" },
	{ value: "forest", label: "Forest", swatch: "#6fc26a" },
	{ value: "grape", label: "Grape", swatch: "#b980e8" },
	{ value: "crimson", label: "Crimson", swatch: "#e8596a" },
	{ value: "amber", label: "Amber", swatch: "#e8a13f" },
	{ value: "lagoon", label: "Lagoon", swatch: "#45c9c9" },
	{ value: "slate", label: "Slate", swatch: "#6f9ce8" },
	{ value: "midnight", label: "Midnight", swatch: "#8484f0" },
	{ value: "graphite", label: "Graphite", swatch: "#c9a876" },
	{ value: "rose", label: "Rose", swatch: "#e85fae" }
]

function IndexPopup() {
	const [theme, setTheme] = useState<Theme>(DEFAULT_THEME)
	const [loaded, setLoaded] = useState(false)

	useEffect(() => {
		chrome.storage.sync.get(
			[THEME_STORAGE_KEY, LEGACY_DARK_MODE_STORAGE_KEY],
			(result) => {
				setTheme(resolveStoredTheme(result))
				setLoaded(true)
			}
		)
	}, [])

	function changeTheme(next: Theme) {
		setTheme(next)
		chrome.storage.sync.set({ [THEME_STORAGE_KEY]: next })
	}

	// Exposed as CSS custom properties on the root element so every nested
	// component (ThemeSelect, TrainingGroupsPanel) can pick up the current
	// theme's colors via var(--qol-...) without prop-drilling them down.
	const vars = themeVarsFor(theme)
	const themeCssVars = {
		"--qol-bg": vars.bg,
		"--qol-bg-alt": vars.bgAlt,
		"--qol-bg-elevated": vars.bgElevated,
		"--qol-bg-hover": vars.bgHover,
		"--qol-bg-selected": vars.bgSelected,
		"--qol-border": vars.border,
		"--qol-text": vars.text,
		"--qol-link": vars.link
	} as CSSProperties

	return (
		<div
			style={{
				...themeCssVars,
				width: 380,
				maxHeight: 600,
				overflowY: "auto",
				fontFamily: "system-ui, sans-serif",
				color: "var(--qol-text)",
				background: "var(--qol-bg)"
			}}>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: 10,
					padding: "16px 16px 12px"
				}}>
				<img src={icon} alt="" width={28} height={28} />
				<div>
					<div style={{ fontSize: 15, fontWeight: 600 }}>ASM Toolkit</div>
					<div
						style={{ fontSize: 12, color: "var(--qol-text)", opacity: 0.65 }}>
						Quality of life tweaks for Active Swim Manager
					</div>
				</div>
			</div>

			<hr
				style={{
					border: "none",
					borderTop: "1px solid var(--qol-border)",
					margin: 0
				}}
			/>

			<div style={{ padding: 16 }}>
				<div
					style={{
						fontSize: 12,
						fontWeight: 600,
						textTransform: "uppercase",
						letterSpacing: 0.5,
						color: "var(--qol-text)",
						opacity: 0.65,
						marginBottom: 10
					}}>
					Appearance
				</div>

				<label
					style={{
						display: "block",
						fontSize: 14,
						marginBottom: 6,
						opacity: loaded ? 1 : 0.5
					}}>
					Theme
				</label>

				<ThemeSelect
					value={theme}
					options={THEME_OPTIONS}
					disabled={!loaded}
					onChange={changeTheme}
				/>

				<hr
					style={{
						border: "none",
						borderTop: "1px solid var(--qol-border)",
						margin: "16px 0"
					}}
				/>

				<TrainingGroupsPanel />
			</div>
		</div>
	)
}

export default IndexPopup
