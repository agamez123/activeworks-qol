import type { PlasmoCSConfig } from "plasmo"

import { DARK_MODE_STORAGE_KEY } from "~lib/storage"

export const config: PlasmoCSConfig = {
  matches: ["*://sports.active.com/*"],
  run_at: "document_start"
}

const STYLE_ID = "qol-dark-mode"
const TRANSITION_STYLE_ID = "qol-dark-mode-transition"
const ROW_STRIPE_STYLE_ID = "qol-row-stripe"

// Row striping for readability - kept in its own never-removed style tag so
// it applies in light mode too. The dark-mode stylesheet's own row rules are
// injected after this one, so they win the cascade whenever dark mode is on.
const rowStripeCss = `
  tbody tr:nth-child(even) td {
    background-color: #f0f0f0 !important;
  }
`

// Kept in a separate, never-removed style tag so the fade survives
// toggling the main dark-mode stylesheet on/off. Scoped to the exact
// selectors the dark-mode css touches (a universal "*" selector forces the
// browser to repaint every element on every frame, which is what caused
// the jank).
const transitionCss = `
  html,
  body,
  h1, h2, h3, h4, h5, h6,
  label,
  .checkbox,
  .dropdown__button,
  .dropdown__button-text,
  .active-swimming-components-BaseInput,
  .form__instruction,
  .form__label,
  .table,
  tbody > tr > td,
  .viewlabel,
  #tableTitle,
  #headerText,
  #programDetail,
  .item-header,
  .athlete-info,
  a,
  .fndArch-LinkBlueOnLightGray,
  .btn,
  input,
  select,
  textarea,
  .dropdown__menu,
  .dropdown__menu li,
  .dropdown__menu li a,
  #athleteFilerArea,
  .odd,
  tbody tr,
  tbody tr.selected,
  .sidebar a,
  .pagination > li > span {
    transition: background-color 0.15s ease-in-out, color 0.15s ease-in-out, border-color 0.15s ease-in-out !important;
  }
`

const css = `
  :root {
    --qol-bg: #1e1e1e;
    --qol-bg-alt: #222222;
    --qol-bg-elevated: #2a2a2a;
    --qol-bg-hover: #33475a;
    --qol-border: #444444;
    --qol-text: #e4e4e4;
    --qol-link: #4dbde9;
  }

  html,
  body {
    background-color: var(--qol-bg) !important;
    color: var(--qol-text) !important;
  }

  /* Text hardcoded to dark grays/black by the site's own CSS */
  h1, h2, h3, h4, h5, h6,
  label,
  .checkbox,
  .dropdown__button,
  .dropdown__button-text,
  .active-swimming-components-BaseInput,
  .form__instruction,
  .form__label,
  .table,
  tbody > tr > td,
  .viewlabel,
  #tableTitle,
  #headerText,
  #programDetail,
  .item-header,
  .athlete-info {
    color: var(--qol-text) !important;
  }

  a,
  .fndArch-LinkBlueOnLightGray {
    color: var(--qol-link) !important;
  }

  /* Buttons, inputs, selects that default to light backgrounds */
  .btn,
  input,
  select,
  textarea,
  .dropdown__button {
    background-color: var(--qol-bg-elevated) !important;
    background-image: none !important;
    color: var(--qol-text) !important;
    border-color: var(--qol-border) !important;
  }

  /* Dropdown / combobox menus */
  .dropdown__menu,
  .dropdown__menu li {
    background-color: var(--qol-bg-elevated) !important;
    color: var(--qol-text) !important;
  }

  .dropdown__menu li a {
    color: var(--qol-text) !important;
  }

  .dropdown__menu li:hover {
    background-color: var(--qol-bg-hover) !important;
  }

  #athleteFilerArea {
    background-color: var(--qol-bg-alt) !important;
    background-image: none !important;
  }

  /* Data grid rows - alternate shading for row scannability */
  .odd,
  tbody tr:nth-child(odd) td,
  tbody tr:last-child td {
    background-color: var(--qol-bg-alt) !important;
  }

  tbody tr:nth-child(even) td {
    background-color: var(--qol-bg) !important;
  }

  .table-hover tbody tr:hover,
  tbody tr:hover {
    background-color: var(--qol-bg-hover) !important;
    color: var(--qol-text) !important;
  }

  tbody tr.selected {
    background-color: #244b57 !important;
    color: var(--qol-text) !important;
  }

  /* Left nav / FAQ sidebar links */
  .sidebar a {
    background-color: var(--qol-bg-elevated) !important;
    color: var(--qol-text) !important;
  }

  /* Pagination */
  .pagination > li > span {
    background-color: var(--qol-bg-elevated) !important;
    border-color: var(--qol-border) !important;
    color: var(--qol-link) !important;
  }

  .pagination > li > span:hover {
    background-color: var(--qol-bg-hover) !important;
  }
`

// Optimistically on so there's no flash-of-light for the common case;
// corrected as soon as storage resolves if the user has disabled it.
let darkModeEnabled = true

function injectTransitionStyle() {
  if (document.getElementById(TRANSITION_STYLE_ID)) return

  const style = document.createElement("style")
  style.id = TRANSITION_STYLE_ID
  style.textContent = transitionCss
  ;(document.head || document.documentElement).appendChild(style)
}

function injectRowStripeStyle() {
  if (document.getElementById(ROW_STRIPE_STYLE_ID)) return

  const style = document.createElement("style")
  style.id = ROW_STRIPE_STYLE_ID
  style.textContent = rowStripeCss
  ;(document.head || document.documentElement).appendChild(style)
}

function injectStyle() {
  injectRowStripeStyle()
  injectTransitionStyle()

  if (document.getElementById(STYLE_ID)) return

  const style = document.createElement("style")
  style.id = STYLE_ID
  style.textContent = css
  ;(document.head || document.documentElement).appendChild(style)
}

function removeStyle() {
  document.getElementById(STYLE_ID)?.remove()
}

function applyDarkMode() {
  if (darkModeEnabled) injectStyle()
}

applyDarkMode()

chrome.storage.sync.get([DARK_MODE_STORAGE_KEY], (result) => {
  darkModeEnabled = result[DARK_MODE_STORAGE_KEY] ?? true

  if (darkModeEnabled) {
    applyDarkMode()
  } else {
    removeStyle()
  }
})

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync" || !changes[DARK_MODE_STORAGE_KEY]) return

  darkModeEnabled = changes[DARK_MODE_STORAGE_KEY].newValue ?? true

  if (darkModeEnabled) {
    applyDarkMode()
  } else {
    removeStyle()
  }
})

// Re-apply if the site's own bootstrap process rebuilds the document
// and drops our injected stylesheet.
const observer = new MutationObserver(() => applyDarkMode())
observer.observe(document.documentElement, {
  childList: true,
  subtree: true
})

window.addEventListener("hashchange", applyDarkMode)
