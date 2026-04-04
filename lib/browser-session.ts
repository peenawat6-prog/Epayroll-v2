const BROWSER_SESSION_KEY = "epayroll-browser-session-active"

export function markBrowserSessionActive() {
  if (typeof window === "undefined") {
    return
  }

  window.sessionStorage.setItem(BROWSER_SESSION_KEY, "1")
}

export function clearBrowserSessionMarker() {
  if (typeof window === "undefined") {
    return
  }

  window.sessionStorage.removeItem(BROWSER_SESSION_KEY)
}

export function hasBrowserSessionMarker() {
  if (typeof window === "undefined") {
    return false
  }

  return window.sessionStorage.getItem(BROWSER_SESSION_KEY) === "1"
}
