"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { api, getToken } from "@/lib/api";
import { Button, Card, Spinner } from "@/components/ui";
import { PageHeader } from "@/components/shell";

type Point = { date: string; value: number };
type Series = {
  revenue: Point[];
  orders: Point[];
  signups: Point[];
  enrollments: Point[];
  lessonCompletions: Point[];
};
type Timeseries = {
  from: string;
  to: string;
  series: Series;
  totals: Record<string, number>;
};
type FunnelRow = {
  courseId: string;
  title: string;
  lessons: number;
  enrolled: number;
  notStarted: number;
  inProgress: number;
  completed: number;
  avgPercent: number;
  completionRate: number;
  dropOffRate: number;
};
type Funnel = {
  from: string;
  to: string;
  courses: FunnelRow[];
  totals: {
    enrolled: number;
    started: number;
    notStarted: number;
    inProgress: number;
    completed: number;
    completionRate: number;
    dropOffRate: number;
  };
};

type MetricKey = keyof Series;

const METRICS: Array<{
  key: MetricKey;
  label: string;
  color: string;
  money?: boolean;
}> = [
  { key: "revenue", label: "Revenue", color: "#FF7A1A", money: true },
  { key: "orders", label: "Paid orders", color: "#0f172a" },
  { key: "signups", label: "Signups", color: "#2563eb" },
  { key: "enrollments", label: "Enrollments", color: "#16a34a" },
  { key: "lessonCompletions", label: "Lessons done", color: "#9333ea" },
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

function fmt(n: number, money?: boolean) {
  const v = Number(n || 0);
  return money ? "PKR " + v.toLocaleString() : v.toLocaleString();
}

function LineChart({ data, color }: { data: Point[]; color: string }) {
  const w = 760;
  const h = 240;
  const pad = 32;
  if (!data.length) {
    return <p className="py-10 text-center text-sm text-slate-400">No data</p>;
  }
  const max = Math.max(1, ...data.map((d) => d.value));
  const stepX = (w - pad * 2) / Math.max(1, data.length - 1);
  const coords = data.map((d, i) => {
    const x = pad + i * stepX;
    const y = h - pad - (d.value / max) * (h - pad * 2);
    return { x, y };
  });
  const line = coords.map((c) => c.x + "," + c.y).join(" ");
  const area =
    pad +
    "," +
    (h - pad) +
    " " +
    line +
    " " +
    (pad + (data.length - 1) * stepX) +
    "," +
    (h - pad);
  const gridY = [0, 0.25, 0.5, 0.75, 1].map((f) => h - pad - f * (h - pad * 2));
  const peak = data.reduce((a, b) => (b.value > a.value ? b : a), data[0]);

  return (
    <div>
      <svg viewBox={"0 0 " + w + " " + h} className="w-full">
        {gridY.map((y, i) => (
          <line
            key={i}
            x1={pad}
            y1={y}
            x2={w - pad}
            y2={y}
            stroke="#e2e8f0"
            strokeWidth={1}
          />
        ))}
        <polygon points={area} fill={color} opacity={0.08} />
        <polyline
          points={line}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {coords.map((c, i) =>
          data[i].date === peak.date ? (
            <circle key={i} cx={c.x} cy={c.y} r={4} fill={color} />
          ) : null,
        )}
      </svg>
      <div className="mt-1 flex justify-between text-xs text-slate-400">
        <span>{data[0].date}</span>
        <span>
          Peak {peak.value.toLocaleString()} on {peak.date}
        </span>
        <span>{data[data.length - 1].date}</span>
      </div>
    </div>
  );
}

function FunnelBar({ totals }: { totals: Funnel["totals"] }) {
  const base = Math.max(1, totals.enrolled);
  const seg = [
    { label: "Completed", value: totals.completed, color: "#16a34a" },
    { label: "In progress", value: totals.inProgress, color: "#FF7A1A" },
    { label: "Not started", value: totals.notStarted, color: "#cbd5e1" },
  ];
  return (
    <div>
      <div className="flex h-5 overflow-hidden rounded-full bg-slate-100">
        {seg.map((s) => {
          const pct = (s.value / base) * 100;
          return (
            <div
              key={s.label}
              className="h-full"
              style={makeBarStyle(pct, s.color)}
              title={s.label + ": " + s.value}
            />
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
        {seg.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={makeDotStyle(s.color)}
            />
            {s.label} ({s.value})
          </span>
        ))}
      </div>
    </div>
  );
}

// Precompute style objects so we never write inline object literals in JSX.
function makeBarStyle(pct: number, color: string) {
  return { width: pct + "%", backgroundColor: color };
}
function makeDotStyle(color: string) {
  return { backgroundColor: color };
}
function makeWidthStyle(pct: number, color: string) {
  return { width: Math.min(100, pct) + "%", backgroundColor: color };
}

export default function AdminReportsPage() {
  const today = useMemo(() => new Date(), []);
  const defaultFrom = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return isoDay(d);
  }, []);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(isoDay(today));
  const [metric, setMetric] = useState<MetricKey>("revenue");
  const [ts, setTs] = useState<Timeseries | null>(null);
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [loading, setLoading] = useState(true);

  const query = useMemo(() => "?from=" + from + "&to=" + to, [from, to]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        api<Timeseries>("/reports/admin/timeseries" + query),
        api<Funnel>("/reports/admin/funnel" + query),
      ]);
      setTs(a);
      setFunnel(b);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  function preset(days: number) {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    setFrom(isoDay(start));
    setTo(isoDay(end));
  }

  async function downloadCsv(path: string, filename: string) {
    const token = getToken();
    const res = await fetch(API_BASE + path + query, {
      headers: token ? { Authorization: "Bearer " + token } : {},
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const active = METRICS.find((m) => m.key === metric) || METRICS[0];

  return (
    <div>
      <PageHeader
        title="Reports & analytics"
        subtitle="Trends over time, course completion and drop-off"
      />

      {/* Date range controls */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-sm">
            <span className="mb-1 block text-slate-500">From</span>
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-500">To</span>
            <input
              type="date"
              value={to}
              min={from}
              max={isoDay(today)}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => preset(7)}>
              7d
            </Button>
            <Button variant="outline" onClick={() => preset(30)}>
              30d
            </Button>
            <Button variant="outline" onClick={() => preset(90)}>
              90d
            </Button>
          </div>
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              onClick={() =>
                downloadCsv(
                  "/reports/admin/timeseries/export",
                  "timeseries.csv",
                )
              }
            >
              <Download className="mr-1.5 h-4 w-4" /> Trends CSV
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                downloadCsv("/reports/admin/funnel/export", "course-funnel.csv")
              }
            >
              <Download className="mr-1.5 h-4 w-4" /> Funnel CSV
            </Button>
          </div>
        </div>
      </Card>

      {loading || !ts || !funnel ? (
        <Spinner />
      ) : (
        <>
          {/* Metric totals */}
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
            {METRICS.map((m) => {
              const selected = m.key === metric;
              return (
                <button
                  key={m.key}
                  onClick={() => setMetric(m.key)}
                  className={
                    "rounded-xl border p-4 text-left transition " +
                    (selected
                      ? "border-brand bg-brand-light"
                      : "border-slate-200 bg-white hover:border-slate-300")
                  }
                >
                  <p className="text-xs text-slate-500">{m.label}</p>
                  <p className="mt-1 text-xl font-bold text-slate-950">
                    {fmt(ts.totals[m.key], m.money)}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Time-series chart */}
          <Card className="mb-6">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-bold text-slate-950">
                {active.label} over time
              </h3>
              <span className="text-xs text-slate-400">
                {ts.from} – {ts.to}
              </span>
            </div>
            <LineChart data={ts.series[metric]} color={active.color} />
          </Card>

          {/* Completion / drop-off funnel */}
          <Card className="mb-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-950">
                  Course completion & drop-off
                </h3>
                <p className="text-sm text-slate-500">
                  {funnel.totals.enrolled} enrollments ·{" "}
                  {funnel.totals.completionRate}% completed ·{" "}
                  {funnel.totals.dropOffRate}% dropped off
                </p>
              </div>
            </div>
            <FunnelBar totals={funnel.totals} />
          </Card>

          {/* Per-course table */}
          <Card>
            <h3 className="mb-3 font-bold text-slate-950">By course</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
                    <th className="py-2 pr-4">Course</th>
                    <th className="py-2 pr-4">Enrolled</th>
                    <th className="py-2 pr-4">Completed</th>
                    <th className="py-2 pr-4">Avg %</th>
                    <th className="py-2 pr-4">Completion</th>
                    <th className="py-2">Drop-off</th>
                  </tr>
                </thead>
                <tbody>
                  {funnel.courses.map((c) => (
                    <tr key={c.courseId} className="border-b border-slate-50">
                      <td className="py-2 pr-4 font-medium text-slate-800">
                        {c.title}
                      </td>
                      <td className="py-2 pr-4">{c.enrolled}</td>
                      <td className="py-2 pr-4">{c.completed}</td>
                      <td className="py-2 pr-4">{c.avgPercent}%</td>
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full"
                              style={makeWidthStyle(
                                c.completionRate,
                                "#16a34a",
                              )}
                            />
                          </div>
                          <span className="text-xs text-slate-500">
                            {c.completionRate}%
                          </span>
                        </div>
                      </td>
                      <td className="py-2 text-slate-500">{c.dropOffRate}%</td>
                    </tr>
                  ))}
                  {funnel.courses.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-6 text-center text-sm text-slate-400"
                      >
                        No course enrollments in this range.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
