"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  ErrorText,
  Select,
  Textarea,
} from "@/components/ui";
import { PageHeader } from "@/components/shell";

const STATUS = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
const STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};
const CAT_LABEL: Record<string, string> = {
  TECHNICAL: "Technical",
  BILLING: "Billing / Financial",
  BOOKS: "Books",
  COURSES: "Courses",
  OTHER: "Other",
};

export default function AdminSupport() {
  const [filter, setFilter] = useState<string>("");
  const [tickets, setTickets] = useState<any[]>([]);
  const [active, setActive] = useState<any>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agents, setAgents] = useState<any[]>([]);

  function load() {
    const q = filter ? "?status=" + filter : "";
    api<any[]>("/support/admin/all" + q)
      .then((d) => setTickets(d || []))
      .catch(() => setTickets([]));
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    api<any[]>("/support/admin/agents")
      .then((d) => setAgents(d || []))
      .catch(() => setAgents([]));
  }, []);

  async function assignTo(assigneeId: string) {
    if (!active) return;
    try {
      setBusy(true);
      await api("/support/" + active.id + "/assign", {
        method: "POST",
        body: { assigneeId },
      });
      open(active.id);
      load();
    } catch (e: any) {
      setError(e?.message || "Could not assign the ticket.");
    } finally {
      setBusy(false);
    }
  }

  async function removeTicket() {
    if (!active) return;
    if (!window.confirm("Delete this ticket permanently?")) return;
    try {
      setBusy(true);
      await api("/support/" + active.id, { method: "DELETE" });
      setActive(null);
      load();
    } catch (e: any) {
      setError(
        e?.message ||
          "Could not delete the ticket. You may not have permission.",
      );
    } finally {
      setBusy(false);
    }
  }

  function open(id: string) {
    api<any>("/support/" + id)
      .then(setActive)
      .catch(() => setActive(null));
  }

  async function sendReply() {
    if (!reply.trim() || !active) return;
    try {
      setBusy(true);
      const t = await api<any>("/support/" + active.id + "/reply", {
        method: "POST",
        body: { body: reply.trim() },
      });
      setReply("");
      setActive(t);
      load();
    } catch (e: any) {
      setError(e?.message || "Could not send the reply.");
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(status: string) {
    if (!active) return;
    try {
      setBusy(true);
      await api("/support/" + active.id + "/status", {
        method: "PATCH",
        body: { status },
      });
      open(active.id);
      load();
    } catch (e: any) {
      setError(e?.message || "Could not update the status.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Support tickets"
        subtitle="Answer and manage help tickets from clients and consultants."
        action={
          <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All statuses</option>
            {STATUS.map((sVal) => (
              <option key={sVal} value={sVal}>
                {STATUS_LABEL[sVal]}
              </option>
            ))}
          </Select>
        }
      />

      {error ? <ErrorText message={error} /> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="space-y-2">
          {tickets.length === 0 ? (
            <p className="text-sm text-slate-500">No tickets found.</p>
          ) : (
            tickets.map((t) => (
              <button
                key={t.id}
                onClick={() => open(t.id)}
                className={
                  "flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition " +
                  (active && active.id === t.id
                    ? "border-brand bg-brand/5"
                    : "border-slate-200 hover:bg-slate-50")
                }
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-900">
                    {t.subject}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {t.user?.name || "User"} ·{" "}
                    {CAT_LABEL[t.category] || t.category}
                  </span>
                </span>
                <Badge>{STATUS_LABEL[t.status] || t.status}</Badge>
              </button>
            ))
          )}
        </Card>

        <Card>
          {!active ? (
            <p className="text-sm text-slate-500">
              Select a ticket to read and reply.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    {active.subject}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {active.user?.name} · {active.user?.email}
                  </p>
                </div>
                <Badge>{STATUS_LABEL[active.status] || active.status}</Badge>
              </div>

              <div className="flex flex-wrap gap-2">
                {STATUS.map((sVal) => (
                  <button
                    key={sVal}
                    onClick={() => changeStatus(sVal)}
                    disabled={busy || active.status === sVal}
                    className={
                      "rounded-lg border px-2.5 py-1 text-xs font-medium transition " +
                      (active.status === sVal
                        ? "border-brand bg-brand text-white"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50")
                    }
                  >
                    {STATUS_LABEL[sVal]}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                <span className="text-xs font-medium text-slate-500">
                  Assigned to
                </span>
                <Select
                  value={active.assignedToId || ""}
                  onChange={(e) => assignTo(e.target.value)}
                  disabled={busy}
                >
                  <option value="">Unassigned</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.role === "ADMIN" ? "Admin" : "Support"})
                    </option>
                  ))}
                </Select>
                <div className="ml-auto">
                  <Button
                    variant="outline"
                    onClick={removeTicket}
                    disabled={busy}
                  >
                    Delete
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {(active.messages || []).map((m: any) => (
                  <div
                    key={m.id}
                    className={
                      "rounded-xl border px-3 py-2 text-sm " +
                      (m.isStaff
                        ? "border-brand/30 bg-brand/5"
                        : "border-slate-200 bg-slate-50")
                    }
                  >
                    <p className="mb-1 text-xs font-semibold text-slate-500">
                      {m.isStaff ? "Support team" : m.sender?.name || "User"}
                    </p>
                    <p className="whitespace-pre-wrap text-slate-800">
                      {m.body}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {new Date(m.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex items-end gap-2">
                <Textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={2}
                  placeholder="Write a reply to the user"
                />
                <Button onClick={sendReply} disabled={busy || !reply.trim()}>
                  Send
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
