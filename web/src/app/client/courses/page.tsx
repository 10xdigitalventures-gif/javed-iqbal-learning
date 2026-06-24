"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card, Spinner, Badge, Button, ErrorText } from "@/components/ui";
import { PageHeader } from "@/components/shell";
import { GraduationCap, PlayCircle } from "lucide-react";

type Course = {
  id: string;
  title: string;
  slug: string;
  description?: string;
  coverUrl?: string;
  price: number;
  currency: string;
  _count?: { lessons: number };
  lessons?: Array<{ id: string }>;
};

type Enrollment = {
  courseId: string;
  percentComplete?: number;
  course?: Course;
};

function CourseCover({ course }: { course: Course }) {
  if (course.coverUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={course.coverUrl} alt={course.title} className="h-36 w-full rounded-lg object-cover" />;
  }
  return (
    <div className="flex h-36 w-full items-center justify-center rounded-lg bg-brand-light text-brand">
      <GraduationCap className="h-10 w-10" />
    </div>
  );
}

export default function CoursesPage() {
  const [tab, setTab] = useState<"all" | "mine">("all");
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [mine, setMine] = useState<Enrollment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Course[]>("/courses").then(setCourses).catch((e) => setError(e.message));
    api<Enrollment[]>("/courses/me/enrolled").then(setMine).catch(() => setMine([]));
  }, []);

  const enrolledIds = new Set((mine ?? []).map((e) => e.courseId));

  return (
    <div>
      <PageHeader
        title="Courses"
        subtitle="Structured learning with lessons, quizzes and certificates"
        action={
          <div className="flex rounded-xl border border-slate-200 bg-white p-1">
            <button
              onClick={() => setTab("all")}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium ${tab === "all" ? "bg-brand text-white" : "text-slate-600"}`}
            >
              All courses
            </button>
            <button
              onClick={() => setTab("mine")}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium ${tab === "mine" ? "bg-brand text-white" : "text-slate-600"}`}
            >
              My learning
            </button>
          </div>
        }
      />
      <ErrorText message={error} />

      {tab === "all" ? (
        courses === null ? (
          <Spinner />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => {
              const enrolled = enrolledIds.has(c.id);
              const lessonCount = c._count?.lessons ?? c.lessons?.length ?? 0;
              return (
                <Card key={c.id} className="flex flex-col">
                  <CourseCover course={c} />
                  <div className="mt-3 flex items-start justify-between gap-2">
                    <p className="line-clamp-2 font-semibold">{c.title}</p>
                    {enrolled ? <Badge color="green">Enrolled</Badge> : null}
                  </div>
                  {c.description ? (
                    <p className="mt-1 line-clamp-2 text-xs text-slate-400">{c.description}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-slate-500">{lessonCount} lessons</p>
                  <Link href={`/client/courses/${c.id}`} className="mt-3">
                    <Button className="w-full">
                      {enrolled ? "Continue" : c.price > 0 ? `${c.currency} ${c.price.toLocaleString()}` : "View course"}
                    </Button>
                  </Link>
                </Card>
              );
            })}
            {courses.length === 0 ? (
              <p className="text-sm text-slate-400">No courses published yet.</p>
            ) : null}
          </div>
        )
      ) : mine === null ? (
        <Spinner />
      ) : mine.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500">
            You haven’t enrolled in any course yet.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {mine.map((e) => {
            const c = e.course;
            if (!c) return null;
            return (
              <Card key={e.courseId} className="flex flex-col">
                <CourseCover course={c} />
                <p className="mt-3 line-clamp-2 font-semibold">{c.title}</p>
                <div className="mt-2">
                  <div className="mb-1 flex justify-between text-xs text-slate-500">
                    <span>Progress</span>
                    <span>{Math.round(e.percentComplete ?? 0)}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100">
                    <div
                      className="h-1.5 rounded-full bg-brand"
                      style={{ width: `${Math.min(100, e.percentComplete ?? 0)}%` }}
                    />
                  </div>
                </div>
                <Link href={`/client/courses/${e.courseId}`} className="mt-3">
                  <Button className="w-full">
                    <PlayCircle className="h-4 w-4" /> Continue
                  </Button>
                </Link>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
