"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card, Spinner, Badge, Button, ErrorText } from "@/components/ui";
import { ChevronLeft, FileText, PlayCircle, HelpCircle, ClipboardList, Lock } from "lucide-react";

type Lesson = {
  id: string;
  index: number;
  title: string;
  type: "VIDEO" | "PDF" | "TEXT" | "QUIZ" | "ASSIGNMENT";
  durationSec?: number;
  isPreview: boolean;
};

type Course = {
  id: string;
  title: string;
  description?: string;
  coverUrl?: string;
  price: number;
  currency: string;
  lessons: Lesson[];
  isEnrolled?: boolean;
  enrollment?: { percentComplete?: number } | null;
};

const lessonIcon = {
  VIDEO: PlayCircle,
  PDF: FileText,
  TEXT: FileText,
  QUIZ: HelpCircle,
  ASSIGNMENT: ClipboardList,
};

export default function CourseDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const [course, setCourse] = useState<Course | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<Course>(`/courses/${id}`).then(setCourse).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function enroll() {
    setBusy(true);
    setError(null);
    try {
      await api(`/courses/${id}/enroll`, { method: "POST" });
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!course) return <Spinner />;

  const enrolled = course.isEnrolled;

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/client/courses"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:text-brand-dark"
      >
        <ChevronLeft className="h-4 w-4" /> Back to Courses
      </Link>

      <Card className="mb-5">
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="h-32 w-full shrink-0 overflow-hidden rounded-lg bg-brand-light sm:w-48">
            {course.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={course.coverUrl} alt={course.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-brand">
                <PlayCircle className="h-12 w-12" />
              </div>
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-950">{course.title}</h1>
            {course.description ? (
              <p className="mt-1 text-sm text-slate-600">{course.description}</p>
            ) : null}
            <p className="mt-2 text-xs text-slate-500">{course.lessons.length} lessons</p>
            <div className="mt-4">
              {enrolled ? (
                <Badge color="green">You are enrolled</Badge>
              ) : (
                <Button onClick={enroll} disabled={busy}>
                  {busy
                    ? "Enrolling…"
                    : course.price > 0
                      ? `Enroll — ${course.currency} ${course.price.toLocaleString()}`
                      : "Enroll for free"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      <ErrorText message={error} />

      <Card>
        <p className="mb-3 text-sm font-semibold text-slate-900">Course content</p>
        <div className="divide-y divide-slate-100">
          {course.lessons.map((l) => {
            const Icon = lessonIcon[l.type] ?? FileText;
            const locked = !enrolled && !l.isPreview;
            return (
              <div key={l.id} className="flex items-center gap-3 py-3">
                <Icon className="h-4 w-4 text-brand" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">
                    {l.index + 1}. {l.title}
                  </p>
                  <p className="text-xs text-slate-400">
                    {l.type.toLowerCase()}
                    {l.durationSec ? ` · ${Math.round(l.durationSec / 60)} min` : ""}
                  </p>
                </div>
                {l.isPreview ? (
                  <Badge color="amber">Preview</Badge>
                ) : locked ? (
                  <Lock className="h-4 w-4 text-slate-400" />
                ) : (
                  <Badge color="green">Available</Badge>
                )}
              </div>
            );
          })}
          {course.lessons.length === 0 ? (
            <p className="py-3 text-sm text-slate-400">No lessons added yet.</p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
