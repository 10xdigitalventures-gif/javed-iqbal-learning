"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge, Button, Card, Spinner } from "@/components/ui";
import { PageHeader } from "@/components/shell";
import type { Meeting } from "@/lib/types";

const statusColor: Record<string, any> = {
  REQUESTED: "amber",
  APPROVED: "green",
  REJECTED: "red",
  COMPLETED: "blue",
  CANCELLED: "slate",
};

// Shared meetings list. Consultants can approve/reject/complete; clients cancel.
export function MeetingsView({ role }: { role: "CONSULTANT" | "CLIENT" }) {
  const [list, setList] = useState<Meeting[] | null>(null);

  async function load() {
    setList(await api<Meeting[]>("/meetings"));
  }

  useEffect(() => {
    load();
  }, []);

  async function act(id: string, action: string) {
    await api(`/meetings/${id}/${action}`, { method: "POST" });
    load();
  }

  if (!list) return <Spinner />;

  return (
    <div>
      <PageHeader title="Meetings" subtitle="Scheduled sessions and requests" />
      <div className="space-y-2">
        {list.map((m) => {
          const peer =
            role === "CONSULTANT" ? m.client?.name : m.consultant?.name;
          return (
            <Card key={m.id}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{m.title}</p>
                  <p className="text-sm text-slate-500">
                    {peer} · {new Date(m.scheduledAt).toLocaleString()} ·{" "}
                    {m.durationMin} min
                  </p>
                  {m.meetingUrl ? (
                    <a
                      href={m.meetingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-brand"
                    >
                      Join link
                    </a>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Badge color={statusColor[m.status]}>{m.status}</Badge>
                  {role === "CONSULTANT" && m.status === "REQUESTED" ? (
                    <>
                      <Button onClick={() => act(m.id, "approve")}>
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => act(m.id, "reject")}
                      >
                        Reject
                      </Button>
                    </>
                  ) : null}
                  {role === "CONSULTANT" && m.status === "APPROVED" ? (
                    <Button onClick={() => act(m.id, "complete")}>
                      Mark complete
                    </Button>
                  ) : null}
                  {role === "CLIENT" &&
                  (m.status === "REQUESTED" || m.status === "APPROVED") ? (
                    <Button
                      variant="outline"
                      onClick={() => act(m.id, "cancel")}
                    >
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </div>
            </Card>
          );
        })}
        {list.length === 0 ? (
          <p className="text-sm text-slate-400">No meetings yet.</p>
        ) : null}
      </div>
    </div>
  );
}
