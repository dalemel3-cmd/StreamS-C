import { NextResponse } from "next/server";
import type { StatusResponse } from "@/lib/remote";
import { isSignedIn, rpc } from "@/lib/remoteServer";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isSignedIn()))
    return NextResponse.json({ error: "sign in" }, { status: 401 });
  try {
    const data = await rpc<StatusResponse>("tv_remote_status", {});
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("remote status failed:", err);
    return NextResponse.json({ error: "remote unavailable" }, { status: 503 });
  }
}
