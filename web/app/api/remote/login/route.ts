import { NextResponse } from "next/server";
import { newSessionCookie, passwordMatches, remoteConfigured } from "@/lib/remoteServer";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!remoteConfigured())
    return NextResponse.json({ error: "Set REMOTE_PASSWORD in Vercel first." }, { status: 503 });
  let password = "";
  try {
    password = String(((await req.json()) as { password?: unknown }).password ?? "");
  } catch {}
  if (!passwordMatches(password)) {
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(newSessionCookie());
  return res;
}
