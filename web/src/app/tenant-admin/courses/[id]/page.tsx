"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, FileVideo, Plus, Save, Trash2 } from "lucide-react";
import { api, uploadFile } from "@/lib/api";
import {
  Button,
  Card,
  ErrorText,
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
  source?: "UPLOAD" | "LINK" | "MEDIA";
  contentKey?: string | null;
  videoUrl?: string | null;
  durationSec?: number | null;
  isPreview?: boolean;
  isPublished?: boolean;
  moduleId?: string | null;
};

type ModuleT = {
  id: string;
  title: string;
  index: number;
  isPublished?: boolean;
};

type CourseDetail = {
  id: string;
  title: string;
  description?: string;
  price: number;
  currency?: string;
  isPublished: boolean;
  coverUrl?: string | null;
  lessons: Lesson[];
  modules: ModuleT[];
};

const blankLesson = {
  id: "",
  title: "",
  index: 0,
  type: "VIDEO",
  source: "UPLOAD" as "UPLOAD" | "LINK" | "MEDIA",
  contentKey: "",
  videoUrl: "",
  durationSec: 0,
  isPreview: false,
  isPublished: true,
  moduleId: "",
};

export default function TenantCourseDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [moduleTitle, setModuleTitle] = useState("");
  const [lessonForm, setLessonForm] = useState(blankLesson);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const d = await api<CourseDetail>(`/tenant-admin/courses/${params.id}`);
      setCourse(d);
    } catch (e: any) {
      setError(e?.message || "Could not load course.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const modules = useMemo(
    () => [...(course?.modules || [])].sort((a, b) => a.index - b.index),
    [course],
  );

  const lessonsOf = (moduleId?: string | null) =>
    [...(course?.lessons || [])]
      .filter((l) => (moduleId ? l.moduleId === moduleId : !l.moduleId))
      .sort((a, b) => a.index - b.index);

  async function saveCourse(e: React.FormEvent) {
    e.preventDefault();
    if (!course) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await api<any>(`/tenant-admin/courses/${course.id}`, {
        method: "PATCH",
        body: {
          title: course.title,
          description: course.description,
          coverUrl: course.coverUrl,
          price: Number(course.price || 0),
          isPublished: course.isPublished,
        },
      });
      setCourse((c) => (c ? { ...c, ...saved } : c));
      setNotice("Course details saved.");
    } catch (e: any) {
      setError(e?.message || "Could not save course.");
    } finally {
      setSaving(false);
    }
  }

  async function addModule() {
    if (!course || !moduleTitle.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api("/tenant-admin/courses/modules", {
        method: "POST",
        body: {
          courseId: course.id,
          title: moduleTitle.trim(),
          index: modules.length,
          isPublished: true,
        },
      });
      setModuleTitle("");
      await load();
    } catch (e: any) {
      setError(e?.message || "Could not add module.");
    } finally {
      setSaving(false);
    }
  }

  async function removeModule(id: string) {
    if (!confirm("Delete this module?")) return;
    await api(`/tenant-admin/courses/modules/${id}`, { method: "DELETE" });
    await load();
  }

  function startEditLesson(lesson?: Lesson, moduleId?: string | null) {
    if (!lesson) {
      setEditingLessonId(null);
      setLessonForm({
        ...blankLesson,
        moduleId: moduleId || "",
        index: lessonsOf(moduleId).length,
      });
      return;
    }
    setEditingLessonId(lesson.id);
    setLessonForm({
      id: lesson.id,
      title: lesson.title,
      index: lesson.index,
      type: lesson.type || "VIDEO",
      source: lesson.source || "UPLOAD",
      contentKey: lesson.contentKey || "",
      videoUrl: lesson.videoUrl || "",
      durationSec: lesson.durationSec || 0,
      isPreview: !!lesson.isPreview,
      isPublished: lesson.isPublished !== false,
      moduleId: lesson.moduleId || "",
    });
  }

  async function saveLesson(e: React.FormEvent) {
    e.preventDefault();
    if (!course || !lessonForm.title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        courseId: course.id,
        title: lessonForm.title.trim(),
        index: Number(lessonForm.index || 0),
        type: lessonForm.type,
        source: lessonForm.source,
        contentKey:
          lessonForm.source === "LINK" ? null : lessonForm.contentKey || null,
        videoUrl:
          lessonForm.source === "LINK" ? lessonForm.videoUrl || null : null,
        durationSec: Number(lessonForm.durationSec || 0),
        isPreview: lessonForm.isPreview,
        isPublished: lessonForm.isPublished,
        moduleId: lessonForm.moduleId || null,
      };
      if (editingLessonId) {
        await api(`/tenant-admin/courses/lessons/${editingLessonId}`, {
          method: "PATCH",
          body,
        });
      } else {
        await api("/tenant-admin/courses/lessons", {
          method: "POST",
          body,
        });
      }
      setLessonForm(blankLesson);
      setEditingLessonId(null);
      await load();
    } catch (e: any) {
      setError(e?.message || "Could not save lesson.");
    } finally {
      setSaving(false);
    }
  }

  async function removeLesson(id: string) {
    if (!confirm("Delete this lesson?")) return;
    await api(`/tenant-admin/courses/lessons/${id}`, { method: "DELETE" });
    await load();
  }

  async function uploadLessonAsset(file: File) {
    try {
      setSaving(true);
      const res = await uploadFile(file);
      setLessonForm((f) => ({ ...f, contentKey: res.key, source: "UPLOAD" }));
    } catch (e: any) {
      setError(e?.message || "Upload failed.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner />;
  if (!course) return <ErrorText message={error || "Course not found"} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={course.title}
        subtitle="Manage tenant-scoped course details, modules and lessons."
      />
      <ErrorText message={error} />
      {notice ? (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          {notice}
        </p>
      ) : null}

      <Card>
        <form onSubmit={saveCourse} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Course title"
              value={course.title}
              onChange={(e) => setCourse({ ...course, title: e.target.value })}
            />
            <Input
              label="Cover image URL"
              value={course.coverUrl || ""}
              onChange={(e) =>
                setCourse({ ...course, coverUrl: e.target.value })
              }
            />
            <Input
              label="Price"
              type="number"
              value={course.price}
              onChange={(e) =>
                setCourse({ ...course, price: Number(e.target.value) })
              }
            />
            <label className="flex items-center gap-2 pt-8 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={course.isPublished}
                onChange={(e) =>
                  setCourse({ ...course, isPublished: e.target.checked })
                }
              />
              Published
            </label>
          </div>
          <Textarea
            label="Description"
            rows={4}
            value={course.description || ""}
            onChange={(e) =>
              setCourse({ ...course, description: e.target.value })
            }
          />
          <Button type="submit" loading={saving}>
            <Save className="h-4 w-4" /> Save course details
          </Button>
        </form>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="space-y-4">
          <div>
            <h2 className="font-semibold text-slate-900">Add module</h2>
            <p className="text-sm text-slate-500">
              Use modules to group lessons for this tenant course.
            </p>
          </div>
          <Input
            label="Module title"
            value={moduleTitle}
            onChange={(e) => setModuleTitle(e.target.value)}
          />
          <Button onClick={addModule} disabled={saving || !moduleTitle.trim()}>
            <Plus className="h-4 w-4" /> Add module
          </Button>

          <div className="border-t border-slate-200 pt-4">
            <h2 className="font-semibold text-slate-900">Lesson editor</h2>
            <form onSubmit={saveLesson} className="mt-3 space-y-3">
              <Input
                label="Lesson title"
                value={lessonForm.title}
                onChange={(e) =>
                  setLessonForm({ ...lessonForm, title: e.target.value })
                }
                required
              />
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  label="Order"
                  type="number"
                  value={lessonForm.index}
                  onChange={(e) =>
                    setLessonForm({
                      ...lessonForm,
                      index: Number(e.target.value),
                    })
                  }
                />
                <Select
                  label="Type"
                  value={lessonForm.type}
                  onChange={(e) =>
                    setLessonForm({ ...lessonForm, type: e.target.value })
                  }
                >
                  <option value="VIDEO">Video</option>
                  <option value="TEXT">Text</option>
                </Select>
              </div>
              <Select
                label="Module"
                value={lessonForm.moduleId}
                onChange={(e) =>
                  setLessonForm({ ...lessonForm, moduleId: e.target.value })
                }
              >
                <option value="">No module</option>
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </Select>
              <Select
                label="Source"
                value={lessonForm.source}
                onChange={(e) =>
                  setLessonForm({
                    ...lessonForm,
                    source: e.target.value as any,
                  })
                }
              >
                <option value="UPLOAD">Uploaded file</option>
                <option value="LINK">External link</option>
                <option value="MEDIA">Media library key</option>
              </Select>
              {lessonForm.source === "LINK" ? (
                <Input
                  label="Video URL"
                  value={lessonForm.videoUrl}
                  onChange={(e) =>
                    setLessonForm({ ...lessonForm, videoUrl: e.target.value })
                  }
                />
              ) : (
                <>
                  <Input
                    label={
                      lessonForm.type === "TEXT"
                        ? "Text content"
                        : "Storage key"
                    }
                    value={lessonForm.contentKey}
                    onChange={(e) =>
                      setLessonForm({
                        ...lessonForm,
                        contentKey: e.target.value,
                      })
                    }
                  />
                  {lessonForm.type !== "TEXT" ? (
                    <label className="block text-sm font-medium text-slate-700">
                      <span className="mb-1 block">Upload lesson media</span>
                      <input
                        type="file"
                        className="block w-full text-sm"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadLessonAsset(f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  ) : null}
                </>
              )}
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  label="Duration (sec)"
                  type="number"
                  value={lessonForm.durationSec}
                  onChange={(e) =>
                    setLessonForm({
                      ...lessonForm,
                      durationSec: Number(e.target.value),
                    })
                  }
                />
                <div className="flex gap-4 pt-8 text-sm font-medium text-slate-700">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={lessonForm.isPreview}
                      onChange={(e) =>
                        setLessonForm({
                          ...lessonForm,
                          isPreview: e.target.checked,
                        })
                      }
                    />
                    Preview
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={lessonForm.isPublished}
                      onChange={(e) =>
                        setLessonForm({
                          ...lessonForm,
                          isPublished: e.target.checked,
                        })
                      }
                    />
                    Published
                  </label>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" loading={saving}>
                  <Save className="h-4 w-4" />
                  {editingLessonId ? "Update lesson" : "Add lesson"}
                </Button>
                {editingLessonId ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingLessonId(null);
                      setLessonForm(blankLesson);
                    }}
                  >
                    Cancel edit
                  </Button>
                ) : null}
              </div>
            </form>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">
                Ungrouped lessons
              </h2>
              <Button
                variant="outline"
                onClick={() => startEditLesson(undefined, null)}
              >
                <Plus className="h-4 w-4" /> Add lesson
              </Button>
            </div>
            <div className="space-y-2">
              {lessonsOf(null).length === 0 ? (
                <p className="text-sm text-slate-500">
                  No ungrouped lessons yet.
                </p>
              ) : (
                lessonsOf(null).map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {l.title}
                      </p>
                      <p className="text-xs text-slate-500">
                        #{l.index} · {l.type} ·{" "}
                        {l.isPublished === false ? "Draft" : "Published"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => startEditLesson(l)}
                      >
                        <FileVideo className="h-4 w-4" /> Edit
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => removeLesson(l.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {modules.map((m) => (
            <Card key={m.id}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-slate-900">{m.title}</h2>
                  <p className="text-xs text-slate-500">Module #{m.index}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => startEditLesson(undefined, m.id)}
                  >
                    <Plus className="h-4 w-4" /> Add lesson
                  </Button>
                  <Button variant="danger" onClick={() => removeModule(m.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                {lessonsOf(m.id).length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No lessons in this module yet.
                  </p>
                ) : (
                  lessonsOf(m.id).map((l) => (
                    <div
                      key={l.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {l.title}
                        </p>
                        <p className="text-xs text-slate-500">
                          #{l.index} · {l.type} ·{" "}
                          {l.isPublished === false ? "Draft" : "Published"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => startEditLesson(l)}
                        >
                          <BookOpen className="h-4 w-4" /> Edit
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() => removeLesson(l.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
