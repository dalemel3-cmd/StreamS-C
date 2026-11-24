"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { CalEvent } from "@/lib/ics";
import styles from "./clock.module.css";

const TZ = "America/Chicago";
const DAYS_AHEAD = 7;
const ROLL_PX_PER_SEC = 28; // slow, easy to read from across the room

const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const dayName = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long", month: "short", day: "numeric" });
const shortDay = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" });
const shortTime = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });

const DAY_MS = 86_400_000;

function heading(k: string, now: Date, sample: Date): string {
  if (k === dayKey.format(now)) return "Today";
  if (k === dayKey.format(new Date(now.getTime() + DAY_MS))) return "Tomorrow";
  return dayName.format(sample);
}

function timeLabel(e: CalEvent, now: Date): string {
  if (e.allDay) return "All day";
  const start = new Date(e.start);
  if (start.getTime() <= now.getTime()) {
    // Already going: say when it ends, with the day if it isn't today.
    const end = new Date(e.end ?? e.start);
    const sameDay = dayKey.format(end) === dayKey.format(now);
    return `Now · until ${sameDay ? "" : shortDay.format(end) + " "}${shortTime.format(end)}`;
  }
  return shortTime.format(start);
}

type Day = { key: string; title: string; events: CalEvent[] };

function groupByDay(events: CalEvent[], now: Date): Day[] {
  const t = now.getTime();
  const horizon = t + DAYS_AHEAD * DAY_MS;
  const days = new Map<string, Day>();
  for (const e of events) {
    const startMs = new Date(e.start).getTime();
    const endMs = new Date(e.end ?? e.start).getTime();
    if (endMs <= t && !(e.end === undefined && startMs > t - 3_600_000)) continue; // ended
    if (startMs > horizon) continue;
    // Events already going sit under Today.
    const at = startMs < t ? now : new Date(e.start);
    const k = dayKey.format(at);
    if (!days.has(k)) days.set(k, { key: k, title: heading(k, now, at), events: [] });
    days.get(k)!.events.push(e);
  }
  return [...days.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function Days({ days, now }: { days: Day[]; now: Date }) {
  return (
    <>
      {days.map((d) => (
        <section key={d.key} className={styles.day}>
          <h3 className={styles.dayTitle}>{d.title}</h3>
          {d.events.map((e) => (
            <div key={e.start + e.title} className={styles.event}>
              <span className={styles.when}>{timeLabel(e, now)}</span>
              <span className={styles.what}>{e.title}</span>
              {e.location && <span className={styles.where}>{e.location}</span>}
            </div>
          ))}
        </section>
      ))}
    </>
  );
}

/**
 * The week's events, grouped by day, sitting right on the screen. When they don't
 * all fit, they roll slowly upward like credits and loop.
 */
export default function CalendarRoll({ events }: { events: CalEvent[] }) {
  const now = new Date();
  const days = groupByDay(events, now);
  const boxRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const [rollSec, setRollSec] = useState(0); // 0 = everything fits, no roll

  const signature = days.map((d) => d.key + d.events.map((e) => e.start + e.title).join()).join("|");
  useLayoutEffect(() => {
    const box = boxRef.current;
    const copy = copyRef.current;
    if (!box || !copy) return;
    const h = copy.offsetHeight; // unscaled px
    setRollSec(h > box.clientHeight ? Math.round(h / ROLL_PX_PER_SEC) : 0);
  }, [signature]);

  if (!days.length) return <p className={styles.empty}>Nothing on the calendar this week</p>;

  return (
    <div ref={boxRef} className={`${styles.roll} ${rollSec ? styles.rolling : ""}`}>
      <div className={styles.track} style={rollSec ? { animationDuration: `${rollSec}s` } : undefined}>
        <div ref={copyRef} className={styles.copy}>
          <Days days={days} now={now} />
        </div>
        {/* Second copy makes the loop seamless. */}
        {rollSec > 0 && (
          <div className={styles.copy} aria-hidden>
            <Days days={days} now={now} />
          </div>
        )}
      </div>
    </div>
  );
}
