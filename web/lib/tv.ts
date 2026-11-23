// Contract between screens and the Mason TV Android shell.
// The shell calls window.masonTv.onOk() when the remote's center button is pressed.

type MasonTvHooks = { onOk?: () => void };

declare global {
  interface Window {
    masonTv?: MasonTvHooks;
    // Native bridge injected by the APK (absent in a desktop browser).
    MasonTV?: { nextScreen(): void; prevScreen(): void; getDeviceName(): string };
  }
}

/** Register the OK-button handler. In a desktop browser, Enter does the same thing. Returns a cleanup fn. */
export function onOk(handler: () => void): () => void {
  window.masonTv = { ...(window.masonTv ?? {}), onOk: handler };
  const key = (e: KeyboardEvent) => {
    if (e.key === "Enter") handler();
  };
  window.addEventListener("keydown", key);
  return () => {
    window.removeEventListener("keydown", key);
    if (window.masonTv?.onOk === handler) delete window.masonTv.onOk;
  };
}

/** Read/write localStorage without throwing (private mode, quota, etc.). */
export const store = {
  get<T>(key: string): T | null {
    try {
      const v = localStorage.getItem(key);
      return v ? (JSON.parse(v) as T) : null;
    } catch {
      return null;
    }
  },
  set(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  },
};
