"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import {
  Check,
  CheckCheck,
  FileText,
  MessageSquare,
  Mic,
  Paperclip,
  Pencil,
  Reply,
  Send,
  Smile,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";
import { api, eventsUrl, uploadFile } from "@/lib/api";
import { Button, Card, ErrorText, Spinner } from "@/components/ui";
import type { Allowance, Message, Role } from "@/lib/types";

type Channel = "TEXT" | "AUDIO" | "VIDEO";

// Quick-reaction palette shown in the emoji picker.
const REACTION_EMOJIS = [
  "\uD83D\uDC4D",
  "\u2764\uFE0F",
  "\uD83D\uDE02",
  "\uD83D\uDE2E",
  "\uD83D\uDE22",
  "\uD83D\uDE4F",
];

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
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(
    null,
  );
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [peerTyping, setPeerTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingSentAt = useRef(0);
  const typingClear = useRef<number | null>(null);

  // Only clients are gated by allowance; consultants/admins can always reply.
  const isClient = role === "CLIENT";

  const load = useCallback(async () => {
    const convo = await api<{ messages: Message[] }>(
      `/conversations/${conversationId}`,
    );
    setMessages(convo.messages || []);
    await api(`/conversations/${conversationId}/read`, { method: "POST" });
  }, [conversationId]);

  const loadAllowance = useCallback(async () => {
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
  }, [isClient, consultantId]);

  useEffect(() => {
    load();
    loadAllowance();

    // Real-time updates via Server-Sent Events. We refresh the thread when a
    // message event for THIS conversation arrives, and show a transient typing
    // indicator. A slow (30s) interval remains as a safety net.
    const url = eventsUrl();
    let es: EventSource | null = null;
    const refreshIfMine = (ev: MessageEvent) => {
      try {
        const payload = JSON.parse(ev.data);
        if (payload.conversationId === conversationId) load();
      } catch {
        load();
      }
    };
    if (url && typeof window !== "undefined" && "EventSource" in window) {
      es = new EventSource(url);
      es.addEventListener("message", refreshIfMine);
      es.addEventListener("message:update", refreshIfMine);
      es.addEventListener("message:reaction", refreshIfMine);
      es.addEventListener("typing", (ev: MessageEvent) => {
        try {
          const p = JSON.parse(ev.data);
          if (p.conversationId !== conversationId || p.userId === meId) return;
          setPeerTyping(p.typing !== false);
          if (typingClear.current) window.clearTimeout(typingClear.current);
          typingClear.current = window.setTimeout(
            () => setPeerTyping(false),
            4000,
          );
        } catch {
          // ignore malformed typing payloads
        }
      });
    }

    const t = window.setInterval(load, es ? 30000 : 5000);
    return () => {
      window.clearInterval(t);
      if (typingClear.current) window.clearTimeout(typingClear.current);
      es?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, consultantId, meId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages?.length, peerTyping]);

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

  // Throttled typing ping to the peer (max once every 1.5s).
  function onType(v: string) {
    setBody(v);
    const now = Date.now();
    if (now - typingSentAt.current > 1500) {
      typingSentAt.current = now;
      api(`/conversations/${conversationId}/typing`, {
        method: "POST",
        body: { typing: true },
      }).catch(() => {});
    }
  }

  async function sendText() {
    if (!body.trim()) return;
    if (!channelAllowed("TEXT")) return;
    setError(null);
    setSending(true);
    const text = body;
    const replyId = replyTo?.id;
    setBody("");
    setReplyTo(null);
    try {
      await api(`/conversations/${conversationId}/messages`, {
        method: "POST",
        body: { type: "TEXT", body: text, replyToId: replyId },
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

  // Attach an image or arbitrary file (gated by the text allowance).
  async function sendAttachment(file: File) {
    if (!channelAllowed("TEXT")) return;
    setError(null);
    setSending(true);
    const replyId = replyTo?.id;
    setReplyTo(null);
    try {
      const uploaded = await uploadFile(file);
      const isImage = file.type.startsWith("image/");
      await api(`/conversations/${conversationId}/messages`, {
        method: "POST",
        body: {
          type: isImage ? "IMAGE" : "FILE",
          mediaKey: uploaded.key,
          fileName: file.name,
          replyToId: replyId,
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

  async function saveEdit() {
    if (!editing || !editing.text.trim()) return;
    const { id, text } = editing;
    setEditing(null);
    try {
      await api(`/conversations/${conversationId}/messages/${id}`, {
        method: "PATCH",
        body: { body: text },
      });
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Edit failed");
    }
  }

  async function deleteMessage(id: string) {
    try {
      await api(`/conversations/${conversationId}/messages/${id}`, {
        method: "DELETE",
      });
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function toggleReaction(id: string, emoji: string) {
    setPickerFor(null);
    try {
      await api(`/conversations/${conversationId}/messages/${id}/react`, {
        method: "POST",
        body: { emoji },
      });
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Reaction failed");
    }
  }

  if (!messages) return <Spinner />;

  const tabs: { key: Channel; label: string; Icon: typeof MessageSquare }[] = [
    { key: "TEXT", label: "Text", Icon: MessageSquare },
    { key: "AUDIO", label: "Audio", Icon: Mic },
    { key: "VIDEO", label: "Video", Icon: Video },
  ];

  const activeAllowed = channelAllowed(tab);

  function previewText(m: { type: string; body?: string | null }): string {
    if (m.type === "TEXT") return m.body || "";
    if (m.type === "IMAGE") return "\uD83D\uDDBC\uFE0F Photo";
    if (m.type === "FILE") return "\uD83D\uDCCE File";
    if (m.type === "AUDIO") return "\uD83C\uDFA4 Audio message";
    if (m.type === "VIDEO") return "\uD83C\uDFA5 Video message";
    return "";
  }

  return (
    <Card className="flex h-[70vh] flex-col p-0">
      <div className="border-b border-slate-200 px-4 py-3">
        <p className="font-semibold">{peerName || "Conversation"}</p>
        <p className="text-xs text-slate-500">
          {peerTyping ? (
            <span className="text-brand">typing\u2026</span>
          ) : (
            "Live updates enabled."
          )}
        </p>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
            <MessageSquare className="mb-2 h-8 w-8" aria-hidden="true" />
            <p className="text-sm">No messages yet. Say hello \uD83D\uDC4B</p>
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === meId;
            const deleted = !!m.deletedAt;
            // Group reactions by emoji with counts + whether I reacted.
            const reactionGroups = Object.values(
              (m.reactions || []).reduce(
                (acc, r) => {
                  const g = acc[r.emoji] || {
                    emoji: r.emoji,
                    count: 0,
                    mine: false,
                  };
                  g.count += 1;
                  if (r.userId === meId) g.mine = true;
                  acc[r.emoji] = g;
                  return acc;
                },
                {} as Record<
                  string,
                  { emoji: string; count: number; mine: boolean }
                >,
              ),
            );
            return (
              <div
                key={m.id}
                className={clsx(
                  "group flex flex-col",
                  mine ? "items-end" : "items-start",
                )}
              >
                <div
                  className={clsx(
                    "flex items-center gap-1",
                    mine ? "flex-row-reverse" : "flex-row",
                  )}
                >
                  <div
                    className={clsx(
                      "max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                      mine
                        ? "bg-brand text-white"
                        : "border border-slate-200 bg-white text-slate-800",
                    )}
                  >
                    {/* Quoted reply */}
                    {m.replyTo ? (
                      <div
                        className={clsx(
                          "mb-1 rounded-lg border-l-2 px-2 py-1 text-xs",
                          mine
                            ? "border-white/60 bg-white/15"
                            : "border-brand/50 bg-slate-50 text-slate-600",
                        )}
                      >
                        <span className="block font-medium">
                          {m.replyTo.sender?.name || "Reply"}
                        </span>
                        <span className="line-clamp-2">
                          {previewText(m.replyTo)}
                        </span>
                      </div>
                    ) : null}

                    {deleted ? (
                      <p className="italic opacity-70">
                        This message was deleted
                      </p>
                    ) : editing && editing.id === m.id ? (
                      <div className="flex flex-col gap-2">
                        <textarea
                          value={editing.text}
                          onChange={(e) =>
                            setEditing({ id: m.id, text: e.target.value })
                          }
                          className="min-h-16 w-64 rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-800 outline-none"
                        />
                        <div className="flex gap-2">
                          <Button
                            onClick={saveEdit}
                            className="px-2 py-1 text-xs"
                          >
                            Save
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setEditing(null)}
                            className="px-2 py-1 text-xs"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : m.type === "AUDIO" && m.mediaUrl ? (
                      <audio controls src={m.mediaUrl} className="max-w-full" />
                    ) : m.type === "VIDEO" && m.mediaUrl ? (
                      <video
                        controls
                        src={m.mediaUrl}
                        className="max-h-64 max-w-full rounded-lg"
                      />
                    ) : m.type === "IMAGE" && m.mediaUrl ? (
                      <a href={m.mediaUrl} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={m.mediaUrl}
                          alt={m.fileName || "image"}
                          className="max-h-64 max-w-full rounded-lg"
                        />
                      </a>
                    ) : m.type === "FILE" && m.mediaUrl ? (
                      <a
                        href={m.mediaUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={clsx(
                          "flex items-center gap-2 underline",
                          mine ? "text-white" : "text-brand",
                        )}
                      >
                        <FileText className="h-4 w-4" aria-hidden="true" />
                        {m.fileName || "Download file"}
                      </a>
                    ) : (
                      <p className="whitespace-pre-wrap break-words">
                        {m.body}
                      </p>
                    )}

                    <p
                      className={clsx(
                        "mt-1 flex items-center gap-1 text-[10px]",
                        mine ? "text-blue-100" : "text-slate-400",
                      )}
                    >
                      {m.editedAt && !deleted ? (
                        <span>edited \u00B7 </span>
                      ) : null}
                      {new Date(m.createdAt).toLocaleTimeString()}
                      {mine && !deleted ? (
                        m.status === "READ" ? (
                          <CheckCheck className="h-3 w-3 text-sky-200" />
                        ) : m.status === "DELIVERED" ? (
                          <CheckCheck className="h-3 w-3" />
                        ) : (
                          <Check className="h-3 w-3" />
                        )
                      ) : null}
                    </p>
                  </div>

                  {/* Hover actions */}
                  {!deleted ? (
                    <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                      <button
                        type="button"
                        title="Reply"
                        aria-label="Reply"
                        onClick={() => setReplyTo(m)}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      >
                        <Reply className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="React"
                        aria-label="React"
                        onClick={() =>
                          setPickerFor(pickerFor === m.id ? null : m.id)
                        }
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      >
                        <Smile className="h-3.5 w-3.5" />
                      </button>
                      {mine && m.type === "TEXT" ? (
                        <button
                          type="button"
                          title="Edit"
                          aria-label="Edit"
                          onClick={() =>
                            setEditing({ id: m.id, text: m.body || "" })
                          }
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                      {mine ? (
                        <button
                          type="button"
                          title="Delete"
                          aria-label="Delete"
                          onClick={() => deleteMessage(m.id)}
                          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {/* Emoji picker */}
                {pickerFor === m.id ? (
                  <div className="mt-1 flex gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 shadow-sm">
                    {REACTION_EMOJIS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => toggleReaction(m.id, e)}
                        className="text-base transition hover:scale-125"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                ) : null}

                {/* Reaction chips */}
                {reactionGroups.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {reactionGroups.map((g) => (
                      <button
                        key={g.emoji}
                        type="button"
                        onClick={() => toggleReaction(m.id, g.emoji)}
                        className={clsx(
                          "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
                          g.mine
                            ? "border-brand bg-brand/10 text-brand"
                            : "border-slate-200 bg-white text-slate-600",
                        )}
                      >
                        <span>{g.emoji}</span>
                        <span>{g.count}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-slate-200 p-3">
        <ErrorText message={error} />

        {/* Reply preview */}
        {replyTo ? (
          <div className="mb-2 flex items-center justify-between rounded-lg border-l-2 border-brand bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
            <span className="line-clamp-1">
              Replying to: {previewText(replyTo)}
            </span>
            <button
              type="button"
              aria-label="Cancel reply"
              onClick={() => setReplyTo(null)}
              className="ml-2 rounded p-0.5 hover:bg-slate-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}

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
                onClick={() => setTab(key)}
                className={clsx(
                  "flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition",
                  tab === key
                    ? "bg-white text-brand shadow-sm"
                    : "text-slate-500 hover:text-slate-700",
                  !allowed && "cursor-not-allowed opacity-40",
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {label}
                {remaining ? (
                  <span className="text-[10px] text-slate-400">
                    ({remaining})
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {!activeAllowed ? (
          <p className="text-xs text-slate-500">
            You don\u2019t have an active plan for this channel.
          </p>
        ) : tab === "TEXT" ? (
          <div className="flex items-end gap-2">
            <label
              className="flex cursor-pointer items-center justify-center rounded-xl border border-slate-300 p-2 text-slate-500 transition hover:bg-slate-50"
              title="Attach photo or file"
            >
              <Paperclip className="h-4 w-4" aria-hidden="true" />
              <input
                type="file"
                className="sr-only"
                disabled={sending}
                onChange={(e) =>
                  e.target.files?.[0] && sendAttachment(e.target.files[0])
                }
              />
            </label>
            <textarea
              value={body}
              onChange={(e) => onType(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendText();
                }
              }}
              placeholder="Type a message\u2026"
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
              ? "Uploading\u2026"
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
