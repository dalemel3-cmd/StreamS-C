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

export default function ClubBoard({ slug }: { slug: string }) {
  const club = CLUBS[slug];
  const { board, offline } = useBoard();
  const sport = useSportFilter(sportsIn(board));

  const all = club.kind === "total" ? totals(board?.bests ?? [], sport) : [];
  const members =
    club.kind === "total" ? all.filter((r) => r.total >= club.target) : [];
  // No members yet: show who's closest so the board still motivates.
  const rows = (members.length ? members : all).slice(0, 8);
  useRotate(20, Boolean(board && sport && rows.length === 0));

  return (
    <Frame
      eyebrow={`Shiloh HPD · ${sport ?? "All sports"} · ${
        club.kind === "total"
          ? "Bench + Squat + Clean"
          : "Top speed · Titan GPS"
      }`}
      title={club.title}
      note={
        club.kind === "total" && members.length
          ? `${members.length} member${members.length === 1 ? "" : "s"}`
          : undefined
      }
      filter="OK: change sport"
      updated={board?.generated_at}
      offline={offline}
    >
      {club.kind === "speed" ? (
        <div className={styles.empty}>Waiting on Titan GPS top speeds</div>
      ) : rows.length === 0 ? (
        <div className={styles.empty}>
          {board ? "No athletes with all three lifts yet" : "Loading…"}
        </div>
      ) : (
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
                <td>
                  {r.name}
                  {!sport && r.sport && (
                    <span className={styles.meta}> &nbsp;{r.sport}</span>
                  )}
                </td>
                <td>{r.bench}</td>
                <td>{r.squat}</td>
                <td>{r.clean}</td>
                <td>
                  <span className={styles.big}>{r.total}</span>
                  {!members.length && club.kind === "total" && (
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
      )}
    </Frame>
  );
}
