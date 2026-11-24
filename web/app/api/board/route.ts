import { NextResponse } from "next/server";
import type { Board } from "@/lib/board";

// Reads the HPD app's read-only `tv_board` function. It returns first name + last
// initial and best marks only, and needs TV_BOARD_TOKEN. All three values are Vercel env vars.
export const dynamic = "force-dynamic";

// Trim: values pasted into the Vercel dashboard can carry stray spaces or newlines.
const env = (name: string) => process.env[name]?.trim().replace(/\/+$/, "") || undefined;

let lastGood: Board | null = null;

export async function GET() {
  const url = env("HPD_SUPABASE_URL");
  const key = env("HPD_SUPABASE_KEY");
  const token = env("TV_BOARD_TOKEN");
  const missing = [!url && "HPD_SUPABASE_URL", !key && "HPD_SUPABASE_KEY", !token && "TV_BOARD_TOKEN"].filter(Boolean);
  if (missing.length) {
    return NextResponse.json({ error: "board not configured", missing }, { status: 503 });
  }

  let detail = "";
  try {
    const res = await fetch(`${url}/rest/v1/rpc/tv_board`, {
      method: "POST",
      headers: { apikey: key!, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: token }),
      cache: "no-store",
    });
    if (!res.ok) {
      // PostgREST errors are short JSON messages (e.g. "not authorized"); no secrets in them.
      detail = `upstream ${res.status}: ${(await res.text()).slice(0, 200)}`;
      throw new Error(detail);
    }
    const data = (await res.json()) as Board;
    lastGood = data;
    return NextResponse.json(data, { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=60" } });
  } catch (err) {
    console.error("board fetch failed:", err);
    if (lastGood) return NextResponse.json({ ...lastGood, stale: true });
    return NextResponse.json({ error: "board unavailable", detail: detail || String(err) }, { status: 503 });
  }
}
