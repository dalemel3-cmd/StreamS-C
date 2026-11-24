import { NextResponse } from "next/server";
import type { Board } from "@/lib/board";

// Reads the HPD app's read-only `tv_board` function. It returns first name + last
// initial and best marks only, and needs TV_BOARD_TOKEN. All three values are Vercel env vars.
export const dynamic = "force-dynamic";
const revalidate = 300;

const URL_ = process.env.HPD_SUPABASE_URL;
const KEY = process.env.HPD_SUPABASE_KEY;
const TOKEN = process.env.TV_BOARD_TOKEN;

let lastGood: Board | null = null;

export async function GET() {
  if (!URL_ || !KEY || !TOKEN) {
    return NextResponse.json({ error: "board not configured" }, { status: 503 });
  }
  try {
    const res = await fetch(`${URL_}/rest/v1/rpc/tv_board`, {
      method: "POST",
      headers: { apikey: KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: TOKEN }),
      next: { revalidate },
    });
    if (!res.ok) throw new Error(`tv_board ${res.status}`);
    const data = (await res.json()) as Board;
    lastGood = data;
    return NextResponse.json(data);
  } catch (err) {
    console.error("board fetch failed:", err);
    if (lastGood) return NextResponse.json({ ...lastGood, stale: true });
    return NextResponse.json({ error: "board unavailable" }, { status: 503 });
  }
}
