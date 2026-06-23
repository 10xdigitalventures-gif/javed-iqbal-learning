"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Badge, Button, Card, ErrorText, Spinner } from "@/components/ui";
import { PageHeader } from "@/components/shell";
import type { Community } from "@/lib/types";

type Post = {
  id: string;
  body: string;
  mediaUrl?: string;
  createdAt: string;
  author?: { name: string };
  comments?: Array<{ id: string; body: string; author?: { name: string } }>;
};

// Shared communities browser + feed for consultant and client portals.
export function CommunitiesView() {
  const { user } = useAuth();
  const [all, setAll] = useState<Community[] | null>(null);
  const [mine, setMine] = useState<string[]>([]);
  const [active, setActive] = useState<Community | null>(null);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [body, setBody] = useState("");
  const [comment, setComment] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [list, joined] = await Promise.all([
      api<Community[]>("/communities"),
      api<Community[]>("/communities/mine"),
    ]);
    setAll(list);
    setMine(joined.map((c) => c.id));
  }

  useEffect(() => {
    load();
  }, []);

  async function open(c: Community) {
    setActive(c);
    setPosts(null);
    setError(null);
    try {
      setPosts(await api<Post[]>(`/communities/${c.id}/posts`));
    } catch (err: any) {
      setError(err.message);
      setPosts([]);
    }
  }

  async function join(c: Community) {
    await api(`/communities/${c.id}/join`, { method: "POST" });
    await load();
    open(c);
  }

  async function post() {
    if (!active || !body.trim()) return;
    await api(`/communities/${active.id}/posts`, {
      method: "POST",
      body: { body },
    });
    setBody("");
    open(active);
  }

  async function addComment(postId: string) {
    const text = comment[postId];
    if (!text?.trim()) return;
    await api(`/communities/posts/${postId}/comments`, {
      method: "POST",
      body: { body: text },
    });
    setComment({ ...comment, [postId]: "" });
    if (active) open(active);
  }

  if (!all) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Communities"
        subtitle="Join groups and join the conversation"
      />
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          {all.map((c) => (
            <Card key={c.id}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-slate-500">
                    {c._count?.members ?? 0} members
                  </p>
                </div>
                <Badge color={c.isPaid ? "amber" : "green"}>
                  {c.isPaid ? `${c.currency} ${c.price}` : "Free"}
                </Badge>
              </div>
              <div className="mt-2 flex gap-2">
                {mine.includes(c.id) ? (
                  <Button variant="outline" onClick={() => open(c)}>
                    Open
                  </Button>
                ) : (
                  <Button onClick={() => join(c)}>Join</Button>
                )}
              </div>
            </Card>
          ))}
        </div>
        <div className="col-span-2">
          {!active ? (
            <Card>
              <p className="text-sm text-slate-400">
                Select a community to view its feed.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              <Card>
                <h2 className="text-lg font-semibold">{active.name}</h2>
                <p className="text-sm text-slate-500">{active.description}</p>
                <ErrorText message={error} />
                <div className="mt-3 flex gap-2">
                  <input
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Share something..."
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand"
                  />
                  <Button onClick={post}>Post</Button>
                </div>
              </Card>
              {posts?.map((p) => (
                <Card key={p.id}>
                  <p className="text-sm font-medium">{p.author?.name}</p>
                  <p className="mt-1 text-sm">{p.body}</p>
                  <div className="mt-3 space-y-1 border-t border-slate-100 pt-2">
                    {p.comments?.map((c) => (
                      <p key={c.id} className="text-xs text-slate-600">
                        <span className="font-medium">{c.author?.name}: </span>
                        {c.body}
                      </p>
                    ))}
                    <div className="mt-2 flex gap-2">
                      <input
                        value={comment[p.id] || ""}
                        onChange={(e) =>
                          setComment({ ...comment, [p.id]: e.target.value })
                        }
                        placeholder="Add a comment..."
                        className="flex-1 rounded-lg border border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand"
                      />
                      <Button
                        variant="outline"
                        onClick={() => addComment(p.id)}
                      >
                        Reply
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
              {posts && posts.length === 0 && !error ? (
                <p className="text-sm text-slate-400">No posts yet.</p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
