// Contract between screens and the HPD TV Android shell.
// The shell calls window.masonTv.onOk() when the remote's center button is pressed,
// onBack() for Back, and onStep(delta) for Left/Right so manual browsing stays in sync
// with in-app rotation and respects Off screens.

type MasonTvHooks = {
  onOk?: () => void;
  onBack?: () => boolean;
  onStep?: (delta: number) => boolean;
};

declare global {
  interface Window {
    masonTv?: MasonTvHooks;
    // Native bridge injected by the APK (absent in a desktop browser).
    MasonTV?: {
      nextScreen(): void;
      prevScreen(): void;
      syncPath?(path: string): void;
      getDeviceName(): string;
    };
  }
}

// One OK / Back / Step dispatcher for the whole app: the settings menu (when open)
// gets OK and Back first, otherwise the active screen does.
let pageOk: (() => void) | null = null;
let menuOk: (() => void) | null = null;
let menuBack: (() => void) | null = null;
let stepHandler: ((delta: number) => boolean) | null = null;
let installed = false;

function dispatchOk() {
  if (menuOk) menuOk();
  else pageOk?.();
}

function dispatchBack(): boolean {
  if (menuBack) {
    menuBack();
    return true;
  }
  return false;
}

function dispatchStep(delta: number): boolean {
  return stepHandler ? stepHandler(delta) : false;
}

function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.masonTv = {
    ...(window.masonTv ?? {}),
    onOk: dispatchOk,
    onBack: dispatchBack,
    onStep: dispatchStep,
  };
  // In a desktop browser, Enter does the same thing as OK.
  window.addEventListener("keydown", (e) => {
    if (e.key === "Enter") dispatchOk();
  });
}

/** Register the screen's OK-button handler. Returns a cleanup fn. */
export function onOk(handler: () => void): () => void {
  install();
  pageOk = handler;
  return () => {
    if (pageOk === handler) pageOk = null;
  };
}

/** While the settings menu is open, OK goes to it instead of the screen. */
export function setMenuOk(handler: (() => void) | null) {
  install();
  menuOk = handler;
}

/** While the settings menu is open, Back closes it instead of leaving the app. */
export function setMenuBack(handler: (() => void) | null) {
  install();
  menuBack = handler;
}

/** Register the in-app Left/Right handler used by the APK shell. */
export function setStepHandler(handler: ((delta: number) => boolean) | null) {
  install();
  stepHandler = handler;
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
