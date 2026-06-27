"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card, Spinner, Badge } from "@/components/ui";
import { PageHeader } from "@/components/shell";
import {
  BookOpen,
  CalendarClock,
  GraduationCap,
  MessageSquare,
  Package,
  Settings2,
} from "lucide-react";
import clsx from "clsx";

type ActivePackage = {
  consultant?: { name: string };
  package?: string;
  expiresAt?: string;
  text: any;
  audio: any;
  video: any;
  sessions: any;
};
type Stats = { activePackages: ActivePackage[] };
type EnrolledCourse = {
  courseId: string;
  course?: { title: string };
  percentComplete: number;
  lessonsComplete: number;
};
type Meeting = {
  id: string;
  title: string;
  scheduledAt?: string;
  status: string;
  meetingUrl?: string | null;
};

const ALL_WIDGETS = [
  { id: "packages", label: "Active Packages" },
  { id: "courses", label: "Enrolled Courses" },
  { id: "meetings", label: "Upcoming Meetings" },
  { id: "messages", label: "Quick Links" },
] as const;
type WidgetId = (typeof ALL_WIDGETS)[number]["id"];

const LS_KEY = "clientDashWidgets";
function loadWidgets(): Set<WidgetId> {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null;
    if (raw) return new Set(JSON.parse(raw) as WidgetId[]);
  } catch {}
  return new Set(ALL_WIDGETS.map((w) => w.id));
}
function saveWidgets(set: Set<WidgetId>) {
  localStorage.setItem(LS_KEY, JSON.stringify([...set]));
}

function UsageBar({ r }: { r: any }) {
  if (!r) return null;
  if (r.unlimited)
    return <span className="text-xs text-green-700 font-semibold">Unlimited</span>;
  const pct = r.limit ? Math.round((r.used / r.limit) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-slate-500">
        <span>{r.used} / {r.limit} used</span>
        <span className="font-semibold text-slate-700">{r.remaining} left</span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100">
        <div
          className={clsx(
            "h-2 rounded-full transition-all",
            pct > 80 ? "bg-red-400" : pct > 50 ? "bg-amber-400" : "bg-brand",
          )}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}

export default function ClientDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [courses, setCourses] = useState<EnrolledCourse[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [visible, setVisible] = useState<Set<WidgetId>>(new Set());

  useEffect(() => {
    setVisible(loadWidgets());
    Promise.all([
      api<Stats>("/reports/client/me").catch(() => ({ activePackages: [] })),
      api<EnrolledCourse[]>("/courses/me/enrolled").catch(() => []),
      api<Meeting[]>("/meetings").catch(() => []),
    ]).then(([s, c, m]) => {
      setStats(s);
      const arr = Array.isArray(c) ? c : (c as any)?.items || [];
      setCourses(arr);
      const marr = Array.isArray(m) ? m : (m as any)?.items || [];
      setMeetings(
        marr
          .filter((x: Meeting) => x.status === "APPROVED" || x.status === "PENDING")
          .slice(0, 5),
      );
    }).finally(() => setLoading(false));
  }, []);

  function toggleWidget(id: WidgetId) {
    setVisible((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      saveWidgets(next);
      return next;
    });
  }

  if (loading) return <Spinner />;

  const hasPackages = (stats?.activePackages?.length ?? 0) > 0;

  return (
    <div>
      <PageHeader
        title="My Dashboard"
        subtitle="Overview of your learning and consultations"
        action={
          <button
            onClick={() => setShowSettings((s) => !s)}
            className={clsx(
              "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition",
              showSettings
                ? "border-brand bg-brand/10 text-brand"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
            )}
          >
            <Settings2 className="h-4 w-4" />
            Customize
          </button>
        }
      />

      {showSettings && (
        <Card className="mb-6">
          <p className="mb-3 text-sm font-semibold text-slate-700">Show / hide widgets</p>
          <div className="flex flex-wrap gap-3">
            {ALL_WIDGETS.map((w) => (
              <button
                key={w.id}
                onClick={() => toggleWidget(w.id)}
                className={clsx(
                  "rounded-lg border px-3 py-1.5 text-sm font-medium transition",
                  visible.has(w.id)
                    ? "border-brand bg-brand text-white"
                    : "border-slate-200 bg-white text-slate-500",
                )}
              >
                {w.label}
              </button>
            ))}
          </div>
        </Card>
      )}

      <div className="space-y-6">
        {visible.has("packages") && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-800">
              <Package className="h-4 w-4 text-brand" /> Active Packages
            </h2>
            {!hasPackages ? (
              <Card>
                <p className="text-sm text-slate-400">
                  No active packages.{" "}
                  <Link href="/client/packages" className="text-brand underline">Browse packages</Link>
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {stats!.activePackages.map((p, i) => (
                  <Card key={i}>
                    <div className="mb-3 flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">{p.package}</p>
                        <p className="text-xs text-slate-500">
                          with {p.consultant?.name || "Any consultant"}
                        </p>
                      </div>
                      {p.expiresAt && (
                        <span className="text-xs text-slate-400">
                          Expires {new Date(p.expiresAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="mb-1.5 text-xs font-semibold text-slate-600">Text messages</p>
                        <UsageBar r={p.text} />
                      </div>
                      <div>
                        <p className="mb-1.5 text-xs font-semibold text-slate-600">Audio messages</p>
                        <UsageBar r={p.audio} />
                      </div>
                      <div>
                        <p className="mb-1.5 text-xs font-semibold text-slate-600">Video messages</p>
                        <UsageBar r={p.video} />
                      </div>
                      <div>
                        <p className="mb-1.5 text-xs font-semibold text-slate-600">Live sessions</p>
                        <UsageBar r={p.sessions} />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        )}

        {visible.has("courses") && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-800">
              <GraduationCap className="h-4 w-4 text-brand" /> Enrolled Courses
            </h2>
            {courses.length === 0 ? (
              <Card>
                <p className="text-sm text-slate-400">
                  Not enrolled in any courses yet.{" "}
                  <Link href="/client/courses" className="text-brand underline">Browse courses</Link>
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {courses.slice(0, 6).map((c) => (
                  <Link
                    key={c.courseId}
                    href={`/client/courses/${c.courseId}`}
                    className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand hover:shadow-md"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-brand" />
                      <p className="flex-1 truncate text-sm font-semibold text-slate-900">
                        {c.course?.title || "Course"}
                      </p>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100">
                      <div
                        className="h-1.5 rounded-full bg-brand"
                        style={{ width: `${Math.round(c.percentComplete)}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-right text-xs text-slate-400">
                      {Math.round(c.percentComplete)}% complete
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        {visible.has("meetings") && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-800">
              <CalendarClock className="h-4 w-4 text-brand" /> Upcoming Meetings
            </h2>
            {meetings.length === 0 ? (
              <Card>
                <p className="text-sm text-slate-400">
                  No upcoming meetings.{" "}
                  <Link href="/client/meetings" className="text-brand underline">Book a meeting</Link>
                </p>
              </Card>
            ) : (
              <div className="space-y-2">
                {meetings.map((m) => (
                  <Card key={m.id}>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-slate-900">{m.title}</p>
                        {m.scheduledAt && (
                          <p className="text-xs text-slate-500">
                            {new Date(m.scheduledAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className={clsx(
                            "rounded-full px-2 py-0.5 text-xs font-semibold",
                            m.status === "APPROVED"
                              ? "bg-green-100 text-green-700"
                              : "bg-amber-100 text-amber-700",
                          )}
                        >
                          {m.status}
                        </span>
                        {m.meetingUrl && (
                          <a
                            href={m.meetingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg bg-brand px-3 py-1 text-xs font-bold text-white hover:bg-brand/90"
                          >
                            Join
                          </a>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        )}

        {visible.has("messages") && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-800">
              <MessageSquare className="h-4 w-4 text-brand" /> Quick Links
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { href: "/client/messages", label: "Messages", icon: MessageSquare, color: "text-blue-600 bg-blue-50" },
                { href: "/client/library", label: "My Library", icon: BookOpen, color: "text-purple-600 bg-purple-50" },
                { href: "/client/meetings", label: "Meetings", icon: CalendarClock, color: "text-green-600 bg-green-50" },
                { href: "/client/courses", label: "Courses", icon: GraduationCap, color: "text-orange-600 bg-orange-50" },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm transition hover:border-brand hover:shadow-md"
                  >
                    <div className={clsx("flex h-10 w-10 items-center justify-center rounded-xl", item.color)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-semibold text-slate-700">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
