// Crossfade between screens: fade the page out, switch screens in-app (no full reload), fade back in.
// Opacity only, so the stick's GPU does the work.

export const FADE_MS = 400;
const CLASS = "leaving";

/** Fade the current screen to black; resolves when the fade has finished. */
export function fadeOut(): Promise<void> {
  document.documentElement.classList.add(CLASS);
  return new Promise((r) => setTimeout(r, FADE_MS));
}

/** Fade in once the new screen has painted (two frames lets its cached data render first). */
export function fadeIn() {
  requestAnimationFrame(() =>
    requestAnimationFrame(() =>
      document.documentElement.classList.remove(CLASS),
    ),
  );
}
