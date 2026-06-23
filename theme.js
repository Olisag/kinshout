const DISPLAY_MODE_KEY = "kinshout_display_mode";

export function getStoredDisplayMode() {
  const mode = localStorage.getItem(DISPLAY_MODE_KEY);
  return mode === "sombre" ? "sombre" : "clair";
}

export function applyDisplayMode(mode) {
  const normalized = mode === "sombre" ? "sombre" : "clair";
  document.documentElement.dataset.theme = normalized;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = normalized === "sombre" ? "#0f1419" : "#ffffff";
  localStorage.setItem(DISPLAY_MODE_KEY, normalized);
  return normalized;
}

export function initDisplayModeFromStorage() {
  applyDisplayMode(getStoredDisplayMode());
}
