"use client";

import { useEffect, useState } from "react";
import Stage from "@/components/Stage";
import { onOk, store } from "@/lib/tv";
import type { Weather } from "@/lib/weather";
import styles from "./clock.module.css";

const TZ = "America/Chicago";
const REFRESH_MS = 10 * 60 * 1000; // matches screens.json refreshSec
const WEATHER_KEY = "clock.weather";
const THEME_KEY = "clock.theme";

const timeFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
const dateFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long", month: "long", day: "numeric" });
const shortTime = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });

function readNow() {
  const now = new Date();
  const parts = timeFmt.formatToParts(now);
  const hm = parts.filter((p) => p.type !== "dayPeriod").map((p) => p.value).join("").trim();
  const ampm = parts.find((p) => p.type === "dayPeriod")?.value ?? "";
  return { hm, ampm, date: dateFmt.format(now) };
}

export default function ClockScreen() {
  const [now, setNow] = useState<ReturnType<typeof readNow> | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [offline, setOffline] = useState(false);
  const [theme, setTheme] = useState<"default" | "pz">("default");

  // Clock: tick every second, but React only re-renders when the strings change.
  useEffect(() => {
    const tick = () =>
      setNow((prev) => {
        const next = readNow();
        return prev && prev.hm === next.hm && prev.date === next.date ? prev : next;
      });
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Theme: ?theme=pz wins, else last choice. OK on the remote toggles it.
  useEffect(() => {
    const q = new URLSearchParams(location.search).get("theme");
    const initial = q === "pz" || q === "default" ? q : store.get<"default" | "pz">(THEME_KEY) ?? "default";
    setTheme(initial);
    return onOk(() =>
      setTheme((t) => {
        const next = t === "pz" ? "default" : "pz";
        store.set(THEME_KEY, next);
        return next;
      }),
    );
  }, []);

  // Weather: show cache immediately, then refresh on an interval. Never blank on failure.
  useEffect(() => {
    const cached = store.get<Weather>(WEATHER_KEY);
    if (cached) setWeather(cached);

    const load = async () => {
      try {
        const res = await fetch("/api/weather", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data: Weather = await res.json();
        setWeather(data);
        setOffline(Boolean(data.stale));
        store.set(WEATHER_KEY, data);
      } catch {
        setOffline(true);
      }
    };
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  const pz = theme === "pz";

  return (
    <Stage theme={pz ? "pz" : undefined}>
      <div className={`${styles.screen} ${pz ? styles.pz : ""}`}>
        <header className={styles.date}>{now?.date ?? " "}</header>

        <main className={styles.time}>
          <span className={styles.hm}>{now?.hm ?? "--:--"}</span>
          <span className={styles.ampm}>{now?.ampm}</span>
        </main>

        <section className={styles.weather}>
          {weather ? (
            <>
              <span className={styles.temp}>{weather.tempF}°</span>
              <div className={styles.details}>
                <span className={styles.label}>{weather.label}</span>
                <span className={styles.sub}>
                  H {weather.highF}° &nbsp;·&nbsp; L {weather.lowF}° &nbsp;·&nbsp; {weather.precipPct}% rain
                </span>
              </div>
            </>
          ) : (
            <span className={`${styles.temp} ${styles.skeleton}`}>—°</span>
          )}
        </section>

        <footer className={styles.updated}>
          {pz && <span className={styles.badge}>PROTOCOL ZERO</span>}
          {offline && <span className={styles.offline}>Offline</span>}
          {weather && <span>Updated {shortTime.format(new Date(weather.updated))}</span>}
        </footer>
      </div>
    </Stage>
  );
}
