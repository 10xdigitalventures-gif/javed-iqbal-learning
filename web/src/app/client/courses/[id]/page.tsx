"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { api, resolveMediaUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, Spinner, Badge, Button, ErrorText } from "@/components/ui";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FileText,
  PlayCircle,
  HelpCircle,
  ClipboardList,
  Lock,
  Download,
  CheckCircle2,
  Circle,
  BookOpen,
  Loader2,
  Star,
  MessageCircle,
  StickyNote,
  Trash2,
  Send,
  Check,
} from "lucide-react";

type Lesson = {
  id: string;
  index: number;
  title: string;
  type: "VIDEO" | "PDF" | "TEXT" | "QUIZ" | "ASSIGNMENT";
  source?: "UPLOAD" | "LINK" | "MEDIA";
  contentKey?: string | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  durationSec?: number;
  isPreview: boolean;
  // Last saved playback position (seconds) for resume-where-you-left-off.
  resumeSec?: number;
  // Optional rich notes (render only when present).
  notes?: string | null;
  keyPoints?: string | null;
  attachments?: { name: string; key: string }[];
};

type Question = {
  id: string;
  index: number;
  prompt: string;
  options: string;
  answer: number;
};

type Quiz = {
  id: string;
  courseId: string;
  lessonId?: string | null;
  title: string;
  passScore: number;
  questions: Question[];
};

type Instructor = {
  name: string;
  title?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
};

type Course = {
  id: string;
  title: string;
  slug?: string;
  description?: string;
  coverUrl?: string;
  price: number;
  currency: string;
  lessons: Lesson[];
  quizzes?: Quiz[];
  hasAccess?: boolean;
  isEnrolled?: boolean;
  enrollment?: { percentComplete?: number } | null;
  instructor?: Instructor | null;
  updatedAt?: string;
  reviewSummary?: { avg: number; count: number };
  myReview?: { id: string; rating: number; comment?: string | null } | null;
};

const lessonIcon = {
  VIDEO: PlayCircle,
  PDF: FileText,
  TEXT: FileText,
  QUIZ: HelpCircle,
  ASSIGNMENT: ClipboardList,
};

const typeLabel = {
  VIDEO: "VIDEO",
  PDF: "PDF",
  TEXT: "READING",
  QUIZ: "QUIZ",
  ASSIGNMENT: "ASSIGNMENT",
};

// Turn a YouTube / Vimeo / direct link into something we can embed inline.
// Streaming only \u2014 no download affordance is exposed.
function toEmbed(url: string): { kind: "iframe" | "video"; src: string } {
  const yt = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/,
  );
  if (yt) {
    const base = "https://www." + "youtube.com/embed/";
    return { kind: "iframe", src: base + yt[1] + "?rel=0&modestbranding=1" };
  }
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) {
    const vbase = "https://player." + "vimeo.com/video/";
    return { kind: "iframe", src: vbase + vimeo[1] };
  }
  return { kind: "video", src: url };
}

function parseOptions(q: Question): string[] {
  try {
    const arr = JSON.parse(q.options);
    if (Array.isArray(arr) && arr.length) return arr.map((x) => String(x));
  } catch {
    // fall through
  }
  return ["True", "False"];
}

function progressKey(courseId: string) {
  return "course-progress:" + courseId;
}

function readCompleted(courseId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(progressKey(courseId));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const id = String(params.id);

  const [course, setCourse] = useState<Course | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [tab, setTab] = useState<"syllabus" | "details">("syllabus");
  const [moduleOpen, setModuleOpen] = useState(true);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);

  const load = useCallback(() => {
    api<Course>("/courses/" + id)
      .then(setCourse)
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setCompleted(readCompleted(id));
  }, [id]);

  const enrolled = course?.hasAccess || course?.isEnrolled;
  const lessons = course?.lessons ?? [];
  const active = lessons.find((l) => l.id === activeId) || null;

  const completedCount = useMemo(
    () => lessons.filter((l) => completed.includes(l.id)).length,
    [lessons, completed],
  );
  const localPct = lessons.length
    ? Math.round((completedCount / lessons.length) * 100)
    : 0;
  const pct = Math.max(localPct, course?.enrollment?.percentComplete ?? 0);
  const barStyle = { width: pct + "%" };

  function persistCompleted(next: string[]) {
    setCompleted(next);
    try {
      window.localStorage.setItem(progressKey(id), JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  }

  function toggleComplete(lessonId: string) {
    const next = completed.includes(lessonId)
      ? completed.filter((x) => x !== lessonId)
      : [...completed, lessonId];
    persistCompleted(next);
  }

  async function enroll() {
    if (!course) return;
    setBusy(true);
    setError(null);
    try {
      if (course.price > 0) {
        const res = await api<{ order: any; payment: any }>("/orders", {
          method: "POST",
          body: { kind: "COURSE", courseId: id },
        });
        const q = new URLSearchParams({
          title: course.title,
          amount: String(course.price),
          currency: course.currency,
          back: "/client/courses/" + id,
        }).toString();
        router.push("/checkout/" + res.payment.id + "?" + q);
        return;
      }
      await api("/courses/" + id + "/enroll", { method: "POST" });
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function openLesson(l: Lesson) {
    if (!(enrolled || l.isPreview)) return;
    setActiveId(l.id);
    if (typeof window !== "undefined")
      window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function continueLearning() {
    const next = lessons.find((l) => !completed.includes(l.id)) || lessons[0];
    if (next) openLesson(next);
  }

  function goAdjacent(dir: -1 | 1) {
    if (!active) return;
    const i = lessons.findIndex((l) => l.id === active.id);
    const n = lessons[i + dir];
    if (n) openLesson(n);
  }

  if (!course) return <Spinner />;

  // ---------------- Lesson view ----------------
  if (active) {
    const i = lessons.findIndex((l) => l.id === active.id);
    const isDone = completed.includes(active.id);
    const quiz =
      active.type === "QUIZ"
        ? course.quizzes?.find((q) => q.lessonId === active.id) ||
          course.quizzes?.[0]
        : undefined;
    return (
      <div className="mx-auto max-w-4xl">
        <button
          onClick={() => setActiveId(null)}
          className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:text-brand-dark"
        >
          <ChevronLeft className="h-4 w-4" /> Back to syllabus
        </button>

        {active.type === "QUIZ" ? (
          <QuizRunner
            quiz={quiz}
            onPassed={() => {
              if (!completed.includes(active.id))
                persistCompleted([...completed, active.id]);
            }}
          />
        ) : (
          <LessonPlayer
            lesson={active}
            watermark={user?.email || user?.name || "Protected content"}
          />
        )}

        {/* prev / next + completion */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            onClick={() => goAdjacent(-1)}
            disabled={i <= 0}
            className="!px-3"
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>

          {active.type !== "QUIZ" ? (
            <Button
              variant={isDone ? "outline" : "primary"}
              onClick={() => toggleComplete(active.id)}
            >
              {isDone ? (
                <>
                  <CheckCircle2 className="h-4 w-4" /> Mark as incomplete
                </>
              ) : (
                <>
                  <Circle className="h-4 w-4" /> Mark as complete
                </>
              )}
            </Button>
          ) : (
            <span className="text-xs text-slate-400">
              Pass the quiz to complete
            </span>
          )}

          <Button
            variant="outline"
            onClick={() => goAdjacent(1)}
            disabled={i >= lessons.length - 1}
            className="!px-3"
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Personal notes + course Q&A for this lesson */}
        {(enrolled || active.isPreview) && active.type !== "QUIZ" ? (
          <LessonExtras
            lessonId={active.id}
            isInstructor={
              (user as any)?.role === "ADMIN" ||
              (user as any)?.role === "CONSULTANT"
            }
            isAdmin={(user as any)?.role === "ADMIN"}
            currentUserId={(user as any)?.id || (user as any)?.userId || ""}
          />
        ) : null}
      </div>
    );
  }

  // ---------------- Course overview ----------------
  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/client/courses"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:text-brand-dark"
      >
        <ChevronLeft className="h-4 w-4" /> Back to Courses
      </Link>

      {/* Banner */}
      <div className="relative mb-5 overflow-hidden rounded-2xl bg-brand-light">
        <div className="aspect-[16/6] w-full">
          {course.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={course.coverUrl}
              alt={course.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-brand">
              <PlayCircle className="h-14 w-14" />
            </div>
          )}
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <span className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">
          {completedCount}/{lessons.length} lessons
        </span>
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h1 className="text-xl font-bold text-white drop-shadow sm:text-2xl">
            {course.title}
          </h1>
          <p className="mt-1 text-xs text-white/80">
            1 module · {lessons.length} lessons
            {course.updatedAt
              ? " \u00b7 Updated " +
                new Date(course.updatedAt).toLocaleDateString()
              : ""}
          </p>
          {enrolled ? (
            <div className="mt-3 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/30">
                <div
                  className="h-full rounded-full bg-brand"
                  style={barStyle}
                />
              </div>
              <span className="text-xs font-semibold text-white">{pct}%</span>
            </div>
          ) : null}
        </div>
      </div>

      <ErrorText message={error} />

      {/* Tabs */}
      <div className="mb-4 flex gap-6 border-b border-slate-200">
        <button
          onClick={() => setTab("syllabus")}
          className={clsx(
            "-mb-px border-b-2 pb-2 text-sm font-semibold transition",
            tab === "syllabus"
              ? "border-brand text-brand"
              : "border-transparent text-slate-500 hover:text-slate-800",
          )}
        >
          Syllabus
        </button>
        <button
          onClick={() => setTab("details")}
          className={clsx(
            "-mb-px border-b-2 pb-2 text-sm font-semibold transition",
            tab === "details"
              ? "border-brand text-brand"
              : "border-transparent text-slate-500 hover:text-slate-800",
          )}
        >
          More details
        </button>
      </div>

      {tab === "details" ? (
        <MoreDetails course={course} />
      ) : (
        <>
          {!enrolled ? (
            <Card className="mb-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-600">
                  Enroll to unlock all {lessons.length} lessons.
                </p>
                <Button onClick={enroll} disabled={busy}>
                  {busy
                    ? course.price > 0
                      ? "Starting checkout\u2026"
                      : "Enrolling\u2026"
                    : course.price > 0
                      ? "Enroll \u2014 " +
                        course.currency +
                        " " +
                        course.price.toLocaleString()
                      : "Enroll for free"}
                </Button>
              </div>
            </Card>
          ) : null}

          {/* Module accordion */}
          <Card>
            <button
              onClick={() => setModuleOpen((v) => !v)}
              className="flex w-full items-center justify-between text-left"
            >
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  1: {course.title}
                </p>
                <p className="text-xs text-slate-400">
                  {lessons.length} lessons
                </p>
              </div>
              <ChevronDown
                className={clsx(
                  "h-5 w-5 text-slate-400 transition-transform",
                  moduleOpen ? "rotate-180" : "",
                )}
              />
            </button>

            {moduleOpen ? (
              <div className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
                {lessons.map((l) => {
                  const Icon = lessonIcon[l.type] ?? FileText;
                  const open = enrolled || l.isPreview;
                  const locked = !open;
                  const done = completed.includes(l.id);
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => openLesson(l)}
                      disabled={locked}
                      className={clsx(
                        "flex w-full items-center gap-3 py-3 text-left transition",
                        locked ? "cursor-not-allowed" : "hover:bg-slate-50",
                      )}
                    >
                      <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-md bg-slate-100">
                        <div className="flex h-full w-full items-center justify-center text-slate-400">
                          <Icon className="h-5 w-5" />
                        </div>
                        {l.thumbnailUrl ? (
                          <MediaImg
                            value={l.thumbnailUrl}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        ) : null}
                        {l.type === "VIDEO" ? (
                          <span className="absolute bottom-1 left-1 rounded bg-black/60 p-0.5">
                            <PlayCircle className="h-3 w-3 text-white" />
                          </span>
                        ) : null}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800">
                          {l.index + 1}. {l.title}
                        </p>
                        <div className="mt-0.5 flex items-center gap-2">
                          <span className="text-[10px] font-semibold tracking-wide text-slate-400">
                            {typeLabel[l.type]}
                          </span>
                          {l.durationSec ? (
                            <span className="text-[10px] text-slate-400">
                              · {Math.round(l.durationSec / 60)} min
                            </span>
                          ) : null}
                          {l.isPreview ? (
                            <Badge color="amber">Preview</Badge>
                          ) : null}
                        </div>
                      </div>

                      {done ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : locked ? (
                        <Lock className="h-4 w-4 text-slate-400" />
                      ) : (
                        <Icon className="h-4 w-4 text-brand" />
                      )}
                    </button>
                  );
                })}
                {lessons.length === 0 ? (
                  <p className="py-3 text-sm text-slate-400">
                    No lessons added yet.
                  </p>
                ) : null}
              </div>
            ) : null}
          </Card>

          {/* Sticky continue */}
          {enrolled && lessons.length ? (
            <div className="sticky bottom-4 mt-5">
              <Button onClick={continueLearning} className="w-full">
                <PlayCircle className="h-4 w-4" />{" "}
                {completedCount > 0 && completedCount < lessons.length
                  ? "Continue learning"
                  : completedCount >= lessons.length
                    ? "Review course"
                    : "Start learning"}
              </Button>
            </div>
          ) : null}

          {/* Ratings & reviews */}
          <ReviewsSection
            courseId={id}
            canReview={!!enrolled}
            summary={course.reviewSummary}
            myReview={course.myReview}
            onChange={load}
          />
        </>
      )}
    </div>
  );
}

// ============== Lesson player ==============
function LessonPlayer({
  lesson,
  watermark,
}: {
  lesson: Lesson;
  watermark: string;
}) {
  const [subTab, setSubTab] = useState<"details" | "attachments">("details");
  const [playUrl, setPlayUrl] = useState<string | null>(null);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [playLoading, setPlayLoading] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [videoError, setVideoError] = useState(false);

  // Resume-where-you-left-off + periodic progress reporting for video lessons.
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastReport = useRef(0);
  const didSeek = useRef(false);

  // Seek to the saved position once metadata is ready.
  function onVideoMeta() {
    const v = videoRef.current;
    if (!v || didSeek.current) return;
    didSeek.current = true;
    const resume = lesson.resumeSec || 0;
    if (resume > 0 && resume < (v.duration || Infinity) - 5) {
      try {
        v.currentTime = resume;
      } catch {
        // ignore seek errors
      }
    }
  }

  // Throttled save of watch fraction + last position (every ~10s).
  function onVideoTime() {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const now = Date.now();
    if (now - lastReport.current < 10000) return;
    lastReport.current = now;
    const fraction = Math.min(1, v.currentTime / v.duration);
    api("/courses/lessons/" + lesson.id + "/progress", {
      method: "POST",
      body: { progress: fraction, positionSec: Math.round(v.currentTime) },
    }).catch(() => {});
  }

  useEffect(() => {
    let cancelled = false;
    setPlayUrl(null);
    setPosterUrl(null);
    setSubTab("details");
    setShowMore(false);
    setVideoError(false);
    didSeek.current = false;
    lastReport.current = 0;
    // Resolve the lesson thumbnail (storage key or external URL) so it can be
    // shown as the video poster before playback starts.
    resolveMediaUrl(lesson.thumbnailUrl).then((u) => {
      if (!cancelled) setPosterUrl(u);
    });
    if (lesson.type === "VIDEO" || lesson.type === "PDF") {
      setPlayLoading(true);
      (async () => {
        try {
          if (lesson.source === "LINK" && lesson.videoUrl) {
            if (!cancelled) setPlayUrl(lesson.videoUrl);
          } else if (lesson.contentKey) {
            const u = await resolveMediaUrl(lesson.contentKey);
            if (!cancelled) setPlayUrl(u);
          }
        } finally {
          if (!cancelled) setPlayLoading(false);
        }
      })();
    }
    return () => {
      cancelled = true;
    };
  }, [
    lesson.id,
    lesson.type,
    lesson.source,
    lesson.contentKey,
    lesson.videoUrl,
    lesson.thumbnailUrl,
  ]);

  const notesLines = (lesson.notes || "")
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const keyLines = (lesson.keyPoints || "")
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const visibleNotes = showMore ? notesLines : notesLines.slice(0, 3);

  const attachments = [
    ...(lesson.type === "PDF" && lesson.contentKey
      ? [{ name: lesson.title + ".pdf", key: lesson.contentKey }]
      : []),
    ...(lesson.attachments || []),
  ];

  return (
    <>
      {/* Media */}
      {lesson.type === "TEXT" ? (
        <Card>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {lesson.contentKey || lesson.notes || "No content."}
          </p>
        </Card>
      ) : lesson.type === "ASSIGNMENT" ? (
        <Card>
          <p className="text-sm text-slate-600">
            This is an assignment lesson. Submit your work from the course
            tools.
          </p>
        </Card>
      ) : playLoading ? (
        <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-black/90 text-white/70">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : !playUrl ? (
        <Card>
          <p className="text-sm text-slate-500">
            This lesson has no media attached yet.
          </p>
        </Card>
      ) : lesson.type === "PDF" ? (
        <div className="relative">
          <iframe
            src={playUrl}
            className="h-[70vh] w-full rounded-xl border border-slate-200"
            title={lesson.title}
          />
          <Watermark text={watermark} />
        </div>
      ) : (
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
          {(() => {
            const embed =
              lesson.source === "LINK"
                ? toEmbed(playUrl)
                : { kind: "video" as const, src: playUrl };
            if (embed.kind === "iframe") {
              return (
                <iframe
                  src={embed.src}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={lesson.title}
                />
              );
            }
            return (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video
                ref={videoRef}
                src={embed.src}
                poster={posterUrl || undefined}
                controls
                controlsList="nodownload noplaybackrate"
                disablePictureInPicture
                onContextMenu={(e) => e.preventDefault()}
                onLoadedMetadata={onVideoMeta}
                onTimeUpdate={onVideoTime}
                onPause={onVideoTime}
                onError={() => setVideoError(true)}
                className={videoError ? "hidden" : "h-full w-full"}
              />
              {videoError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90 text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                  <p className="text-sm font-semibold">Could not play this video</p>
                  <p className="text-xs text-white/60">The link may have expired. Try reloading.</p>
                  <button
                    onClick={() => { setVideoError(false); setPlayUrl(null); setPlayLoading(true); (async () => { try { const u = await resolveMediaUrl(lesson.contentKey); setPlayUrl(u); } finally { setPlayLoading(false); } })(); }}
                    className="mt-1 rounded-lg bg-white/20 px-5 py-2 text-sm font-bold hover:bg-white/30"
                  >
                    Retry
                  </button>
                </div>
              )}
            );
          })()}
          <Watermark text={watermark} />
        </div>
      )}

      {/* Title + sub tabs */}
      <div className="mt-4">
        <h2 className="text-lg font-bold text-slate-950">{lesson.title}</h2>
        <p className="text-xs text-slate-400">Lesson {lesson.index + 1}</p>
      </div>

      <div className="mt-3 flex gap-6 border-b border-slate-200">
        <button
          onClick={() => setSubTab("details")}
          className={clsx(
            "-mb-px border-b-2 pb-2 text-sm font-semibold transition",
            subTab === "details"
              ? "border-brand text-brand"
              : "border-transparent text-slate-500 hover:text-slate-800",
          )}
        >
          Details
        </button>
        <button
          onClick={() => setSubTab("attachments")}
          className={clsx(
            "-mb-px border-b-2 pb-2 text-sm font-semibold transition",
            subTab === "attachments"
              ? "border-brand text-brand"
              : "border-transparent text-slate-500 hover:text-slate-800",
          )}
        >
          Attachments
          {attachments.length ? (
            <span className="ml-1 text-xs text-slate-400">
              ({attachments.length})
            </span>
          ) : null}
        </button>
      </div>

      <div className="mt-4">
        {subTab === "attachments" ? (
          attachments.length ? (
            <div className="space-y-2">
              {attachments.map((a, idx) => (
                <AttachmentRow key={idx} name={a.name} fileKey={a.key} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              No attachments for this lesson.
            </p>
          )
        ) : notesLines.length || keyLines.length ? (
          <div className="space-y-4">
            {notesLines.length ? (
              <div>
                <p className="mb-1 text-sm font-semibold text-slate-900">
                  📌 In This Lecture
                </p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {visibleNotes.map((n, idx) => (
                    <li key={idx}>{n}</li>
                  ))}
                </ul>
                {notesLines.length > 3 ? (
                  <button
                    onClick={() => setShowMore((v) => !v)}
                    className="mt-1 text-xs font-semibold text-brand hover:text-brand-dark"
                  >
                    {showMore ? "View less" : "View more"}
                  </button>
                ) : null}
              </div>
            ) : null}
            {keyLines.length ? (
              <div>
                <p className="mb-1 text-sm font-semibold text-slate-900">
                  🔍 Key Lessons
                </p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {keyLines.map((n, idx) => (
                    <li key={idx}>{n}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            No lecture notes for this lesson yet.
          </p>
        )}
      </div>
    </>
  );
}

// Resolves a stored media value (storage key or external URL) and renders it as
// an <img>, with the caller supplying a fallback behind it. Returns null until
// the URL resolves so the fallback shows in the meantime.
function MediaImg({
  value,
  alt,
  className,
}: {
  value?: string | null;
  alt: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    resolveMediaUrl(value).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [value]);
  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={className} />;
}

function Watermark({ text }: { text: string }) {
  const rows = Array.from({ length: 6 });
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between overflow-hidden opacity-[0.12]">
      {rows.map((_, r) => (
        <div
          key={r}
          className="flex -rotate-12 justify-around whitespace-nowrap text-[11px] font-semibold text-white"
        >
          <span>{text}</span>
          <span>{text}</span>
          <span>{text}</span>
        </div>
      ))}
    </div>
  );
}

function AttachmentRow({ name, fileKey }: { name: string; fileKey: string }) {
  const [busy, setBusy] = useState(false);
  async function open() {
    setBusy(true);
    try {
      const url = await resolveMediaUrl(fileKey);
      if (url && typeof window !== "undefined")
        window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      onClick={open}
      disabled={busy}
      className="flex w-full items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-left transition hover:bg-slate-50"
    >
      <FileText className="h-5 w-5 text-brand" />
      <span className="flex-1 truncate text-sm text-slate-800">{name}</span>
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
      ) : (
        <Download className="h-4 w-4 text-slate-400" />
      )}
    </button>
  );
}

// ============== More details ==============
function MoreDetails({ course }: { course: Course }) {
  const instructor: Instructor = course.instructor || {
    name: "Prof. Dr. Javed Iqbal",
    title: "Course Instructor",
    bio: null,
  };
  return (
    <div className="space-y-5">
      <Card>
        <p className="mb-3 text-sm font-semibold text-slate-900">Instructor</p>
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-light text-brand">
            {instructor.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={instructor.avatarUrl}
                alt={instructor.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-sm font-bold">
                {instructor.name.slice(0, 1)}
              </span>
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900">
              {instructor.name}
            </p>
            {instructor.title ? (
              <p className="text-xs text-slate-500">{instructor.title}</p>
            ) : null}
            {instructor.bio ? (
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {instructor.bio}
              </p>
            ) : null}
          </div>
        </div>
      </Card>

      <Card>
        <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <BookOpen className="h-4 w-4 text-brand" /> About this course
        </p>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
          {course.description || "No description provided for this course."}
        </p>
      </Card>
    </div>
  );
}

// ============== Quiz runner ==============
function QuizRunner({ quiz, onPassed }: { quiz?: Quiz; onPassed: () => void }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{
    score: number;
    passed: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!quiz || !quiz.questions?.length) {
    return (
      <Card>
        <p className="text-sm text-slate-500">
          This quiz has no questions yet.
        </p>
      </Card>
    );
  }

  const questions = quiz.questions;
  const total = questions.length;
  const q = questions[step];
  const opts = parseOptions(q);
  const chosen = answers[q.id];
  const isLast = step === total - 1;
  const quizBarStyle = { width: ((step + 1) / total) * 100 + "%" };

  function choose(idx: number) {
    setAnswers((a) => ({ ...a, [q.id]: idx }));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const correct = questions.filter(
        (qq) => answers[qq.id] === qq.answer,
      ).length;
      const score = Math.round((correct / total) * 100);
      const passed = score >= (quiz.passScore ?? 70);
      try {
        await api("/courses/quizzes/" + quiz.id + "/submit", {
          method: "POST",
          body: { score, passed },
        });
      } catch {
        // still show local result if the attempt fails to persist
      }
      setResult({ score, passed });
      if (passed) onPassed();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <Card>
        <div className="flex flex-col items-center py-6 text-center">
          {result.passed ? (
            <CheckCircle2 className="h-12 w-12 text-green-500" />
          ) : (
            <HelpCircle className="h-12 w-12 text-amber-500" />
          )}
          <p className="mt-3 text-lg font-bold text-slate-900">
            {result.passed ? "Passed!" : "Keep practicing"}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            You scored {result.score}%
          </p>
          {!result.passed ? (
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setResult(null);
                setAnswers({});
                setStep(0);
              }}
            >
              Retry quiz
            </Button>
          ) : null}
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">{quiz.title}</p>
        <span className="text-xs font-semibold text-slate-400">
          {step + 1}/{total}
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-brand transition-all"
          style={quizBarStyle}
        />
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 p-4">
        <p className="text-base font-medium text-slate-900">{q.prompt}</p>
        <div className="mt-4 space-y-2">
          {opts.map((opt, idx) => (
            <button
              key={idx}
              onClick={() => choose(idx)}
              className={clsx(
                "flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left text-sm transition",
                chosen === idx
                  ? "border-brand bg-brand-light/60 text-brand-dark"
                  : "border-slate-200 hover:bg-slate-50",
              )}
            >
              <span
                className={clsx(
                  "flex h-4 w-4 items-center justify-center rounded-full border",
                  chosen === idx ? "border-brand" : "border-slate-300",
                )}
              >
                {chosen === idx ? (
                  <span className="h-2 w-2 rounded-full bg-brand" />
                ) : null}
              </span>
              {opt}
            </button>
          ))}
        </div>
      </div>

      <ErrorText message={error} />

      <div className="mt-5 flex items-center justify-between gap-3">
        <Button
          variant="outline"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="!px-3"
        >
          <ChevronLeft className="h-4 w-4" /> Prev
        </Button>
        {isLast ? (
          <Button
            onClick={submit}
            disabled={busy || Object.keys(answers).length < total}
          >
            {busy ? "Submitting\u2026" : "Submit quiz"}
          </Button>
        ) : (
          <Button
            onClick={() => setStep((s) => Math.min(total - 1, s + 1))}
            disabled={chosen === undefined}
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </Card>
  );
}

// ============== Ratings & reviews ==============
function Stars({
  value,
  onSelect,
  size = "h-5 w-5",
}: {
  value: number;
  onSelect?: (n: number) => void;
  size?: string;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onSelect}
          onClick={() => onSelect && onSelect(n)}
          className={clsx(onSelect ? "cursor-pointer" : "cursor-default")}
        >
          <Star
            className={clsx(
              size,
              n <= value ? "fill-amber-400 text-amber-400" : "text-slate-300",
            )}
          />
        </button>
      ))}
    </div>
  );
}

type ReviewItem = {
  id: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
  user?: { id: string; name: string; avatarUrl?: string | null };
};

function ReviewsSection({
  courseId,
  canReview,
  summary,
  myReview,
  onChange,
}: {
  courseId: string;
  canReview: boolean;
  summary?: { avg: number; count: number };
  myReview?: { id: string; rating: number; comment?: string | null } | null;
  onChange: () => void;
}) {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [rating, setRating] = useState(myReview?.rating || 0);
  const [comment, setComment] = useState(myReview?.comment || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    api<ReviewItem[]>("/courses/" + courseId + "/reviews")
      .then(setReviews)
      .catch(() => {});
  }, [courseId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setRating(myReview?.rating || 0);
    setComment(myReview?.comment || "");
  }, [myReview?.rating, myReview?.comment]);

  async function submit() {
    if (rating < 1) {
      setErr("Please pick a star rating.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api("/courses/" + courseId + "/reviews", {
        method: "POST",
        body: { rating, comment: comment.trim() || undefined },
      });
      load();
      onChange();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeMine() {
    setBusy(true);
    try {
      await api("/courses/" + courseId + "/reviews", { method: "DELETE" });
      setRating(0);
      setComment("");
      load();
      onChange();
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mt-5">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-bold text-slate-950">
          <Star className="h-5 w-5 text-brand" /> Ratings &amp; reviews
        </h3>
        {summary && summary.count > 0 ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-lg font-bold text-slate-900">
              {summary.avg.toFixed(1)}
            </span>
            <Stars value={Math.round(summary.avg)} size="h-4 w-4" />
            <span className="text-slate-400">({summary.count})</span>
          </div>
        ) : (
          <span className="text-xs text-slate-400">No reviews yet</span>
        )}
      </div>

      {canReview ? (
        <div className="mt-4 rounded-xl border border-slate-200 p-4">
          <p className="mb-2 text-sm font-semibold text-slate-700">
            {myReview ? "Your review" : "Write a review"}
          </p>
          <Stars value={rating} onSelect={setRating} />
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="Share what you thought about this course (optional)"
            className="mt-3 w-full rounded-lg border border-slate-200 p-2 text-sm focus:border-brand focus:outline-none"
          />
          {err ? <ErrorText message={err} /> : null}
          <div className="mt-2 flex gap-2">
            <Button onClick={submit} disabled={busy}>
              {myReview ? "Update review" : "Submit review"}
            </Button>
            {myReview ? (
              <Button variant="outline" onClick={removeMine} disabled={busy}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-400">
          Enroll in this course to leave a review.
        </p>
      )}

      <div className="mt-4 space-y-4">
        {reviews.map((r) => (
          <div
            key={r.id}
            className="border-b border-slate-100 pb-3 last:border-0"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-800">
                {r.user?.name || "Learner"}
              </span>
              <Stars value={r.rating} size="h-3.5 w-3.5" />
            </div>
            {r.comment ? (
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                {r.comment}
              </p>
            ) : null}
          </div>
        ))}
        {reviews.length === 0 ? (
          <p className="text-sm text-slate-400">
            Be the first to review this course.
          </p>
        ) : null}
      </div>
    </Card>
  );
}

// ============== Lesson notes + Q&A ==============
type NoteItem = {
  id: string;
  body: string;
  positionSec?: number | null;
  createdAt: string;
};

type AnswerItem = {
  id: string;
  body: string;
  isInstructor: boolean;
  createdAt: string;
  user?: { id: string; name: string };
};

type QuestionItem = {
  id: string;
  body: string;
  resolved: boolean;
  createdAt: string;
  userId: string;
  user?: { id: string; name: string };
  answers: AnswerItem[];
};

function LessonExtras({
  lessonId,
  isInstructor,
  isAdmin,
  currentUserId,
}: {
  lessonId: string;
  isInstructor: boolean;
  isAdmin: boolean;
  currentUserId: string;
}) {
  const [tab, setTab] = useState<"notes" | "qa">("notes");
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [noteBody, setNoteBody] = useState("");
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [qBody, setQBody] = useState("");
  const [answerFor, setAnswerFor] = useState<string | null>(null);
  const [answerBody, setAnswerBody] = useState("");
  const [busy, setBusy] = useState(false);

  const loadNotes = useCallback(() => {
    api<NoteItem[]>("/courses/lessons/" + lessonId + "/notes")
      .then(setNotes)
      .catch(() => {});
  }, [lessonId]);
  const loadQuestions = useCallback(() => {
    api<QuestionItem[]>("/courses/lessons/" + lessonId + "/questions")
      .then(setQuestions)
      .catch(() => {});
  }, [lessonId]);

  useEffect(() => {
    loadNotes();
    loadQuestions();
    setNoteBody("");
    setQBody("");
    setAnswerFor(null);
  }, [loadNotes, loadQuestions]);

  async function addNote() {
    if (!noteBody.trim()) return;
    setBusy(true);
    try {
      await api("/courses/notes", {
        method: "POST",
        body: { lessonId, body: noteBody.trim() },
      });
      setNoteBody("");
      loadNotes();
    } finally {
      setBusy(false);
    }
  }
  async function delNote(id: string) {
    await api("/courses/notes/" + id, { method: "DELETE" }).catch(() => {});
    loadNotes();
  }
  async function askQuestion() {
    if (!qBody.trim()) return;
    setBusy(true);
    try {
      await api("/courses/questions", {
        method: "POST",
        body: { lessonId, body: qBody.trim() },
      });
      setQBody("");
      loadQuestions();
    } finally {
      setBusy(false);
    }
  }
  async function sendAnswer(qid: string) {
    if (!answerBody.trim()) return;
    setBusy(true);
    try {
      await api("/courses/questions/" + qid + "/answers", {
        method: "POST",
        body: { body: answerBody.trim() },
      });
      setAnswerBody("");
      setAnswerFor(null);
      loadQuestions();
    } finally {
      setBusy(false);
    }
  }
  async function toggleResolved(q: QuestionItem) {
    await api("/courses/questions/" + q.id + "/resolve", {
      method: "PATCH",
      body: { resolved: !q.resolved },
    }).catch(() => {});
    loadQuestions();
  }
  async function delQuestion(id: string) {
    await api("/courses/questions/" + id, { method: "DELETE" }).catch(() => {});
    loadQuestions();
  }

  return (
    <Card className="mt-5">
      <div className="mb-3 flex gap-6 border-b border-slate-200">
        <button
          onClick={() => setTab("notes")}
          className={clsx(
            "-mb-px flex items-center gap-1 border-b-2 pb-2 text-sm font-semibold transition",
            tab === "notes"
              ? "border-brand text-brand"
              : "border-transparent text-slate-500 hover:text-slate-800",
          )}
        >
          <StickyNote className="h-4 w-4" /> My notes
        </button>
        <button
          onClick={() => setTab("qa")}
          className={clsx(
            "-mb-px flex items-center gap-1 border-b-2 pb-2 text-sm font-semibold transition",
            tab === "qa"
              ? "border-brand text-brand"
              : "border-transparent text-slate-500 hover:text-slate-800",
          )}
        >
          <MessageCircle className="h-4 w-4" /> Q&amp;A
          {questions.length ? (
            <span className="ml-1 text-xs text-slate-400">
              ({questions.length})
            </span>
          ) : null}
        </button>
      </div>

      {tab === "notes" ? (
        <div>
          <textarea
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            rows={2}
            placeholder="Add a private note for this lesson..."
            className="w-full rounded-lg border border-slate-200 p-2 text-sm focus:border-brand focus:outline-none"
          />
          <div className="mt-2">
            <Button onClick={addNote} disabled={busy}>
              <Send className="h-4 w-4" /> Save note
            </Button>
          </div>
          <div className="mt-4 space-y-3">
            {notes.map((n) => (
              <div
                key={n.id}
                className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 p-3"
              >
                <p className="whitespace-pre-wrap text-sm text-slate-700">
                  {n.body}
                </p>
                <button
                  onClick={() => delNote(n.id)}
                  className="text-slate-400 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {notes.length === 0 ? (
              <p className="text-sm text-slate-400">
                Your notes are private and only visible to you.
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <div>
          <textarea
            value={qBody}
            onChange={(e) => setQBody(e.target.value)}
            rows={2}
            placeholder="Ask a question about this lesson..."
            className="w-full rounded-lg border border-slate-200 p-2 text-sm focus:border-brand focus:outline-none"
          />
          <div className="mt-2">
            <Button onClick={askQuestion} disabled={busy}>
              <Send className="h-4 w-4" /> Post question
            </Button>
          </div>
          <div className="mt-4 space-y-4">
            {questions.map((q) => (
              <div
                key={q.id}
                className="rounded-lg border border-slate-200 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800">
                        {q.user?.name || "Learner"}
                      </span>
                      {q.resolved ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          <Check className="h-3 w-3" /> Resolved
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                      {q.body}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {isAdmin || q.userId === currentUserId ? (
                      <button
                        onClick={() => toggleResolved(q)}
                        title="Toggle resolved"
                        className="text-slate-400 hover:text-green-600"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    ) : null}
                    {isAdmin || q.userId === currentUserId ? (
                      <button
                        onClick={() => delQuestion(q.id)}
                        className="text-slate-400 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </div>

                {q.answers.length ? (
                  <div className="mt-3 space-y-2 border-l-2 border-slate-100 pl-3">
                    {q.answers.map((a) => (
                      <div key={a.id}>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-700">
                            {a.user?.name || "User"}
                          </span>
                          {a.isInstructor ? (
                            <span className="rounded-full bg-brand-light px-2 py-0.5 text-xs font-medium text-brand">
                              Instructor
                            </span>
                          ) : null}
                        </div>
                        <p className="whitespace-pre-wrap text-sm text-slate-600">
                          {a.body}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}

                {answerFor === q.id ? (
                  <div className="mt-3">
                    <textarea
                      value={answerBody}
                      onChange={(e) => setAnswerBody(e.target.value)}
                      rows={2}
                      placeholder="Write an answer..."
                      className="w-full rounded-lg border border-slate-200 p-2 text-sm focus:border-brand focus:outline-none"
                    />
                    <div className="mt-2 flex gap-2">
                      <Button onClick={() => sendAnswer(q.id)} disabled={busy}>
                        Reply
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setAnswerFor(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setAnswerFor(q.id);
                      setAnswerBody("");
                    }}
                    className="mt-2 text-xs font-medium text-brand hover:text-brand-dark"
                  >
                    Reply
                  </button>
                )}
              </div>
            ))}
            {questions.length === 0 ? (
              <p className="text-sm text-slate-400">
                No questions yet. Start the conversation!
              </p>
            ) : null}
          </div>
        </div>
      )}
    </Card>
  );
}
