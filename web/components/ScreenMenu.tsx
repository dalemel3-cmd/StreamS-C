"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { setMenuBack, setMenuOk, store } from "@/lib/tv";
import { goNext } from "@/components/board/useRotate";
import { type Board, sportsIn } from "@/lib/board";
import { readSport, writeSport } from "@/lib/sportFilter";
import {
  MODE_LABEL,
  NEXT_MODE,
  type Mode,
  type ScreenEntry,
  loadScreens,
  SECONDS_STEPS,
  loadSeconds,
  loadSettings,
  modeOf,
  saveSeconds,
  secondsLabel,
  saveSettings,
  setMenuOpen,
  withMode,
} from "@/lib/screenSettings";

const IDLE_CLOSE_MS = 30 * 1000;
const BOARD_CACHE_KEY = "board.data";

/**
 * Screen settings. Down opens it. Up/Down move, OK changes the highlighted item:
 *   row 0 = Seconds per screen (Default/10/15/20/30/45/60/90 s)
 *   row 1 = Sport filter (All sports / individual sports)
 *   rows 2..n+1 = screens (In rotation -> Stand-alone -> Off)
 *   row n+2 = Done
 * OK on Done, Back/Escape, or 30 s idle closes it.
 */
export default function ScreenMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [screens, setScreens] = useState<ScreenEntry[]>([]);
  const [settings, setSettings] = useState<Record<string, Mode>>({});
  const [seconds, setSeconds] = useState<number | null>(null);
  const [sports, setSports] = useState<string[]>([]);
  const [sport, setSport] = useState<string | null>(null);
  // Rows: 0 = seconds per screen, 1 = sport filter, 2..n+1 = screens, n+2 = Done.
  const [sel, setSel] = useState(0);
  const state = useRef({ open, screens, settings, sel, seconds, sports, sport });
  state.current = { open, screens, settings, sel, seconds, sports, sport };
  const idle = useRef<ReturnType<typeof setTimeout>>(undefined);

  const close = () => {
    setOpen(false);
    setMenuOpen(false);
    setMenuOk(null);
    setMenuBack(null);
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
    const { screens, settings, sel, seconds, sports, sport } = state.current;
    touch();
    if (sel === 0) {
      const next =
        SECONDS_STEPS[
          (SECONDS_STEPS.indexOf(seconds) + 1) % SECONDS_STEPS.length
        ];
      setSeconds(next);
      saveSeconds(next);
      return;
    }
    if (sel === 1) {
      const order: (string | null)[] = [null, ...sports];
      const next = order[(order.indexOf(sport) + 1) % order.length] ?? null;
      setSport(next);
      writeSport(next);
      return;
    }
    if (sel >= screens.length + 2) return close();
    const s = screens[sel - 2];
    if (!s) return close();
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
              const cachedBoard = store.get<Board>(BOARD_CACHE_KEY);
              const availSports = sportsIn(cachedBoard);
              const curSport = readSport();
              setScreens(list);
              setSettings(loadSettings());
              setSeconds(loadSeconds());
              setSports(availSports);
              setSport(
                curSport && availSports.includes(curSport) ? curSport : null,
              );
              const here = list.findIndex((s) => s.path === location.pathname);
              setSel(here >= 0 ? here + 2 : 0);
              setOpen(true);
              setMenuOpen(true);
              setMenuOk(press);
              setMenuBack(close);
              touch();
            })
            .catch(() => {});
        }
        return;
      }
      // Menu open: it owns Up/Down (so Up doesn't toggle the lock) and Escape.
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        e.stopImmediatePropagation();
        touch();
        const rows = screens.length + 3;
        setSel((i) => (i + (e.key === "ArrowDown" ? 1 : -1) + rows) % rows);
      } else if (e.key === "Escape") {
        e.stopImmediatePropagation();
        close();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKey, { capture: true });
      clearTimeout(idle.current);
      setMenuOk(null);
      setMenuBack(null);
      setMenuOpen(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!open) return null;
  return (
    <div className="menuBackdrop">
      <div className="menu">
        <div className="menuTitle">Screens</div>
        <div className="menuHint">Up/Down: choose · OK: change · Back: close</div>
        <ul>
          <li className={sel === 0 ? "menuSel" : undefined}>
            <span>Seconds per screen</span>
            <span className="menuMode menuMode-only">
              {secondsLabel(seconds)}
            </span>
          </li>
          <li className={sel === 1 ? "menuSel" : undefined}>
            <span>Sport filter</span>
            <span
              className={`menuMode ${sport ? "menuMode-only" : "menuMode-on"}`}
            >
              {sport ?? "All sports"}
            </span>
          </li>
          {screens.map((s, i) => {
            const mode = modeOf(s, settings);
            return (
              <li
                key={s.path}
                className={i + 2 === sel ? "menuSel" : undefined}
              >
                <span>{s.title ?? s.name}</span>
                <span className={`menuMode menuMode-${mode}`}>
                  {MODE_LABEL[mode]}
                </span>
              </li>
            );
          })}
          <li
            className={
              sel === screens.length + 2 ? "menuSel menuDone" : "menuDone"
            }
          >
            <span>Done</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
