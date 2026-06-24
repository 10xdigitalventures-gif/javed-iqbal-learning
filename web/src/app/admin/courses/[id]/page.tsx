"use client";

import React, { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  Input,
  Select,
  Spinner,
  Textarea,
} from "@/components/ui";
import { PageHeader } from "@/components/shell";

type Lesson = {
  id: string;
  index: number;
  title: string;
  type: string;
  contentKey?: string | null;
  durationSec?: number | null;
  isPreview: boolean;
};

type CourseDetail = {
  id: string;
  title: string;
  description?: string;
  price: number;
  isPublished: boolean;
  lessons: Lesson[];
  quizzes: any[];
  assignments: any[];
  _count?: { enrollments: number };
};

export default function CourseDetailPage({ params }: { params: { id: string } }) {
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [tab, setTab] = useState<"lessons" | "quizzes" | "assignments">("lessons");
  const [lessonForm, setLessonForm] = useState({
    title: "",
    index: 0,
    type: "VIDEO",
    contentKey: "",
    isPreview: false,
  });

  useEffect(() => {
    api<CourseDetail>(`/courses/${params.id}`)
      .then(setCourse)
      .catch(() => setCourse(null));
  }, [params.id]);

  async function addLesson(e: React.FormEvent) {
    e.preventDefault();
    await api("/courses/lessons", {
      method: "POST",
      body: {
        ...lessonForm,
        courseId: params.id,
        index: Number(lessonForm.index),
      },
    });
    setLessonForm({ title: "", index: 0, type: "VIDEO", contentKey: "", isPreview: false });
    const d = await api<CourseDetail>(`/courses/${params.id}`);
    setCourse(d);
  }

  async function removeLesson(id: string) {
    if (!confirm("Delete lesson?")) return;
    await api(`/courses/lessons/${id}`, { method: "DELETE" });
    if (course) {
      setCourse({ ...course, lessons: course.lessons.filter((l) => l.id !== id) });
    }
  }

  if (!course) return <Spinner />;

  return (
    <div>
      <PageHeader title={course.title} subtitle={course.description || ""} />

      <div className="mb-6 flex gap-2">
        {(["lessons", "quizzes", "assignments"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition ${
              tab === t
                ? "bg-brand text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "lessons" && (
        <div>
          <Card className="mb-6">
            <form onSubmit={addLesson} className="space-y-4">
              <h3 className="font-semibold text-slate-950">Add Lesson</h3>
              <Input label="Lesson Title" value={lessonForm.title} onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })} required />
              <div className="flex gap-4">
                <Input label="Index" type="number" value={lessonForm.index} onChange={(e) => setLessonForm({ ...lessonForm, index: +e.target.value })} />
                <Select label="Type" value={lessonForm.type} onChange={(e) => setLessonForm({ ...lessonForm, type: e.target.value })}>
                  <option value="VIDEO">Video</option>
                  <option value="PDF">PDF</option>
                  <option value="TEXT">Text</option>
                  <option value="QUIZ">Quiz</option>
                  <option value="ASSIGNMENT">Assignment</option>
                </Select>
                <label className="flex items-end pb-2 gap-2 text-sm font-medium text-slate-700">
                  <input type="checkbox" checked={lessonForm.isPreview} onChange={(e) => setLessonForm({ ...lessonForm, isPreview: e.target.checked })} />
                  Free Preview
                </label>
              </div>
              <Textarea label="Content / Video URL" rows={2} value={lessonForm.contentKey} onChange={(e) => setLessonForm({ ...lessonForm, contentKey: e.target.value })} />
              <Button type="submit"><Plus className="h-4 w-4" />Add Lesson</Button>
            </form>
          </Card>

          <div className="space-y-2">
            {course.lessons.map((l) => (
              <Card key={l.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span className="text-slate-400">#{l.index + 1}</span>
                  <div>
                    <span className="font-medium text-slate-950">{l.title}</span>
                    <div className="mt-1 flex gap-2">
                      <Badge color="blue">{l.type}</Badge>
                      {l.isPreview && <Badge color="green">Preview</Badge>}
                      {l.durationSec ? <Badge>{Math.round(l.durationSec / 60)} min</Badge> : null}
                    </div>
                  </div>
                </div>
                <Button variant="danger" onClick={() => removeLesson(l.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Card>
            ))}
            {course.lessons.length === 0 && (
              <p className="text-sm text-slate-500">No lessons yet. Add one above.</p>
            )}
          </div>
        </div>
      )}

      {tab === "quizzes" && (
        <div className="space-y-4">
          {course.quizzes.map((q: any) => (
            <Card key={q.id}>
              <h3 className="font-semibold text-slate-950">{q.title}</h3>
              <p className="text-sm text-slate-500">Pass score: {q.passScore}%</p>
              <div className="mt-3 space-y-2">
                {q.questions?.map((qq: any) => (
                  <div key={qq.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                    <strong>Q{qq.index + 1}:</strong> {qq.prompt}
                    <br />
                    Options: {JSON.parse(qq.options).join(" | ")}
                    <br />
                    Answer: #{qq.answer + 1}
                  </div>
                ))}
              </div>
            </Card>
          ))}
          {course.quizzes.length === 0 && (
            <p className="text-sm text-slate-500">No quizzes yet.</p>
          )}
        </div>
      )}

      {tab === "assignments" && (
        <div className="space-y-3">
          {course.assignments.map((a: any) => (
            <Card key={a.id}>
              <h3 className="font-semibold text-slate-950">{a.title}</h3>
              <p className="mt-1 text-sm text-slate-500">{a.description || "No description"}</p>
            </Card>
          ))}
          {course.assignments.length === 0 && (
            <p className="text-sm text-slate-500">No assignments yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
