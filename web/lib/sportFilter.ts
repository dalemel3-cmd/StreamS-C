// Active sport filter for this app run (sessionStorage), shared by all board screens
// and the Down settings menu so either control updates the screen immediately.

const KEY = "board.sport";
export const SPORT_EVENT = "board-sport";

export function readSport(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function writeSport(v: string | null) {
  try {
    if (v) sessionStorage.setItem(KEY, v);
    else sessionStorage.removeItem(KEY);
  } catch {}
  window.dispatchEvent(new CustomEvent(SPORT_EVENT, { detail: v }));
}

export function clearLegacySport() {
  try {
    localStorage.removeItem(KEY); // older builds saved it permanently
  } catch {}
}
