import Link from "next/link";
import { apiGet } from "@/lib/api";
import type { MarketplaceCatalog } from "@/lib/types";
import { ExpertGrid } from "@/components/expert-grid";
import { GlobalCatalog } from "@/components/global-catalog";

export const dynamic = "force-dynamic";

const EMPTY: MarketplaceCatalog = {
  experts: [],
  courses: [],
  books: [],
  packages: [],
};

async function getCatalog(): Promise<MarketplaceCatalog> {
  try {
    return await apiGet<MarketplaceCatalog>("/marketplace/catalog");
  } catch {
    return EMPTY;
  }
}

export default async function HomePage() {
  const { experts, courses, books, packages } = await getCatalog();

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-brand">
            10X Digital Ventures
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            The 10X Marketplace
          </h1>
          <p className="mt-1 text-slate-600">
            Every consultant, course, book and package — all in one place.
          </p>
        </div>
        <Link
          href="/onboard"
          className="shrink-0 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark"
        >
          Become an expert
        </Link>
      </header>

      <section>
        <h2 className="mb-4 text-xl font-semibold tracking-tight">
          Experts
        </h2>
        <ExpertGrid experts={experts} />
      </section>

      <GlobalCatalog courses={courses} books={books} packages={packages} />
    </main>
  );
}
