"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Stage from "@/components/Stage";
import { store } from "@/lib/tv";
import { useRotate } from "@/components/board/useRotate";
import type { Weather } from "@/lib/weather";
import type { Calendar, CalEvent } from "@/lib/ics";
import styles from "./clock.module.css";

const TZ = "America/Chicago";
const REFRESH_MS = 10 * 60 * 1000; // matches screens.json refreshSec
const WEATHER_KEY = "clock.weather";
const CAL_KEY = "clock.calendar";
const SHOW_EVENTS = 5;

const timeFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
const dateFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long", month: "long", day: "numeric" });
const shortTime = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });

const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const weekdayFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" });

/** "Today", "Tomorrow", or "Thu, Nov 27" in Chicago time. */
function dayLabel(d: Date, now: Date): string {
  const k = dayKey.format(d);
  if (k === dayKey.format(now)) return "Today";
  if (k === dayKey.format(new Date(now.getTime() + 86_400_000))) return "Tomorrow";
  return weekdayFmt.format(d);
}

function whenLabel(e: CalEvent, now: Date): string {
  const start = new Date(e.start);
  const startsBefore = start.getTime() < now.getTime();
  const day = startsBefore ? "Today" : dayLabel(start, now);
  if (e.allDay) return `${day} · All day`;
  if (startsBefore) return `Now · until ${shortTime.format(new Date(e.end ?? e.start))}`;
  return `${day} · ${shortTime.format(start)}`;
}

/** Drop events that have ended since the data was fetched. */
function stillUpcoming(events: CalEvent[], now: Date): CalEvent[] {
  const t = now.getTime();
  return events.filter((e) => new Date(e.end ?? e.start).getTime() > t || (!e.end && new Date(e.start).getTime() > t - 3_600_000));
}

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
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  const nowDate = new Date();
  const events = calendar ? stillUpcoming(calendar.events, nowDate).slice(0, SHOW_EVENTS) : [];
  const showCal = Boolean(calendar);

  // Show only whole events: hide any that would be cut off at the bottom of the panel.
  const listRef = useRef<HTMLOListElement>(null);
  useLayoutEffect(() => {
    const ol = listRef.current;
    if (!ol) return;
    const items = Array.from(ol.children) as HTMLElement[];
    items.forEach((li) => (li.style.display = ""));
    const limit = ol.getBoundingClientRect().bottom + 1;
    let hide = false;
    for (const li of items) {
      if (hide || li.getBoundingClientRect().bottom > limit) {
        hide = true;
        li.style.display = "none";
      }
    }
  });

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
            <h2 className={styles.calTitle}>Coming up</h2>
            {events.length ? (
              <ol ref={listRef} className={styles.events}>
                {events.map((e) => (
                  <li key={e.start + e.title} className={styles.event}>
                    <span className={styles.when}>{whenLabel(e, nowDate)}</span>
                    <span className={styles.what}>{e.title}</span>
                    {e.location && <span className={styles.where}>{e.location}</span>}
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.empty}>Nothing on the calendar</p>
            )}
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
