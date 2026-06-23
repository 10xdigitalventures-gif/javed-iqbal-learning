"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, Spinner } from "@/components/ui";
import { PageHeader } from "@/components/shell";

type Stats = {
  activePackages: Array<{
    consultant?: { name: string };
    package?: string;
    expiresAt?: string;
    text: any;
    audio: any;
    video: any;
    sessions: any;
  }>;
};

function bar(r: any) {
  if (!r) return null;
  if (r.unlimited)
    return <span className="text-xs text-green-700">Unlimited</span>;
  const pct = r.limit ? Math.round((r.used / r.limit) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-slate-500">
        <span>
          {r.used}/{r.limit}
        </span>
        <span>{r.remaining} left</span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100">
        <div
          className="h-2 rounded-full bg-brand"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}

export default function ClientDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api<Stats>("/reports/client/me")
      .then(setStats)
      .catch(() => {});
  }, []);

  if (!stats) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="My dashboard"
        subtitle="Your active packages and remaining allowances"
      />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {stats.activePackages.map((p, i) => (
          <Card key={i}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="font-medium">{p.package}</p>
                <p className="text-xs text-slate-500">
                  with {p.consultant?.name || "Any consultant"}
                </p>
              </div>
              {p.expiresAt ? (
                <span className="text-xs text-slate-400">
                  Expires {new Date(p.expiresAt).toLocaleDateString()}
                </span>
              ) : null}
            </div>
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-xs font-medium">Text messages</p>
                {bar(p.text)}
              </div>
              <div>
                <p className="mb-1 text-xs font-medium">Audio messages</p>
                {bar(p.audio)}
              </div>
              <div>
                <p className="mb-1 text-xs font-medium">Video messages</p>
                {bar(p.video)}
              </div>
              <div>
                <p className="mb-1 text-xs font-medium">Live sessions</p>
                {bar(p.sessions)}
              </div>
            </div>
          </Card>
        ))}
        {stats.activePackages.length === 0 ? (
          <p className="text-sm text-slate-400">
            No active packages. Visit Packages to purchase one.
          </p>
        ) : null}
      </div>
    </div>
  );
}
