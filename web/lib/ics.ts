// Small iCalendar (.ics) reader for the clock screen's "Coming up" list.
// Handles folded lines, UTC / TZID / floating times, all-day events, simple
// DAILY/WEEKLY repeats (COUNT, UNTIL, BYDAY, INTERVAL), EXDATE, and cancelled events.

export type CalEvent = {
  title: string;
  start: string; // ISO (UTC). For all-day events: midnight Chicago time of that day.
  end?: string;
  allDay: boolean;
  location?: string;
};

export type Calendar = {
  events: CalEvent[];
  updated: string;
  stale?: boolean;
};

const DEFAULT_TZ = "America/Chicago";

type Prop = { name: string; params: Record<string, string>; value: string };

function unfold(text: string): string[] {
  return text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}

function parseLine(line: string): Prop | null {
  // NAME;PARAM=x;PARAM2="y:z":VALUE  (colon inside quotes is not the separator)
  let inQuote = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuote = !inQuote;
    else if (c === ":" && !inQuote) {
      colon = i;
      break;
    }
  }
  if (colon < 0) return null;
  const [name, ...paramParts] = line.slice(0, colon).split(";");
  const params: Record<string, string> = {};
  for (const p of paramParts) {
    const eq = p.indexOf("=");
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: name.toUpperCase(), params, value: line.slice(colon + 1) };
}

function unescapeText(v: string): string {
  return v.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").replace(/\s+/g, " ").trim();
}

/** Offset (ms) of a time zone from UTC at a given instant. */
function tzOffset(utcMs: number, tz: string): number {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(f.formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return asUtc - utcMs;
}

/** Wall-clock time in `tz` to a UTC instant. */
function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string): number {
  const guess = Date.UTC(y, mo, d, h, mi, s);
  let t = guess - tzOffset(guess, tz);
  t = guess - tzOffset(t, tz); // second pass settles DST edges
  return t;
}

function validTz(tz: string | undefined): string {
  if (!tz) return DEFAULT_TZ;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TZ;
  }
}

type Parsed = { ms: number; allDay: boolean };

function parseDate(value: string, params: Record<string, string>): Parsed | null {
  const m = value.trim().match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (h === undefined || params.VALUE === "DATE") {
    return { ms: zonedToUtc(+y, +mo - 1, +d, 0, 0, 0, DEFAULT_TZ), allDay: true };
  }
  if (z) return { ms: Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s ?? 0)), allDay: false };
  return { ms: zonedToUtc(+y, +mo - 1, +d, +h, +mi, +(s ?? 0), validTz(params.TZID)), allDay: false };
}

const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const DAY_MS = 86_400_000;

/** Expand a simple RRULE into start instants (ms) within [from, to]. */
function expand(startMs: number, rule: string, exdates: Set<number>, from: number, to: number, tz: string): number[] {
  const r = Object.fromEntries(rule.split(";").map((kv) => kv.split("=") as [string, string]));
  const freq = r.FREQ;
  if (freq !== "DAILY" && freq !== "WEEKLY") return startMs >= from && startMs <= to ? [startMs] : [];
  const interval = Math.max(1, Number(r.INTERVAL) || 1);
  const count = r.COUNT ? Number(r.COUNT) : Infinity;
  const until = r.UNTIL ? parseDate(r.UNTIL, {})?.ms ?? Infinity : Infinity;
  const byDay = r.BYDAY ? r.BYDAY.split(",").map((x) => DAY_CODES.indexOf(x.replace(/^[+-]?\d+/, ""))) : null;

  // Step through local calendar days so the wall-clock time holds across DST.
  const off = tzOffset(startMs, tz);
  const local = new Date(startMs + off);
  const [Y, M, D, h, mi, s] = [
    local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(),
    local.getUTCHours(), local.getUTCMinutes(), local.getUTCSeconds(),
  ];
  const startWeekday = local.getUTCDay();
  const out: number[] = [];
  let seen = 0;
  for (let i = 0; i < 800 && seen < count; i++) {
    const dayDate = new Date(Date.UTC(Y, M, D + i));
    const weekday = dayDate.getUTCDay();
    let hit: boolean;
    if (freq === "DAILY") hit = i % interval === 0;
    else {
      const week = Math.floor((i + startWeekday) / 7);
      hit = week % interval === 0 && (byDay ? byDay.includes(weekday) : weekday === startWeekday);
    }
    if (!hit) continue;
    const t = zonedToUtc(dayDate.getUTCFullYear(), dayDate.getUTCMonth(), dayDate.getUTCDate(), h, mi, s, tz);
    if (t < startMs) continue;
    if (t > until || t > to) break;
    seen++;
    if (t >= from && !exdates.has(t)) out.push(t);
  }
  return out;
}

/** Events that haven't ended yet, soonest first, up to `limit`. */
export function upcomingEvents(ics: string, now = Date.now(), limit = 6, days = 60): CalEvent[] {
  if (!/BEGIN:VCALENDAR/i.test(ics)) throw new Error("not an iCalendar feed");
  const lines = unfold(ics);
  const horizon = now + days * DAY_MS;
  const out: CalEvent[] = [];
  const overridden = new Set<string>(); // UID|start of single changed instances of a repeat

  type Raw = Record<string, Prop[]>;
  const raws: Raw[] = [];
  let cur: Raw | null = null;
  let depth = 0;
  for (const line of lines) {
    if (/^BEGIN:VEVENT/i.test(line)) {
      cur = {};
      depth = 0;
      continue;
    }
    if (!cur) continue;
    if (/^BEGIN:/i.test(line)) depth++; // e.g. VALARM inside the event
    else if (/^END:VEVENT/i.test(line)) {
      raws.push(cur);
      cur = null;
    } else if (/^END:/i.test(line)) depth--;
    else if (depth === 0) {
      const p = parseLine(line);
      if (p) (cur[p.name] ??= []).push(p);
    }
  }

  for (const ev of raws) {
    if (ev["RECURRENCE-ID"] && ev.UID) {
      const rid = parseDate(ev["RECURRENCE-ID"][0].value, ev["RECURRENCE-ID"][0].params);
      if (rid) overridden.add(`${ev.UID[0].value}|${rid.ms}`);
    }
  }

  for (const ev of raws) {
    if (ev.STATUS?.[0].value.toUpperCase() === "CANCELLED") continue;
    const ds = ev.DTSTART?.[0];
    if (!ds) continue;
    const start = parseDate(ds.value, ds.params);
    if (!start) continue;
    const de = ev.DTEND?.[0];
    const end = de ? parseDate(de.value, de.params) : null;
    const length = end ? Math.max(0, end.ms - start.ms) : start.allDay ? DAY_MS : 0;
    const title = unescapeText(ev.SUMMARY?.[0].value ?? "") || "Event";
    const location = ev.LOCATION ? unescapeText(ev.LOCATION[0].value) || undefined : undefined;
    const uid = ev.UID?.[0].value ?? "";

    let starts: number[];
    const rrule = ev.RRULE?.[0].value;
    if (rrule && !ev["RECURRENCE-ID"]) {
      const ex = new Set<number>();
      for (const p of ev.EXDATE ?? [])
        for (const v of p.value.split(",")) {
          const d = parseDate(v, { ...ds.params, ...p.params });
          if (d) ex.add(d.ms);
        }
      const tz = start.allDay ? DEFAULT_TZ : validTz(ds.params.TZID);
      starts = expand(start.ms, rrule, ex, now - length, horizon, tz).filter((t) => !overridden.has(`${uid}|${t}`));
    } else {
      starts = [start.ms];
    }

    for (const t of starts) {
      const endMs = t + length;
      // Keep events that are still going (or start within the window).
      if ((length ? endMs <= now : t < now - 60 * 60_000) || t > horizon) continue;
      out.push({
        title,
        start: new Date(t).toISOString(),
        end: length ? new Date(endMs).toISOString() : undefined,
        allDay: start.allDay,
        location,
      });
    }
  }

  out.sort((a, b) => a.start.localeCompare(b.start) || Number(b.allDay) - Number(a.allDay));
  return out.slice(0, limit);
}
