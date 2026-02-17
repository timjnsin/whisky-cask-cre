import { redirect } from "next/navigation";
import { CaskTable } from "@/components/cask-table";
import { Nav } from "@/components/nav";
import { getCaskBatch, getPortfolioSummary } from "@/lib/api";
import { getDashboardMode } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

interface CasksPageProps {
  searchParams?: Promise<{
    focus?: string;
  }>;
}

export default async function CasksPage({ searchParams }: CasksPageProps) {
  const mode = await getDashboardMode();
  if (mode === "confidential") {
    redirect("/");
  }

  const asOf = new Date().toISOString();
  const [summary, batch] = await Promise.all([
    getPortfolioSummary(asOf),
    getCaskBatch({ asOf, limit: 50 }),
  ]);

  const params = searchParams ? await searchParams : undefined;
  const focus = Number(params?.focus ?? "");
  const initialExpandedCaskId = Number.isInteger(focus) && focus > 0 ? focus : undefined;

  return (
    <main className="app-shell">
      <Nav mode={mode} active="casks" />
      <CaskTable summary={summary} items={batch.items} initialExpandedCaskId={initialExpandedCaskId} />
    </main>
  );
}
