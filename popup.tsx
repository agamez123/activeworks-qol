import icon from "data-base64:~assets/icon.png"
import { useEffect, useState } from "react"

import { DARK_MODE_STORAGE_KEY } from "~lib/storage"

function IndexPopup() {
	const [darkModeEnabled, setDarkModeEnabled] = useState(true)
	const [loaded, setLoaded] = useState(false)

	useEffect(() => {
		chrome.storage.sync.get([DARK_MODE_STORAGE_KEY], (result) => {
			setDarkModeEnabled(result[DARK_MODE_STORAGE_KEY] ?? true)
			setLoaded(true)
		})
	}, [])

	function toggleDarkMode() {
		const next = !darkModeEnabled
		setDarkModeEnabled(next)
		chrome.storage.sync.set({ [DARK_MODE_STORAGE_KEY]: next })
	}

	return (
		<div
			style={{
				width: 260,
				fontFamily: "system-ui, sans-serif",
				color: "#1e1e1e"
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
					<div style={{ fontSize: 15, fontWeight: 600 }}>Activeworks QOL</div>
					<div style={{ fontSize: 12, color: "#666" }}>
						Quality of life tweaks for Activeworks
					</div>
				</div>
			</div>

			<hr
				style={{ border: "none", borderTop: "1px solid #e0e0e0", margin: 0 }}
			/>

			<div style={{ padding: 16 }}>
				<div
					style={{
						fontSize: 12,
						fontWeight: 600,
						textTransform: "uppercase",
						letterSpacing: 0.5,
						color: "#888",
						marginBottom: 10
					}}>
					Options
				</div>

				<label
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						cursor: "pointer",
						opacity: loaded ? 1 : 0.5
					}}>
					<span style={{ fontSize: 14 }}>Dark mode</span>
					<input
						type="checkbox"
						checked={darkModeEnabled}
						disabled={!loaded}
						onChange={toggleDarkMode}
					/>
				</label>
			</div>
		</div>
	)
}

export default IndexPopup
