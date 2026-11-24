"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { setMenuOk } from "@/lib/tv";
import { goNext } from "@/components/board/useRotate";
import {
  MODE_LABEL,
  NEXT_MODE,
  type Mode,
  type ScreenEntry,
  loadScreens,
  loadSettings,
  modeOf,
  saveSettings,
  setMenuOpen,
  withMode,
} from "@/lib/screenSettings";

const IDLE_CLOSE_MS = 30 * 1000;

/**
 * Screen settings. Down opens it. Up/Down move, OK changes the highlighted screen
 * (In rotation -> Stand-alone -> Off), OK on Done (or 30 s idle) closes it.
 * Left/Right belong to the app shell, so the menu doesn't use them.
 */
export default function ScreenMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [screens, setScreens] = useState<ScreenEntry[]>([]);
  const [settings, setSettings] = useState<Record<string, Mode>>({});
  const [sel, setSel] = useState(0);
  const state = useRef({ open, screens, settings, sel });
  state.current = { open, screens, settings, sel };
  const idle = useRef<ReturnType<typeof setTimeout>>(undefined);

  const close = () => {
    setOpen(false);
    setMenuOpen(false);
    setMenuOk(null);
    clearTimeout(idle.current);
    // Show the stand-alone screen right away, or move off a screen that was just turned off.
    const { screens, settings } = state.current;
    const only = screens.find((s) => modeOf(s, settings) === "only");
    const here = screens.find((s) => s.path === location.pathname);
    if (only) void goNext(router, only.path);
    else if (here && modeOf(here, settings) === "off") void goNext(router);
  };

  const touch = () => {
    clearTimeout(idle.current);
    idle.current = setTimeout(close, IDLE_CLOSE_MS);
  };

  const press = () => {
    const { screens, settings, sel } = state.current;
    touch();
    if (sel >= screens.length) return close();
    const s = screens[sel];
    const next = withMode(
      screens,
      settings,
      s.path,
      NEXT_MODE[modeOf(s, settings)],
    );
    setSettings(next);
    saveSettings(next);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { open, screens } = state.current;
      if (!open) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          e.stopImmediatePropagation();
          loadScreens()
            .then((list) => {
              setScreens(list);
              setSettings(loadSettings());
              const here = list.findIndex((s) => s.path === location.pathname);
              setSel(Math.max(here, 0));
              setOpen(true);
              setMenuOpen(true);
              setMenuOk(press);
              touch();
            })
            .catch(() => {});
        }
        return;
      }
      // Menu open: it owns Up/Down (so Up doesn't toggle the lock) and Enter.
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        e.stopImmediatePropagation();
        touch();
        const rows = screens.length + 1;
        setSel((i) => (i + (e.key === "ArrowDown" ? 1 : -1) + rows) % rows);
      } else if (e.key === "Escape") {
        e.stopImmediatePropagation();
        close();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKey, { capture: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!open) return null;
  return (
    <div className="menuBackdrop">
      <div className="menu">
        <div className="menuTitle">Screens</div>
        <div className="menuHint">Up/Down: choose · OK: change</div>
        <ul>
          {screens.map((s, i) => {
            const mode = modeOf(s, settings);
            return (
              <li key={s.path} className={i === sel ? "menuSel" : undefined}>
                <span>{s.title ?? s.name}</span>
                <span className={`menuMode menuMode-${mode}`}>
                  {MODE_LABEL[mode]}
                </span>
              </li>
            );
          })}
          <li
            className={sel === screens.length ? "menuSel menuDone" : "menuDone"}
          >
            <span>Done</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
