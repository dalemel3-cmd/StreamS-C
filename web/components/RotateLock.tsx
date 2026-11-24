"use client";

import { useEffect, useState } from "react";
import { LOCK_EVENT, isLocked, setLocked } from "@/lib/rotateLock";

/** Up toggles the rotation lock; shows a small badge while locked. */
export default function RotateLock() {
  const [locked, setState] = useState(false);

  useEffect(() => {
    setState(isLocked());
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowUp") return;
      e.preventDefault();
      setLocked(!isLocked());
    };
    const onChange = (e: Event) =>
      setState(Boolean((e as CustomEvent<boolean>).detail));
    window.addEventListener("keydown", onKey);
    window.addEventListener(LOCK_EVENT, onChange);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(LOCK_EVENT, onChange);
    };
  }, []);

  if (!locked) return null;
  return (
    <div
      style={{
        position: "fixed",
        top: "5vh",
        right: "5vw",
        zIndex: 10,
        padding: "0.6vh 1.2vw",
        borderRadius: "999px",
        background: "#b89c5b",
        color: "#030a14",
        font: "700 1.7vw/1.2 Oswald, sans-serif",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      }}
    >
      Locked · Up to unlock
    </div>
  );
}
