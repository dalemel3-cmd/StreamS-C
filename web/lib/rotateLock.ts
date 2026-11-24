// Up on the remote locks auto-rotation on the current screen (and any screen you
// move to with left/right) until Up is pressed again or the app is relaunched.
const KEY = "rotate.locked";
export const LOCK_EVENT = "rotate-lock";

export function isLocked(): boolean {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setLocked(locked: boolean) {
  try {
    if (locked) sessionStorage.setItem(KEY, "1");
    else sessionStorage.removeItem(KEY);
  } catch {}
  window.dispatchEvent(new CustomEvent(LOCK_EVENT, { detail: locked }));
}
