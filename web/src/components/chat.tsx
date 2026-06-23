"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Lock, MessageSquare, Mic, Send, Upload, Video } from "lucide-react";
import { api, eventsUrl, uploadFile } from "@/lib/api";
import { Button, Card, ErrorText, Spinner } from "@/components/ui";
import type { Allowance, Message, Role } from "@/lib/types";

type Channel = "TEXT" | "AUDIO" | "VIDEO";

export function ChatPanel({
  conversationId,
  meId,
  peerName,
  consultantId,
  role,
}: {
  conversationId: string;
  meId: string;
  peerName?: string;
  // The consultant on the other side of this conversation. Used to look up the
  // client's per-channel allowance.
  consultantId?: string;
  role?: Role;
}) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [tab, setTab] = useState<Channel>("TEXT");
  const [allowance, setAllowance] = useState<Allowance | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Only clients are gated by allowance; consultants/admins can always reply.
  const isClient = role === "CLIENT";

  async function load() {
    const convo = await api<{ messages: Message[] }>(
      `/conversations/${conversationId}`,
    );
    setMessages(convo.messages || []);
    await api(`/conversations/${conversationId}/read`, { method: "POST" });
  }

  async function loadAllowance() {
    if (!isClient || !consultantId) return;
    try {
      const a = await api<Allowance>(
        `/purchases/allowance?consultantId=${consultantId}`,
      );
      setAllowance(a);
    } catch {
      // Non-fatal: leave allowance null (treated as no remaining allowance).
      setAllowance(null);
    }
  }

  useEffect(() => {
    load();
    loadAllowance();

    // Real-time updates via Server-Sent Events. We refresh when a message for
    // this conversation arrives. A slow (30s) interval remains as a safety net
    // in case the SSE connection drops.
    const url = eventsUrl();
    let es: EventSource | null = null;
    if (url && typeof window !== "undefined" && "EventSource" in window) {
      es = new EventSource(url);
      es.addEventListener("message", (ev: MessageEvent) => {
        try {
          const payload = JSON.parse(ev.data);
          if (payload.conversationId === conversationId) load();
        } catch {
          load();
        }
      });
    }

    const t = window.setInterval(load, es ? 30000 : 5000);
    return () => {
      window.clearInterval(t);
      es?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, consultantId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages?.length]);

  // Whether the current user can send on a given channel.
  function channelAllowed(channel: Channel): boolean {
    if (!isClient) return true; // consultants always allowed
    if (!allowance) return false;
    return allowance[channel.toLowerCase() as "text" | "audio" | "video"]
      .allowed;
  }

  function remainingLabel(channel: Channel): string | null {
    if (!isClient || !allowance) return null;
    const a = allowance[channel.toLowerCase() as "text" | "audio" | "video"];
    if (!a.allowed) return null;
    if (a.unlimited) return "Unlimited";
    return `${a.remaining} left`;
  }

  async function sendText() {
    if (!body.trim()) return;
    if (!channelAllowed("TEXT")) return;
    setError(null);
    setSending(true);
    const text = body;
    setBody("");
    try {
      await api(`/conversations/${conversationId}/messages`, {
        method: "POST",
        body: { type: "TEXT", body: text },
      });
      await load();
      await loadAllowance();
    } catch (err: unknown) {
      setBody(text);
      setError(err instanceof Error ? err.message : "Message failed");
    } finally {
      setSending(false);
    }
  }

  async function sendMedia(file: File, type: "AUDIO" | "VIDEO") {
    if (!channelAllowed(type)) return;
    setError(null);
    setSending(true);
    try {
      const uploaded = await uploadFile(file);
      await api(`/conversations/${conversationId}/messages`, {
        method: "POST",
        body: {
          type,
          // Send the stable object key; the server signs a fresh URL on read.
          mediaKey: uploaded.key,
          durationSec: uploaded.durationSec ?? undefined,
          body: file.name,
        },
      });
      await load();
      await loadAllowance();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSending(false);
    }
  }

  if (!messages) return <Spinner />;

  const tabs: { key: Channel; label: string; Icon: typeof MessageSquare }[] = [
    { key: "TEXT", label: "Text", Icon: MessageSquare },
    { key: "AUDIO", label: "Audio", Icon: Mic },
    { key: "VIDEO", label: "Video", Icon: Video },
  ];

  const activeAllowed = channelAllowed(tab);

  return (
    <Card className="flex h-[70vh] flex-col p-0">
      <div className="border-b border-slate-200 px-4 py-3">
        <p className="font-semibold">{peerName || "Conversation"}</p>
        <p className="text-xs text-slate-500">Live updates enabled.</p>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
            <MessageSquare className="mb-2 h-8 w-8" aria-hidden="true" />
            <p className="text-sm">No messages yet. Say hello 👋</p>
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === meId;
            return (
              <div
                key={m.id}
                className={clsx("flex", mine ? "justify-end" : "justify-start")}
              >
                <div
                  className={clsx(
                    "max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                    mine
                      ? "bg-brand text-white"
                      : "border border-slate-200 bg-white text-slate-800",
                  )}
                >
                  {m.type === "AUDIO" && m.mediaUrl ? (
                    <audio controls src={m.mediaUrl} className="max-w-full" />
                  ) : m.type === "VIDEO" && m.mediaUrl ? (
                    <video
                      controls
                      src={m.mediaUrl}
                      className="max-h-64 max-w-full rounded-lg"
                    />
                  ) : (
                    <p>{m.body}</p>
                  )}
                  <p
                    className={clsx(
                      "mt-1 text-[10px]",
                      mine ? "text-blue-100" : "text-slate-400",
                    )}
                  >
                    {m.status} · {new Date(m.createdAt).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-slate-200 p-3">
        <ErrorText message={error} />

        {/* Channel tabs */}
        <div
          role="tablist"
          aria-label="Message type"
          className="mb-2 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1"
        >
          {tabs.map(({ key, label, Icon }) => {
            const allowed = channelAllowed(key);
            const remaining = remainingLabel(key);
            return (
              <button
                key={key}
                role="tab"
                type="button"
                aria-selected={tab === key}
                disabled={!allowed}
                title={
                  allowed
                    ? remaining || undefined
                    : "Buy a plan for this channel"
                }
                onClick={() => allowed && setTab(key)}
                className={clsx(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                  tab === key && allowed
                    ? "bg-white text-brand shadow-sm"
                    : "text-slate-500",
                  !allowed && "cursor-not-allowed opacity-50",
                )}
              >
                {allowed ? (
                  <Icon className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {label}
                {remaining ? (
                  <span className="ml-1 text-[10px] text-slate-400">
                    ({remaining})
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Composer for the active channel */}
        {!activeAllowed ? (
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-500">
            <Lock className="h-4 w-4" aria-hidden="true" />
            Buy a plan for this channel to send {tab.toLowerCase()} messages.
          </div>
        ) : tab === "TEXT" ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) sendText();
              }}
              placeholder="Type a message…"
              aria-label="Message text"
              className="min-h-10 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition duration-200 focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
            <Button onClick={sendText} disabled={sending || !body.trim()}>
              {sending ? (
                <Upload className="h-4 w-4 animate-pulse" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send
            </Button>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 py-4 text-sm font-medium transition duration-200 hover:bg-slate-50 focus-within:ring-2 focus-within:ring-brand/30">
            {tab === "AUDIO" ? (
              <Mic className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Video className="h-4 w-4" aria-hidden="true" />
            )}
            {sending
              ? "Uploading…"
              : `Upload ${tab === "AUDIO" ? "an audio" : "a video"} message`}
            <input
              type="file"
              accept={tab === "AUDIO" ? "audio/*" : "video/*"}
              className="sr-only"
              disabled={sending}
              onChange={(e) =>
                e.target.files?.[0] &&
                sendMedia(e.target.files[0], tab as "AUDIO" | "VIDEO")
              }
            />
          </label>
        )}
      </div>
    </Card>
  );
}
