"use client";

import { useState } from "react";
import s from "./remote.module.css";

export default function RemoteLogin({ configured }: { configured: boolean }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(
    configured ? null : "Set REMOTE_PASSWORD in Vercel, then redeploy.",
  );
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/remote/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (res.ok) return location.reload();
      setErr(((await res.json()) as { error?: string }).error ?? "Sign in failed.");
    } catch {
      setErr("Can't reach the server.");
    }
    setBusy(false);
  };

  return (
    <main className={s.root}>
      <form className={s.login} onSubmit={submit}>
        <div className={s.brand}>HPD TV</div>
        <h1 className={s.title}>Remote</h1>
        <input
          className={s.input}
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          autoFocus
        />
        <button className={s.primary} disabled={busy || !pw}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        {err && <p className={s.error}>{err}</p>}
      </form>
    </main>
  );
}
