"use client";

import { useEffect, useState } from "react";
import Frame from "@/components/board/Frame";
import styles from "@/components/board/board.module.css";
import { useBoard } from "@/components/board/useBoard";
import { useRotate } from "@/components/board/useRotate";
import { useSportFilter } from "@/components/board/useSportFilter";
import {
  type Best,
  athleteKey,
  inSport,
  round5,
  sportsIn,
} from "@/lib/board";
import { CLUBS } from "./clubs";

const PAGE_SIZE = 8;
const PAGE_SEC = 10;

type Row = {
  key: string;
  name: string;
  sport: string | null;
  bench: number;
  squat: number;
  clean: number;
  total: number;
};

/**
 * 1,000 lb club = best Bench + best Squat (back or front) + best Clean (hang or power),
 * each the athlete's max as the leaderboards show it (nearest 5 lb); the total adds those. Athletes need all three.
 */
function totals(bests: Best[], sport: string | null): Row[] {
  const by = new Map<string, Row>();
  for (const b of bests) {
    if (b.unit !== "lb" || !inSport(b, sport)) continue;
    const v = round5(b.value); // as shown on the leaderboards
    const key = athleteKey(b);
    const r = by.get(key) ?? {
      key,
      name: b.name,
      sport: b.sport,
      bench: 0,
      squat: 0,
      clean: 0,
      total: 0,
    };
    if (b.metric === "Bench") r.bench = Math.max(r.bench, v);
    if (b.metric === "Squat" || b.metric === "Front Squat")
      r.squat = Math.max(r.squat, v);
    if (b.metric === "Hang Clean" || b.metric === "Power Clean")
      r.clean = Math.max(r.clean, v);
    by.set(key, r);
  }
  return [...by.values()]
    .filter((r) => r.bench && r.squat && r.clean)
    .map((r) => ({ ...r, total: r.bench + r.squat + r.clean }))
    .sort((a, b) => b.total - a.total);
}

/** Fly 10 time (seconds over 10 yards) to mph: 20.45 / time. */
export const flyMph = (seconds: number) => 20.45 / seconds;

type SpeedRow = {
  key: string;
  name: string;
  sport: string | null;
  sports?: string[];
  fly: number | null; // Fly 10 mph
  gps: number | null; // Titan GPS top speed, mph
  mph: number; // the faster of the two
  source: "GPS" | "Fly 10";
};

/** Each athlete's best speed: the faster of their GPS top speed and their Fly 10 converted to mph. */
function speeds(bests: Best[], sport: string | null): SpeedRow[] {
  const rows = new Map<string, SpeedRow>();
  for (const b of bests) {
    if (b.value <= 0 || !inSport(b, sport)) continue;
    const mph =
      b.metric === "Fly 10"
        ? flyMph(b.value)
        : b.metric === "Top Speed"
          ? b.value
          : null;
    if (mph == null) continue;
    const key = athleteKey(b);
    const r = rows.get(key) ?? {
      key,
      name: b.name,
      sport: b.sport,
      sports: b.sports,
      fly: null,
      gps: null,
      mph: 0,
      source: "GPS" as const,
    };
    if (b.metric === "Fly 10") r.fly = Math.max(r.fly ?? 0, mph);
    else r.gps = Math.max(r.gps ?? 0, mph);
    r.mph = Math.max(r.fly ?? 0, r.gps ?? 0);
    r.source = (r.gps ?? 0) >= (r.fly ?? 0) ? "GPS" : "Fly 10";
    rows.set(key, r);
  }
  return [...rows.values()].sort((a, b) => b.mph - a.mph);
}

const Name = ({
  r,
  sport,
}: {
  r: { name: string; sport: string | null };
  sport: string | null;
}) => (
  <td>
    {r.name}
    {!sport && r.sport && <span className={styles.meta}> &nbsp;{r.sport}</span>}
  </td>
);

export default function ClubBoard({ slug }: { slug: string }) {
  const club = CLUBS[slug];
  const { board, offline } = useBoard();
  const sport = useSportFilter(sportsIn(board));
  const bests = board?.bests ?? [];
  const [page, setPage] = useState(0);

  let count = 0;
  let totalPages = 1;
  let hasMembers = false;
  let totalRows: Row[] = [];
  let speedRows: SpeedRow[] = [];

  if (club.kind === "total") {
    const all = totals(bests, sport);
    const members = all.filter((r) => r.total >= club.target);
    count = members.length;
    hasMembers = members.length > 0;
    const pool = hasMembers ? members : all.slice(0, PAGE_SIZE);
    totalPages = Math.max(1, Math.ceil(pool.length / PAGE_SIZE));
    const safePage = page % totalPages;
    totalRows = pool.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  } else {
    const all = speeds(bests, sport);
    // Tiers: each athlete only in their highest club (16 mph = 16.0 to 16.9). The top club has no ceiling.
    const top = Math.max(
      ...Object.values(CLUBS).map((c) => (c.kind === "speed" ? c.mph : 0)),
    );
    // Compare the speed as shown (1 decimal), so 16.97 (shown 17.0) counts as 17.
    const shown = (r: SpeedRow) => Number(r.mph.toFixed(1));
    const members = all.filter(
      (r) =>
        shown(r) >= club.mph && (club.mph === top || shown(r) < club.mph + 1),
    );
    count = members.length;
    hasMembers = members.length > 0;
    const below = all.filter((r) => shown(r) < club.mph);
    const pool = hasMembers ? members : below.slice(0, PAGE_SIZE);
    totalPages = Math.max(1, Math.ceil(pool.length / PAGE_SIZE));
    const safePage = page % totalPages;
    speedRows = pool.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  }

  // Reset to page 1 when switching sport or club, and auto-page large clubs during dwell time.
  useEffect(() => {
    setPage(0);
  }, [slug, sport, totalPages]);

  useEffect(() => {
    if (totalPages <= 1) return;
    const id = setInterval(() => {
      setPage((p) => (p + 1) % totalPages);
    }, PAGE_SEC * 1000);
    return () => clearInterval(id);
  }, [totalPages]);

  const currentPage = page % totalPages;
  let body: React.ReactNode;
  if (club.kind === "total") {
    body =
      totalRows.length === 0 ? null : (
        <table className={`${styles.table} ${styles.tight}`}>
          <thead>
            <tr>
              <th>{hasMembers ? "Athlete" : "Closest to 1,000"}</th>
              <th>Bench</th>
              <th>Squat</th>
              <th>Clean</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {totalRows.map((r) => (
              <tr key={r.key}>
                <Name r={r} sport={sport} />
                <td>{r.bench}</td>
                <td>{r.squat}</td>
                <td>{r.clean}</td>
                <td>
                  <span className={styles.big}>{r.total}</span>
                  {!hasMembers && (
                    <span className={styles.meta}>
                      {" "}
                      &nbsp;−{club.target - r.total}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
  } else {
    body =
      speedRows.length === 0 ? null : (
        <table className={`${styles.table} ${styles.tight}`}>
          <thead>
            <tr>
              <th>
                {hasMembers ? "Athlete" : `Closest to ${club.mph} mph`}
              </th>
              <th>GPS</th>
              <th>Fly 10</th>
              <th>Best</th>
            </tr>
          </thead>
          <tbody>
            {speedRows.map((r) => (
              <tr key={r.key}>
                <Name r={r} sport={sport} />
                <td>{r.gps == null ? "–" : r.gps.toFixed(1)}</td>
                <td>{r.fly == null ? "–" : r.fly.toFixed(1)}</td>
                <td>
                  <span className={styles.big}>{r.mph.toFixed(1)}</span>
                  <span className={styles.meta}>
                    {" "}
                    &nbsp;
                    {hasMembers
                      ? r.source
                      : `−${(club.mph - r.mph).toFixed(1)}`}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
  }

  useRotate(Math.max(20, totalPages * PAGE_SEC), Boolean(board && sport && !body));

  const note = count
    ? `${count} member${count === 1 ? "" : "s"}${
        totalPages > 1 ? ` · Page ${currentPage + 1}/${totalPages}` : ""
      }`
    : undefined;

  return (
    <Frame
      eyebrow={`Shiloh HPD · ${sport ?? "All sports"} · ${
        club.kind === "total"
          ? "Bench + Squat + Clean"
          : "Best of GPS or Fly 10 (20.45 ÷ time)"
      }`}
      title={club.title}
      note={note}
      filter="OK: change sport"
      updated={board?.generated_at}
      offline={offline}
    >
      {body ?? (
        <div className={styles.empty}>
          {!board
            ? "Loading…"
            : club.kind === "total"
              ? "No athletes with all three lifts yet"
              : "No speeds yet"}
        </div>
      )}
    </Frame>
  );
}
