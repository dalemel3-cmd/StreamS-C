"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RemoteCommand, StatusResponse } from "@/lib/remote";
import {
  MODE_LABEL,
  SECONDS_STEPS,
  type Mode,
  type ScreenEntry,
  secondsLabel,
} from "@/lib/screenSettings";
import s from "./remote.module.css";

const STATUS_MS = 3_000;
// The TV checks every 15 s normally and every 2 s while this page is open (after its next check).
const ONLINE_WITHIN_MS = 45_000;

function ago(ms: number): string {
  const sec = Math.max(0, Math.round(ms / 1000));
  if (sec < 60) return `${sec} sec ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  return hr < 48 ? `${hr} hr ago` : `${Math.round(hr / 24)} days ago`;
}

export default function RemoteApp() {
  const [screens, setScreens] = useState<ScreenEntry[]>([]);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [statusErr, setStatusErr] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    fetch("/screens.json", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { screens: ScreenEntry[] }) => setScreens(d.screens ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const load = async () => {
      try {
        const res = await fetch("/api/remote/status", { cache: "no-store" });
        if (res.status === 401) return location.reload();
        if (!res.ok) throw new Error();
        setStatus((await res.json()) as StatusResponse);
        setStatusErr(false);
      } catch {
        setStatusErr(true);
      }
      if (!stopped) timer = setTimeout(load, STATUS_MS);
    };
    void load();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);

  const flash = (text: string) => {
    setNote(text);
    clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setNote(null), 4000);
  };

  const send = useCallback(async (cmd: RemoteCommand, label: string) => {
    try {
      const res = await fetch("/api/remote/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cmd),
      });
      if (res.status === 401) return location.reload();
      if (!res.ok) throw new Error();
      flash(`Sent: ${label}`);
    } catch {
      flash(`Couldn't send: ${label}`);
    }
  }, []);

  const tv = status?.tv ?? null;
  const seenMs =
    status?.tv_seen_at && status.now
      ? Date.parse(status.now) - Date.parse(status.tv_seen_at)
      : null;
  const online = seenMs !== null && seenMs < ONLINE_WITHIN_MS;
  const current = screens.find((x) => x.path === tv?.path);
  const modeOf = (x: ScreenEntry): Mode =>
    tv?.settings?.[x.path] ?? x.default ?? "on";

  // Computer keyboard: Left/Right = prev/next, Up = lock toggle, Enter = OK.
  const lockedRef = useRef(false);
  lockedRef.current = Boolean(tv?.locked);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "BUTTON")) return;
      if (e.key === "ArrowLeft") void send({ type: "step", delta: -1 }, "Previous");
      else if (e.key === "ArrowRight") void send({ type: "step", delta: 1 }, "Next");
      else if (e.key === "ArrowUp") {
        e.preventDefault();
        const on = !lockedRef.current;
        void send({ type: "lock", on }, on ? "Lock" : "Unlock");
      } else if (e.key === "Enter") void send({ type: "ok" }, "OK");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [send]);

  const signOut = async () => {
    await fetch("/api/remote/logout", { method: "POST" }).catch(() => {});
    location.reload();
  };

  return (
    <main className={s.root}>
      <div className={s.wrap}>
        <header className={s.header}>
          <div>
            <div className={s.brand}>HPD TV</div>
            <h1 className={s.title}>Remote</h1>
          </div>
          <div className={`${s.pill} ${online ? s.pillOn : s.pillOff}`}>
            <span className={s.dot} />
            {statusErr && !status
              ? "Can't reach server"
              : seenMs === null
                ? "TV hasn't checked in yet"
                : online
                  ? `TV online · ${ago(seenMs)}`
                  : `TV offline · last seen ${ago(seenMs)}`}
          </div>
        </header>

        <section className={s.now}>
          <div className={s.label}>On the TV now</div>
          <div className={s.nowTitle}>
            {current?.title ?? tv?.path ?? "Unknown"}
          </div>
          <div className={s.nowMeta}>
            {tv?.locked ? "Locked" : "Rotating"} ·{" "}
            {tv?.sport ?? "All sports"} · {secondsLabel(tv?.seconds ?? null)}
            {tv?.device ? ` · ${tv.device}` : ""}
          </div>
          <div className={s.pad}>
            <button
              className={s.big}
              onClick={() => send({ type: "step", delta: -1 }, "Previous")}
            >
              ‹ Prev
            </button>
            <button
              className={`${s.big} ${tv?.locked ? s.active : ""}`}
              onClick={() =>
                send(
                  { type: "lock", on: !tv?.locked },
                  tv?.locked ? "Unlock" : "Lock",
                )
              }
            >
              {tv?.locked ? "Unlock" : "Lock"}
            </button>
            <button
              className={s.big}
              onClick={() => send({ type: "step", delta: 1 }, "Next")}
            >
              Next ›
            </button>
          </div>
          <div className={s.row}>
            <button className={s.btn} onClick={() => send({ type: "ok" }, "OK")}>
              OK button
            </button>
            <button
              className={s.btn}
              onClick={() => send({ type: "reload" }, "Reload")}
            >
              Reload TV page
            </button>
          </div>
          <p className={s.hint}>
            Keyboard: ← → change screen · ↑ lock · Enter = OK. The TV picks up
            commands within a few seconds (up to 15 sec right after you open
            this page).
          </p>
        </section>

        <section className={s.card}>
          <h2 className={s.h2}>Go to screen</h2>
          <div className={s.grid}>
            {screens.map((x) => (
              <button
                key={x.path}
                className={`${s.btn} ${x.path === tv?.path ? s.active : ""} ${
                  modeOf(x) === "off" ? s.dim : ""
                }`}
                onClick={() =>
                  send({ type: "go", path: x.path }, x.title ?? x.name)
                }
              >
                {x.title ?? x.name}
              </button>
            ))}
          </div>
        </section>

        <section className={s.card}>
          <h2 className={s.h2}>Sport filter</h2>
          <div className={s.chips}>
            {[null, ...(tv?.sports ?? [])].map((sp) => (
              <button
                key={sp ?? "all"}
                className={`${s.chip} ${(tv?.sport ?? null) === sp ? s.active : ""}`}
                onClick={() =>
                  send({ type: "sport", value: sp }, sp ?? "All sports")
                }
              >
                {sp ?? "All sports"}
              </button>
            ))}
          </div>
        </section>

        <section className={s.card}>
          <h2 className={s.h2}>Seconds per screen</h2>
          <div className={s.chips}>
            {SECONDS_STEPS.map((v) => (
              <button
                key={v ?? "default"}
                className={`${s.chip} ${(tv?.seconds ?? null) === v ? s.active : ""}`}
                onClick={() =>
                  send({ type: "seconds", value: v }, secondsLabel(v))
                }
              >
                {secondsLabel(v)}
              </button>
            ))}
          </div>
        </section>

        <section className={s.card}>
          <h2 className={s.h2}>Rotation</h2>
          <ul className={s.list}>
            {screens.map((x) => {
              const mode = modeOf(x);
              return (
                <li key={x.path} className={s.listRow}>
                  <span className={s.listName}>{x.title ?? x.name}</span>
                  <span className={s.seg}>
                    {(["on", "only", "off"] as Mode[]).map((m) => (
                      <button
                        key={m}
                        className={`${s.segBtn} ${mode === m ? s.active : ""}`}
                        onClick={() =>
                          send(
                            { type: "mode", path: x.path, mode: m },
                            `${x.title ?? x.name}: ${MODE_LABEL[m]}`,
                          )
                        }
                      >
                        {MODE_LABEL[m]}
                      </button>
                    ))}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <details className={s.card}>
          <summary className={s.h2}>TV offline or no remote?</summary>
          <div className={s.help}>
            <p>
              This page only works while the TV has internet. If the TV shows
              &ldquo;Reconnecting…&rdquo; or this page says offline, it isn&apos;t
              on Wi-Fi.
            </p>
            <ol>
              <li>
                <b>Hotspot trick:</b> turn on your phone hotspot with the same
                name and password as the Wi-Fi the stick knows. It joins on
                its own in about a minute.
              </li>
              <li>
                <b>Google TV phone app:</b> the Google TV app on your phone has
                a remote. Phone and stick must be on the same Wi-Fi (the
                hotspot works).
              </li>
              <li>
                <b>From a computer on the same network:</b>{" "}
                <code>adb connect 192.168.0.253:5555</code>, then{" "}
                <code>scrcpy</code> to see and click the TV screen, or{" "}
                <code>adb shell am start -a android.settings.WIFI_SETTINGS</code>{" "}
                to open Wi-Fi settings. The IP changes on other networks: check
                your hotspot&apos;s connected devices.
              </li>
              <li>
                <b>Last resort:</b> a USB-C hub with power pass-through lets you
                plug a USB keyboard or mouse into the stick and use it as a
                remote.
              </li>
            </ol>
          </div>
        </details>

        <footer className={s.footer}>
          <button className={s.link} onClick={signOut}>
            Sign out
          </button>
        </footer>
      </div>
      {note && <div className={s.toast}>{note}</div>}
    </main>
  );
}
