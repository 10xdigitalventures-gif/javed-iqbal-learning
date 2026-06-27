"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge, Button, Card, Spinner } from "@/components/ui";
import { PageHeader } from "@/components/shell";
import { NotificationPreferences } from "@/components/notification-preferences";
import type { Notification } from "@/lib/types";

export function NotificationsView() {
  const [list, setList] = useState<Notification[] | null>(null);

  async function load() {
    setList(await api<Notification[]>("/notifications"));
  }

  useEffect(() => {
    load();
  }, []);

  async function readAll() {
    await api("/notifications/read-all", { method: "POST" });
    load();
  }

  if (!list) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Your alerts and reminders"
        action={
          <Button variant="outline" onClick={readAll}>
            Mark all read
          </Button>
        }
      />
      <div className="mb-6">
        <NotificationPreferences />
      </div>

      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
        Recent
      </h2>
      <div className="space-y-2">
        {list.map((n) => (
          <Card key={n.id}>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{n.title}</p>
                {n.body ? (
                  <p className="text-sm text-slate-500">{n.body}</p>
                ) : null}
                <p className="mt-1 text-xs text-slate-400">
                  {new Date(n.createdAt).toLocaleString()}
                </p>
              </div>
              {!n.read ? <Badge color="blue">New</Badge> : null}
            </div>
          </Card>
        ))}
        {list.length === 0 ? (
          <p className="text-sm text-slate-400">No notifications.</p>
        ) : null}
      </div>
    </div>
  );
}
