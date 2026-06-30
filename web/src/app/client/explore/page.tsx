"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card, Spinner, Badge, Input, ErrorText } from "@/components/ui";
import { PageHeader } from "@/components/shell";
import { BookOpen, GraduationCap, Headphones, Search } from "lucide-react";

type Book = {
  id: string;
  title: string;
  author: string;
  description?: string;
  coverUrl?: string;
  price: number;
  currency: string;
  category?: { id: string; name: string } | null;
};

type Course = {
  id: string;
  title: string;
  description?: string;
  coverUrl?: string;
  price: number;
  currency: string;
  _count?: { lessons: number };
};

type Item = {
  id: string;
  kind: "book" | "audiobook" | "course";
  title: string;
  subtitle: string;
  description?: string;
  coverUrl?: string;
  price: number;
  currency: string;
  href: string;
};

const TABS = [
  { id: "all", label: "All" },
  { id: "book", label: "Books" },
  { id: "audiobook", label: "Audiobooks" },
  { id: "course", label: "Courses" },
] as const;

function isAudio(b: Book) {
  return (b.category?.name || "").toLowerCase().includes("audio");
}

function CoverArt({ item }: { item: Item }) {
  const isCourse = item.kind === "course";
  const ratio = isCourse ? "aspect-video" : "aspect-[3/4]";
  const Icon =
    item.kind === "course"
      ? GraduationCap
      : item.kind === "audiobook"
        ? Headphones
        : BookOpen;
  return (
    <div
      className={
        "relative w-full overflow-hidden rounded-xl bg-brand-light " + ratio
      }
    >
      {item.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.coverUrl}
          alt={item.title}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-brand">
          <Icon className="h-12 w-12" />
        </div>
      )}
      <span className="absolute left-2 top-2">
        <Badge color={item.kind === "course" ? "blue" : "amber"}>
          {item.kind === "course"
            ? "Course"
            : item.kind === "audiobook"
              ? "Audiobook"
              : "Novel"}
        </Badge>
      </span>
      {item.kind === "audiobook" ? (
        <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-brand shadow">
          <Headphones className="h-4 w-4" />
        </span>
      ) : null}
    </div>
  );
}

export default function ExplorePage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("all");
  const [books, setBooks] = useState<Book[] | null>(null);
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Book[]>("/books")
      .then(setBooks)
      .catch((e) => setError(e.message));
    api<Course[]>("/courses")
      .then(setCourses)
      .catch(() => setCourses([]));
  }, []);

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (const b of books ?? []) {
      const audio = isAudio(b);
      out.push({
        id: b.id,
        kind: audio ? "audiobook" : "book",
        title: b.title,
        subtitle: b.author,
        description: b.description,
        coverUrl: b.coverUrl,
        price: b.price,
        currency: b.currency,
        href: audio ? "/client/audiobooks" : `/client/library/${b.id}`,
      });
    }
    for (const c of courses ?? []) {
      out.push({
        id: c.id,
        kind: "course",
        title: c.title,
        subtitle: (c._count?.lessons ?? 0) + " lessons",
        description: c.description,
        coverUrl: c.coverUrl,
        price: c.price,
        currency: c.currency,
        href: `/client/courses/${c.id}`,
      });
    }
    return out;
  }, [books, courses]);

  const filtered = items.filter((it) => {
    if (tab !== "all" && it.kind !== tab) return false;
    if (q && !it.title.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const loading = books === null || courses === null;

  return (
    <div>
      <PageHeader title="Explore" subtitle="Discover the entire collection" />

      {/* Hero */}
      <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-brand to-brand-dark p-6 text-white">
        <p className="text-lg font-bold sm:text-2xl">
          Discover the entire collection
        </p>
        <p className="mt-1 max-w-md text-sm text-white/85">
          Novels, audiobooks and courses — all in one place. Start reading,
          listening and learning today.
        </p>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                tab === t.id
                  ? "bg-brand text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <ErrorText message={error} />

      {loading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <Card>
          <p className="py-6 text-center text-sm text-slate-500">
            Nothing here yet.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((it) => (
            <Link key={it.kind + it.id} href={it.href}>
              <Card className="flex h-full flex-col transition hover:shadow-md">
                <CoverArt item={it} />
                <p className="mt-3 line-clamp-2 text-sm font-semibold text-slate-900">
                  {it.title}
                </p>
                <p className="text-xs text-slate-500">{it.subtitle}</p>
                <p className="mt-2 text-xs font-medium text-brand">
                  {it.price > 0
                    ? it.currency + " " + it.price.toLocaleString()
                    : "Free"}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
