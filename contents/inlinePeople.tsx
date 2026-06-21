import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["*://*/active/swimming/*", "*://*/HtmlApp*"],
  run_at: "document_idle"
}

// ── Types ────────────────────────────────────────────────────────────────────

type DropdownOption = {
  value: string
  label: string
  selected?: boolean
}

type InjectConfig = {
  /** The new table-cell <div> id */
  cellId: string
  /** VFormItem label text */
  label: string
  /** The inner combobox div id (matches the site's naming convention) */
  comboboxId: string
  /** Combobox width in px */
  width: number
  /** Dropdown options */
  options: DropdownOption[]
  /** Called when the user picks a value */
  onChange?: (value: string) => void
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a combobox <li> item identical to the site's rendered markup.
 */
function buildOptionLi(opt: DropdownOption, index: number): HTMLLIElement {
  const li = document.createElement("li")
  li.setAttribute("data-value", opt.value)

  const a = document.createElement("a")
  a.setAttribute("data-value", opt.value)
  a.setAttribute("data-index", String(index))
  a.setAttribute("data-disabled", "false")
  if (opt.selected) a.setAttribute("data-selected", "true")
  a.textContent = opt.label

  li.appendChild(a)
  return li
}

/**
 * Create a fully-formed combobox cell matching the site's HBox children.
 * Mirrors:  active.fnd.arch.layouts.HBox  →  VFormItem  →  Combobox
 */
function buildComboboxCell(cfg: InjectConfig): HTMLDivElement {
  const defaultOpt = cfg.options.find(o => o.selected) ?? cfg.options[0]

  // ── Outer table-cell wrapper ──────────────────────────────────────────────
  const cell = document.createElement("div")
  cell.id = cfg.cellId
  cell.style.cssText = "float:left;display:table-cell;"

  // ── VFormItem ─────────────────────────────────────────────────────────────
  const formItem = document.createElement("div")
  formItem.className =
    "filterItem form__group form-item"
  formItem.setAttribute("data-render", "active.swimming.components.VFormItem")
  formItem.setAttribute("data-label", cfg.label)
  formItem.setAttribute("data-rendered", "true")

  // Label
  const labelSpan = document.createElement("span")
  labelSpan.className = "form__label"
  labelSpan.textContent = cfg.label

  // form__control
  const formControl = document.createElement("div")
  formControl.className = "form__control"

  // ── Combobox ──────────────────────────────────────────────────────────────
  const combobox = document.createElement("div")
  combobox.id = cfg.comboboxId
  combobox.setAttribute("data-render", "active.swimming.components.Combobox")
  combobox.setAttribute("data-rendered", "true")
  combobox.style.cssText = `width:${cfg.width}px;padding:0px;`
  combobox.className =
    "active-swimming-components-BaseInput form-element " +
    "active-swimming-components-toolTip active-swimming-components-toolTip--ne " +
    "btn-group dropdown dropdown--flat btn-input"

  // Toggle button
  const button = document.createElement("button")
  button.type = "button"
  button.className = "btn dropdown__button select form__element collapse"

  const labelText = document.createElement("span")
  labelText.setAttribute("data-bind", "label")
  labelText.className = "left-label u-floatLeft dropdown__button-text"
  labelText.setAttribute("data-value", defaultOpt.value)
  labelText.textContent = defaultOpt.label

  const icon = document.createElement("i")
  icon.className = "ic-triangle-down"
  icon.setAttribute("data-value", "icon")
  icon.style.fontSize = "20px"

  button.appendChild(labelText)
  button.appendChild(icon)

  // Tooltip span (hidden, required by site CSS)
  const tooltip = document.createElement("span")
  tooltip.className = "active-swimming-components-toolTip__content"
  tooltip.style.display = "none"

  // Dropdown menu
  const menu = document.createElement("ul")
  menu.className = "dropdown__menu"
  menu.setAttribute("role", "menu")
  menu.setAttribute("data-dropdown-type", "select")
  menu.style.display = "none"

  cfg.options.forEach((opt, i) => menu.appendChild(buildOptionLi(opt, i)))

  // ── Wire up open/close & selection ───────────────────────────────────────
  button.addEventListener("click", e => {
    e.stopPropagation()
    const isOpen = menu.style.display !== "none"
    // Close any other open dropdowns on the page first
    document
      .querySelectorAll<HTMLElement>(".dropdown__menu")
      .forEach(m => (m.style.display = "none"))
    menu.style.display = isOpen ? "none" : "block"
  })

  menu.addEventListener("click", e => {
    const target = (e.target as HTMLElement).closest("a[data-value]")
    if (!target) return

    const value = target.getAttribute("data-value") ?? ""
    const label =
      cfg.options.find(o => o.value === value)?.label ?? value

    // Update button label
    labelText.setAttribute("data-value", value)
    labelText.textContent = label

    // Update selected state on <li>
    menu.querySelectorAll("li").forEach(li => {
      li.querySelector("a")?.removeAttribute("data-selected")
    })
    target.setAttribute("data-selected", "true")

    menu.style.display = "none"
    cfg.onChange?.(value)
  })

  // Close on outside click
  document.addEventListener("click", () => {
    menu.style.display = "none"
  })

  combobox.appendChild(button)
  combobox.appendChild(tooltip)
  combobox.appendChild(menu)

  // Hint + validation (hidden, mirrors site structure)
  const hint = document.createElement("div")
  hint.className = "hint text-hint"
  hint.style.display = "none"

  const validation = document.createElement("div")
  validation.className = "validation"
  validation.style.display = "none"

  formControl.appendChild(combobox)
  formItem.appendChild(labelSpan)
  formItem.appendChild(formControl)
  formItem.appendChild(hint)
  formItem.appendChild(validation)
  cell.appendChild(formItem)

  return cell
}

// ── Injection ─────────────────────────────────────────────────────────────────

function injectDiveFilter() {
  // Guard: only inject once
  if (document.getElementById("plasmo-dive-filter-cell")) return

  // The HBox is the display:table div that wraps Gender / Age / Attached cells
  const hbox = document.querySelector<HTMLElement>(
    "#athleteFilerArea [data-render='active.fnd.arch.layouts.HBox']"
  )
  if (!hbox) return

  // The last real filter cell is the Attached combobox cell
  const attachedCell = document
    .getElementById("attacheStatusCombobox")
    ?.closest<HTMLElement>("div[style*='table-cell']")
  if (!attachedCell) return

  const diveCell = buildComboboxCell({
    cellId: "plasmo-dive-filter-cell",
    label: "Dive Cert.",
    comboboxId: "plasmo-diveCertCombobox",
    width: 140,
    options: [
      { value: "ALL",   label: "All",           selected: true },
      { value: "TRUE",  label: "Certified" },
      { value: "FALSE", label: "Uncertified" }
    ],
    onChange(value) {
      // Hook into whatever filter mechanism the page exposes.
      // The page stores filter state on window and re-renders via its
      // own event bus — emit the same custom event other filters use.
      const detail = { field: "diveCertified", value }
      document.dispatchEvent(
        new CustomEvent("plasmo:peopleDiveFilter", { detail })
      )

      // If the page uses a global filter object (common in ActiveWorks):
      // (window as any).peopleFilter?.set("diveCertified", value)
    }
  })

  // Insert after the Attached cell, before the age-validation message cell
  const validationCell = attachedCell.nextElementSibling
  if (validationCell) {
    hbox.insertBefore(diveCell, validationCell)
  } else {
    hbox.appendChild(diveCell)
  }

  console.log("[inlinePeople] Dive Cert. filter injected ✓")
}

// ── Boot ──────────────────────────────────────────────────────────────────────

/**
 * The People page renders its content asynchronously via Vue/require.js.
 * Poll until the HBox filter row is present, then inject once.
 */
function waitAndInject(retries = 40, intervalMs = 300) {
  const hbox = document.querySelector(
    "#athleteFilerArea [data-render='active.fnd.arch.layouts.HBox']"
  )
  if (hbox) {
    injectDiveFilter()
    return
  }
  if (retries > 0) {
    setTimeout(() => waitAndInject(retries - 1, intervalMs), intervalMs)
  } else {
    console.warn("[inlinePeople] Timed out waiting for athlete filter HBox.")
  }
}

// Re-inject if the page navigates SPA-style (hash change / pushState)
window.addEventListener("hashchange", () => waitAndInject())
window.addEventListener("popstate",   () => waitAndInject())

waitAndInject()