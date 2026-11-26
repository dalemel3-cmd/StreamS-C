import { NextResponse } from "next/server";
import { parseCommand } from "@/lib/remote";
import { isSignedIn, rpc } from "@/lib/remoteServer";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await isSignedIn()))
    return NextResponse.json({ error: "sign in" }, { status: 401 });
  let raw: unknown = null;
  try {
    raw = await req.json();
  } catch {}
  const cmd = parseCommand(raw);
  if (!cmd) return NextResponse.json({ error: "bad command" }, { status: 400 });
  try {
    const id = await rpc<number>("tv_remote_send", { p_cmd: cmd });
    return NextResponse.json({ id });
  } catch (err) {
    console.error("remote send failed:", err);
    return NextResponse.json({ error: "remote unavailable" }, { status: 503 });
  }
}
