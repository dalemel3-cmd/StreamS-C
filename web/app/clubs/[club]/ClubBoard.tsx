"use client";

import Frame from "@/components/board/Frame";
import styles from "@/components/board/board.module.css";
import { useBoard } from "@/components/board/useBoard";
import { useRotate } from "@/components/board/useRotate";
import { useSportFilter } from "@/components/board/useSportFilter";
import { type Best, inSport, round5, sportsIn } from "@/lib/board";
import { CLUBS } from "./clubs";

type Row = {
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
    const key = `${b.name}|${b.sport}`;
    const r = by.get(key) ?? {
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
  name: string;
  sport: string | null;
  time: number;
  mph: number;
};

/** Each athlete's best (fastest) Fly 10, fastest first. */
function speeds(bests: Best[], sport: string | null): SpeedRow[] {
  return bests
    .filter((b) => b.metric === "Fly 10" && b.value > 0 && inSport(b, sport))
    .map((b) => ({
      name: b.name,
      sport: b.sport,
      time: b.value,
      mph: flyMph(b.value),
    }))
    .sort((a, b) => a.time - b.time);
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

  // No members yet: each board shows who's closest so it still motivates.
  let count = 0;
  let body: React.ReactNode;
  if (club.kind === "total") {
    const all = totals(bests, sport);
    const members = all.filter((r) => r.total >= club.target);
    count = members.length;
    const rows = (members.length ? members : all).slice(0, 8);
    body =
      rows.length === 0 ? null : (
        <table className={`${styles.table} ${styles.tight}`}>
          <thead>
            <tr>
              <th>{members.length ? "Athlete" : "Closest to 1,000"}</th>
              <th>Bench</th>
              <th>Squat</th>
              <th>Clean</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.name}|${r.sport}`}>
                <Name r={r} sport={sport} />
                <td>{r.bench}</td>
                <td>{r.squat}</td>
                <td>{r.clean}</td>
                <td>
                  <span className={styles.big}>{r.total}</span>
                  {!members.length && (
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
    const all = speeds(bests, sport);
    const members = all.filter((r) => r.mph >= club.mph);
    count = members.length;
    const rows = (members.length ? members : all).slice(0, 8);
    body =
      rows.length === 0 ? null : (
        <table className={`${styles.table} ${styles.tight}`}>
          <thead>
            <tr>
              <th>
                {members.length ? "Athlete" : `Closest to ${club.mph} mph`}
              </th>
              <th>Fly 10</th>
              <th>MPH</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.name}|${r.sport}`}>
                <Name r={r} sport={sport} />
                <td>{r.time.toFixed(2)} s</td>
                <td>
                  <span className={styles.big}>{r.mph.toFixed(1)}</span>
                  {!members.length && (
                    <span className={styles.meta}>
                      {" "}
                      &nbsp;−{(club.mph - r.mph).toFixed(1)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
  }
  useRotate(20, Boolean(board && sport && !body));

  return (
    <Frame
      eyebrow={`Shiloh HPD · ${sport ?? "All sports"} · ${
        club.kind === "total"
          ? "Bench + Squat + Clean"
          : "From Fly 10 · 20.45 ÷ time"
      }`}
      title={club.title}
      note={count ? `${count} member${count === 1 ? "" : "s"}` : undefined}
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
              : "No Fly 10 times yet"}
        </div>
      )}
    </Frame>
  );
}
