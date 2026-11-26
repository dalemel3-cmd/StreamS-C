"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { goNext } from "@/components/board/useRotate";
import { type Board, sportsIn } from "@/lib/board";
import type { PollResponse, RemoteCommand, TvStatus } from "@/lib/remote";
import { isLocked, setLocked } from "@/lib/rotateLock";
import {
  loadScreens,
  loadSeconds,
  loadSettings,
  modeOf,
  saveSeconds,
  saveSettings,
  stepScreenPath,
  withMode,
} from "@/lib/screenSettings";
import { readSport, writeSport } from "@/lib/sportFilter";
import { store } from "@/lib/tv";

const FAST_MS = 2_000; // while the web remote is open
const IDLE_MS = 15_000; // otherwise
const ERROR_MS = 30_000;
const BUILD = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
const FLAG = "remote.listen";

type Router = ReturnType<typeof useRouter>;

/** Only the TV app listens (the APK injects window.MasonTV). `?remote=1` turns it on in a browser for testing. */
function shouldListen(): boolean {
  try {
    if (new URLSearchParams(location.search).get("remote") === "1")
      sessionStorage.setItem(FLAG, "1");
    return Boolean(window.MasonTV) || sessionStorage.getItem(FLAG) === "1";
  } catch {
    return Boolean(window.MasonTV);
  }
}

function status(): TvStatus {
  let device = "Browser";
  try {
    device = window.MasonTV?.getDeviceName() || "HPD TV";
  } catch {}
  return {
    path: location.pathname,
    locked: isLocked(),
    sport: readSport(),
    sports: sportsIn(store.get<Board>("board.data")),
    seconds: loadSeconds(),
    settings: loadSettings(),
    device,
    build: BUILD,
  };
}

async function run(cmd: RemoteCommand, router: Router) {
  const markAdvance = () => {
    try {
      sessionStorage.setItem("rotate.last", String(Date.now()));
    } catch {}
  };
  switch (cmd.type) {
    case "go":
      markAdvance();
      await goNext(router, cmd.path);
      break;
    case "step": {
      const screens = await loadScreens();
      const target = stepScreenPath(screens, location.pathname, cmd.delta);
      markAdvance();
      if (target) await goNext(router, target);
      break;
    }
    case "ok":
      window.masonTv?.onOk?.();
      break;
    case "lock":
      setLocked(cmd.on);
      break;
    case "sport":
      writeSport(cmd.value);
      break;
    case "seconds":
      saveSeconds(cmd.value);
      break;
    case "mode": {
      const screens = await loadScreens();
      const next = withMode(screens, loadSettings(), cmd.path, cmd.mode);
      saveSettings(next);
      // Same as closing the Down menu: show a stand-alone screen now, or leave a screen just turned off.
      const only = screens.find((s) => modeOf(s, next) === "only");
      const here = screens.find((s) => s.path === location.pathname);
      if (only) await goNext(router, only.path);
      else if (here && modeOf(here, next) === "off") await goNext(router);
      break;
    }
    case "reload":
      location.reload();
      break;
  }
}

/** TV side of the web remote (/remote): reports status and runs queued commands. */
export default function RemoteListener() {
  const router = useRouter();

  useEffect(() => {
    if (!shouldListen()) return;
    let since: number | null = null;
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;

    const tick = async () => {
      let wait = IDLE_MS;
      try {
        const res = await fetch("/api/remote/poll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ since, status: status() }),
          cache: "no-store",
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) throw new Error(`poll ${res.status}`);
        const data = (await res.json()) as PollResponse;
        const first = since === null;
        since = data.last;
        wait = data.fast ? FAST_MS : IDLE_MS;
        if (!first && data.commands.length) {
          for (const { cmd } of data.commands) {
            try {
              await run(cmd, router);
            } catch (err) {
              console.warn("remote command failed", cmd, err);
            }
          }
          wait = 600; // report the new state right away
        }
      } catch {
        wait = ERROR_MS;
      }
      if (!stopped) timer = setTimeout(tick, wait);
    };

    void tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [router]);

  return null;
}
