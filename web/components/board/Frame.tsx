"use client";

import Stage from "@/components/Stage";
import styles from "./board.module.css";

const shortTime = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" });

/** Shared screen chrome: eyebrow + title + note, body, footer with filter and freshness. */
export default function Frame({
  eyebrow,
  title,
  note,
  filter,
  updated,
  offline,
  children,
}: {
  eyebrow: string;
  title: string;
  note?: string;
  filter?: string;
  updated?: string;
  offline?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Stage>
      <div className={styles.screen}>
        <header className={styles.header}>
          <div>
            <div className={styles.eyebrow}>{eyebrow}</div>
            <h1 className={styles.title}>{title}</h1>
          </div>
          {note && <div className={styles.note}>{note}</div>}
        </header>
        <main className={styles.body}>{children}</main>
        <footer className={styles.footer}>
          <span>{filter ?? ""}</span>
          <span className={styles.footRight}>
            {offline && <span className={styles.offline}>Offline</span>}
            {updated && <span>Updated {shortTime.format(new Date(updated))}</span>}
          </span>
        </footer>
      </div>
    </Stage>
  );
}
