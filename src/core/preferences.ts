const KEY = 'feder.appearance.dark';
export function readDarkMode() {
  try {
    return localStorage.getItem(KEY) === 'true';
  } catch {
    return false;
  }
}
export function storeDarkMode(dark: boolean) {
  try {
    localStorage.setItem(KEY, String(dark));
  } catch {
    /* The appearance remains usable if device preferences cannot be persisted. */
  }
}
