"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, Spinner } from "@/components/ui";
import { ChatPanel } from "@/components/chat";
import { PageHeader } from "@/components/shell";
import type { Conversation } from "@/lib/types";

// Shared messages screen for consultant and client (peer differs by role).
export function MessagesView({ role }: { role: "CONSULTANT" | "CLIENT" }) {
  const { user } = useAuth();
  const [convos, setConvos] = useState<Conversation[] | null>(null);
  const [active, setActive] = useState<string | null>(null);

  async function load() {
    const list = await api<Conversation[]>("/conversations");
    setConvos(list);
    if (!active && list.length) setActive(list[0].id);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!convos) return <Spinner />;

  function peerName(c: Conversation) {
    return role === "CONSULTANT" ? c.client?.name : c.consultant?.name;
  }

  const activeConvo = convos.find((c) => c.id === active);

  return (
    <div>
      <PageHeader
        title="Messages"
        subtitle="Text, audio and video conversations"
      />
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          {convos.map((c) => (
            <button
              key={c.id}
              onClick={() => setActive(c.id)}
              className={clsx(
                "w-full rounded-lg border px-3 py-2 text-left text-sm",
                active === c.id
                  ? "border-brand bg-brand-light"
                  : "border-slate-200 bg-white hover:bg-slate-50",
              )}
            >
              {peerName(c) || "Conversation"}
            </button>
          ))}
          {convos.length === 0 ? (
            <Card>
              <p className="text-sm text-slate-400">No conversations yet.</p>
            </Card>
          ) : null}
        </div>
        <div className="col-span-2">
          {activeConvo && user ? (
            <ChatPanel
              conversationId={activeConvo.id}
              meId={user.id}
              peerName={peerName(activeConvo)}
              consultantId={activeConvo.consultantId}
              role={role}
            />
          ) : (
            <Card>
              <p className="text-sm text-slate-400">
                Select a conversation to start chatting.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
