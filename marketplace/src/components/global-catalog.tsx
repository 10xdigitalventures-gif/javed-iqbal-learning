"use client";

import { useState } from "react";
import Link from "next/link";
import { ROOT_DOMAIN } from "@/lib/api";
import type {
  GlobalBook,
  GlobalCourse,
  GlobalPackage,
  ExpertMini,
} from "@/lib/types";

type Tab = "courses" | "books" | "packages";

function money(price: number, currency: string) {
  if (!price) return "Free";
  return `${currency} ${price.toLocaleString()}`;
}

// Deep-link to the expert's profile on the marketplace. The expert page then
// links onward to the dedicated portal (if any) + booking/chat.
function expertHref(expert: ExpertMini | null): string {
  if (!expert?.slug) return "#";
  return `/expert/${expert.slug}`;
}

function ExpertBadge({ expert }: { expert: ExpertMini | null }) {
  if (!expert) return null;
  const dotStyle = { backgroundColor: expert.primaryColor || "#cbd5e1" };
  return (
    <Link
      href={expertHref(expert)}
      className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-brand"
    >
      {expert.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={expert.logoUrl}
          alt={expert.name}
          className="h-4 w-4 rounded-full object-cover"
        />
      ) : (
        <span className="h-4 w-4 rounded-full" style={dotStyle} />
      )}
      by {expert.name}
    </Link>
  );
}

function Card({
  title,
  subtitle,
  cover,
  price,
  expert,
  href,
}: {
  title: string;
  subtitle?: string | null;
  cover?: string | null;
  price: string;
  expert: ExpertMini | null;
  href: string;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      <Link href={href} className="block">
        <div className="aspect-[16/10] w-full bg-slate-100">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover}
              alt={title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-300">
              <span className="text-3xl">10X</span>
            </div>
          )}
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <Link href={href}>
          <h3 className="line-clamp-2 font-semibold text-slate-900 hover:text-brand">
            {title}
          </h3>
        </Link>
        {subtitle ? (
          <p className="mt-1 line-clamp-2 text-sm text-slate-500">{subtitle}</p>
        ) : null}
        <ExpertBadge expert={expert} />
        <div className="mt-3 flex items-center justify-between">
          <span className="font-bold text-brand">{price}</span>
          <Link
            href={href}
            className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-dark"
          >
            View
          </Link>
        </div>
      </div>
    </div>
  );
}

export function GlobalCatalog({
  courses,
  books,
  packages,
}: {
  courses: GlobalCourse[];
  books: GlobalBook[];
  packages: GlobalPackage[];
}) {
  const [tab, setTab] = useState<Tab>("courses");
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "courses", label: "Courses", count: courses.length },
    { id: "books", label: "Books", count: books.length },
    { id: "packages", label: "Packages", count: packages.length },
  ];

  const fc = courses.filter(
    (c) => !term || (c.title + " " + (c.description || "")).toLowerCase().includes(term),
  );
  const fb = books.filter(
    (b) => !term || (b.title + " " + b.author).toLowerCase().includes(term),
  );
  const fp = packages.filter(
    (p) => !term || (p.name + " " + (p.description || "")).toLowerCase().includes(term),
  );

  return (
    <section className="mt-12">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={
                "rounded-full px-4 py-1.5 text-sm font-medium transition " +
                (tab === t.id
                  ? "bg-brand text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200")
              }
            >
              {t.label}
              <span className="ml-1.5 opacity-70">{t.count}</span>
            </button>
          ))}
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${tab}...`}
          className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-brand sm:w-64"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {tab === "courses" &&
          fc.map((c) => (
            <Card
              key={c.id}
              title={c.title}
              subtitle={c.description}
              cover={c.coverUrl}
              price={money(c.price, c.currency)}
              expert={c.expert}
              href={`/expert/${c.expert?.slug || ""}?course=${c.slug}`}
            />
          ))}
        {tab === "books" &&
          fb.map((b) => (
            <Card
              key={b.id}
              title={b.title}
              subtitle={b.author}
              cover={b.coverUrl}
              price={money(b.price, b.currency)}
              expert={b.expert}
              href={`/expert/${b.expert?.slug || ""}?book=${b.slug}`}
            />
          ))}
        {tab === "packages" &&
          fp.map((p) => (
            <Card
              key={p.id}
              title={p.name}
              subtitle={p.description}
              cover={null}
              price={money(p.price, p.currency)}
              expert={p.expert}
              href={`/expert/${p.expert?.slug || ""}?package=${p.id}`}
            />
          ))}
      </div>

      {((tab === "courses" && fc.length === 0) ||
        (tab === "books" && fb.length === 0) ||
        (tab === "packages" && fp.length === 0)) && (
        <p className="py-12 text-center text-slate-400">Nothing here yet.</p>
      )}
    </section>
  );
}
