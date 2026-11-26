import type { Metadata } from "next";
import { isSignedIn, remoteConfigured } from "@/lib/remoteServer";
import RemoteApp from "./RemoteApp";
import RemoteLogin from "./RemoteLogin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "HPD TV Remote" };

export default async function RemotePage() {
  if (await isSignedIn()) return <RemoteApp />;
  return <RemoteLogin configured={remoteConfigured()} />;
}
