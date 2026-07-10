"use client";

import { useState } from "react";
import Link from "next/link";
import type { ExpertCard } from "@/lib/types";
import { CATEGORIES } from "@/lib/categories";
import { ROOT_DOMAIN } from "@/lib/api";

export function ExpertGrid({ experts }: { experts: ExpertCard[] }) {
  const [q, setQ] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Unique non-null categories present in the current expert list.
  const presentCategories = Array.from(
    new Set(experts.map((e) => e.category).filter(Boolean) as string[]),
  ).sort(
    (a, b) =>
      (CATEGORIES as readonly string[]).indexOf(a) -
      (CATEGORIES as readonly string[]).indexOf(b),
  );

  const term = q.trim().toLowerCase();
  const filtered = experts.filter((e) => {
    if (activeCategory && e.category !== activeCategory) return false;
    if (
      term &&
      !(e.brandName + " " + e.name + " " + (e.tagline || ""))
        .toLowerCase()
        .includes(term)
    )
      return false;
    return true;
  });

  return (
    <div>
      {presentCategories.length > 0 ? (
        <div className="mb-5 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCategory(null)}
            className={
              "rounded-full px-3.5 py-1.5 text-sm font-medium transition " +
              (activeCategory === null
                ? "bg-brand text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200")
            }
          >
            All
          </button>
          {presentCategories.map((cat) => (
            <button
              key={cat}
              onClick={() =>
                setActiveCategory(activeCategory === cat ? null : cat)
              }
              className={
                "rounded-full px-3.5 py-1.5 text-sm font-medium transition " +
                (activeCategory === cat
                  ? "bg-brand text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200")
              }
            >
              {cat}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mb-6">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search experts by name or focus…"
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 sm:max-w-sm"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-500">
          {experts.length === 0
            ? "No experts listed yet. Check back soon."
            : "No experts match your search."}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((e) => {
            const accent = { borderTopColor: e.primaryColor || "#FF9100" };
            const host = e.slug + "." + ROOT_DOMAIN;
            return (
              <Link
                key={e.id}
                href={"/expert/" + e.slug}
                className="group rounded-2xl border border-t-4 border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
                style={accent}
              >
                <div className="flex items-center gap-3">
                  {e.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={e.logoUrl}
                      alt={e.brandName}
                      className="h-10 w-10 rounded-lg object-contain"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-light text-sm font-bold text-brand">
                      {e.brandName.slice(0, 1)}
                    </div>
                  )}
                  <div>
                    <h2 className="font-semibold text-slate-900">
                      {e.brandName}
                    </h2>
                    <p className="text-xs text-slate-500">{host}</p>
                  </div>
                </div>

                {e.category ? (
                  <span className="mt-2 inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                    {e.category}
                  </span>
                ) : null}

                {e.tagline ? (
                  <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                    {e.tagline}
                  </p>
                ) : null}
                <span className="mt-4 inline-block text-sm font-medium text-brand group-hover:underline">
                  View storefront →
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
