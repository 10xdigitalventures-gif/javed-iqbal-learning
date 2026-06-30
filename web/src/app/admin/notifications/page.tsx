"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Button,
  Card,
  ErrorText,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import { PageHeader } from "@/components/shell";

type Segment = "all" | "tag" | "purchase";

export default function AdminNotifications() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [segment, setSegment] = useState<Segment>("all");
  const [tag, setTag] = useState("");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");

  const [tags, setTags] = useState<string[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    api<string[]>("/users/tags")
      .then((t) => setTags(t || []))
      .catch(() => setTags([]));
  }, []);

  // Reset the recipient preview whenever the targeting changes.
  useEffect(() => {
    setCount(null);
  }, [segment, tag, since, until]);

  function payload() {
    return {
      title: title.trim(),
      body: body.trim() || undefined,
      segment,
      tag: segment === "tag" ? tag.trim() : undefined,
      since: segment === "purchase" && since ? since : undefined,
      until: segment === "purchase" && until ? until : undefined,
    };
  }

  async function preview() {
    setError(null);
    setOk(null);
    if (segment === "tag" && !tag.trim()) {
      setError("Please choose a tag to target.");
      return;
    }
    try {
      setBusy(true);
      const r = await api<{ count: number }>(
        "/notifications/broadcast/preview",
        {
          method: "POST",
          body: payload(),
        },
      );
      setCount(r.count);
    } catch (e: any) {
      setError(e?.message || "Could not estimate recipients.");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    setError(null);
    setOk(null);
    if (!title.trim()) {
      setError("Please enter a notification title.");
      return;
    }
    if (segment === "tag" && !tag.trim()) {
      setError("Please choose a tag to target.");
      return;
    }
    try {
      setBusy(true);
      const r = await api<{ recipients: number; sent: number }>(
        "/notifications/broadcast",
        { method: "POST", body: payload() },
      );
      setOk("Sent to " + r.sent + " of " + r.recipients + " recipients.");
      setTitle("");
      setBody("");
      setCount(null);
    } catch (e: any) {
      setError(e?.message || "Could not send the notification.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Push Notifications"
        subtitle="Send a push + in-app notification to your users"
      />

      <Card className="space-y-4">
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. New course is live!"
        />
        <Textarea
          label="Message"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write the notification message (optional)"
          rows={3}
        />

        <Select
          label="Send to"
          value={segment}
          onChange={(e) => setSegment(e.target.value as Segment)}
        >
          <option value="all">All users</option>
          <option value="tag">Users with a specific tag</option>
          <option value="purchase">Users who purchased</option>
        </Select>

        {segment === "tag" ? (
          tags.length > 0 ? (
            <Select
              label="Tag"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
            >
              <option value="">Choose a tag</option>
              {tags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          ) : (
            <div>
              <Input
                label="Tag"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="Type a tag (assign tags to clients first)"
              />
              <p className="mt-1 text-xs text-slate-400">
                No tags yet. Add tags to clients on the Clients page, then
                target them here.
              </p>
            </div>
          )
        ) : null}

        {segment === "purchase" ? (
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Purchased from"
              type="date"
              value={since}
              onChange={(e) => setSince(e.target.value)}
            />
            <Input
              label="Purchased until"
              type="date"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
            />
          </div>
        ) : null}

        {error ? <ErrorText message={error} /> : null}
        {ok ? <p className="text-sm font-medium text-green-600">{ok}</p> : null}
        {count !== null ? (
          <p className="text-sm text-slate-600">
            This will reach <span className="font-semibold">{count}</span>{" "}
            user(s).
          </p>
        ) : null}

        <div className="flex gap-2">
          <Button variant="outline" onClick={preview} disabled={busy}>
            Preview recipients
          </Button>
          <Button onClick={send} disabled={busy}>
            {busy ? "Working\u2026" : "Send notification"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
