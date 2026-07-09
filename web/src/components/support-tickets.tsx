"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  ErrorText,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import { PageHeader } from "@/components/shell";

const CATEGORIES = [
  { key: "TECHNICAL", label: "Technical" },
  { key: "BILLING", label: "Billing / Financial" },
  { key: "BOOKS", label: "Books" },
  { key: "COURSES", label: "Courses" },
  { key: "OTHER", label: "Other" },
];

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

function catLabel(key: string) {
  const c = CATEGORIES.find((x) => x.key === key);
  return c ? c.label : key;
}

export function SupportTickets() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [active, setActive] = useState<any>(null);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("TECHNICAL");
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    api<any[]>("/support")
      .then((d) => setTickets(d || []))
      .catch(() => setTickets([]));
  }
  useEffect(() => {
    load();
  }, []);

  function open(id: string) {
    api<any>("/support/" + id)
      .then(setActive)
      .catch(() => setActive(null));
  }

  async function create() {
    setError(null);
    if (subject.trim().length < 3) {
      setError("Please enter a subject (at least 3 characters).");
      return;
    }
    if (!message.trim()) {
      setError("Please describe your issue.");
      return;
    }
    try {
      setBusy(true);
      const t = await api<any>("/support", {
        method: "POST",
        body: { subject: subject.trim(), category, message: message.trim() },
      });
      setSubject("");
      setMessage("");
      setCategory("TECHNICAL");
      setShowForm(false);
      load();
      open(t.id);
    } catch (e: any) {
      setError(e?.message || "Could not create the ticket.");
    } finally {
      setBusy(false);
    }
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
      setError(e?.message || "Could not send your reply.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Support"
        subtitle="Open a ticket for any issue and our team will reply here."
        action={
          <Button onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Close" : "New ticket"}
          </Button>
        }
      />

      {error ? <ErrorText message={error} /> : null}

      {showForm ? (
        <Card className="mb-6 space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Subject
            </label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief title of your issue"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Category
            </label>
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Message
            </label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder="Describe your issue in detail"
            />
          </div>
          <Button onClick={create} disabled={busy}>
            {busy ? "Submitting" : "Submit ticket"}
          </Button>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="space-y-2">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">
            Your tickets
          </h2>
          {tickets.length === 0 ? (
            <p className="text-sm text-slate-500">No tickets yet.</p>
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
                    {catLabel(t.category)}
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
              Select a ticket to view the conversation.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-900">
                  {active.subject}
                </h2>
                <Badge>{STATUS_LABEL[active.status] || active.status}</Badge>
              </div>
              <div className="space-y-2">
                {(active.messages || []).map((m: any) => (
                  <div
                    key={m.id}
                    className={
                      "rounded-xl border px-3 py-2 text-sm " +
                      (m.isStaff
                        ? "border-slate-200 bg-slate-50"
                        : "border-brand/30 bg-brand/5")
                    }
                  >
                    <p className="mb-1 text-xs font-semibold text-slate-500">
                      {m.isStaff ? "Support team" : m.sender?.name || "You"}
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
                  placeholder="Write a reply"
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
