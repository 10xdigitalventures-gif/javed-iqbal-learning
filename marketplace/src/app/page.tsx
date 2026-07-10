import Link from "next/link";
import { apiGet } from "@/lib/api";
import type { ExpertCard } from "@/lib/types";
import { ExpertGrid } from "@/components/expert-grid";

export const dynamic = "force-dynamic";

async function getExperts(): Promise<ExpertCard[]> {
  try {
    return await apiGet<ExpertCard[]>("/tenant/directory");
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const experts = await getExperts();

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-brand">
            10X Digital Ventures
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Find an expert</h1>
          <p className="mt-1 text-slate-600">
            Browse consultants and creators building on the 10X platform.
          </p>
        </div>
        <Link
          href="/onboard"
          className="shrink-0 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark"
        >
          Become an expert
        </Link>
      </header>

      <ExpertGrid experts={experts} />
    </main>
  );
}
