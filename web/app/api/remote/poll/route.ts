import { NextResponse } from "next/server";
import type { PollResponse } from "@/lib/remote";
import { rpc } from "@/lib/remoteServer";

// The TV page calls this every few seconds: it reports what it's showing and gets any
// commands the web remote queued. No login (the TV has no secrets); it can only read commands.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { since?: unknown; status?: unknown } = {};
  try {
    body = await req.json();
  } catch {}
  const since = Number.isSafeInteger(body.since) ? (body.since as number) : null;
  const status = body.status && typeof body.status === "object" ? body.status : null;
  try {
    const data = await rpc<PollResponse>("tv_remote_poll", {
      p_since: since,
      p_status: status,
    });
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("remote poll failed:", err);
    return NextResponse.json({ error: "remote unavailable" }, { status: 503 });
  }
}
