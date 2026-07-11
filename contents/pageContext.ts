import type { PlasmoCSConfig } from "plasmo"

// Must run in the MAIN world: an ISOLATED content script has its own
// window.fetch/XMLHttpRequest, so it never sees requests the page itself makes.
export const config: PlasmoCSConfig = {
  matches: ["*://sports.active.com/*"],
  run_at: "document_start",
  world: "MAIN"
}

const CSRF_HEADER_NAMES = ["aws-csrftoken"]
const CSRF_DATA_ATTR = "qolCsrf"
const AGENCY_ID_DATA_ATTR = "qolAgencyId"

function matchesCSRFHeader(name: string) {
  return CSRF_HEADER_NAMES.includes(name.toLowerCase())
}

function findCSRFInHeaders(
  headers: HeadersInit | undefined
): string | undefined {
  if (!headers) return undefined

  if (headers instanceof Headers) {
    for (const name of CSRF_HEADER_NAMES) {
      const value = headers.get(name)
      if (value) return value
    }
    return undefined
  }

  if (Array.isArray(headers)) {
    const found = headers.find(([name]) => matchesCSRFHeader(name))
    return found?.[1]
  }

  const key = Object.keys(headers).find(matchesCSRFHeader)
  return key ? (headers as Record<string, string>)[key] : undefined
}

// The site's own service calls carry the agency the user is currently
// managing as `agencyId` (sometimes nested under `request`) in the JSON
// body. Sniffing it here means we never have to hardcode -- or figure out
// how to read -- one specific club's ID.
function findAgencyIdInBody(body: unknown): number | undefined {
  if (typeof body !== "string") return undefined

  try {
    const parsed = JSON.parse(body)
    const candidate = parsed?.agencyId ?? parsed?.request?.agencyId
    return typeof candidate === "number" ? candidate : undefined
  } catch {
    return undefined
  }
}

function publishToDataset(attr: string, value: string) {
  if (document.documentElement.dataset[attr] === value) return
  document.documentElement.dataset[attr] = value
}

// Hook fetch (covers most of the page's own AJAX calls)
const originalFetch = window.fetch
window.fetch = async (...args) => {
  const [, options] = args as [RequestInfo | URL, RequestInit | undefined]

  const token = findCSRFInHeaders(options?.headers)
  if (token) publishToDataset(CSRF_DATA_ATTR, token)

  const agencyId = findAgencyIdInBody(options?.body)
  if (agencyId) publishToDataset(AGENCY_ID_DATA_ATTR, String(agencyId))

  return originalFetch(...args)
}

// Hook XHR too, in case the page issues requests via XMLHttpRequest (e.g. jQuery.ajax)
const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader
XMLHttpRequest.prototype.setRequestHeader = function (
  name: string,
  value: string
) {
  if (matchesCSRFHeader(name)) publishToDataset(CSRF_DATA_ATTR, value)
  return originalSetRequestHeader.call(this, name, value)
}

const originalSend = XMLHttpRequest.prototype.send
XMLHttpRequest.prototype.send = function (
  body?: Document | XMLHttpRequestBodyInit | null
) {
  const agencyId = findAgencyIdInBody(body)
  if (agencyId) publishToDataset(AGENCY_ID_DATA_ATTR, String(agencyId))
  return originalSend.call(this, body)
}

// Reads the token/id from the shared DOM (works from any world/content
// script, since MAIN and ISOLATED worlds share the DOM but not JS state).
export function getCSRF(): string | undefined {
  return document.documentElement.dataset[CSRF_DATA_ATTR]
}

export function getAgencyId(): number | undefined {
  const raw = document.documentElement.dataset[AGENCY_ID_DATA_ATTR]
  return raw ? Number(raw) : undefined
}
