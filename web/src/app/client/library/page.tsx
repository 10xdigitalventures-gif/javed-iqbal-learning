"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card, Spinner, Button, ErrorText } from "@/components/ui";
import { PageHeader } from "@/components/shell";
import { useModules } from "@/lib/branding";
import { BookOpen, GraduationCap, PlayCircle } from "lucide-react";

type Book = {
  id: string;
  title: string;
  author: string;
  coverUrl?: string;
};

type Entitlement = {
  bookId: string;
  book: Book;
  progress?: { percentComplete: number; isCompleted: boolean } | null;
};

type Course = {
  id: string;
  title: string;
  coverUrl?: string;
};

type Enrollment = {
  courseId: string;
  percentComplete?: number;
  course?: Course;
};

const TABS = [
  { id: "novels", label: "Novels" },
  { id: "courses", label: "Courses" },
] as const;

function Cover({ url, kind }: { url?: string; kind: "book" | "course" }) {
  const Icon = kind === "course" ? GraduationCap : BookOpen;
  const ratio = kind === "course" ? "aspect-video" : "aspect-[3/4]";
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={url}
        alt=""
        className={"w-full rounded-xl object-cover " + ratio}
      />
    );
  }
  return (
    <div
      className={
        "flex w-full items-center justify-center rounded-xl bg-brand-light text-brand " +
        ratio
      }
    >
      <Icon className="h-10 w-10" aria-hidden="true" />
    </div>
  );
}

function progressStyle(pct: number) {
  return { width: String(Math.min(100, Math.max(0, pct))) + "%" };
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100">
      <div
        className="h-1.5 rounded-full bg-brand"
        style={progressStyle(percent)}
      />
    </div>
  );
}

export default function LibraryPage() {
  const modules = useModules();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("novels");
  const [allBooks, setAllBooks] = useState<Entitlement[] | null>(null);
  const books =
    allBooks === null
      ? null
      : modules.books_language === "both"
        ? allBooks
        : allBooks.filter(
            (e) =>
              !e.book.language || e.book.language === modules.books_language,
          );
  const [courses, setCourses] = useState<Enrollment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Entitlement[]>("/library")
      .then(setAllBooks)
      .catch((e) => setError(e.message));
    api<Enrollment[]>("/courses/me/enrolled")
      .then(setCourses)
      .catch(() => setCourses([]));
  }, []);

  // "Continue reading / learning" — only items that are in progress.
  const continueBooks = (books ?? []).filter(
    (e) => (e.progress?.percentComplete ?? 0) > 0 && !e.progress?.isCompleted,
  );
  const continueCourses = (courses ?? []).filter(
    (e) => (e.percentComplete ?? 0) > 0 && (e.percentComplete ?? 0) < 100,
  );
  const continueItems =
    tab === "novels" ? continueBooks.length : continueCourses.length;

  return (
    <div>
      <PageHeader
        title="Library"
        subtitle="Your novels and courses — pick up where you left off"
        action={
          <div className="flex rounded-xl border border-slate-200 bg-white p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium ${
                  tab === t.id ? "bg-brand text-white" : "text-slate-600"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        }
      />
      <ErrorText message={error} />

      {/* Continue reading / learning */}
      {continueItems > 0 ? (
        <div className="mb-6">
          <p className="mb-3 text-sm font-semibold text-slate-900">
            Continue {tab === "novels" ? "reading" : "learning"}
          </p>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {tab === "novels"
              ? continueBooks.map((e) => (
                  <Card key={e.bookId} className="flex flex-col">
                    <Cover url={e.book.coverUrl} kind="book" />
                    <p className="mt-3 line-clamp-2 text-sm font-semibold">
                      {e.book.title}
                    </p>
                    <ProgressBar percent={e.progress?.percentComplete ?? 0} />
                    <Link href={`/client/library/${e.bookId}`} className="mt-3">
                      <Button className="w-full">Continue</Button>
                    </Link>
                  </Card>
                ))
              : continueCourses.map((e) => (
                  <Card key={e.courseId} className="flex flex-col">
                    <Cover url={e.course?.coverUrl} kind="course" />
                    <p className="mt-3 line-clamp-2 text-sm font-semibold">
                      {e.course?.title}
                    </p>
                    <ProgressBar percent={e.percentComplete ?? 0} />
                    <Link
                      href={`/client/courses/${e.courseId}`}
                      className="mt-3"
                    >
                      <Button className="w-full">
                        <PlayCircle className="h-4 w-4" /> Continue
                      </Button>
                    </Link>
                  </Card>
                ))}
          </div>
        </div>
      ) : null}

      {/* All items in this tab */}
      {tab === "novels" ? (
        books === null ? (
          <Spinner />
        ) : books.length === 0 ? (
          <Card>
            <p className="py-6 text-center text-sm text-slate-500">
              You don’t have any novels yet. Visit{" "}
              <Link href="/client/explore" className="font-medium text-brand">
                Explore
              </Link>{" "}
              to add some.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {books.map((e) => (
              <Card key={e.bookId} className="flex flex-col">
                <Cover url={e.book.coverUrl} kind="book" />
                <p className="mt-3 line-clamp-2 text-sm font-semibold">
                  {e.book.title}
                </p>
                <p className="text-xs text-slate-500">{e.book.author}</p>
                {(e.progress?.percentComplete ?? 0) > 0 ? (
                  <ProgressBar percent={e.progress?.percentComplete ?? 0} />
                ) : null}
                <Link href={`/client/library/${e.bookId}`} className="mt-3">
                  <Button className="w-full">
                    {e.progress?.isCompleted
                      ? "Read again"
                      : (e.progress?.percentComplete ?? 0) > 0
                        ? "Continue"
                        : "Read"}
                  </Button>
                </Link>
              </Card>
            ))}
          </div>
        )
      ) : courses === null ? (
        <Spinner />
      ) : courses.length === 0 ? (
        <Card>
          <p className="py-6 text-center text-sm text-slate-500">
            You haven’t enrolled in any course yet. Visit{" "}
            <Link href="/client/explore" className="font-medium text-brand">
              Explore
            </Link>{" "}
            to get started.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {courses.map((e) => (
            <Card key={e.courseId} className="flex flex-col">
              <Cover url={e.course?.coverUrl} kind="course" />
              <p className="mt-3 line-clamp-2 text-sm font-semibold">
                {e.course?.title}
              </p>
              <ProgressBar percent={e.percentComplete ?? 0} />
              <Link href={`/client/courses/${e.courseId}`} className="mt-3">
                <Button className="w-full">
                  <PlayCircle className="h-4 w-4" /> Continue
                </Button>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
