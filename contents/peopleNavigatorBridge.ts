import type { PlasmoCSConfig } from "plasmo"

// Runs in the page's own JS world (unlike the rest of our content scripts,
// which are sandboxed) so it can reach window.active directly. inlinePeople.tsx
// can't call active.navigator.navigate itself -- it's isolated from the page --
// so it dispatches NAVIGATE_EVENT on the shared DOM and this script does the
// actual call, exactly like the site's own peopleDetail links do.
export const config: PlasmoCSConfig = {
  matches: ["*://sports.active.com/*"],
  world: "MAIN",
  run_at: "document_start"
}

export const NAVIGATE_EVENT = "qol-navigate-people-detail"

// The site's own global namespace object (window.active), typed just enough
// to cover the one call we make into it.
declare global {
  interface Window {
    active?: {
      navigator?: {
        navigate: (path: string, params: Record<string, unknown>) => void
      }
    }
  }
}

window.addEventListener(NAVIGATE_EVENT, ((e: CustomEvent<{ spid: string }>) => {
  const spid = e.detail?.spid
  if (!spid) return

  window.active?.navigator?.navigate("/active/swimming/people/peopleDetail", {
    spid,
    from: "peopleHome"
  })
}) as EventListener)
