"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card, Spinner, Badge, Button, Input, ErrorText } from "@/components/ui";
import { PageHeader } from "@/components/shell";
import { BookOpen } from "lucide-react";

type Book = {
  id: string;
  title: string;
  slug: string;
  author: string;
  description?: string;
  coverUrl?: string;
  price: number;
  currency: string;
  pageCount?: number;
  category?: { id: string; name: string } | null;
};

type Entitlement = {
  bookId: string;
  book: Book;
  progress?: { percentComplete: number; isCompleted: boolean } | null;
};

function Cover({ book }: { book: Book }) {
  if (book.coverUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={book.coverUrl}
        alt={book.title}
        className="h-40 w-full rounded-lg object-cover"
      />
    );
  }
  return (
    <div className="flex h-40 w-full items-center justify-center rounded-lg bg-brand-light text-brand">
      <BookOpen className="h-10 w-10" aria-hidden="true" />
    </div>
  );
}

export default function LibraryPage() {
  const [tab, setTab] = useState<"mine" | "browse">("mine");
  const [mine, setMine] = useState<Entitlement[] | null>(null);
  const [catalog, setCatalog] = useState<Book[] | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Entitlement[]>("/library")
      .then(setMine)
      .catch((e) => setError(e.message));
    api<Book[]>("/books")
      .then(setCatalog)
      .catch((e) => setError(e.message));
  }, []);

  const ownedIds = new Set((mine ?? []).map((e) => e.bookId));
  const filtered = (catalog ?? []).filter((b) =>
    q ? b.title.toLowerCase().includes(q.toLowerCase()) : true,
  );

  return (
    <div>
      <PageHeader
        title="Library"
        subtitle="Your books and the full catalog"
        action={
          <div className="flex rounded-xl border border-slate-200 bg-white p-1">
            <button
              onClick={() => setTab("mine")}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium ${tab === "mine" ? "bg-brand text-white" : "text-slate-600"}`}
            >
              My Books
            </button>
            <button
              onClick={() => setTab("browse")}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium ${tab === "browse" ? "bg-brand text-white" : "text-slate-600"}`}
            >
              Browse
            </button>
          </div>
        }
      />
      <ErrorText message={error} />

      {tab === "mine" ? (
        mine === null ? (
          <Spinner />
        ) : mine.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-500">
              You don’t own any books yet. Switch to <strong>Browse</strong> to
              explore the catalog.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {mine.map((e) => (
              <Card key={e.bookId} className="flex flex-col">
                <Cover book={e.book} />
                <p className="mt-3 line-clamp-2 font-semibold">{e.book.title}</p>
                <p className="text-xs text-slate-500">{e.book.author}</p>
                {e.progress && e.progress.percentComplete > 0 ? (
                  <div className="mt-2">
                    <div className="h-1.5 w-full rounded-full bg-slate-100">
                      <div
                        className="h-1.5 rounded-full bg-brand"
                        style={{ width: `${Math.min(100, e.progress.percentComplete)}%` }}
                      />
                    </div>
                  </div>
                ) : null}
                <Link href={`/client/library/${e.bookId}`} className="mt-3">
                  <Button className="w-full">
                    {e.progress?.isCompleted
                      ? "Read again"
                      : e.progress && e.progress.percentComplete > 0
                        ? "Continue"
                        : "Read"}
                  </Button>
                </Link>
              </Card>
            ))}
          </div>
        )
      ) : (
        <div>
          <div className="mb-4 max-w-sm">
            <Input
              placeholder="Search books…"
              value={q}
              onChange={(ev) => setQ(ev.target.value)}
            />
          </div>
          {catalog === null ? (
            <Spinner />
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {filtered.map((b) => {
                const owned = ownedIds.has(b.id);
                return (
                  <Card key={b.id} className="flex flex-col">
                    <Cover book={b} />
                    <div className="mt-3 flex items-start justify-between gap-2">
                      <p className="line-clamp-2 font-semibold">{b.title}</p>
                      {owned ? <Badge color="green">Owned</Badge> : null}
                    </div>
                    <p className="text-xs text-slate-500">{b.author}</p>
                    {b.description ? (
                      <p className="mt-1 line-clamp-2 text-xs text-slate-400">
                        {b.description}
                      </p>
                    ) : null}
                    <div className="mt-3">
                      {owned ? (
                        <Link href={`/client/library/${b.id}`}>
                          <Button className="w-full">Read</Button>
                        </Link>
                      ) : (
                        <Link href="/client/packages">
                          <Button variant="outline" className="w-full">
                            {b.price > 0
                              ? `${b.currency} ${b.price.toLocaleString()}`
                              : "Get access"}
                          </Button>
                        </Link>
                      )}
                    </div>
                  </Card>
                );
              })}
              {filtered.length === 0 ? (
                <p className="text-sm text-slate-400">No books found.</p>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
