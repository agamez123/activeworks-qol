import { useEffect, useRef, useState } from "react"

import type { Theme } from "~lib/storage"

export interface ThemeOption {
	value: Theme
	label: string
	swatch: string
}

interface ThemeSelectProps {
	value: Theme
	options: ThemeOption[]
	disabled?: boolean
	onChange: (value: Theme) => void
}

function Dot({ color }: { color: string }) {
	return (
		<span
			style={{
				width: 12,
				height: 12,
				borderRadius: "50%",
				border: "1px solid var(--qol-border)",
				background: color,
				flexShrink: 0
			}}
		/>
	)
}

// Native <select>/<option> can't render arbitrary content (like a color
// swatch) inside the open dropdown list - browsers only allow plain text in
// <option>. This is a custom listbox instead, so every option (not just the
// current selection) gets its own colored dot.
export default function ThemeSelect({
	value,
	options,
	disabled,
	onChange
}: ThemeSelectProps) {
	const [open, setOpen] = useState(false)
	const [hovered, setHovered] = useState<Theme | null>(null)
	const rootRef = useRef<HTMLDivElement>(null)

	const active = options.find((option) => option.value === value)

	useEffect(() => {
		if (!open) return

		function handlePointerDown(e: MouseEvent) {
			if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
		}
		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === "Escape") setOpen(false)
		}

		document.addEventListener("mousedown", handlePointerDown)
		document.addEventListener("keydown", handleKeyDown)
		return () => {
			document.removeEventListener("mousedown", handlePointerDown)
			document.removeEventListener("keydown", handleKeyDown)
		}
	}, [open])

	return (
		<div ref={rootRef} style={{ position: "relative" }}>
			<button
				type="button"
				disabled={disabled}
				onClick={() => setOpen((o) => !o)}
				style={{
					width: "100%",
					display: "flex",
					alignItems: "center",
					gap: 8,
					fontSize: 14,
					fontFamily: "inherit",
					color: "var(--qol-text)",
					background: "var(--qol-bg-elevated)",
					border: "1px solid var(--qol-border)",
					borderRadius: 6,
					padding: "8px 10px",
					cursor: disabled ? "default" : "pointer",
					opacity: disabled ? 0.5 : 1,
					textAlign: "left"
				}}>
				{active && <Dot color={active.swatch} />}
				<span style={{ flex: 1 }}>{active?.label}</span>
				<span style={{ fontSize: 10, color: "var(--qol-text)", opacity: 0.65 }}>
					{open ? "▲" : "▼"}
				</span>
			</button>

			{open && (
				<div
					role="listbox"
					style={{
						position: "absolute",
						top: "calc(100% + 4px)",
						left: 0,
						right: 0,
						zIndex: 20,
						background: "var(--qol-bg-elevated)",
						border: "1px solid var(--qol-border)",
						borderRadius: 6,
						boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
						maxHeight: 240,
						overflowY: "auto"
					}}>
					{options.map((option) => {
						const isSelected = option.value === value
						const isHovered = option.value === hovered

						return (
							<div
								key={option.value}
								role="option"
								aria-selected={isSelected}
								onMouseEnter={() => setHovered(option.value)}
								onMouseLeave={() => setHovered(null)}
								onClick={() => {
									onChange(option.value)
									setOpen(false)
								}}
								style={{
									display: "flex",
									alignItems: "center",
									gap: 8,
									padding: "7px 10px",
									fontSize: 13,
									color: "var(--qol-text)",
									cursor: "pointer",
									background: isHovered
										? "var(--qol-bg-hover)"
										: isSelected
											? "var(--qol-bg-selected)"
											: "transparent"
								}}>
								<Dot color={option.swatch} />
								<span>{option.label}</span>
							</div>
						)
					})}
				</div>
			)}
		</div>
	)
}
