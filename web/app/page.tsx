import { redirect } from "next/navigation";

// The APK reads screens.json; a bare visit lands on the first screen.
export default function Home() {
  redirect("/clock");
}
