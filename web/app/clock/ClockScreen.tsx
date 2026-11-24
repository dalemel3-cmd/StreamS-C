"use client";

import { useEffect, useState } from "react";
import Stage from "@/components/Stage";
import { store } from "@/lib/tv";
import { useRotate } from "@/components/board/useRotate";
import type { Weather } from "@/lib/weather";
import type { Calendar } from "@/lib/ics";
import CalendarRoll from "./CalendarRoll";
import styles from "./clock.module.css";

const TZ = "America/Chicago";
const REFRESH_MS = 10 * 60 * 1000; // matches screens.json refreshSec
const CAL_REFRESH_MS = 2 * 60 * 1000;
const WEATHER_KEY = "clock.weather";
const CAL_KEY = "clock.calendar";

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
  // undefined = not loaded yet, null = no calendar set up (panel hidden).
  const [calendar, setCalendar] = useState<Calendar | null | undefined>(undefined);
  useRotate(20);

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

  // Protocol Zero theme was removed; clear any saved choice so the stick never sticks on it.
  useEffect(() => {
    try {
      localStorage.removeItem("clock.theme");
    } catch {}
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

  // Calendar: same pattern as weather. Cached copy first; hidden only if no calendar is set up.
  useEffect(() => {
    const cached = store.get<Calendar>(CAL_KEY);
    if (cached) setCalendar(cached);

    const load = async () => {
      try {
        const res = await fetch("/api/calendar", { cache: "no-store" });
        if (res.status === 503) {
          const body = await res.json().catch(() => ({}));
          if (body?.missing) {
            setCalendar(null);
            return;
          }
        }
        if (!res.ok) throw new Error(String(res.status));
        const data: Calendar = await res.json();
        setCalendar(data);
        store.set(CAL_KEY, data);
      } catch {
        setCalendar((prev) => (prev === undefined ? null : prev));
      }
    };
    load();
    const id = setInterval(load, CAL_REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  const showCal = Boolean(calendar);

  const clock = (
    <>
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

    </>
  );

  return (
    <Stage>
      {showCal ? (
        <div className={styles.split}>
          <div className={styles.screen}>{clock}</div>
          <aside className={styles.cal}>
            <CalendarRoll events={calendar?.events ?? []} />
          </aside>
        </div>
      ) : (
        <div className={styles.screen}>{clock}</div>
      )}
      <footer className={styles.updated}>
        {offline && <span className={styles.offline}>Offline</span>}
        {weather && <span>Updated {shortTime.format(new Date(weather.updated))}</span>}
      </footer>
    </Stage>
  );
}
