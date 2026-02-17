import { redirect } from "next/navigation";
import { LifecycleFeed } from "@/components/lifecycle-feed";
import { Nav } from "@/components/nav";
import { getRecentLifecycle } from "@/lib/api";
import { getDashboardMode } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function LifecyclePage() {
  const mode = await getDashboardMode();
  if (mode === "confidential") {
    redirect("/");
  }

  const recent = await getRecentLifecycle(50, new Date().toISOString());

  return (
    <main className="app-shell">
      <Nav mode={mode} active="lifecycle" />
      <LifecycleFeed events={recent.events} />
    </main>
  );
}