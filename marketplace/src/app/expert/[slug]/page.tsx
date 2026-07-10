import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { apiGet } from "@/lib/api";
import type { ModuleFlags, TenantCatalog, TenantPublic } from "@/lib/types";

export const dynamic = "force-dynamic";

async function getExpert(slug: string): Promise<TenantPublic | null> {
  try {
    return await apiGet<TenantPublic>(
      "/tenant/public/" + encodeURIComponent(slug),
    );
  } catch {
    return null;
  }
}

async function getCatalog(slug: string): Promise<TenantCatalog> {
  try {
    return await apiGet<TenantCatalog>(
      "/tenant/public/" + encodeURIComponent(slug) + "/catalog",
    );
  } catch {
    return { courses: [], packages: [] };
  }
}

function formatPrice(price: number, currency: string): string {
  if (!price || price <= 0) return "Free";
  return currency + " " + Math.round(price).toLocaleString();
}

function billingLabel(days: number | null): string {
  if (!days) return "one-time";
  if (days === 30) return "/ month";
  if (days === 365) return "/ year";
  return "/ " + days + " days";
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const expert = await getExpert(params.slug);
  if (!expert) return { title: "Expert not found — 10X Marketplace" };
  return {
    title: expert.brandName + " — 10X Marketplace",
    description:
      expert.tagline ||
      "Discover " + expert.brandName + " on the 10X platform.",
  };
}

type ModuleInfo = {
  key: keyof ModuleFlags;
  label: string;
  desc: string;
  icon: string;
};

const MODULES: ModuleInfo[] = [
  {
    key: "learning",
    label: "Courses & Learning",
    desc: "On-demand courses, ebooks, and audiobooks.",
    icon: "\uD83D\uDCDA",
  },
  {
    key: "consultation",
    label: "1:1 Consultation",
    desc: "Book sessions and get personal guidance.",
    icon: "\uD83D\uDDD3\uFE0F",
  },
  {
    key: "community",
    label: "Community",
    desc: "Join the community and connect with peers.",
    icon: "\uD83D\uDCAC",
  },
];

export default async function ExpertPage({
  params,
}: {
  params: { slug: string };
}) {
  const [expert, catalog] = await Promise.all([
    getExpert(params.slug),
    getCatalog(params.slug),
  ]);
  if (!expert) notFound();

  const accent = { backgroundColor: expert.primaryColor || "#FF9100" };
  const tint = { borderTopColor: expert.primaryColor || "#FF9100" };
  const chip = { color: expert.primaryColor || "#FF9100" };
  const modules = MODULES.filter((m) => expert.moduleFlags[m.key]);
  const host = expert.subdomainUrl
    .replace("https://", "")
    .replace("http://", "");

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <Link href="/" className="text-sm text-slate-500 hover:underline">
        ← All experts
      </Link>

      <section
        className="mt-4 overflow-hidden rounded-3xl border border-t-4 border-slate-200 bg-white shadow-sm"
        style={tint}
      >
        <div className="p-8">
          <div className="flex items-center gap-4">
            {expert.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={expert.logoUrl}
                alt={expert.brandName}
                className="h-16 w-16 rounded-2xl object-contain"
              />
            ) : (
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-bold text-white"
                style={accent}
              >
                {expert.brandName.slice(0, 1)}
              </div>
            )}
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                {expert.brandName}
              </h1>
              {expert.tagline ? (
                <p className="mt-1 text-slate-600">{expert.tagline}</p>
              ) : null}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={expert.subdomainUrl}
              className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
              style={accent}
            >
              Visit storefront →
            </a>
            {expert.supportEmail ? (
              <a
                href={"mailto:" + expert.supportEmail}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Contact
              </a>
            ) : null}
          </div>
        </div>
      </section>

      {modules.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900">Offerings</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {modules.map((m) => (
              <div
                key={m.key}
                className="rounded-2xl border border-slate-200 bg-white p-5"
              >
                <div className="text-2xl">{m.icon}</div>
                <h3 className="mt-2 font-semibold text-slate-900">{m.label}</h3>
                <p className="mt-1 text-sm text-slate-600">{m.desc}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {catalog.courses.length > 0 ? (
        <section className="mt-10">
          <div className="flex items-end justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              Featured courses
            </h2>
            <a
              href={expert.subdomainUrl}
              className="text-sm font-medium hover:underline"
              style={chip}
            >
              See all →
            </a>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.courses.map((c) => (
              <a
                key={c.id}
                href={expert.subdomainUrl}
                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
              >
                {c.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.coverUrl}
                    alt={c.title}
                    className="h-32 w-full object-cover"
                  />
                ) : (
                  <div
                    className="flex h-32 w-full items-center justify-center text-2xl font-bold text-white"
                    style={accent}
                  >
                    {c.title.slice(0, 1)}
                  </div>
                )}
                <div className="p-4">
                  <h3 className="line-clamp-2 font-semibold text-slate-900">
                    {c.title}
                  </h3>
                  <p className="mt-2 text-sm font-semibold" style={chip}>
                    {formatPrice(c.price, c.currency)}
                  </p>
                </div>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {catalog.packages.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-slate-900">
            Consultation plans
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.packages.map((p) => (
              <div
                key={p.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <h3 className="font-semibold text-slate-900">{p.name}</h3>
                {p.description ? (
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                    {p.description}
                  </p>
                ) : null}
                <p className="mt-3">
                  <span className="text-lg font-bold" style={chip}>
                    {formatPrice(p.price, p.currency)}
                  </span>
                  <span className="ml-1 text-xs text-slate-400">
                    {billingLabel(p.billingDays)}
                  </span>
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-10 rounded-2xl bg-slate-50 p-6 text-center">
        <p className="text-slate-600">
          Ready to get started with {expert.brandName}?
        </p>
        <a
          href={expert.subdomainUrl}
          className="mt-3 inline-block rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
          style={accent}
        >
          Go to {host} →
        </a>
      </section>
    </main>
  );
}
