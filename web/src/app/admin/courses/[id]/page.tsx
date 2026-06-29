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
  ListTree,
  Radio,
  Settings,
  Palette,
  Tag,
  MessageSquare,
  Award,
  Users,
  GraduationCap,
  FileQuestion,
  ClipboardList,
  Search,
  Eye,
  Folder,
  GripVertical,
  FileVideo,
  BookOpen,
  Lock,
  X,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Link2,
  Code,
  Upload,
  ChevronRight,
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
  isPublished?: boolean;
};

// A course module (section) used to group lessons + apply drip-locks.
type ModuleT = {
  id: string;
  title: string;
  index: number;
  lockMode: "SINGLE" | "BOTH";
  unlockDelayHours: number;
  isPublished?: boolean;
};

// A reference / submitted file descriptor stored as JSON on the assignment.
type SubFile = { key: string; name: string; size?: number };

type Assignment = {
  id: string;
  title: string;
  description?: string | null;
  lessonId?: string | null;
  attachments?: SubFile[] | string | null;
  thumbnailUrl?: string | null;
  graded?: boolean;
  completionMessage?: string | null;
};

type CourseDetail = {
  id: string;
  title: string;
  description?: string;
  price: number;
  isPublished: boolean;
  accessDurationDays?: number | null;
  unlockPolicy?: "OPEN" | "SEQUENTIAL" | "DRIP";
  offlineValidityDays?: number;
  coverUrl?: string | null;
  tags?: string[];
  instructorHeading?: string | null;
  instructorName?: string | null;
  instructorTitle?: string | null;
  instructorBio?: string | null;
  instructorAvatarUrl?: string | null;
  autoplayNext?: boolean;
  autoplayFirst?: boolean;
  autoComplete?: boolean;
  lessons: Lesson[];
  modules: ModuleT[];
  quizzes: any[];
  assignments: Assignment[];
  _count?: { enrollments: number };
};

type EnrollmentRow = {
  id: string;
  userId: string;
  user: { id: string; name?: string | null; email?: string | null };
  startedAt: string;
  percentComplete: number;
  accessUntil: string | null;
  revokedAt: string | null;
  active: boolean;
  daysLeft: number | null;
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
              <Loader2 className="h-3 w-3 animate-spin" /> Uploading
              thumbnail...
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

// --------------------------------------------------------------------------
// Generic centered modal used by the Outline view (add lesson / edit module).
// --------------------------------------------------------------------------
function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm">
      <div
        className={`my-8 w-full ${wide ? "max-w-3xl" : "max-w-xl"} rounded-2xl bg-white shadow-xl`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="text-base font-semibold text-slate-950">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// A small green/grey pill dropdown that flips a Published <-> Draft flag.
function PublishSelect({
  published,
  onChange,
}: {
  published: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <select
      value={published ? "pub" : "draft"}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value === "pub")}
      className={`cursor-pointer rounded-full border px-2.5 py-1 text-xs font-semibold focus:outline-none ${
        published
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-100 text-slate-500"
      }`}
    >
      <option value="pub">Published</option>
      <option value="draft">Draft</option>
    </select>
  );
}

// Map a lesson type to its outline icon.
function lessonIcon(type: string) {
  if (type === "VIDEO") return FileVideo;
  if (type === "PDF") return FileText;
  if (type === "TEXT") return BookOpen;
  if (type === "QUIZ") return FileQuestion;
  if (type === "ASSIGNMENT") return ClipboardList;
  return FileText;
}

export default function CourseDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [view, setView] = useState<string>("outline");
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [addMenu, setAddMenu] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [lessonModal, setLessonModal] = useState(false);
  const [moduleModal, setModuleModal] = useState<{
    id?: string;
    title: string;
    index: number;
    lockMode: string;
    unlockDelayHours: number;
    isPublished: boolean;
    parentId: string | null;
  } | null>(null);
  const [editLesson, setEditLesson] = useState<Lesson | null>(null);
  const [editAssignment, setEditAssignment] = useState<Assignment | null>(null);
  const [importOpen, setImportOpen] = useState(false);

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

  const isPlayable = form.type === "VIDEO" || form.type === "PDF";
  const isAssignment = form.type === "ASSIGNMENT";

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

  function openLessonModal(type: string, moduleId = "") {
    setForm({ ...BLANK, type, moduleId });
    setErr(null);
    setAddMenu(false);
    setLessonModal(true);
  }

  function openModuleModal(existing?: ModuleT, parentId: string | null = null) {
    setAddMenu(false);
    setErr(null);
    if (existing) {
      setModuleModal({
        id: existing.id,
        title: existing.title,
        index: existing.index,
        lockMode: existing.lockMode,
        unlockDelayHours: existing.unlockDelayHours || 0,
        isPublished: (existing as any).isPublished ?? true,
        parentId: (existing as any).parentId ?? null,
      });
    } else {
      setModuleModal({
        title: "",
        index: course?.modules?.length || 0,
        lockMode: "SINGLE",
        unlockDelayHours: 0,
        isPublished: true,
        parentId,
      });
    }
  }

  function soon(label: string) {
    setAddMenu(false);
    setNotice(`${label} is not available yet \u2014 coming soon.`);
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
        body.source = form.source;
        body.contentKey = form.contentKey || null;
      }
      const lesson = await api<Lesson>("/courses/lessons", {
        method: "POST",
        body,
      });

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
      setLessonModal(false);
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

  async function saveModule() {
    if (!moduleModal) return;
    setSaving(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = {
        title: moduleModal.title,
        index: Number(moduleModal.index),
        lockMode: moduleModal.lockMode,
        unlockDelayHours:
          moduleModal.lockMode === "BOTH"
            ? Number(moduleModal.unlockDelayHours)
            : 0,
        isPublished: moduleModal.isPublished,
        parentId: moduleModal.parentId || null,
      };
      if (moduleModal.id) {
        await api(`/courses/modules/${moduleModal.id}`, {
          method: "PATCH",
          body,
        });
      } else {
        await api("/courses/modules", {
          method: "POST",
          body: { ...body, courseId: params.id },
        });
      }
      setModuleModal(null);
      await reload();
    } catch (e: any) {
      setErr(e.message || "Could not save module");
    } finally {
      setSaving(false);
    }
  }

  async function removeModule(id: string) {
    if (!confirm("Delete this module? Its lessons will become ungrouped."))
      return;
    await api(`/courses/modules/${id}`, { method: "DELETE" });
    await reload();
  }

  async function setLessonPublish(l: Lesson, published: boolean) {
    await api(`/courses/lessons/${l.id}`, {
      method: "PATCH",
      body: { isPublished: published },
    });
    await reload();
  }

  async function setModulePublish(m: ModuleT, published: boolean) {
    await api(`/courses/modules/${m.id}`, {
      method: "PATCH",
      body: { isPublished: published },
    });
    await reload();
  }

  if (!course) return <Spinner />;

  const modules = [...(course.modules || [])].sort((a, b) => a.index - b.index);
  const q = search.trim().toLowerCase();
  const matchText = (t: string) => !q || t.toLowerCase().includes(q);
  const lessonsOf = (mid: string | null) =>
    course.lessons
      .filter((l) => (mid ? l.moduleId === mid : !l.moduleId))
      .filter((l) => matchText(l.title))
      .sort((a, b) => a.index - b.index);
  const standalone = lessonsOf(null);
  const subModulesOf = (pid: string) =>
    modules
      .filter((m) => (m as any).parentId === pid)
      .sort((a, b) => a.index - b.index);
  const visibleModules = modules.filter(
    (m) =>
      !(m as any).parentId &&
      (matchText(m.title) ||
        lessonsOf(m.id).length > 0 ||
        subModulesOf(m.id).some(
          (sm) => matchText(sm.title) || lessonsOf(sm.id).length > 0,
        )),
  );
  const moduleCount = modules.length;
  const allCollapsed = collapsed.size >= moduleCount && moduleCount > 0;

  function toggleCollapse(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function collapseAll() {
    if (allCollapsed) setCollapsed(new Set());
    else setCollapsed(new Set(modules.map((m) => m.id)));
  }

  const NAV: { id: string; label: string; icon: any }[] = [
    { id: "outline", label: "Outline", icon: ListTree },
    { id: "live", label: "Live Sessions", icon: Radio },
    { id: "settings", label: "Settings", icon: Settings },
    { id: "customize", label: "Customize", icon: Palette },
    { id: "offers", label: "Offers", icon: Tag },
    { id: "comments", label: "Comments", icon: MessageSquare },
    { id: "credentials", label: "Credentials", icon: Award },
    { id: "community", label: "Community Groups", icon: Users },
  ];
  const MANAGE: { id: string; label: string; icon: any }[] = [
    { id: "students", label: "Students", icon: GraduationCap },
    { id: "quizzes", label: "Quizzes", icon: FileQuestion },
    { id: "assignments", label: "Assignments", icon: ClipboardList },
  ];
  const ADD_ITEMS: { label: string; fn: () => void }[] = [
    { label: "Add Module", fn: () => openModuleModal() },
    {
      label: "Add Sub-module",
      fn: () => {
        setAddMenu(false);
        const first = (course?.modules || []).find((m: any) => !m.parentId);
        if (!first) {
          setNotice("Create a module first, then add a sub-module under it.");
          return;
        }
        openModuleModal(undefined, first.id);
      },
    },
    { label: "Add Lesson", fn: () => openLessonModal("VIDEO") },
    { label: "Add Quiz", fn: () => openLessonModal("QUIZ") },
    { label: "Add Assignment", fn: () => openLessonModal("ASSIGNMENT") },
    {
      label: "Add Welcome Badge",
      fn: () => {
        setAddMenu(false);
        setView("credentials");
      },
    },
    {
      label: "Add Credential",
      fn: () => {
        setAddMenu(false);
        setView("credentials");
      },
    },
    { label: "Import from another course", fn: () => setImportOpen(true) },
  ];

  const placeholders: Record<string, { title: string; body: string }> = {
    customize: {
      title: "Customize",
      body: "Branding and player customization options will appear here.",
    },
    community: {
      title: "Community Groups",
      body: "Link this course to community groups here.",
    },
  };

  function renderLessonRow(l: Lesson) {
    const Icon = lessonIcon(l.type);
    const locked = l.lockMode === "BOTH";
    return (
      <div
        key={l.id}
        className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2.5 hover:border-slate-200"
      >
        <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-slate-300" />
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-800">
            {l.title}
          </p>
          <p className="text-[11px] uppercase tracking-wide text-slate-400">
            {l.type}
            {l.isPreview ? " \u00b7 Free preview" : ""}
          </p>
        </div>
        {locked && (
          <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
            <Lock className="h-3 w-3" /> Locked
          </span>
        )}
        <PublishSelect
          published={(l as any).isPublished ?? true}
          onChange={(v) => setLessonPublish(l, v)}
        />
        <button
          onClick={() => {
            if (l.type === "ASSIGNMENT") {
              const a = course.assignments.find((x) => x.lessonId === l.id);
              if (a) {
                setEditAssignment(a);
                return;
              }
            }
            setEditLesson(l);
          }}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          title="Edit lesson"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          onClick={() => removeLesson(l.id)}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
          title="Delete lesson"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  }

  function renderSubModule(sm: ModuleT) {
    const isOpen = !collapsed.has(sm.id);
    const childLessons = lessonsOf(sm.id);
    return (
      <div
        key={sm.id}
        className="ml-6 overflow-hidden rounded-xl border border-slate-200 bg-white"
      >
        <div className="flex items-center gap-2 bg-slate-50/70 px-3 py-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
            <Folder className="h-3.5 w-3.5" />
          </span>
          <button
            onClick={() => toggleCollapse(sm.id)}
            className="min-w-0 flex-1 text-left"
          >
            <p className="truncate text-sm font-medium text-slate-800">
              {sm.title}
            </p>
            <p className="text-[11px] text-slate-400">
              {childLessons.length}{" "}
              {childLessons.length === 1 ? "lesson" : "lessons"}
            </p>
          </button>
          <PublishSelect
            published={(sm as any).isPublished ?? true}
            onChange={(v) => setModulePublish(sm, v)}
          />
          <button
            onClick={() => openLessonModal("VIDEO", sm.id)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
            title="Add content"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={() => openModuleModal(sm)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
            title="Edit sub-module"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => removeModule(sm.id)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
            title="Delete sub-module"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => toggleCollapse(sm.id)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200"
          >
            {isOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>
        {isOpen && (
          <div className="space-y-2 p-3">
            {childLessons.map((l) => renderLessonRow(l))}
            {childLessons.length === 0 && (
              <p className="px-2 py-3 text-sm text-slate-400">
                No lessons in this sub-module yet.
              </p>
            )}
            <button
              onClick={() => openLessonModal("VIDEO", sm.id)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-brand hover:underline"
            >
              <Plus className="h-4 w-4" /> Add Content
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={course.title} subtitle={course.description || ""} />

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Left sidebar navigation */}
        <aside className="shrink-0 lg:w-60">
          <nav className="space-y-1 rounded-2xl border border-slate-100 bg-white p-2">
            {NAV.map((n) => {
              const Icon = n.icon;
              const active = view === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => setView(n.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-brand text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {n.label}
                </button>
              );
            })}
            <div className="my-2 border-t border-slate-100" />
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Manage
            </p>
            {MANAGE.map((n) => {
              const Icon = n.icon;
              const active = view === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => setView(n.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-brand text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {n.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main column */}
        <div className="min-w-0 flex-1">
          {notice && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <span>{notice}</span>
              <button
                onClick={() => setNotice(null)}
                className="text-amber-500 hover:text-amber-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {view === "outline" && (
            <div>
              {/* Toolbar */}
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search Module or Lesson"
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-brand focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => setView("live")}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Radio className="h-4 w-4" /> Add live session
                </button>
                <button
                  onClick={() => soon("Preview")}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Eye className="h-4 w-4" /> Preview
                </button>
                <div className="relative">
                  <button
                    onClick={() => setAddMenu((v) => !v)}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
                  >
                    <Plus className="h-4 w-4" /> Add Content
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  {addMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setAddMenu(false)}
                      />
                      <div className="absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-xl border border-slate-100 bg-white py-1 shadow-lg">
                        {ADD_ITEMS.map((it) => (
                          <button
                            key={it.label}
                            onClick={it.fn}
                            className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                          >
                            {it.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Count + collapse */}
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">
                  {moduleCount} {moduleCount === 1 ? "Module" : "Modules"}
                </p>
                {moduleCount > 0 && (
                  <button
                    onClick={collapseAll}
                    className="text-sm font-medium text-brand hover:underline"
                  >
                    {allCollapsed ? "Expand All" : "Collapse All"}
                  </button>
                )}
              </div>

              {/* Module cards */}
              <div className="space-y-4">
                {visibleModules.map((m) => {
                  const isOpen = !collapsed.has(m.id);
                  const childLessons = lessonsOf(m.id);
                  return (
                    <div
                      key={m.id}
                      className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
                    >
                      <div className="flex items-center gap-3 bg-slate-50 px-4 py-3">
                        <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-slate-300" />
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                          <Folder className="h-4 w-4" />
                        </span>
                        <button
                          onClick={() => toggleCollapse(m.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {m.title}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {childLessons.length}{" "}
                            {childLessons.length === 1 ? "lesson" : "lessons"}
                          </p>
                        </button>
                        <button
                          onClick={() => openLessonModal("VIDEO", m.id)}
                          className="hidden items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 sm:inline-flex"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add Content
                        </button>
                        <PublishSelect
                          published={(m as any).isPublished ?? true}
                          onChange={(v) => setModulePublish(m, v)}
                        />
                        <button
                          onClick={() => openModuleModal(m)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                          title="Edit module"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => removeModule(m.id)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          title="Delete module"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => toggleCollapse(m.id)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200"
                        >
                          {isOpen ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      {isOpen && (
                        <div className="space-y-2 p-3">
                          {childLessons.map((l) => renderLessonRow(l))}
                          {childLessons.length === 0 && (
                            <p className="px-2 py-3 text-sm text-slate-400">
                              No lessons in this module yet.
                            </p>
                          )}
                          <button
                            onClick={() => openLessonModal("VIDEO", m.id)}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-brand hover:underline"
                          >
                            <Plus className="h-4 w-4" /> Add Content
                          </button>
                          {subModulesOf(m.id).map((sm) => renderSubModule(sm))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Ungrouped lessons */}
                {standalone.length > 0 && (
                  <div className="overflow-hidden rounded-2xl border border-dashed border-slate-200 bg-white">
                    <div className="flex items-center gap-3 bg-slate-50 px-4 py-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                        <FileText className="h-4 w-4" />
                      </span>
                      <p className="flex-1 text-sm font-semibold text-slate-900">
                        Ungrouped lessons
                      </p>
                    </div>
                    <div className="space-y-2 p-3">
                      {standalone.map((l) => renderLessonRow(l))}
                    </div>
                  </div>
                )}

                {visibleModules.length === 0 && standalone.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
                    <p className="text-sm text-slate-500">
                      {q
                        ? "No modules or lessons match your search."
                        : "No content yet. Use \u201cAdd Content\u201d to create your first module or lesson."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {view === "settings" && (
            <CourseSettings course={course} onChanged={reload} />
          )}
          {view === "students" && <StudentsManager courseId={params.id} />}
          {view === "quizzes" && (
            <QuizManager
              courseId={params.id}
              lessons={course.lessons}
              quizzes={course.quizzes}
              onChanged={reload}
            />
          )}
          {view === "assignments" && (
            <div className="space-y-4">
              {course.assignments.map((a) => (
                <AssignmentCard
                  key={a.id}
                  assignment={a}
                  onChanged={reload}
                  onEdit={() => setEditAssignment(a)}
                />
              ))}
              {course.assignments.length === 0 && (
                <p className="text-sm text-slate-500">
                  No assignments yet. Add an Assignment from the Outline.
                </p>
              )}
            </div>
          )}
          {view === "offers" && (
            <div className="space-y-8">
              <OffersManager courseId={params.id} />
              <CouponsManager />
            </div>
          )}
          {view === "comments" && <CommentsManager courseId={params.id} />}
          {view === "live" && <LiveSessionsManager courseId={params.id} />}
          {view === "credentials" && <BadgeManager courseId={params.id} />}
          {placeholders[view] && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
              <h3 className="text-base font-semibold text-slate-800">
                {placeholders[view].title}
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                {placeholders[view].body}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ---- Add lesson modal ---- */}
      {lessonModal && (
        <Modal
          title="Add Content"
          wide
          onClose={() => {
            setLessonModal(false);
            setForm({ ...BLANK });
          }}
        >
          <form onSubmit={addLesson} className="space-y-4">
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

            <div className="grid gap-4 sm:grid-cols-3">
              <Select
                label="Module / Section"
                value={form.moduleId}
                onChange={(e) => setForm({ ...form, moduleId: e.target.value })}
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
                onChange={(e) => setForm({ ...form, lockMode: e.target.value })}
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
                    setForm({ ...form, unlockDelayHours: +e.target.value })
                  }
                />
              )}
            </div>

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

            {form.type !== "QUIZ" && (
              <ThumbnailField
                value={form.thumbnailUrl}
                onChange={(v) => setForm((f) => ({ ...f, thumbnailUrl: v }))}
              />
            )}

            <ErrorText message={err} />

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => {
                  setLessonModal(false);
                  setForm({ ...BLANK });
                }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
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
            </div>
          </form>
        </Modal>
      )}

      {/* ---- Add / edit module modal ---- */}
      {moduleModal && (
        <Modal
          title={moduleModal.id ? "Edit Module" : "Add Module"}
          onClose={() => setModuleModal(null)}
        >
          <div className="space-y-4">
            <Input
              label="Module Title"
              value={moduleModal.title}
              onChange={(e) =>
                setModuleModal({ ...moduleModal, title: e.target.value })
              }
              required
            />
            <Select
              label="Parent module"
              value={moduleModal.parentId || ""}
              onChange={(e) =>
                setModuleModal({
                  ...moduleModal,
                  parentId: e.target.value || null,
                })
              }
            >
              <option value="">Top-level module</option>
              {modules
                .filter((m) => !(m as any).parentId && m.id !== moduleModal.id)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
            </Select>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Index"
                type="number"
                value={moduleModal.index}
                onChange={(e) =>
                  setModuleModal({ ...moduleModal, index: +e.target.value })
                }
              />
              <Select
                label="Module lock"
                value={moduleModal.lockMode}
                onChange={(e) =>
                  setModuleModal({ ...moduleModal, lockMode: e.target.value })
                }
              >
                <option value="SINGLE">Open after previous module</option>
                <option value="BOTH">Previous module + time delay</option>
              </Select>
            </div>
            {moduleModal.lockMode === "BOTH" && (
              <Input
                label="Unlock delay (hours)"
                type="number"
                min={0}
                value={moduleModal.unlockDelayHours}
                onChange={(e) =>
                  setModuleModal({
                    ...moduleModal,
                    unlockDelayHours: +e.target.value,
                  })
                }
              />
            )}
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={moduleModal.isPublished}
                onChange={(e) =>
                  setModuleModal({
                    ...moduleModal,
                    isPublished: e.target.checked,
                  })
                }
              />
              Published (visible to learners)
            </label>
            <ErrorText message={err} />
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setModuleModal(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <Button onClick={saveModule} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" /> Save Module
                  </>
                )}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ---- Edit lesson modal (reuses the existing LessonRow editor) ---- */}
      {editLesson && (
        <Modal title="Edit Lesson" wide onClose={() => setEditLesson(null)}>
          <LessonRow
            lesson={editLesson}
            modules={course.modules || []}
            startOpen
            onChanged={() => {
              reload();
            }}
            onRemove={() => {
              removeLesson(editLesson.id);
              setEditLesson(null);
            }}
          />
        </Modal>
      )}

      {importOpen && (
        <ImportCourseModal
          currentCourseId={course.id}
          onClose={() => setImportOpen(false)}
          onDone={() => {
            setImportOpen(false);
            reload();
          }}
        />
      )}

      {editAssignment && (
        <AssignmentEditor
          assignment={editAssignment}
          course={course}
          onClose={() => setEditAssignment(null)}
          onChanged={() => {
            reload();
          }}
        />
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
  startOpen,
}: {
  lesson: Lesson;
  modules: ModuleT[];
  onChanged: () => Promise<void> | void;
  onRemove: () => void;
  startOpen?: boolean;
}) {
  const [moduleId, setModuleId] = useState(lesson.moduleId || "");
  const [lockMode, setLockMode] = useState<"SINGLE" | "BOTH">(
    lesson.lockMode || "SINGLE",
  );
  const [delay, setDelay] = useState(lesson.unlockDelayHours || 0);
  const [busy, setBusy] = useState(false);
  const moduleTitle = modules.find((m) => m.id === lesson.moduleId)?.title;

  // Full-edit panel state.
  const [editing, setEditing] = useState(!!startOpen);
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
          timeLimitSec:
            timeLimitMin > 0 ? Number(timeLimitMin) * 60 : undefined,
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
          <p className="text-sm text-slate-500">
            No quizzes yet. Add one above.
          </p>
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
              <Badge color="amber">
                {Math.round(quiz.timeLimitSec / 60)} min
              </Badge>
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
        correct.includes(i) ? correct.filter((x) => x !== i) : [...correct, i],
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
    await api("/courses/quizzes/questions/" + question.id, {
      method: "DELETE",
    });
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
              <Save className="h-4 w-4" />{" "}
              {editing ? "Save question" : "Add question"}
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

// --------------------------------------------------------------------------
// Lightweight rich-text editor (contentEditable + formatting toolbar) used by
// the Assignment editor for Instructions and the Completion message.
// --------------------------------------------------------------------------
function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeight = 140,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Seed the editable region once so React re-renders don't reset the caret.
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || "";
    }
    if (ref.current) ref.current.style.minHeight = minHeight + "px";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function exec(cmd: string, val?: string) {
    document.execCommand(cmd, false, val);
    if (ref.current) onChange(ref.current.innerHTML);
    ref.current?.focus();
  }

  const Btn = ({
    cmd,
    val,
    title,
    children,
  }: {
    cmd: string;
    val?: string;
    title: string;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        exec(cmd, val);
      }}
      className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
    >
      {children}
    </button>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 px-2 py-1.5">
        <select
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => {
            exec("formatBlock", "<" + e.target.value + ">");
            e.target.value = "p";
          }}
          defaultValue="p"
          className="mr-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 focus:outline-none"
        >
          <option value="p">Paragraph</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
        </select>
        <Btn cmd="bold" title="Bold">
          <Bold className="h-4 w-4" />
        </Btn>
        <Btn cmd="italic" title="Italic">
          <Italic className="h-4 w-4" />
        </Btn>
        <Btn cmd="underline" title="Underline">
          <Underline className="h-4 w-4" />
        </Btn>
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <Btn cmd="justifyLeft" title="Align left">
          <AlignLeft className="h-4 w-4" />
        </Btn>
        <Btn cmd="justifyCenter" title="Align center">
          <AlignCenter className="h-4 w-4" />
        </Btn>
        <Btn cmd="justifyRight" title="Align right">
          <AlignRight className="h-4 w-4" />
        </Btn>
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <Btn cmd="insertUnorderedList" title="Bullet list">
          <List className="h-4 w-4" />
        </Btn>
        <Btn cmd="insertOrderedList" title="Numbered list">
          <ListOrdered className="h-4 w-4" />
        </Btn>
        <button
          type="button"
          title="Insert link"
          onMouseDown={(e) => {
            e.preventDefault();
            const url = prompt("Enter URL");
            if (url) exec("createLink", url);
          }}
          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
        >
          <Link2 className="h-4 w-4" />
        </button>
        <Btn cmd="formatBlock" val="<pre>" title="Code block">
          <Code className="h-4 w-4" />
        </Btn>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
        data-placeholder={placeholder || ""}
        className="rte-content prose prose-sm max-w-none px-3 py-2 text-sm text-slate-800 focus:outline-none"
      />
    </div>
  );
}

// --------------------------------------------------------------------------
// Full-screen Assignment editor matching the Course Creator Studio design:
// breadcrumb + course tree, name + instructions + material, and a right rail
// with thumbnail, ungraded toggle and completion message.
// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
// Import all modules + lessons from another course into this one. Uses the
// existing module/lesson create endpoints; media keys are reused as-is.
// --------------------------------------------------------------------------
function ImportCourseModal({
  currentCourseId,
  onClose,
  onDone,
}: {
  currentCourseId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [courses, setCourses] = useState<
    { id: string; title: string }[] | null
  >(null);
  const [sourceId, setSourceId] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<any[]>("/courses")
      .then((list) =>
        setCourses(
          (list || [])
            .filter((c) => c.id !== currentCourseId)
            .map((c) => ({ id: c.id, title: c.title })),
        ),
      )
      .catch(() => setCourses([]));
  }, [currentCourseId]);

  async function runImport() {
    if (!sourceId) return;
    setBusy(true);
    setErr(null);
    try {
      setProgress("Loading source course...");
      const src = await api<any>(`/courses/${sourceId}`);
      const srcModules = [...(src.modules || [])].sort(
        (a, b) => a.index - b.index,
      );
      const srcLessons = [...(src.lessons || [])].sort(
        (a, b) => a.index - b.index,
      );
      const idMap: Record<string, string> = {};
      let mi = 0;
      for (const m of srcModules) {
        setProgress(`Creating module ${++mi}/${srcModules.length}...`);
        const created = await api<any>("/courses/modules", {
          method: "POST",
          body: {
            courseId: currentCourseId,
            title: m.title,
            index: m.index,
            lockMode: m.lockMode,
            unlockDelayHours: m.unlockDelayHours,
            isPublished: m.isPublished,
          },
        });
        idMap[m.id] = created.id;
      }
      let li = 0;
      for (const l of srcLessons) {
        setProgress(`Creating lesson ${++li}/${srcLessons.length}...`);
        await api("/courses/lessons", {
          method: "POST",
          body: {
            courseId: currentCourseId,
            title: l.title,
            index: l.index,
            type: l.type,
            moduleId: l.moduleId ? idMap[l.moduleId] : undefined,
            lockMode: l.lockMode,
            unlockDelayHours: l.unlockDelayHours,
            contentKey: l.contentKey,
            videoUrl: l.videoUrl,
            thumbnailUrl: l.thumbnailUrl,
            source: l.source,
            durationSec: l.durationSec,
            isPreview: l.isPreview,
            isPublished: l.isPublished,
          },
        });
      }
      setProgress("Done!");
      onDone();
    } catch (e: any) {
      setErr(e.message || "Import failed.");
      setBusy(false);
    }
  }

  return (
    <Modal title="Import from another course" onClose={onClose}>
      {!courses ? (
        <Spinner />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Copies all modules and lessons from the selected course into this
            one. Quizzes and assignment submissions are not copied.
          </p>
          <Select
            label="Source course"
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
          >
            <option value="">Select a course...</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </Select>
          {courses.length === 0 && (
            <p className="text-xs text-slate-400">
              No other courses available to import from.
            </p>
          )}
          {busy && (
            <p className="inline-flex items-center gap-2 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" /> {progress}
            </p>
          )}
          {err && <ErrorText message={err} />}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={runImport} disabled={busy || !sourceId}>
              Import
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function AssignmentEditor({
  assignment,
  course,
  onClose,
  onChanged,
}: {
  assignment: Assignment;
  course: CourseDetail;
  onClose: () => void;
  onChanged: () => void;
}) {
  const linkedLesson = course.lessons.find((l) => l.id === assignment.lessonId);
  const [title, setTitle] = useState(assignment.title || "");
  const [instructions, setInstructions] = useState(
    assignment.description || "",
  );
  const [completion, setCompletion] = useState(
    (assignment as any).completionMessage || "",
  );
  const [graded, setGraded] = useState<boolean>(
    (assignment as any).graded ?? true,
  );
  const [thumb, setThumb] = useState((assignment as any).thumbnailUrl || "");
  const [refFiles, setRefFiles] = useState<SubFile[]>(
    asFiles(assignment.attachments),
  );
  const [published, setPublished] = useState<boolean>(
    (linkedLesson as any)?.isPublished ?? true,
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const modules = [...(course.modules || [])].sort((a, b) => a.index - b.index);

  async function uploadMany(files: File[]) {
    if (files.length === 0) return;
    setUploading(true);
    setErr(null);
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
      setErr("Material upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save(publish: boolean) {
    setSaving(true);
    setErr(null);
    try {
      await api(`/courses/assignments/${assignment.id}`, {
        method: "PATCH",
        body: {
          title,
          description: instructions || null,
          completionMessage: completion || null,
          graded,
          thumbnailUrl: thumb || null,
          attachments: JSON.stringify(refFiles),
        },
      });
      if (linkedLesson) {
        await api(`/courses/lessons/${linkedLesson.id}`, {
          method: "PATCH",
          body: { title, isPublished: publish },
        });
      }
      setPublished(publish);
      onChanged();
      onClose();
    } catch (e: any) {
      setErr(e.message || "Could not save the assignment.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this assignment?")) return;
    setSaving(true);
    try {
      await api(`/courses/assignments/${assignment.id}`, { method: "DELETE" });
      onChanged();
      onClose();
    } catch (e: any) {
      setErr(e.message || "Could not delete.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
        <div className="flex min-w-0 items-center gap-1.5 text-sm text-slate-500">
          <span className="font-medium text-slate-600">Course Content</span>
          <ChevronRight className="h-4 w-4 shrink-0" />
          <span className="truncate font-semibold text-slate-900">
            {title || "Assignment"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={published ? "pub" : "lock"}
            onChange={(e) => setPublished(e.target.value === "pub")}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold focus:outline-none ${
              published
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-violet-200 bg-violet-50 text-violet-700"
            }`}
          >
            <option value="pub">Published</option>
            <option value="lock">Locked</option>
          </select>
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <Eye className="h-4 w-4" /> Preview
          </button>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        {/* Left mini course tree */}
        <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-slate-200 bg-slate-50 p-3 lg:block">
          <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Course Content
          </p>
          <div className="space-y-3">
            {modules.map((m) => {
              const lessons = course.lessons
                .filter((l) => l.moduleId === m.id)
                .sort((a, b) => a.index - b.index);
              return (
                <div key={m.id}>
                  <p className="flex items-center gap-1.5 px-1 text-xs font-semibold text-slate-700">
                    <Folder className="h-3.5 w-3.5 text-brand" /> {m.title}
                  </p>
                  <div className="mt-1 space-y-0.5">
                    {lessons.map((l) => {
                      const Icon = lessonIcon(l.type);
                      const active = l.id === assignment.lessonId;
                      return (
                        <div
                          key={l.id}
                          className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs ${
                            active
                              ? "bg-brand/10 font-semibold text-brand"
                              : "text-slate-600"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{l.title}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {modules.length === 0 && (
              <p className="px-1 text-xs text-slate-400">No modules yet.</p>
            )}
          </div>
        </aside>

        {/* Center + right rail */}
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto lg:flex-row">
          {/* Center column */}
          <div className="min-w-0 flex-1 space-y-6 p-6">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-900">
                Assignment Name<span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  value={title}
                  maxLength={255}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Assignment name"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 pr-16 text-sm text-slate-800 focus:border-brand focus:outline-none"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                  {title.length}/255
                </span>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-900">
                Instructions<span className="text-red-500">*</span>
              </label>
              <RichTextEditor
                value={instructions}
                onChange={setInstructions}
                placeholder="Write the assignment instructions..."
                minHeight={200}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-900">
                Assignment Material
              </label>
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  uploadMany(Array.from(e.dataTransfer.files || []));
                }}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
                  dragOver
                    ? "border-brand bg-brand/5"
                    : "border-slate-200 hover:border-brand/50"
                }`}
              >
                <Upload className="mb-2 h-6 w-6 text-slate-400" />
                <p className="text-sm font-medium text-slate-700">
                  Click to upload or drag and drop
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  pdf, docs, doc, xlsx, xls, png, jpeg, jpg
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept=".pdf,.docs,.doc,.xlsx,.xls,.png,.jpeg,.jpg"
                  onChange={(e) => uploadMany(Array.from(e.target.files || []))}
                  className="hidden"
                />
              </div>
              {uploading && (
                <p className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500">
                  <Loader2 className="h-3 w-3 animate-spin" /> Uploading...
                </p>
              )}
              {refFiles.length > 0 && (
                <div className="mt-3 space-y-1">
                  {refFiles.map((rf) => (
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
          </div>

          {/* Right rail */}
          <div className="w-full shrink-0 space-y-6 border-t border-slate-200 p-6 lg:w-80 lg:border-l lg:border-t-0">
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-900">
                Assignment Thumbnail
              </p>
              {thumb ? (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <ThumbnailPreview value={thumb} />
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs text-slate-400">
                      Recommended 1280x720
                    </span>
                    <button
                      onClick={() => setThumb("")}
                      className="inline-flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <ThumbnailField value={thumb} onChange={setThumb} />
                  <p className="mt-1 text-xs text-slate-400">
                    Recommended dimensions of 1280x720
                  </p>
                </div>
              )}
            </div>

            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={!graded}
                onChange={(e) => setGraded(!e.target.checked)}
              />
              Ungraded Assignment
            </label>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-900">
                Completion Message<span className="text-red-500">*</span>
              </label>
              <RichTextEditor
                value={completion}
                onChange={setCompletion}
                placeholder="Shown to learners after they complete this assignment..."
                minHeight={120}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
        <button
          onClick={remove}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" /> Delete
        </button>
        <div className="flex items-center gap-2">
          {err && <span className="text-xs text-red-500">{err}</span>}
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => save(published)}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand px-4 py-2 text-sm font-semibold text-brand hover:bg-brand/5 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save
          </button>
          <button
            onClick={() => save(true)}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}{" "}
            Save &amp; Publish
          </button>
        </div>
      </div>
    </div>
  );
}

// Renders a thumbnail preview from either an external URL or a storage key.
function ThumbnailPreview({ value }: { value: string }) {
  const [src, setSrc] = useState<string | null>(
    /^https?:\/\//i.test(value) ? value : null,
  );
  useEffect(() => {
    let active = true;
    if (/^https?:\/\//i.test(value)) {
      setSrc(value);
    } else if (value) {
      signMedia(value)
        .then((u) => {
          if (active)
            setSrc(typeof u === "string" ? u : (u as any)?.url || null);
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [value]);
  if (!src)
    return (
      <div className="flex h-36 items-center justify-center bg-slate-100 text-slate-300">
        <ImageIcon className="h-8 w-8" />
      </div>
    );
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className="h-36 w-full object-cover" />;
}

function AssignmentCard({
  assignment,
  onChanged,
  onEdit,
}: {
  assignment: Assignment;
  onChanged: () => void;
  onEdit: () => void;
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
        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <Pencil className="h-4 w-4" /> Edit
          </button>
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

// ---- Course access + unlock settings (admin) ----
function SettingToggle({
  checked,
  onChange,
  title,
  desc,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-3 last:border-0">
      <div className="pr-4">
        <p className="text-sm font-medium text-slate-900">{title}</p>
        <p className="mt-0.5 text-xs text-slate-500">{desc}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${
          checked ? "bg-brand" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
            checked ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function CourseSettings({
  course,
  onChanged,
}: {
  course: CourseDetail;
  onChanged: () => void;
}) {
  const [duration, setDuration] = useState<string>(
    course.accessDurationDays != null ? String(course.accessDurationDays) : "0",
  );
  const [policy, setPolicy] = useState<string>(
    course.unlockPolicy || "SEQUENTIAL",
  );
  const [offlineDays, setOfflineDays] = useState<number>(
    course.offlineValidityDays ?? 30,
  );
  const [title, setTitle] = useState(course.title || "");
  const [description, setDescription] = useState(course.description || "");
  const [cover, setCover] = useState(course.coverUrl || "");
  const [tagsInput, setTagsInput] = useState((course.tags || []).join(", "));
  const [insHeading, setInsHeading] = useState(
    course.instructorHeading || "Instructor",
  );
  const [insName, setInsName] = useState(course.instructorName || "");
  const [insTitle, setInsTitle] = useState(course.instructorTitle || "");
  const [insBio, setInsBio] = useState(course.instructorBio || "");
  const [insAvatar, setInsAvatar] = useState(course.instructorAvatarUrl || "");
  const [autoNext, setAutoNext] = useState(course.autoplayNext ?? true);
  const [autoFirst, setAutoFirst] = useState(course.autoplayFirst ?? false);
  const [autoDone, setAutoDone] = useState(course.autoComplete ?? true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function save() {
    setSaving(true);
    setErr(null);
    setOk(false);
    try {
      await api(`/courses/${course.id}`, {
        method: "PATCH",
        body: {
          title: title.trim(),
          description: description.trim() || null,
          coverUrl: cover || null,
          tags: tagsInput
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          instructorHeading: insHeading.trim() || null,
          instructorName: insName.trim() || null,
          instructorTitle: insTitle.trim() || null,
          instructorBio: insBio.trim() || null,
          instructorAvatarUrl: insAvatar || null,
          autoplayNext: autoNext,
          autoplayFirst: autoFirst,
          autoComplete: autoDone,
          accessDurationDays: Number(duration) || 0,
          unlockPolicy: policy,
          offlineValidityDays: Number(offlineDays) || 30,
        },
      });
      setOk(true);
      onChanged();
    } catch (e: any) {
      setErr(e.message || "Could not save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="space-y-5">
        {/* Basic details */}
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-slate-950">Basic details</h3>
            <p className="text-sm text-slate-500">
              The title, description and thumbnail learners see on the course
              page and in their library.
            </p>
          </div>
          <Input
            label="Course title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Textarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="This description appears on the course detail and checkout pages..."
          />
          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-700">
              Course thumbnail
            </p>
            <ThumbnailField value={cover} onChange={setCover} />
            <p className="mt-1 text-xs text-slate-400">
              Shown on the course page and in the library. Recommended 1280x720.
            </p>
          </div>
          <Input
            label="Course tags"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="e.g. mindset, productivity, health (comma separated)"
          />
        </div>

        <div className="border-t border-slate-100" />

        {/* Instructor details */}
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-slate-950">Instructor details</h3>
            <p className="text-sm text-slate-500">
              Appears on the course detail and checkout pages.
            </p>
          </div>
          <Input
            label="Heading"
            value={insHeading}
            onChange={(e) => setInsHeading(e.target.value)}
            placeholder="Instructor"
          />
          <Input
            label="Name"
            value={insName}
            onChange={(e) => setInsName(e.target.value)}
            placeholder="e.g. Dr Javed Iqbal"
          />
          <Input
            label="Title"
            value={insTitle}
            onChange={(e) => setInsTitle(e.target.value)}
            placeholder="e.g. Professor of Surgery & Medical Educator"
          />
          <Textarea
            label="Bio"
            value={insBio}
            onChange={(e) => setInsBio(e.target.value)}
            rows={4}
            placeholder="Short instructor bio..."
          />
          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-700">
              Instructor headshot
            </p>
            <ThumbnailField value={insAvatar} onChange={setInsAvatar} />
            <p className="mt-1 text-xs text-slate-400">
              Recommended dimensions of 300x300.
            </p>
          </div>
        </div>

        <div className="border-t border-slate-100" />

        {/* Learning experience */}
        <div>
          <h3 className="font-semibold text-slate-950">Learning experience</h3>
          <p className="text-sm text-slate-500">
            Control autoplay and how lessons get marked complete.
          </p>
          <div className="mt-3">
            <SettingToggle
              checked={autoNext}
              onChange={setAutoNext}
              title="Automatically play next lesson"
              desc="When enabled, the next lesson starts automatically after the current one ends."
            />
            <SettingToggle
              checked={autoFirst}
              onChange={setAutoFirst}
              title="Automatically play first lesson"
              desc="When enabled, the first lesson in the course starts automatically when the course is opened."
            />
            <SettingToggle
              checked={autoDone}
              onChange={setAutoDone}
              title="Auto complete lessons"
              desc="When enabled, lessons are marked complete automatically as learners progress. When disabled, a lesson only completes after the learner clicks Mark as complete."
            />
          </div>
        </div>

        <div className="border-t border-slate-100" />

        <div>
          <h3 className="font-semibold text-slate-950">Access &amp; unlock</h3>
          <p className="text-sm text-slate-500">
            Control how long learners keep access and how lessons unlock after
            purchase.
          </p>
        </div>

        <Select
          label="Access duration (per learner, from purchase/enrollment)"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
        >
          <option value="0">Lifetime (no expiry)</option>
          <option value="15">15 days</option>
          <option value="30">1 month</option>
          <option value="90">3 months</option>
          <option value="180">6 months</option>
          <option value="365">1 year</option>
        </Select>

        <Select
          label="Unlock policy"
          value={policy}
          onChange={(e) => setPolicy(e.target.value)}
        >
          <option value="OPEN">
            Open - all lessons unlocked after purchase
          </option>
          <option value="SEQUENTIAL">
            Sequential - one by one (complete previous to unlock next)
          </option>
          <option value="DRIP">
            Drip - sequential + time delays (per module/lesson)
          </option>
        </Select>
        <p className="text-xs text-slate-500">
          Module / lecture level locks are still managed in the Modules tab and
          per-lesson settings. OPEN overrides all of them.
        </p>

        <Input
          label="Offline re-validation window (days)"
          type="number"
          min={1}
          value={offlineDays}
          onChange={(e) => setOfflineDays(Number(e.target.value))}
        />
        <p className="text-xs text-slate-500">
          YouTube-style rule: a downloaded video must reconnect to the internet
          within this many days or it stops playing until the device is online.
        </p>

        {err && <ErrorText message={err} />}
        {ok && <p className="text-sm font-medium text-emerald-600">Saved.</p>}
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save settings"}
        </Button>
      </div>
    </Card>
  );
}

// ---- Per-learner access management (admin) ----
// ============================ Access Offers ============================
type OfferT = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  currency: string;
  accessDurationDays?: number | null;
  isActive: boolean;
  index: number;
};

function durationLabel(d?: number | null) {
  if (d == null || d === 0) return "Lifetime";
  if (d % 365 === 0) return `${d / 365} year(s)`;
  if (d % 30 === 0) return `${d / 30} month(s)`;
  return `${d} day(s)`;
}

function OffersManager({ courseId }: { courseId: string }) {
  const [rows, setRows] = useState<OfferT[] | null>(null);
  const [editing, setEditing] = useState<Partial<OfferT> | null>(null);
  const [grantFor, setGrantFor] = useState<OfferT | null>(null);
  const [userId, setUserId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const d = await api<OfferT[]>(`/courses/${courseId}/offers`);
    setRows(d);
  }
  useEffect(() => {
    load().catch(() => setRows([]));
  }, [courseId]);

  function startNew() {
    setErr(null);
    setEditing({
      name: "",
      price: 0,
      currency: "PKR",
      accessDurationDays: null,
      isActive: true,
      index: rows?.length || 0,
    });
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    setErr(null);
    try {
      const body: any = {
        name: editing.name,
        description: editing.description || null,
        price: Number(editing.price) || 0,
        currency: editing.currency || "PKR",
        accessDurationDays:
          editing.accessDurationDays == null ||
          (editing.accessDurationDays as any) === ""
            ? null
            : Number(editing.accessDurationDays),
        isActive: editing.isActive ?? true,
        index: Number(editing.index) || 0,
      };
      if (editing.id) {
        await api(`/courses/offers/${editing.id}`, { method: "PATCH", body });
      } else {
        await api(`/courses/offers`, {
          method: "POST",
          body: { ...body, courseId },
        });
      }
      setEditing(null);
      await load();
    } catch (e: any) {
      setErr(e.message || "Could not save offer");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this offer?")) return;
    await api(`/courses/offers/${id}`, { method: "DELETE" });
    await load();
  }

  async function grant() {
    if (!grantFor || !userId.trim()) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await api(`/courses/offers/${grantFor.id}/grant`, {
        method: "POST",
        body: { userId: userId.trim() },
      });
      setMsg("Access granted to the user.");
      setUserId("");
      setGrantFor(null);
    } catch (e: any) {
      setErr(e.message || "Could not grant access");
    } finally {
      setBusy(false);
    }
  }

  if (!rows) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Access Offers
          </h3>
          <p className="text-sm text-slate-500">
            Sell the same course at different prices, each with its own name and
            access window.
          </p>
        </div>
        <Button onClick={startNew}>
          <Plus className="mr-1 h-4 w-4" /> New offer
        </Button>
      </div>

      {msg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {msg}
        </div>
      )}

      {rows.length === 0 && !editing && (
        <p className="text-sm text-slate-500">
          No offers yet. Create pricing tiers like 1 Month, 3 Months or
          Lifetime.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((o) => (
          <Card key={o.id}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900">
                  {o.name}
                </p>
                <p className="text-xs text-slate-500">
                  {durationLabel(o.accessDurationDays)} access
                </p>
              </div>
              <Badge color={o.isActive ? "green" : "slate"}>
                {o.isActive ? "Active" : "Hidden"}
              </Badge>
            </div>
            {o.description && (
              <p className="mt-2 text-sm text-slate-600">{o.description}</p>
            )}
            <p className="mt-2 text-lg font-bold text-slate-900">
              {o.currency} {Number(o.price).toLocaleString()}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setErr(null);
                  setEditing(o);
                }}
              >
                <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setMsg(null);
                  setErr(null);
                  setUserId("");
                  setGrantFor(o);
                }}
              >
                <Check className="mr-1 h-3.5 w-3.5" /> Grant access
              </Button>
              <Button variant="outline" onClick={() => remove(o.id)}>
                <Trash2 className="mr-1 h-3.5 w-3.5 text-red-500" /> Delete
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {editing && (
        <Modal
          title={editing.id ? "Edit offer" : "New offer"}
          onClose={() => setEditing(null)}
        >
          <div className="space-y-4">
            <ErrorText message={err} />
            <Input
              label="Offer name"
              value={editing.name || ""}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              placeholder="e.g. 1 Month Access"
            />
            <Textarea
              label="Description (optional)"
              value={editing.description || ""}
              onChange={(e) =>
                setEditing({ ...editing, description: e.target.value })
              }
            />
            <div className="flex gap-3">
              <Input
                label="Price"
                type="number"
                value={String(editing.price ?? 0)}
                onChange={(e) =>
                  setEditing({ ...editing, price: Number(e.target.value) })
                }
              />
              <Input
                label="Currency"
                value={editing.currency || "PKR"}
                onChange={(e) =>
                  setEditing({ ...editing, currency: e.target.value })
                }
              />
            </div>
            <Select
              label="Access duration"
              value={
                editing.accessDurationDays == null
                  ? ""
                  : String(editing.accessDurationDays)
              }
              onChange={(e) =>
                setEditing({
                  ...editing,
                  accessDurationDays:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
            >
              <option value="">Lifetime</option>
              <option value="7">7 days</option>
              <option value="15">15 days</option>
              <option value="30">1 month</option>
              <option value="90">3 months</option>
              <option value="180">6 months</option>
              <option value="365">1 year</option>
            </Select>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={editing.isActive ?? true}
                onChange={(e) =>
                  setEditing({ ...editing, isActive: e.target.checked })
                }
              />
              Active (visible to buyers)
            </label>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setEditing(null)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button onClick={save} disabled={busy || !editing.name}>
                {busy ? "Saving..." : "Save offer"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {grantFor && (
        <Modal
          title={`Grant: ${grantFor.name}`}
          onClose={() => setGrantFor(null)}
        >
          <div className="space-y-4">
            <ErrorText message={err} />
            <p className="text-sm text-slate-600">
              Collect payment outside the app, then grant this offer access to a
              user by their ID. To remove access later, use the Students tab.
            </p>
            <Input
              label="User ID"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="user id"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setGrantFor(null)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button onClick={grant} disabled={busy || !userId.trim()}>
                {busy ? "Granting..." : "Grant access"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ============================ Global Coupons ============================
type CouponT = {
  id: string;
  code: string;
  discountType: string;
  amount: number;
  isActive: boolean;
  expiresAt?: string | null;
  maxRedemptions?: number | null;
  timesRedeemed: number;
};

function CouponsManager() {
  const [rows, setRows] = useState<CouponT[] | null>(null);
  const [editing, setEditing] = useState<Partial<CouponT> | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const d = await api<CouponT[]>(`/courses/coupons`);
    setRows(d);
  }
  useEffect(() => {
    load().catch(() => setRows([]));
  }, []);

  function startNew() {
    setErr(null);
    setEditing({
      code: "",
      discountType: "PERCENT",
      amount: 10,
      isActive: true,
    });
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    setErr(null);
    try {
      const body: any = {
        code: editing.code,
        discountType: editing.discountType || "PERCENT",
        amount: Number(editing.amount) || 0,
        isActive: editing.isActive ?? true,
        expiresAt: editing.expiresAt || undefined,
        maxRedemptions:
          editing.maxRedemptions == null ||
          (editing.maxRedemptions as any) === ""
            ? undefined
            : Number(editing.maxRedemptions),
      };
      if (editing.id)
        await api(`/courses/coupons/${editing.id}`, { method: "PATCH", body });
      else await api(`/courses/coupons`, { method: "POST", body });
      setEditing(null);
      await load();
    } catch (e: any) {
      setErr(e.message || "Could not save coupon");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this coupon?")) return;
    await api(`/courses/coupons/${id}`, { method: "DELETE" });
    await load();
  }

  if (!rows) return <Spinner />;

  return (
    <div className="mt-10 space-y-4 border-t border-slate-100 pt-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Global Coupons
          </h3>
          <p className="text-sm text-slate-500">
            Discount codes applied at checkout. A coupon works across every
            course and product on the platform.
          </p>
        </div>
        <Button onClick={startNew}>
          <Plus className="mr-1 h-4 w-4" /> New coupon
        </Button>
      </div>

      {rows.length === 0 && (
        <p className="text-sm text-slate-500">No coupons yet.</p>
      )}

      <div className="space-y-2">
        {rows.map((c) => (
          <Card key={c.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-mono text-sm font-bold text-slate-900">
                  {c.code}
                </p>
                <p className="text-xs text-slate-500">
                  {c.discountType === "FIXED"
                    ? `Flat ${c.amount} off`
                    : `${c.amount}% off`}
                  {" - "}
                  {c.maxRedemptions != null
                    ? `${c.timesRedeemed}/${c.maxRedemptions} used`
                    : `${c.timesRedeemed} used`}
                  {c.expiresAt
                    ? ` - expires ${new Date(c.expiresAt).toLocaleDateString()}`
                    : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge color={c.isActive ? "green" : "slate"}>
                  {c.isActive ? "Active" : "Off"}
                </Badge>
                <Button
                  variant="outline"
                  onClick={() => {
                    setErr(null);
                    setEditing(c);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" onClick={() => remove(c.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {editing && (
        <Modal
          title={editing.id ? "Edit coupon" : "New coupon"}
          onClose={() => setEditing(null)}
        >
          <div className="space-y-4">
            <ErrorText message={err} />
            <Input
              label="Code"
              value={editing.code || ""}
              onChange={(e) =>
                setEditing({ ...editing, code: e.target.value.toUpperCase() })
              }
              placeholder="SAVE20"
            />
            <div className="flex gap-3">
              <Select
                label="Type"
                value={editing.discountType || "PERCENT"}
                onChange={(e) =>
                  setEditing({ ...editing, discountType: e.target.value })
                }
              >
                <option value="PERCENT">Percent (%)</option>
                <option value="FIXED">Fixed amount</option>
              </Select>
              <Input
                label={
                  editing.discountType === "FIXED"
                    ? "Amount off"
                    : "Percent off"
                }
                type="number"
                value={String(editing.amount ?? 0)}
                onChange={(e) =>
                  setEditing({ ...editing, amount: Number(e.target.value) })
                }
              />
            </div>
            <div className="flex gap-3">
              <Input
                label="Expiry (optional)"
                type="date"
                value={
                  editing.expiresAt
                    ? String(editing.expiresAt).slice(0, 10)
                    : ""
                }
                onChange={(e) =>
                  setEditing({ ...editing, expiresAt: e.target.value || null })
                }
              />
              <Input
                label="Max uses (optional)"
                type="number"
                value={
                  editing.maxRedemptions == null
                    ? ""
                    : String(editing.maxRedemptions)
                }
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    maxRedemptions:
                      e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={editing.isActive ?? true}
                onChange={(e) =>
                  setEditing({ ...editing, isActive: e.target.checked })
                }
              />
              Active
            </label>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setEditing(null)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button onClick={save} disabled={busy || !editing.code}>
                {busy ? "Saving..." : "Save coupon"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ============================ Course Comments ============================
type CommentT = {
  id: string;
  body: string;
  createdAt: string;
  parentId?: string | null;
  user?: { id: string; name?: string | null; email?: string | null } | null;
};

function CommentsManager({ courseId }: { courseId: string }) {
  const [rows, setRows] = useState<CommentT[] | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const d = await api<CommentT[]>(`/courses/${courseId}/comments`);
    setRows(d);
  }
  useEffect(() => {
    load().catch(() => setRows([]));
  }, [courseId]);

  async function post() {
    if (!body.trim()) return;
    setBusy(true);
    try {
      await api(`/courses/${courseId}/comments`, {
        method: "POST",
        body: { body: body.trim() },
      });
      setBody("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this comment?")) return;
    await api(`/courses/comments/${id}`, { method: "DELETE" });
    await load();
  }

  if (!rows) return <Spinner />;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-slate-900">Comments</h3>
        <p className="text-sm text-slate-500">
          Course-level discussion. Post announcements or reply to learners.
        </p>
      </div>
      <Card>
        <Textarea
          label=""
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a comment..."
          rows={3}
        />
        <div className="mt-2 flex justify-end">
          <Button onClick={post} disabled={busy || !body.trim()}>
            {busy ? "Posting..." : "Post comment"}
          </Button>
        </div>
      </Card>
      {rows.length === 0 && (
        <p className="text-sm text-slate-500">No comments yet.</p>
      )}
      <div className="space-y-2">
        {rows.map((c) => (
          <Card key={c.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  {c.user?.name || c.user?.email || "User"}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                  {c.body}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {new Date(c.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => remove(c.id)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============================ Live Sessions ============================
type LiveT = {
  id: string;
  title: string;
  description?: string | null;
  scheduledAt: string;
  durationMin: number;
  joinUrl?: string | null;
  status: string;
};

function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function LiveSessionsManager({ courseId }: { courseId: string }) {
  const [rows, setRows] = useState<LiveT[] | null>(null);
  const [editing, setEditing] = useState<Partial<LiveT> | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const d = await api<LiveT[]>(`/courses/${courseId}/live-sessions`);
    setRows(d);
  }
  useEffect(() => {
    load().catch(() => setRows([]));
  }, [courseId]);

  function startNew() {
    setErr(null);
    setEditing({
      title: "",
      description: "",
      scheduledAt: toLocalInput(new Date().toISOString()),
      durationMin: 60,
      joinUrl: "",
      status: "SCHEDULED",
    });
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    setErr(null);
    try {
      const body: any = {
        title: editing.title,
        description: editing.description || null,
        scheduledAt: editing.scheduledAt
          ? new Date(editing.scheduledAt).toISOString()
          : new Date().toISOString(),
        durationMin: Number(editing.durationMin) || 60,
        joinUrl: editing.joinUrl || null,
        status: editing.status || "SCHEDULED",
      };
      if (editing.id) {
        await api(`/courses/live-sessions/${editing.id}`, {
          method: "PATCH",
          body,
        });
      } else {
        await api(`/courses/live-sessions`, {
          method: "POST",
          body: { ...body, courseId },
        });
      }
      setEditing(null);
      await load();
    } catch (e: any) {
      setErr(e.message || "Could not save session");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this live session?")) return;
    await api(`/courses/live-sessions/${id}`, { method: "DELETE" });
    await load();
  }

  if (!rows) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Live Sessions
          </h3>
          <p className="text-sm text-slate-500">
            Schedule live classes and share the join link with enrolled
            learners.
          </p>
        </div>
        <Button onClick={startNew}>
          <Plus className="mr-1 h-4 w-4" /> New session
        </Button>
      </div>

      {rows.length === 0 && !editing && (
        <p className="text-sm text-slate-500">
          No live sessions scheduled yet.
        </p>
      )}

      <div className="space-y-2">
        {rows.map((s) => (
          <Card key={s.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Radio className="h-4 w-4 text-rose-500" />
                  <p className="truncate font-semibold text-slate-900">
                    {s.title}
                  </p>
                  <Badge
                    color={
                      s.status === "LIVE"
                        ? "red"
                        : s.status === "ENDED"
                          ? "slate"
                          : "blue"
                    }
                  >
                    {s.status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {new Date(s.scheduledAt).toLocaleString()} · {s.durationMin}{" "}
                  min
                </p>
                {s.joinUrl && (
                  <a
                    href={s.joinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-sm text-indigo-600 hover:underline"
                  >
                    Join link
                  </a>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setErr(null);
                    setEditing({
                      ...s,
                      scheduledAt: toLocalInput(s.scheduledAt),
                    });
                  }}
                >
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                </Button>
                <Button variant="outline" onClick={() => remove(s.id)}>
                  <Trash2 className="mr-1 h-3.5 w-3.5 text-red-500" /> Delete
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {editing && (
        <Modal
          title={editing.id ? "Edit session" : "New live session"}
          onClose={() => setEditing(null)}
        >
          <div className="space-y-4">
            <ErrorText message={err} />
            <Input
              label="Title"
              value={editing.title || ""}
              onChange={(e) =>
                setEditing({ ...editing, title: e.target.value })
              }
            />
            <Textarea
              label="Description (optional)"
              value={editing.description || ""}
              onChange={(e) =>
                setEditing({ ...editing, description: e.target.value })
              }
            />
            <div className="flex gap-3">
              <Input
                label="Date & time"
                type="datetime-local"
                value={editing.scheduledAt || ""}
                onChange={(e) =>
                  setEditing({ ...editing, scheduledAt: e.target.value })
                }
              />
              <Input
                label="Duration (min)"
                type="number"
                value={String(editing.durationMin ?? 60)}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    durationMin: Number(e.target.value),
                  })
                }
              />
            </div>
            <Input
              label="Join URL (optional)"
              value={editing.joinUrl || ""}
              onChange={(e) =>
                setEditing({ ...editing, joinUrl: e.target.value })
              }
              placeholder="https://meet.google.com/..."
            />
            <Select
              label="Status"
              value={editing.status || "SCHEDULED"}
              onChange={(e) =>
                setEditing({ ...editing, status: e.target.value })
              }
            >
              <option value="SCHEDULED">Scheduled</option>
              <option value="LIVE">Live now</option>
              <option value="ENDED">Ended</option>
              <option value="CANCELLED">Cancelled</option>
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button onClick={save} disabled={busy}>
                {busy ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ============================ Badges ============================
type BadgeT = {
  id: string;
  type: string;
  name: string;
  imageUrl?: string | null;
  message?: string | null;
};

function BadgeManager({ courseId }: { courseId: string }) {
  const [rows, setRows] = useState<BadgeT[] | null>(null);
  const [editing, setEditing] = useState<Partial<BadgeT> | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const d = await api<BadgeT[]>(`/courses/${courseId}/badges`);
    setRows(d);
  }
  useEffect(() => {
    load().catch(() => setRows([]));
  }, [courseId]);

  function startNew(type: string) {
    setErr(null);
    setEditing({
      type,
      name: type === "WELCOME" ? "Welcome!" : "Course Completed",
      message: "",
      imageUrl: "",
    });
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    setErr(null);
    try {
      const body: any = {
        type: editing.type || "WELCOME",
        name: editing.name,
        message: editing.message || null,
        imageUrl: editing.imageUrl || null,
      };
      if (editing.id) {
        await api(`/courses/badges/${editing.id}`, { method: "PATCH", body });
      } else {
        await api(`/courses/badges`, {
          method: "POST",
          body: { ...body, courseId },
        });
      }
      setEditing(null);
      await load();
    } catch (e: any) {
      setErr(e.message || "Could not save badge");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this badge?")) return;
    await api(`/courses/badges/${id}`, { method: "DELETE" });
    await load();
  }

  if (!rows) return <Spinner />;

  const hasWelcome = rows.some((b) => b.type === "WELCOME");
  const hasCompletion = rows.some((b) => b.type === "COMPLETION");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Badges</h3>
          <p className="text-sm text-slate-500">
            Welcome learners and reward course completion with a badge.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => startNew("WELCOME")}
            disabled={hasWelcome}
          >
            <Plus className="mr-1 h-4 w-4" /> Welcome badge
          </Button>
          <Button
            variant="outline"
            onClick={() => startNew("COMPLETION")}
            disabled={hasCompletion}
          >
            <Plus className="mr-1 h-4 w-4" /> Completion badge
          </Button>
        </div>
      </div>

      {rows.length === 0 && !editing && (
        <p className="text-sm text-slate-500">No badges yet.</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((b) => (
          <Card key={b.id}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                {b.imageUrl ? (
                  <img
                    src={b.imageUrl}
                    alt={b.name}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
                    <Award className="h-6 w-6 text-amber-600" />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">
                    {b.name}
                  </p>
                  <Badge color={b.type === "WELCOME" ? "blue" : "green"}>
                    {b.type}
                  </Badge>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setErr(null);
                    setEditing(b);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" onClick={() => remove(b.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                </Button>
              </div>
            </div>
            {b.message && (
              <p className="mt-2 text-sm text-slate-600">{b.message}</p>
            )}
          </Card>
        ))}
      </div>

      {editing && (
        <Modal
          title={editing.id ? "Edit badge" : "New badge"}
          onClose={() => setEditing(null)}
        >
          <div className="space-y-4">
            <ErrorText message={err} />
            <Input
              label="Badge name"
              value={editing.name || ""}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            />
            <Textarea
              label="Message (optional)"
              value={editing.message || ""}
              onChange={(e) =>
                setEditing({ ...editing, message: e.target.value })
              }
              placeholder="Shown to the learner when they earn this badge."
            />
            <Input
              label="Image URL (optional)"
              value={editing.imageUrl || ""}
              onChange={(e) =>
                setEditing({ ...editing, imageUrl: e.target.value })
              }
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button onClick={save} disabled={busy}>
                {busy ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function StudentsManager({ courseId }: { courseId: string }) {
  const [rows, setRows] = useState<EnrollmentRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [grantDays, setGrantDays] = useState<Record<string, string>>({});

  async function load() {
    const d = await api<EnrollmentRow[]>(`/courses/${courseId}/enrollments`);
    setRows(d);
  }
  useEffect(() => {
    load().catch(() => setRows([]));
  }, [courseId]);

  async function grant(userId: string) {
    setBusy(userId);
    try {
      const days = Number(grantDays[userId] ?? "");
      await api(`/courses/${courseId}/access/grant`, {
        method: "POST",
        body: { userId, days: Number.isFinite(days) ? days : null },
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function revoke(userId: string) {
    if (
      !confirm(
        "Revoke access? Their downloaded videos will be wiped from the device on next open.",
      )
    )
      return;
    setBusy(userId);
    try {
      await api(`/courses/${courseId}/access/revoke`, {
        method: "POST",
        body: { userId },
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (!rows) return <Spinner />;
  if (rows.length === 0)
    return <p className="text-sm text-slate-500">No learners enrolled yet.</p>;

  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <Card key={r.id}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium text-slate-950">
                {r.user?.name || r.user?.email || r.userId}
              </p>
              <p className="text-xs text-slate-500">
                {r.revokedAt
                  ? "Access revoked"
                  : r.accessUntil
                    ? r.active
                      ? `Expires in ${r.daysLeft} day(s)`
                      : "Access expired"
                    : "Lifetime access"}
                {" - "}
                {Math.round(r.percentComplete)}% complete
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-28">
                <Select
                  label=""
                  value={grantDays[r.userId] ?? ""}
                  onChange={(e) =>
                    setGrantDays((g) => ({ ...g, [r.userId]: e.target.value }))
                  }
                >
                  <option value="">Set...</option>
                  <option value="0">Lifetime</option>
                  <option value="15">15 days</option>
                  <option value="30">1 month</option>
                  <option value="90">3 months</option>
                  <option value="180">6 months</option>
                  <option value="365">1 year</option>
                </Select>
              </div>
              <Button
                variant="outline"
                onClick={() => grant(r.userId)}
                disabled={
                  busy === r.userId || (grantDays[r.userId] ?? "") === ""
                }
              >
                Grant
              </Button>
              <Button
                variant="danger"
                onClick={() => revoke(r.userId)}
                disabled={busy === r.userId || !!r.revokedAt}
              >
                Revoke
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
