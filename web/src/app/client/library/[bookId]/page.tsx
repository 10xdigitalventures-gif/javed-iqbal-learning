"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card, Spinner, Button, ErrorText } from "@/components/ui";
import { ChevronLeft } from "lucide-react";

type ChapterRef = { id: string; index: number; title: string };
type SecureContent = {
  bookId: string;
  chapterId: string | null;
  chapterTitle: string;
  chapterIndex: number;
  chapters: ChapterRef[];
  content: string;
};

export default function ReaderPage() {
  const params = useParams();
  const bookId = String(params.bookId);
  const [data, setData] = useState<SecureContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    (chapterId?: string) => {
      setLoading(true);
      const qs = chapterId ? `?chapterId=${encodeURIComponent(chapterId)}` : "";
      api<SecureContent>(`/library/content/${bookId}${qs}`)
        .then((d) => {
          setData(d);
          setError(null);
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    },
    [bookId],
  );

  useEffect(() => {
    load();
  }, [load]);

  // Persist reading progress as the reader opens a chapter.
  useEffect(() => {
    if (!data) return;
    const total = data.chapters.length || 1;
    const percent = Math.round(((data.chapterIndex + 1) / total) * 100);
    api(`/library/progress/${bookId}`, {
      method: "PUT",
      body: {
        chapterId: data.chapterId,
        percentComplete: percent,
        isCompleted: percent >= 100,
      },
    }).catch(() => {});
  }, [data, bookId]);

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/client/library"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:text-brand-dark"
      >
        <ChevronLeft className="h-4 w-4" /> Back to Library
      </Link>
      <ErrorText message={error} />
      {loading && !data ? (
        <Spinner />
      ) : data ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[220px,1fr]">
          <Card className="h-fit">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Chapters
            </p>
            <div className="space-y-1">
              {data.chapters.map((c) => (
                <button
                  key={c.id}
                  onClick={() => load(c.id)}
                  className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${c.id === data.chapterId ? "bg-brand text-white" : "text-slate-600 hover:bg-brand-light"}`}
                >
                  {c.index + 1}. {c.title}
                </button>
              ))}
              {data.chapters.length === 0 ? (
                <p className="text-xs text-slate-400">Single document</p>
              ) : null}
            </div>
          </Card>
          <Card>
            <h1 className="mb-4 text-xl font-bold text-slate-950">
              {data.chapterTitle}
            </h1>
            <article className="prose prose-slate max-w-none whitespace-pre-wrap text-[15px] leading-7 text-slate-800">
              {data.content}
            </article>
            {data.chapters.length > 1 ? (
              <div className="mt-6 flex justify-between">
                <Button
                  variant="outline"
                  disabled={data.chapterIndex <= 0}
                  onClick={() => {
                    const prev = data.chapters.find(
                      (c) => c.index === data.chapterIndex - 1,
                    );
                    if (prev) load(prev.id);
                  }}
                >
                  Previous
                </Button>
                <Button
                  disabled={data.chapterIndex >= data.chapters.length - 1}
                  onClick={() => {
                    const next = data.chapters.find(
                      (c) => c.index === data.chapterIndex + 1,
                    );
                    if (next) load(next.id);
                  }}
                >
                  Next
                </Button>
              </div>
            ) : null}
          </Card>
        </div>
      ) : null}
    </div>
  );
}
