"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Plus,
  Trash2,
  Image as ImageIcon,
  Check,
  Loader2,
  Paperclip,
  Download,
  FileText,
  ChevronDown,
  ChevronUp,
  Save,
  Pencil,
} from "lucide-react";
import {
  api,
  uploadFile,
  signMedia,
  listMedia,
  type MediaAsset,
} from "@/lib/api";
import {
  Badge,
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
  thumbnailUrl?: string | null;
  durationSec?: number | null;
  isPreview: boolean;
  moduleId?: string | null;
  lockMode?: "SINGLE" | "BOTH";
  unlockDelayHours?: number;
};

// A course module (section) used to group lessons + apply drip-locks.
type ModuleT = {
  id: string;
  title: string;
  index: number;
  lockMode: "SINGLE" | "BOTH";
  unlockDelayHours: number;
};

// A reference / submitted file descriptor stored as JSON on the assignment.
type SubFile = { key: string; name: string; size?: number };

type Assignment = {
  id: string;
  title: string;
  description?: string | null;
  lessonId?: string | null;
  attachments?: SubFile[] | string | null;
};

type CourseDetail = {
  id: string;
  title: string;
  description?: string;
  price: number;
  isPublished: boolean;
  lessons: Lesson[];
  modules: ModuleT[];
  quizzes: any[];
  assignments: Assignment[];
  _count?: { enrollments: number };
};

type VideoSource = "UPLOAD" | "LINK" | "MEDIA";

const BLANK = {
  title: "",
  index: 0,
  type: "VIDEO",
  source: "UPLOAD" as VideoSource,
  contentKey: "",
  videoUrl: "",
  thumbnailUrl: "",
  durationSec: null as number | null,
  isPreview: false,
  moduleId: "",
  lockMode: "SINGLE",
  unlockDelayHours: 0,
  // Assignment-only fields.
  instructions: "",
  refFiles: [] as SubFile[],
};

function prettySize(bytes?: number) {
  if (!bytes || bytes <= 0) return "";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return mb.toFixed(1) + " MB";
  return Math.max(1, Math.round(bytes / 1024)) + " KB";
}

// Open a stored file by signing its key on demand.
async function openFile(key: string) {
  try {
    const url = await signMedia(key);
    if (url) window.open(url, "_blank");
  } catch {
    alert("Could not open this file.");
  }
}

function asFiles(v: SubFile[] | string | null | undefined): SubFile[] {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

type MediaVals = {
  source: VideoSource;
  contentKey: string;
  videoUrl: string;
  durationSec: number | null;
};

// Reusable video / document source picker rendered as a DROPDOWN (Upload, Link,
// Media Library). Shared by the Add Lesson form and the per-lesson editor.
function LessonSourceFields({
  type,
  source,
  contentKey,
  videoUrl,
  durationSec,
  onChange,
}: {
  type: string;
  source: VideoSource;
  contentKey: string;
  videoUrl: string;
  durationSec: number | null;
  onChange: (patch: Partial<MediaVals>) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [mediaItems, setMediaItems] = useState<MediaAsset[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const mediaFilter = type === "PDF" ? "pdf" : "video";

  async function loadMedia() {
    setMediaLoading(true);
    try {
      setMediaItems(await listMedia(mediaFilter));
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setMediaLoading(false);
    }
  }

  function pick(src: VideoSource) {
    onChange({ source: src });
    if (src === "MEDIA") loadMedia();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setErr(null);
    try {
      const r = await uploadFile(file);
      onChange({
        source: "UPLOAD",
        contentKey: r.key,
        durationSec: r.durationSec ?? durationSec,
      });
    } catch (e: any) {
      setErr(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="mb-3 text-sm font-semibold text-slate-900">
        {type === "PDF" ? "Document source" : "Video source"}
      </p>
      <div className="mb-4 max-w-xs">
        <Select
          label=""
          value={source}
          onChange={(e) => pick(e.target.value as VideoSource)}
        >
          <option value="UPLOAD">Upload</option>
          <option value="LINK">Link (YouTube / Vimeo)</option>
          <option value="MEDIA">Media Library</option>
        </Select>
      </div>

      {source === "UPLOAD" && (
        <div>
          <input
            ref={fileRef}
            type="file"
            accept={type === "PDF" ? "application/pdf" : "video/*"}
            onChange={onFile}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-dark"
          />
          {uploading && (
            <p className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500">
              <Loader2 className="h-3 w-3 animate-spin" /> Uploading to
              storage...
            </p>
          )}
          {contentKey && !uploading && (
            <p className="mt-2 inline-flex items-center gap-1 text-xs text-green-600">
              <Check className="h-3 w-3" /> Uploaded
              {durationSec ? ` - ${Math.round(durationSec / 60)} min` : ""}
            </p>
          )}
        </div>
      )}

      {source === "LINK" && (
        <Input
          label="Video link (YouTube, Vimeo, or direct .mp4)"
          placeholder="https://youtu.be/..."
          value={videoUrl}
          onChange={(e) => onChange({ videoUrl: e.target.value })}
        />
      )}

      {source === "MEDIA" && (
        <div>
          {mediaLoading ? (
            <p className="inline-flex items-center gap-1 text-xs text-slate-500">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading library...
            </p>
          ) : mediaItems.length === 0 ? (
            <p className="text-xs text-slate-500">
              No items in your Media Library yet. Upload one first.
            </p>
          ) : (
            <div className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
              {mediaItems.map((m) => (
                <button
                  type="button"
                  key={m.id}
                  onClick={() =>
                    onChange({
                      source: "MEDIA",
                      contentKey: m.key,
                      durationSec: m.durationSec ?? durationSec,
                    })
                  }
                  className={`truncate rounded-lg border px-3 py-2 text-left text-xs transition ${
                    contentKey === m.key
                      ? "border-brand bg-brand-light text-brand-dark"
                      : "border-slate-200 text-slate-600 hover:border-brand"
                  }`}
                  title={m.filename}
                >
                  {contentKey === m.key ? (
                    <Check className="mb-1 h-3 w-3" />
                  ) : null}
                  {m.filename}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <ErrorText message={err} />
    </div>
  );
}

// Reusable thumbnail picker with an Upload / Link DROPDOWN. thumbnailUrl stores
// either a storage key (upload) or an external image URL (link).
function ThumbnailField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [mode, setMode] = useState<"UPLOAD" | "LINK">(
    value && /^https?:\/\//i.test(value) ? "LINK" : "UPLOAD",
  );
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const r = await uploadFile(file);
      onChange(r.key);
    } catch {
      alert("Thumbnail upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900">
        <ImageIcon className="h-4 w-4" /> Thumbnail (optional)
      </p>
      <div className="mb-3 max-w-xs">
        <Select
          label=""
          value={mode}
          onChange={(e) => setMode(e.target.value as "UPLOAD" | "LINK")}
        >
          <option value="UPLOAD">Upload image</option>
          <option value="LINK">Image link (URL)</option>
        </Select>
      </div>
      {mode === "UPLOAD" ? (
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={onFile}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-200 file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-300"
          />
          {uploading && (
            <p className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500">
              <Loader2 className="h-3 w-3 animate-spin" /> Uploading thumbnail...
            </p>
          )}
          {value && !uploading && (
            <p className="mt-2 inline-flex items-center gap-1 text-xs text-green-600">
              <Check className="h-3 w-3" /> Thumbnail ready
            </p>
          )}
        </div>
      ) : (
        <Input
          label="Thumbnail image URL"
          placeholder="https://.../image.jpg"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

export default function CourseDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [tab, setTab] = useState<
    "lessons" | "modules" | "quizzes" | "assignments"
  >("lessons");
  const [form, setForm] = useState({ ...BLANK });
  const [uploading, setUploading] = useState<"video" | "thumb" | "ref" | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refInput = useRef<HTMLInputElement>(null);

  async function reload() {
    const d = await api<CourseDetail>(`/courses/${params.id}`);
    setCourse(d);
  }

  useEffect(() => {
    api<CourseDetail>(`/courses/${params.id}`)
      .then(setCourse)
      .catch(() => setCourse(null));
  }, [params.id]);

  // The video source only applies to playable lesson types; TEXT keeps an
  // inline body, quizzes/assignments are managed in their own tabs.
  const isPlayable = form.type === "VIDEO" || form.type === "PDF";
  const isAssignment = form.type === "ASSIGNMENT";

  // Upload one or more instructor reference files for the new assignment.
  async function onRefFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading("ref");
    setErr(null);
    try {
      for (const file of files) {
        const r = await uploadFile(file);
        const entry: SubFile = {
          key: r.key,
          name: r.filename || file.name,
          size: r.size ?? file.size,
        };
        setForm((f) => ({ ...f, refFiles: [...f.refFiles, entry] }));
      }
    } catch (e: any) {
      setErr(e.message || "Attachment upload failed");
    } finally {
      setUploading(null);
      if (refInput.current) refInput.current.value = "";
    }
  }

  function removeRefFile(key: string) {
    setForm((f) => ({
      ...f,
      refFiles: f.refFiles.filter((x) => x.key !== key),
    }));
  }

  async function addLesson(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = {
        courseId: params.id,
        title: form.title,
        index: Number(form.index),
        type: form.type,
        isPreview: form.isPreview,
        thumbnailUrl: form.thumbnailUrl || null,
        durationSec: form.durationSec,
        moduleId: form.moduleId || null,
        lockMode: form.lockMode,
        unlockDelayHours:
          form.lockMode === "BOTH" ? Number(form.unlockDelayHours) : 0,
      };
      if (form.type === "TEXT") {
        body.source = "UPLOAD";
        body.contentKey = form.contentKey || null;
      } else if (form.type === "QUIZ" || form.type === "ASSIGNMENT") {
        body.source = "UPLOAD";
      } else if (form.source === "LINK") {
        body.source = "LINK";
        body.videoUrl = form.videoUrl || null;
      } else {
        body.source = form.source; // UPLOAD | MEDIA
        body.contentKey = form.contentKey || null;
      }
      const lesson = await api<Lesson>("/courses/lessons", {
        method: "POST",
        body,
      });

      // An ASSIGNMENT lesson also gets a linked Assignment record carrying the
      // task instructions and the instructor's reference attachments.
      if (form.type === "ASSIGNMENT") {
        await api("/courses/assignments", {
          method: "POST",
          body: {
            courseId: params.id,
            lessonId: lesson.id,
            title: form.title,
            description: form.instructions || null,
            attachments: JSON.stringify(form.refFiles),
          },
        });
      }

      setForm({ ...BLANK });
      if (refInput.current) refInput.current.value = "";
      await reload();
    } catch (e: any) {
      setErr(e.message || "Could not add lesson");
    } finally {
      setSaving(false);
    }
  }

  async function removeLesson(id: string) {
    if (!confirm("Delete lesson?")) return;
    await api(`/courses/lessons/${id}`, { method: "DELETE" });
    await reload();
  }

  if (!course) return <Spinner />;

  return (
    <div>
      <PageHeader title={course.title} subtitle={course.description || ""} />

      <div className="mb-6 flex gap-2">
        {(["lessons", "modules", "quizzes", "assignments"] as const).map((t) => (
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
              <Input
                label="Lesson Title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
              <div className="flex gap-4">
                <Input
                  label="Index"
                  type="number"
                  value={form.index}
                  onChange={(e) => setForm({ ...form, index: +e.target.value })}
                />
                <Select
                  label="Type"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  <option value="VIDEO">Video</option>
                  <option value="PDF">PDF</option>
                  <option value="TEXT">Text</option>
                  <option value="QUIZ">Quiz</option>
                  <option value="ASSIGNMENT">Assignment</option>
                </Select>
                <label className="flex items-end gap-2 pb-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.isPreview}
                    onChange={(e) =>
                      setForm({ ...form, isPreview: e.target.checked })
                    }
                  />
                  Free Preview
                </label>
              </div>

              {/* Module assignment + drip lock for this lesson */}
              <div className="grid gap-4 sm:grid-cols-3">
                <Select
                  label="Module / Section"
                  value={form.moduleId}
                  onChange={(e) =>
                    setForm({ ...form, moduleId: e.target.value })
                  }
                >
                  <option value="">No module (standalone)</option>
                  {(course.modules || []).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Lesson lock"
                  value={form.lockMode}
                  onChange={(e) =>
                    setForm({ ...form, lockMode: e.target.value })
                  }
                >
                  <option value="SINGLE">Open after previous lesson</option>
                  <option value="BOTH">Previous lesson + time delay</option>
                </Select>
                {form.lockMode === "BOTH" && (
                  <Input
                    label="Unlock delay (hours)"
                    type="number"
                    min={0}
                    value={form.unlockDelayHours}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        unlockDelayHours: +e.target.value,
                      })
                    }
                  />
                )}
              </div>

              {/* Inline body for text lessons */}
              {form.type === "TEXT" && (
                <Textarea
                  label="Lesson text"
                  rows={4}
                  value={form.contentKey}
                  onChange={(e) =>
                    setForm({ ...form, contentKey: e.target.value })
                  }
                />
              )}

              {/* Assignment task + reference attachments */}
              {isAssignment && (
                <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                  <Textarea
                    label="Assignment task (shown on the Details tab)"
                    rows={6}
                    placeholder="Describe the task. Markdown, English and Urdu are all supported."
                    value={form.instructions}
                    onChange={(e) =>
                      setForm({ ...form, instructions: e.target.value })
                    }
                  />
                  <div>
                    <p className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                      <Paperclip className="h-4 w-4" /> Reference attachments
                      (optional)
                    </p>
                    <input
                      ref={refInput}
                      type="file"
                      multiple
                      onChange={onRefFiles}
                      className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-200 file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-300"
                    />
                    {uploading === "ref" && (
                      <p className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500">
                        <Loader2 className="h-3 w-3 animate-spin" /> Uploading...
                      </p>
                    )}
                    {form.refFiles.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {form.refFiles.map((rf) => (
                          <div
                            key={rf.key}
                            className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs"
                          >
                            <span className="inline-flex items-center gap-1.5 text-slate-700">
                              <FileText className="h-3.5 w-3.5" /> {rf.name}
                              {rf.size ? ` (${prettySize(rf.size)})` : ""}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeRefFile(rf.key)}
                              className="text-red-500 hover:text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Video / document source (dropdown) for playable lessons */}
              {isPlayable && (
                <LessonSourceFields
                  type={form.type}
                  source={form.source}
                  contentKey={form.contentKey}
                  videoUrl={form.videoUrl}
                  durationSec={form.durationSec}
                  onChange={(p) => setForm((f) => ({ ...f, ...p }))}
                />
              )}

              {/* Thumbnail (upload or link) for non-quiz lessons */}
              {form.type !== "QUIZ" && (
                <ThumbnailField
                  value={form.thumbnailUrl}
                  onChange={(v) => setForm((f) => ({ ...f, thumbnailUrl: v }))}
                />
              )}

              <ErrorText message={err} />

              <Button type="submit" disabled={saving || !!uploading}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" /> Add Lesson
                  </>
                )}
              </Button>
            </form>
          </Card>

          <div className="space-y-2">
            {course.lessons.map((l) => (
              <LessonRow
                key={l.id}
                lesson={l}
                modules={course.modules || []}
                onChanged={reload}
                onRemove={() => removeLesson(l.id)}
              />
            ))}
            {course.lessons.length === 0 && (
              <p className="text-sm text-slate-500">
                No lessons yet. Add one above.
              </p>
            )}
          </div>
        </div>
      )}

      {tab === "modules" && (
        <ModuleManager
          courseId={params.id}
          modules={course.modules || []}
          onChanged={reload}
        />
      )}

      {tab === "quizzes" && (
        <QuizManager
          courseId={params.id}
          lessons={course.lessons}
          quizzes={course.quizzes}
          onChanged={reload}
        />
      )}

      {tab === "assignments" && (
        <div className="space-y-4">
          {course.assignments.map((a) => (
            <AssignmentCard key={a.id} assignment={a} onChanged={reload} />
          ))}
          {course.assignments.length === 0 && (
            <p className="text-sm text-slate-500">
              No assignments yet. Add an ASSIGNMENT-type lesson to create one.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// One assignment: editable task + reference files, plus its review queue.
// --------------------------------------------------------------------------
// Create / edit / delete course modules (sections) with their drip-lock rules.
function ModuleManager({
  courseId,
  modules,
  onChanged,
}: {
  courseId: string;
  modules: ModuleT[];
  onChanged: () => Promise<void> | void;
}) {
  const [title, setTitle] = useState("");
  const [lockMode, setLockMode] = useState("SINGLE");
  const [delay, setDelay] = useState(0);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function createModule(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      await api("/courses/modules", {
        method: "POST",
        body: {
          courseId,
          title,
          index: modules.length,
          lockMode,
          unlockDelayHours: lockMode === "BOTH" ? Number(delay) : 0,
        },
      });
      setTitle("");
      setLockMode("SINGLE");
      setDelay(0);
      await onChanged();
    } catch (e: any) {
      setErr(e.message || "Could not create module");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Card className="mb-6">
        <form onSubmit={createModule} className="space-y-4">
          <h3 className="font-semibold text-slate-950">Add Module / Section</h3>
          <Input
            label="Module title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Module lock"
              value={lockMode}
              onChange={(e) => setLockMode(e.target.value)}
            >
              <option value="SINGLE">Open after previous module</option>
              <option value="BOTH">Previous module + time delay</option>
            </Select>
            {lockMode === "BOTH" && (
              <Input
                label="Unlock delay (hours)"
                type="number"
                min={0}
                value={delay}
                onChange={(e) => setDelay(+e.target.value)}
              />
            )}
          </div>
          <p className="text-xs text-slate-500">
            With “Previous module + time delay”, the countdown starts the moment
            the learner finishes the previous module.
          </p>
          <ErrorText message={err} />
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" /> Add Module
              </>
            )}
          </Button>
        </form>
      </Card>

      <div className="space-y-2">
        {modules.map((m) => (
          <ModuleRow key={m.id} module={m} onChanged={onChanged} />
        ))}
        {modules.length === 0 && (
          <p className="text-sm text-slate-500">
            No modules yet. Add one above, then assign lessons to it from the
            Lessons tab.
          </p>
        )}
      </div>
    </div>
  );
}

// A single editable module row.
function ModuleRow({
  module,
  onChanged,
}: {
  module: ModuleT;
  onChanged: () => Promise<void> | void;
}) {
  const [title, setTitle] = useState(module.title);
  const [lockMode, setLockMode] = useState<"SINGLE" | "BOTH">(module.lockMode);
  const [delay, setDelay] = useState(module.unlockDelayHours);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await api(`/courses/modules/${module.id}`, {
        method: "PATCH",
        body: {
          title,
          lockMode,
          unlockDelayHours: lockMode === "BOTH" ? Number(delay) : 0,
        },
      });
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Delete module? Its lessons stay but become ungrouped."))
      return;
    setBusy(true);
    try {
      await api(`/courses/modules/${module.id}`, { method: "DELETE" });
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-slate-400">#{module.index + 1}</span>
        <Input
          label=""
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Module lock"
          value={lockMode}
          onChange={(e) => setLockMode(e.target.value as "SINGLE" | "BOTH")}
        >
          <option value="SINGLE">Open after previous module</option>
          <option value="BOTH">Previous module + time delay</option>
        </Select>
        {lockMode === "BOTH" && (
          <Input
            label="Unlock delay (hours)"
            type="number"
            min={0}
            value={delay}
            onChange={(e) => setDelay(+e.target.value)}
          />
        )}
      </div>
      <div className="flex gap-2">
        <Button onClick={save} disabled={busy}>
          <Save className="h-4 w-4" /> Save
        </Button>
        <Button variant="danger" onClick={remove} disabled={busy}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}

// A lesson row in the admin list: inline module + drip-lock assignment, plus a
// full "Edit" panel (title, free-preview, video source, thumbnail).
function LessonRow({
  lesson,
  modules,
  onChanged,
  onRemove,
}: {
  lesson: Lesson;
  modules: ModuleT[];
  onChanged: () => Promise<void> | void;
  onRemove: () => void;
}) {
  const [moduleId, setModuleId] = useState(lesson.moduleId || "");
  const [lockMode, setLockMode] = useState<"SINGLE" | "BOTH">(
    lesson.lockMode || "SINGLE",
  );
  const [delay, setDelay] = useState(lesson.unlockDelayHours || 0);
  const [busy, setBusy] = useState(false);
  const moduleTitle = modules.find((m) => m.id === lesson.moduleId)?.title;

  // Full-edit panel state.
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(lesson.title);
  const [isPreview, setIsPreview] = useState(lesson.isPreview);
  const [source, setSource] = useState<VideoSource>(
    (lesson.source as VideoSource) || "UPLOAD",
  );
  const [contentKey, setContentKey] = useState(lesson.contentKey || "");
  const [videoUrl, setVideoUrl] = useState(lesson.videoUrl || "");
  const [thumbnailUrl, setThumbnailUrl] = useState(lesson.thumbnailUrl || "");
  const [durationSec, setDurationSec] = useState<number | null>(
    lesson.durationSec ?? null,
  );
  const isPlayable = lesson.type === "VIDEO" || lesson.type === "PDF";

  async function save() {
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        moduleId: moduleId || null,
        lockMode,
        unlockDelayHours: lockMode === "BOTH" ? Number(delay) : 0,
      };
      if (editing) {
        body.title = title;
        body.isPreview = isPreview;
        body.thumbnailUrl = thumbnailUrl || null;
        if (isPlayable) {
          body.source = source;
          if (source === "LINK") {
            body.videoUrl = videoUrl || null;
            body.contentKey = null;
          } else {
            body.contentKey = contentKey || null;
            body.videoUrl = null;
          }
          if (durationSec != null) body.durationSec = durationSec;
        }
      }
      await api(`/courses/lessons/${lesson.id}`, { method: "PATCH", body });
      await onChanged();
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-slate-400">#{lesson.index + 1}</span>
          <div>
            <span className="font-medium text-slate-950">{lesson.title}</span>
            <div className="mt-1 flex flex-wrap gap-2">
              <Badge color="blue">{lesson.type}</Badge>
              {lesson.source === "LINK" && <Badge>Link</Badge>}
              {lesson.source === "MEDIA" && <Badge>Library</Badge>}
              {lesson.isPreview && <Badge color="green">Preview</Badge>}
              {lesson.durationSec ? (
                <Badge>{Math.round(lesson.durationSec / 60)} min</Badge>
              ) : null}
              {moduleTitle && <Badge color="amber">{moduleTitle}</Badge>}
              {lesson.lockMode === "BOTH" &&
              (lesson.unlockDelayHours || 0) > 0 ? (
                <Badge color="amber">{lesson.unlockDelayHours}h drip</Badge>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditing((v) => !v)}>
            <Pencil className="h-4 w-4" /> {editing ? "Close" : "Edit"}
          </Button>
          <Button variant="danger" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {editing && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <Input
            label="Lesson title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={isPreview}
              onChange={(e) => setIsPreview(e.target.checked)}
            />
            Free Preview
          </label>
          {isPlayable && (
            <LessonSourceFields
              type={lesson.type}
              source={source}
              contentKey={contentKey}
              videoUrl={videoUrl}
              durationSec={durationSec}
              onChange={(p) => {
                if (p.source !== undefined) setSource(p.source);
                if (p.contentKey !== undefined) setContentKey(p.contentKey);
                if (p.videoUrl !== undefined) setVideoUrl(p.videoUrl);
                if (p.durationSec !== undefined) setDurationSec(p.durationSec);
              }}
            />
          )}
          {lesson.type !== "QUIZ" && (
            <ThumbnailField value={thumbnailUrl} onChange={setThumbnailUrl} />
          )}
        </div>
      )}

      <div className="grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-3">
        <Select
          label="Module"
          value={moduleId}
          onChange={(e) => setModuleId(e.target.value)}
        >
          <option value="">No module</option>
          {modules.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </Select>
        <Select
          label="Lesson lock"
          value={lockMode}
          onChange={(e) => setLockMode(e.target.value as "SINGLE" | "BOTH")}
        >
          <option value="SINGLE">After previous lesson</option>
          <option value="BOTH">Previous lesson + time</option>
        </Select>
        {lockMode === "BOTH" && (
          <Input
            label="Delay (hours)"
            type="number"
            min={0}
            value={delay}
            onChange={(e) => setDelay(+e.target.value)}
          />
        )}
      </div>
      <Button onClick={save} disabled={busy}>
        <Save className="h-4 w-4" />{" "}
        {editing ? "Save lesson" : "Save lesson settings"}
      </Button>
    </Card>
  );
}

// ---
// Quiz manager: create quizzes (timer / attempt-limit / shuffle) and edit
// typed, weighted questions with explanations.
// ---
function QuizManager({
  courseId,
  lessons,
  quizzes,
  onChanged,
}: {
  courseId: string;
  lessons: Lesson[];
  quizzes: any[];
  onChanged: () => Promise<void> | void;
}) {
  const [title, setTitle] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [passScore, setPassScore] = useState(70);
  const [timeLimitMin, setTimeLimitMin] = useState(0);
  const [maxAttempts, setMaxAttempts] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function createQuiz(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      await api("/courses/quizzes", {
        method: "POST",
        body: {
          courseId,
          title,
          lessonId: lessonId || undefined,
          passScore: Number(passScore),
          timeLimitSec: timeLimitMin > 0 ? Number(timeLimitMin) * 60 : undefined,
          maxAttempts: Number(maxAttempts),
          shuffle,
        },
      });
      setTitle("");
      setLessonId("");
      setPassScore(70);
      setTimeLimitMin(0);
      setMaxAttempts(0);
      setShuffle(false);
      await onChanged();
    } catch (e: any) {
      setErr(e.message || "Could not create quiz");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Card className="mb-6">
        <form onSubmit={createQuiz} className="space-y-4">
          <h3 className="font-semibold text-slate-950">Add Quiz</h3>
          <Input
            label="Quiz title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Linked lesson (optional)"
              value={lessonId}
              onChange={(e) => setLessonId(e.target.value)}
            >
              <option value="">Standalone quiz</option>
              {lessons.map((l) => (
                <option key={l.id} value={l.id}>
                  #{l.index + 1} {l.title}
                </option>
              ))}
            </Select>
            <Input
              label="Pass score (%)"
              type="number"
              min={0}
              value={passScore}
              onChange={(e) => setPassScore(+e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Time limit (min, 0 = none)"
              type="number"
              min={0}
              value={timeLimitMin}
              onChange={(e) => setTimeLimitMin(+e.target.value)}
            />
            <Input
              label="Max attempts (0 = unlimited)"
              type="number"
              min={0}
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(+e.target.value)}
            />
            <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={shuffle}
                onChange={(e) => setShuffle(e.target.checked)}
              />
              Shuffle questions &amp; options
            </label>
          </div>
          <ErrorText message={err} />
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" /> Add Quiz
              </>
            )}
          </Button>
        </form>
      </Card>

      <div className="space-y-4">
        {quizzes.map((q: any) => (
          <QuizCard key={q.id} quiz={q} onChanged={onChanged} />
        ))}
        {quizzes.length === 0 && (
          <p className="text-sm text-slate-500">No quizzes yet. Add one above.</p>
        )}
      </div>
    </div>
  );
}

// A single quiz: editable settings + question editor.
function QuizCard({
  quiz,
  onChanged,
}: {
  quiz: any;
  onChanged: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [passScore, setPassScore] = useState(quiz.passScore ?? 70);
  const [timeLimitMin, setTimeLimitMin] = useState(
    quiz.timeLimitSec ? Math.round(quiz.timeLimitSec / 60) : 0,
  );
  const [maxAttempts, setMaxAttempts] = useState(quiz.maxAttempts ?? 0);
  const [shuffle, setShuffle] = useState(!!quiz.shuffle);
  const [savingSettings, setSavingSettings] = useState(false);

  async function saveSettings() {
    setSavingSettings(true);
    try {
      await api("/courses/quizzes/" + quiz.id, {
        method: "PATCH",
        body: {
          passScore: Number(passScore),
          timeLimitSec: timeLimitMin > 0 ? Number(timeLimitMin) * 60 : null,
          maxAttempts: Number(maxAttempts),
          shuffle,
        },
      });
      await onChanged();
    } finally {
      setSavingSettings(false);
    }
  }

  async function removeQuiz() {
    if (!confirm("Delete this quiz?")) return;
    await api("/courses/quizzes/" + quiz.id, { method: "DELETE" });
    await onChanged();
  }

  const questions = quiz.questions || [];
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-950">{quiz.title}</h3>
          <div className="mt-1 flex flex-wrap gap-2">
            <Badge color="blue">Pass {quiz.passScore}%</Badge>
            {quiz.timeLimitSec ? (
              <Badge color="amber">{Math.round(quiz.timeLimitSec / 60)} min</Badge>
            ) : null}
            <Badge>
              {quiz.maxAttempts ? quiz.maxAttempts + " attempts" : "Unlimited"}
            </Badge>
            {quiz.shuffle ? <Badge color="green">Shuffled</Badge> : null}
            <Badge>{questions.length} Q</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setOpen(!open)}>
            {open ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
          <Button variant="danger" onClick={removeQuiz}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {open && (
        <div className="mt-4 space-y-5 border-t border-slate-100 pt-4">
          <div className="grid gap-4 sm:grid-cols-4">
            <Input
              label="Pass (%)"
              type="number"
              min={0}
              value={passScore}
              onChange={(e) => setPassScore(+e.target.value)}
            />
            <Input
              label="Time (min)"
              type="number"
              min={0}
              value={timeLimitMin}
              onChange={(e) => setTimeLimitMin(+e.target.value)}
            />
            <Input
              label="Max attempts"
              type="number"
              min={0}
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(+e.target.value)}
            />
            <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={shuffle}
                onChange={(e) => setShuffle(e.target.checked)}
              />
              Shuffle
            </label>
          </div>
          <Button
            variant="outline"
            onClick={saveSettings}
            disabled={savingSettings}
          >
            {savingSettings ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" /> Save settings
              </>
            )}
          </Button>

          <div className="space-y-2">
            {questions.map((qq: any) => (
              <QuestionEditor key={qq.id} question={qq} onChanged={onChanged} />
            ))}
          </div>

          <QuestionEditor
            quizId={quiz.id}
            nextIndex={questions.length}
            onChanged={onChanged}
          />
        </div>
      )}
    </Card>
  );
}

// Add or edit a single quiz question (typed, weighted, with explanation).
function QuestionEditor({
  quizId,
  question,
  nextIndex,
  onChanged,
}: {
  quizId?: string;
  question?: any;
  nextIndex?: number;
  onChanged: () => Promise<void> | void;
}) {
  const editing = !!question;
  const [prompt, setPrompt] = useState(question?.prompt ?? "");
  const [type, setType] = useState<string>(question?.type ?? "SINGLE");
  const [points, setPoints] = useState(question?.points ?? 1);
  const [explanation, setExplanation] = useState(question?.explanation ?? "");
  const [options, setOptions] = useState<string[]>(() => {
    if (question?.options) {
      try {
        return JSON.parse(question.options);
      } catch {
        return ["", ""];
      }
    }
    return ["", ""];
  });
  const [correct, setCorrect] = useState<number[]>(() => {
    if (question?.type === "MULTI" && question?.correct) {
      try {
        return JSON.parse(question.correct);
      } catch {
        return [];
      }
    }
    if (question) return [question.answer];
    return [0];
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [openNew, setOpenNew] = useState(false);

  const effectiveOptions = type === "TRUE_FALSE" ? ["True", "False"] : options;

  function toggleCorrect(i: number) {
    if (type === "MULTI") {
      setCorrect(
        correct.includes(i)
          ? correct.filter((x) => x !== i)
          : [...correct, i],
      );
    } else {
      setCorrect([i]);
    }
  }

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const body: any = {
        prompt,
        type,
        points: Number(points),
        explanation: explanation || undefined,
        options: JSON.stringify(effectiveOptions),
        answer: correct[0] ?? 0,
        correct: type === "MULTI" ? JSON.stringify(correct) : undefined,
      };
      if (editing) {
        await api("/courses/quizzes/questions/" + question.id, {
          method: "PATCH",
          body,
        });
      } else {
        await api("/courses/quizzes/questions", {
          method: "POST",
          body: { ...body, quizId, index: nextIndex ?? 0 },
        });
        setPrompt("");
        setOptions(["", ""]);
        setCorrect([0]);
        setType("SINGLE");
        setPoints(1);
        setExplanation("");
        setOpenNew(false);
      }
      await onChanged();
    } catch (e: any) {
      setErr(e.message || "Could not save question");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this question?")) return;
    await api("/courses/quizzes/questions/" + question.id, { method: "DELETE" });
    await onChanged();
  }

  if (!editing && !openNew) {
    return (
      <Button variant="outline" onClick={() => setOpenNew(true)}>
        <Plus className="h-4 w-4" /> Add question
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <Textarea
        label="Question prompt"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="Type"
          value={type}
          onChange={(e) => {
            const t = e.target.value;
            setType(t);
            if (t === "TRUE_FALSE") {
              setOptions(["True", "False"]);
              setCorrect([0]);
            } else if (t !== "MULTI") {
              setCorrect((c) => [c[0] ?? 0]);
            }
          }}
        >
          <option value="SINGLE">Single choice</option>
          <option value="MULTI">Multiple correct</option>
          <option value="TRUE_FALSE">True / False</option>
        </Select>
        <Input
          label="Points"
          type="number"
          min={1}
          value={points}
          onChange={(e) => setPoints(+e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-slate-600">
          Options{" "}
          {type === "MULTI" ? "(tick all correct)" : "(tick the correct one)"}
        </p>
        {effectiveOptions.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type={type === "MULTI" ? "checkbox" : "radio"}
              checked={correct.includes(i)}
              onChange={() => toggleCorrect(i)}
            />
            {type === "TRUE_FALSE" ? (
              <span className="text-sm text-slate-700">{opt}</span>
            ) : (
              <input
                className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                value={opt}
                placeholder={"Option " + (i + 1)}
                onChange={(e) =>
                  setOptions(
                    options.map((o, oi) => (oi === i ? e.target.value : o)),
                  )
                }
              />
            )}
            {type !== "TRUE_FALSE" && options.length > 2 && (
              <button
                type="button"
                className="text-slate-400 hover:text-red-500"
                onClick={() => {
                  setOptions(options.filter((_, oi) => oi !== i));
                  setCorrect(
                    correct
                      .filter((c) => c !== i)
                      .map((c) => (c > i ? c - 1 : c)),
                  );
                }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        {type !== "TRUE_FALSE" && (
          <button
            type="button"
            className="text-sm font-medium text-orange-600 hover:underline"
            onClick={() => setOptions([...options, ""])}
          >
            + Add option
          </button>
        )}
      </div>

      <Textarea
        label="Explanation (shown after grading, optional)"
        value={explanation}
        onChange={(e) => setExplanation(e.target.value)}
      />
      <ErrorText message={err} />
      <div className="flex gap-2">
        <Button onClick={save} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" /> {editing ? "Save question" : "Add question"}
            </>
          )}
        </Button>
        {editing && (
          <Button variant="danger" onClick={remove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
        {!editing && (
          <Button variant="ghost" onClick={() => setOpenNew(false)}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

function AssignmentCard({
  assignment,
  onChanged,
}: {
  assignment: Assignment;
  onChanged: () => void;
}) {
  const [description, setDescription] = useState(assignment.description || "");
  const [refFiles, setRefFiles] = useState<SubFile[]>(
    asFiles(assignment.attachments),
  );
  const [savingTask, setSavingTask] = useState(false);
  const [uploadingRef, setUploadingRef] = useState(false);
  const [open, setOpen] = useState(false);
  const refInput = useRef<HTMLInputElement>(null);

  async function onRefFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploadingRef(true);
    try {
      const added: SubFile[] = [];
      for (const file of files) {
        const r = await uploadFile(file);
        added.push({
          key: r.key,
          name: r.filename || file.name,
          size: r.size ?? file.size,
        });
      }
      setRefFiles((prev) => [...prev, ...added]);
    } catch {
      alert("Attachment upload failed.");
    } finally {
      setUploadingRef(false);
      if (refInput.current) refInput.current.value = "";
    }
  }

  async function saveTask() {
    setSavingTask(true);
    try {
      await api(`/courses/assignments/${assignment.id}`, {
        method: "PATCH",
        body: {
          description: description || null,
          attachments: JSON.stringify(refFiles),
        },
      });
      onChanged();
    } catch (e: any) {
      alert(e.message || "Could not save the task.");
    } finally {
      setSavingTask(false);
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-950">{assignment.title}</h3>
          <p className="text-xs text-slate-500">
            {assignment.lessonId
              ? "Linked to an assignment lesson"
              : "Not linked to a lesson"}
          </p>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1 text-sm font-medium text-brand"
        >
          {open ? (
            <>
              Hide submissions <ChevronUp className="h-4 w-4" />
            </>
          ) : (
            <>
              Review submissions <ChevronDown className="h-4 w-4" />
            </>
          )}
        </button>
      </div>

      <div className="mt-4 space-y-3">
        <Textarea
          label="Assignment task"
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div>
          <p className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <Paperclip className="h-4 w-4" /> Reference attachments
          </p>
          <input
            ref={refInput}
            type="file"
            multiple
            onChange={onRefFiles}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-200 file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-300"
          />
          {uploadingRef && (
            <p className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500">
              <Loader2 className="h-3 w-3 animate-spin" /> Uploading...
            </p>
          )}
          {refFiles.length > 0 && (
            <div className="mt-2 space-y-1">
              {refFiles.map((rf) => (
                <div
                  key={rf.key}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs"
                >
                  <button
                    type="button"
                    onClick={() => openFile(rf.key)}
                    className="inline-flex items-center gap-1.5 text-slate-700 hover:text-brand"
                  >
                    <FileText className="h-3.5 w-3.5" /> {rf.name}
                    {rf.size ? ` (${prettySize(rf.size)})` : ""}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setRefFiles((prev) =>
                        prev.filter((x) => x.key !== rf.key),
                      )
                    }
                    className="text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <Button onClick={saveTask} disabled={savingTask}>
          {savingTask ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" /> Save task
            </>
          )}
        </Button>
      </div>

      {open && <SubmissionsReview assignmentId={assignment.id} />}
    </Card>
  );
}

// --------------------------------------------------------------------------
// Review queue for one assignment: each learner's answer + files + grading.
// --------------------------------------------------------------------------
type Submission = {
  id: string;
  status: "UNDER_REVIEW" | "APPROVED" | "REJECTED";
  answerText?: string | null;
  attachments?: SubFile[];
  grade?: number | null;
  feedback?: string | null;
  submittedAt: string;
  user?: { id: string; name?: string; email?: string };
};

const STATUS_BADGE: Record<
  Submission["status"],
  { label: string; color: "amber" | "green" | "red" }
> = {
  UNDER_REVIEW: { label: "Under review", color: "amber" },
  APPROVED: { label: "Approved", color: "green" },
  REJECTED: { label: "Needs changes", color: "red" },
};

function SubmissionsReview({ assignmentId }: { assignmentId: string }) {
  const [subs, setSubs] = useState<Submission[] | null>(null);

  async function load() {
    try {
      const data = await api<Submission[]>(
        `/courses/assignments/${assignmentId}/submissions`,
      );
      setSubs(data);
    } catch {
      setSubs([]);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId]);

  if (!subs) {
    return (
      <div className="mt-4 border-t border-slate-100 pt-4">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
      <h4 className="text-sm font-semibold text-slate-900">
        Submissions ({subs.length})
      </h4>
      {subs.length === 0 && (
        <p className="text-sm text-slate-500">No submissions yet.</p>
      )}
      {subs.map((s) => (
        <SubmissionRow key={s.id} submission={s} onGraded={load} />
      ))}
    </div>
  );
}

function SubmissionRow({
  submission,
  onGraded,
}: {
  submission: Submission;
  onGraded: () => void;
}) {
  const [grade, setGrade] = useState<string>(
    submission.grade != null ? String(submission.grade) : "",
  );
  const [feedback, setFeedback] = useState(submission.feedback || "");
  const [busy, setBusy] = useState<"APPROVED" | "REJECTED" | null>(null);
  const badge = STATUS_BADGE[submission.status];

  async function review(status: "APPROVED" | "REJECTED") {
    setBusy(status);
    try {
      await api(`/courses/submissions/${submission.id}/grade`, {
        method: "PATCH",
        body: {
          status,
          grade: grade === "" ? null : Number(grade),
          feedback: feedback || null,
        },
      });
      onGraded();
    } catch (e: any) {
      alert(e.message || "Could not save the review.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {submission.user?.name || submission.user?.email || "Learner"}
          </p>
          <p className="text-xs text-slate-500">
            Submitted {new Date(submission.submittedAt).toLocaleString()}
          </p>
        </div>
        <Badge color={badge.color}>{badge.label}</Badge>
      </div>

      {submission.answerText && (
        <div className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
          {submission.answerText}
        </div>
      )}

      {submission.attachments && submission.attachments.length > 0 && (
        <div className="mt-3 space-y-1">
          {submission.attachments.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => openFile(f.key)}
              className="flex w-full items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700 hover:text-brand"
            >
              <span className="inline-flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" /> {f.name}
                {f.size ? ` (${prettySize(f.size)})` : ""}
              </span>
              <Download className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="w-24">
          <Input
            label="Grade"
            type="number"
            placeholder="0-100"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
          />
        </div>
        <div className="min-w-[200px] flex-1">
          <Input
            label="Feedback"
            placeholder="Feedback for the learner"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <Button onClick={() => review("APPROVED")} disabled={!!busy}>
          {busy === "APPROVED" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Approving...
            </>
          ) : (
            <>
              <Check className="h-4 w-4" /> Approve &amp; unlock next
            </>
          )}
        </Button>
        <Button
          variant="danger"
          onClick={() => review("REJECTED")}
          disabled={!!busy}
        >
          {busy === "REJECTED" ? "Saving..." : "Request changes"}
        </Button>
      </div>
    </div>
  );
}
