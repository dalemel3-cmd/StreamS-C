import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// Server-only helpers for the web remote. REMOTE_PASSWORD is a Vercel env var; the
// HPD Supabase url/key/token are the same ones /api/board uses.

const env = (name: string) =>
  process.env[name]?.trim().replace(/\/+$/, "") || undefined;

export const REMOTE_COOKIE = "hpd_remote";

function sessionValue(): string | null {
  const pw = env("REMOTE_PASSWORD");
  if (!pw) return null;
  return createHmac("sha256", pw).update("hpd-remote-v1").digest("hex");
}

export function remoteConfigured(): boolean {
  return Boolean(env("REMOTE_PASSWORD"));
}

export function passwordMatches(input: string): boolean {
  const pw = env("REMOTE_PASSWORD");
  if (!pw) return false;
  const a = createHmac("sha256", "cmp").update(input).digest();
  const b = createHmac("sha256", "cmp").update(pw).digest();
  return timingSafeEqual(a, b);
}

export function newSessionCookie() {
  return {
    name: REMOTE_COOKIE,
    value: sessionValue() ?? "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: 180 * 24 * 60 * 60,
  };
}

/** True when the request carries a valid remote session cookie. Changing REMOTE_PASSWORD signs everyone out. */
export async function isSignedIn(): Promise<boolean> {
  const want = sessionValue();
  if (!want) return false;
  const got = (await cookies()).get(REMOTE_COOKIE)?.value ?? "";
  if (got.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

/** Call one of the tv_remote_* functions in the HPD Supabase project. */
export async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const url = env("HPD_SUPABASE_URL");
  const key = env("HPD_SUPABASE_KEY");
  const token = env("TV_BOARD_TOKEN");
  if (!url || !key || !token) throw new Error("remote not configured");
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: token, ...args }),
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`${fn} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as T;
}
