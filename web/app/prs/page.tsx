"use client";

import Frame from "@/components/board/Frame";
import styles from "@/components/board/board.module.css";
import { useBoard } from "@/components/board/useBoard";
import { useRotate } from "@/components/board/useRotate";
import { useSportFilter } from "@/components/board/useSportFilter";
import { METRICS, UNIT_LABEL, formatValue, sportsIn } from "@/lib/board";

const TITLE: Record<string, string> = Object.fromEntries(
  Object.values(METRICS).map((m) => [
    m.metric,
    m.metric === "Vertical (no arms)" ? "Vertical · No arms" : m.title,
  ]),
);

export default function PRs() {
  const { board, offline } = useBoard();
  const sport = useSportFilter(sportsIn(board));

  // Improvements this week over the athlete's previous best, biggest % gain first.
  const prs = (board?.bests ?? [])
    .filter(
      (b) =>
        (!sport || b.sport === sport) &&
        b.pr_this_week &&
        b.previous != null &&
        b.previous !== b.value,
    )
    .map((b) => ({
      ...b,
      gain: Math.abs(b.value - (b.previous as number)),
      pct: Math.abs(b.value / (b.previous as number) - 1),
    }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 6);
  useRotate(25, Boolean(board && sport && prs.length === 0));

  return (
    <Frame
      eyebrow={`Shiloh HPD · ${sport ?? "All sports"} · Last 7 days`}
      title="New PRs this week"
      filter="OK: change sport"
      updated={board?.generated_at}
      offline={offline}
    >
      {prs.length === 0 ? (
        <div className={styles.empty}>
          {board
            ? `No new ${sport ? sport + " " : ""}PRs yet this week`
            : "Loading…"}
        </div>
      ) : (
        <div className={styles.cards}>
          {prs.map((b, i) => (
            <div key={i} className={styles.card}>
              <span className={styles.cardLabel}>
                {TITLE[b.metric] ?? b.metric}
              </span>
              <span>
                <span className={styles.cardValue}>
                  {formatValue(b.value, b.unit)}
                </span>
                <span className={styles.unit}>{UNIT_LABEL[b.unit]}</span>
                <span className={styles.gain}>
                  {b.higher ? "+" : "−"}
                  {formatValue(b.gain, b.unit)}
                </span>
              </span>
              <span>
                <span className={styles.name}>{b.name}</span>
                {!sport && (
                  <span className={styles.meta}> &nbsp;{b.sport}</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </Frame>
  );
}
