"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
type Progress = {
  bookId: string;
  percentComplete: number;
  lastAudioPositionSec: number;
  isCompleted: boolean;
};

// Audio books are books whose category name contains "audio". Admins create an
// "Audiobooks" category and tag titles into it; everything else reuses the
// existing books pipeline (secure signed media URLs, entitlements, etc.).
function isAudio(b: Book) {
  return (b.category?.name || "").toLowerCase().includes("audio");
}

function fmt(sec: number) {
  if (!sec || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function AudioBooksPage() {
  const [books, setBooks] = useState<Book[] | null>(null);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<{
    id: string;
    title: string;
    url: string;
    resumeSec: number;
  } | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSaveRef = useRef(0);
  const didSeekRef = useRef(false);

  const loadProgress = useCallback(() => {
    api<Progress[]>("/library/listening")
      .then((rows) => {
        const map: Record<string, Progress> = {};
        for (const r of rows) map[r.bookId] = r;
        setProgress(map);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    api<Book[]>("/books")
      .then((all) => setBooks(all.filter(isAudio)))
      .catch((e) => setError(e.message));
    api<Entitlement[]>("/library")
      .then((es) => setOwned(new Set(es.map((e) => e.bookId))))
      .catch(() => {});
    loadProgress();
  }, [loadProgress]);

  async function listen(book: Book) {
    setError(null);
    try {
      const [res, prog] = await Promise.all([
        api<MediaResp>(`/library/media/${book.id}`),
        api<Progress | null>(`/library/progress/${book.id}`).catch(() => null),
      ]);
      didSeekRef.current = false;
      lastSaveRef.current = 0;
      setPlaying({
        id: book.id,
        title: book.title,
        url: res.url,
        resumeSec: prog?.lastAudioPositionSec || 0,
      });
    } catch (e: any) {
      setError(e.message);
    }
  }

  // Persist the current playback offset + percent. Throttled by the caller.
  const save = useCallback(
    (
      bookId: string,
      positionSec: number,
      durationSec: number,
      ended = false,
    ) => {
      const percent =
        durationSec > 0
          ? Math.min(100, Math.round((positionSec / durationSec) * 100))
          : 0;
      api(`/library/progress/${bookId}`, {
        method: "PUT",
        body: {
          lastAudioPositionSec: Math.round(positionSec),
          percentComplete: percent,
          isCompleted: ended || percent >= 99,
        },
      }).catch(() => {});
      setProgress((p) => ({
        ...p,
        [bookId]: {
          bookId,
          percentComplete: percent,
          lastAudioPositionSec: Math.round(positionSec),
          isCompleted: ended || percent >= 99,
        },
      }));
    },
    [],
  );

  function onLoadedMetadata() {
    const el = audioRef.current;
    if (!el || !playing || didSeekRef.current) return;
    didSeekRef.current = true;
    if (playing.resumeSec > 0 && playing.resumeSec < el.duration - 5) {
      el.currentTime = playing.resumeSec;
    }
  }

  function onTimeUpdate() {
    const el = audioRef.current;
    if (!el || !playing) return;
    const now = Date.now();
    // Throttle saves to once every 10 seconds of wall-clock time.
    if (now - lastSaveRef.current < 10000) return;
    lastSaveRef.current = now;
    save(playing.id, el.currentTime, el.duration);
  }

  function onEnded() {
    const el = audioRef.current;
    if (!el || !playing) return;
    save(playing.id, el.duration, el.duration, true);
  }

  function close() {
    const el = audioRef.current;
    if (el && playing && el.currentTime > 0) {
      save(playing.id, el.currentTime, el.duration);
    }
    setPlaying(null);
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
            const prog = progress[b.id];
            const pct = prog?.percentComplete || 0;
            return (
              <Card key={b.id} className="flex gap-4">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand-light text-brand">
                  {b.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={b.coverUrl}
                      alt={b.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Headphones className="h-8 w-8" />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="line-clamp-1 font-semibold">{b.title}</p>
                  <p className="text-xs text-slate-500">{b.author}</p>
                  {isOwned && pct > 0 ? (
                    <div className="mt-2">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-brand"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {prog?.isCompleted
                          ? "Finished"
                          : `${pct}% • resume at ${fmt(prog?.lastAudioPositionSec || 0)}`}
                      </p>
                    </div>
                  ) : null}
                  <div className="mt-auto pt-2">
                    {isOwned ? (
                      <Button className="w-full" onClick={() => listen(b)}>
                        <Headphones className="h-4 w-4" />{" "}
                        {pct > 0 && !prog?.isCompleted ? "Resume" : "Listen"}
                      </Button>
                    ) : (
                      <Button variant="outline" className="w-full" disabled>
                        <Lock className="h-4 w-4" />
                        {b.price > 0
                          ? `${b.currency} ${b.price.toLocaleString()}`
                          : "Locked"}
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
            <Headphones className="h-5 w-5 shrink-0 text-brand" />
            <div className="min-w-0 flex-1">
              <p className="mb-1 line-clamp-1 text-xs font-medium text-slate-600">
                {playing.title}
              </p>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio
                ref={audioRef}
                src={playing.url}
                controls
                autoPlay
                onLoadedMetadata={onLoadedMetadata}
                onTimeUpdate={onTimeUpdate}
                onEnded={onEnded}
                onPause={onTimeUpdate}
                className="w-full"
              />
            </div>
            <button
              onClick={close}
              className="shrink-0 text-sm font-medium text-slate-500 hover:text-slate-800"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
