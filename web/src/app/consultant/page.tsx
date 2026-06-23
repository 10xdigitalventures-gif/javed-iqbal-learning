"use client";

import { useEffect, useState } from "react";
import { Users, CalendarClock, MessageSquare } from "lucide-react";
import { api } from "@/lib/api";
import { Card, Spinner } from "@/components/ui";
import { PageHeader } from "@/components/shell";

type Stats = {
  clientCount: number;
  upcomingMeetings: number;
  messagesSent: number;
  activePackages: Array<{
    client?: { name: string };
    package?: string;
    text: any;
    audio: any;
    video: any;
    sessions: any;
  }>;
};

function remainingLabel(r: any) {
  if (!r) return "-";
  if (r.unlimited) return "Unlimited";
  return `${r.remaining} left`;
}

export default function ConsultantDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api<Stats>("/reports/consultant/me")
      .then(setStats)
      .catch(() => {});
  }, []);

  if (!stats) return <Spinner />;

  const cards = [
    { label: "Clients", value: stats.clientCount, icon: Users },
    {
      label: "Upcoming meetings",
      value: stats.upcomingMeetings,
      icon: CalendarClock,
    },
    { label: "Messages sent", value: stats.messagesSent, icon: MessageSquare },
  ];

  return (
    <div>
      <PageHeader
        title="Consultant dashboard"
        subtitle="Your clients and package utilization"
      />
      <div className="grid grid-cols-3 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label}>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-light text-brand-dark">
                  <Icon size={20} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{c.value}</p>
                  <p className="text-xs text-slate-500">{c.label}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      <h2 className="mb-3 mt-6 text-lg font-semibold">Client package usage</h2>
      <div className="space-y-2">
        {stats.activePackages.map((p, i) => (
          <Card key={i}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{p.client?.name}</p>
                <p className="text-xs text-slate-500">{p.package}</p>
              </div>
              <div className="flex gap-4 text-xs text-slate-600">
                <span>Text: {remainingLabel(p.text)}</span>
                <span>Audio: {remainingLabel(p.audio)}</span>
                <span>Video: {remainingLabel(p.video)}</span>
                <span>Sessions: {remainingLabel(p.sessions)}</span>
              </div>
            </div>
          </Card>
        ))}
        {stats.activePackages.length === 0 ? (
          <p className="text-sm text-slate-400">
            No active client packages yet.
          </p>
        ) : null}
      </div>
    </div>
  );
}
