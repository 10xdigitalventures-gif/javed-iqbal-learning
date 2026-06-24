"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, Spinner, Button, ErrorText } from "@/components/ui";
import { PageHeader } from "@/components/shell";
import { Headphones, Lock } from "lucide-react";

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

type Entitlement = { bookId: string };
type MediaResp = { url: string; mimeType: string };

// Audio books are books whose category name contains "audio". Admins create an
// "Audiobooks" category and tag titles into it; everything else reuses the
// existing books pipeline (secure signed media URLs, entitlements, etc.).
function isAudio(b: Book) {
  return (b.category?.name || "").toLowerCase().includes("audio");
}

export default function AudioBooksPage() {
  const [books, setBooks] = useState<Book[] | null>(null);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<{ id: string; url: string } | null>(null);

  useEffect(() => {
    api<Book[]>("/books")
      .then((all) => setBooks(all.filter(isAudio)))
      .catch((e) => setError(e.message));
    api<Entitlement[]>("/library")
      .then((es) => setOwned(new Set(es.map((e) => e.bookId))))
      .catch(() => {});
  }, []);

  async function listen(bookId: string) {
    setError(null);
    try {
      const res = await api<MediaResp>(`/library/media/${bookId}`);
      setPlaying({ id: bookId, url: res.url });
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div>
      <PageHeader
        title="Audio Books"
        subtitle="Listen to narrated titles — secure, streaming only"
      />
      <ErrorText message={error} />
      {books === null ? (
        <Spinner />
      ) : books.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500">
            No audio books are available yet. (Admins: create a category named
            “Audiobooks” and add titles to it.)
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {books.map((b) => {
            const isOwned = owned.has(b.id);
            return (
              <Card key={b.id} className="flex gap-4">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand-light text-brand">
                  {b.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.coverUrl} alt={b.title} className="h-full w-full object-cover" />
                  ) : (
                    <Headphones className="h-8 w-8" />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="line-clamp-1 font-semibold">{b.title}</p>
                  <p className="text-xs text-slate-500">{b.author}</p>
                  <div className="mt-auto pt-2">
                    {isOwned ? (
                      <Button className="w-full" onClick={() => listen(b.id)}>
                        <Headphones className="h-4 w-4" /> Listen
                      </Button>
                    ) : (
                      <Button variant="outline" className="w-full" disabled>
                        <Lock className="h-4 w-4" />
                        {b.price > 0 ? `${b.currency} ${b.price.toLocaleString()}` : "Locked"}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {playing ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white p-4 shadow-lg lg:left-72">
          <div className="mx-auto flex max-w-3xl items-center gap-4">
            <Headphones className="h-5 w-5 text-brand" />
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio src={playing.url} controls autoPlay className="w-full" />
            <button
              onClick={() => setPlaying(null)}
              className="text-sm font-medium text-slate-500 hover:text-slate-800"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
