"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Badge, Button, Card, ErrorText, Spinner } from "@/components/ui";
import { PageHeader } from "@/components/shell";
import type { Community } from "@/lib/types";
import {
  Plus,
  Search,
  Bell,
  MessageSquare,
  Hash,
  Home as HomeIcon,
  Megaphone,
  Heart,
  MessageCircle,
  Pin,
  MoreHorizontal,
  Radio,
  Calendar,
  Trophy,
  Users as UsersIcon,
  Info,
  Settings as SettingsIcon,
  GraduationCap,
  X,
  Trash2,
  Send,
  Flag,
  ChevronLeft,
  Crown,
  Lock,
  Globe,
} from "lucide-react";

/* ---------- types (extend shared Community with full-space shape) ---------- */

type CRole = "ADMIN" | "CONTRIBUTOR";
type CStatus = "ACTIVE" | "REQUESTED" | "BANNED" | "INVITED";
type CChannelType = "HOME" | "ANNOUNCEMENTS" | "CUSTOM";

type UserRef = {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  role?: string;
};

type Channel = {
  id: string;
  name: string;
  type: CChannelType;
  icon?: string;
  order: number;
  isDefault: boolean;
};

type Comment = {
  id: string;
  body: string;
  createdAt: string;
  author?: UserRef;
};

type Post = {
  id: string;
  title?: string;
  body: string;
  mediaUrl?: string;
  channelId?: string;
  isPinned: boolean;
  createdAt: string;
  author?: UserRef;
  comments?: Comment[];
  likeCount?: number;
  likedByMe?: boolean;
  _count?: { comments?: number; likes?: number };
};

type Membership = {
  id: string;
  userId: string;
  role: CRole;
  status: CStatus;
  points: number;
  user?: UserRef;
} | null;

type LiveSession = {
  id: string;
  title: string;
  provider: string;
  streamUrl?: string;
  status: "LIVE" | "ENDED";
  host?: UserRef;
};

type CLink = { id: string; title: string; url: string; order: number };

type EventItem = {
  id: string;
  title: string;
  description?: string;
  location?: string;
  link?: string;
  startsAt: string;
  endsAt?: string;
  createdBy?: UserRef;
};

type Member = {
  id: string;
  userId: string;
  role: CRole;
  status: CStatus;
  points: number;
  lastActiveAt?: string;
  user?: UserRef;
};

type LeaderRow = {
  id: string;
  userId: string;
  points: number;
  level: number;
  user?: UserRef;
};

type ReportItem = {
  id: string;
  postId?: string;
  commentId?: string;
  reason?: string;
  status: "OPEN" | "RESOLVED";
  createdAt: string;
  reporter?: UserRef;
};

type FullCommunity = Community & {
  about?: string;
  logo?: string;
  coverImage?: string;
  visibility?: "PUBLIC" | "PRIVATE";
  createdBy?: UserRef;
  channels?: Channel[];
  links?: CLink[];
  membership?: Membership;
  live?: LiveSession[];
  canModerate?: boolean;
};

type Tab =
  | "discussion"
  | "learning"
  | "events"
  | "leaderboard"
  | "members"
  | "about"
  | "settings";

type CourseCard = {
  id: string;
  title: string;
  description?: string;
  coverUrl?: string;
  _count?: { lessons: number };
};

/* ---------- helpers ---------- */

function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h";
  const days = Math.floor(h / 24);
  if (days < 7) return days + "d";
  return new Date(iso).toLocaleDateString();
}

function initials(name?: string): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function Avatar({ user, size = 36 }: { user?: UserRef; size?: number }) {
  const dim = { width: size, height: size };
  if (user?.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={user.avatarUrl}
        alt={user.name}
        className="shrink-0 rounded-full object-cover"
        style={dim}
      />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-brand-light text-xs font-semibold text-brand-dark"
      style={dim}
    >
      {initials(user?.name)}
    </div>
  );
}

function channelIcon(c: Channel) {
  if (c.type === "HOME") return <HomeIcon className="h-3.5 w-3.5" />;
  if (c.type === "ANNOUNCEMENTS") return <Megaphone className="h-3.5 w-3.5" />;
  return <Hash className="h-3.5 w-3.5" />;
}

function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center">
      <div
        className={clsx(
          "w-full rounded-2xl bg-white p-5 shadow-xl",
          wide ? "max-w-2xl" : "max-w-lg",
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ===================================================================== */
/*  Root: browse list  <->  community space                              */
/* ===================================================================== */

export function CommunitiesView() {
  const { user } = useAuth();
  const [all, setAll] = useState<FullCommunity[] | null>(null);
  const [mineIds, setMineIds] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, joined] = await Promise.all([
        api<FullCommunity[]>("/communities"),
        api<FullCommunity[]>("/communities/mine"),
      ]);
      setAll(list);
      setMineIds(joined.map((c) => c.id));
    } catch (e: any) {
      setError(e.message);
      setAll([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function join(c: FullCommunity) {
    try {
      const res = await api<any>(`/communities/${c.id}/join`, {
        method: "POST",
      });
      if (res?.requiresPayment && res?.paymentId) {
        const qs = new URLSearchParams({
          title: c.name,
          amount: String(c.price ?? 0),
          currency: c.currency ?? "PKR",
          back: "/client/communities",
        });
        window.location.href = `/checkout/${res.paymentId}?${qs.toString()}`;
        return;
      }
      await load();
      if (res?.status !== "REQUESTED") setActiveId(c.id);
    } catch (e: any) {
      setError(e.message);
    }
  }

  if (activeId) {
    return (
      <CommunitySpace
        communityId={activeId}
        currentUser={user}
        onBack={() => {
          setActiveId(null);
          load();
        }}
      />
    );
  }

  if (!all) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Communities"
        subtitle="Apni communities join karein aur guftugu mein shamil hon"
      />
      <ErrorText message={error} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {all.map((c) => {
          const joined = mineIds.includes(c.id);
          return (
            <Card key={c.id} className="flex flex-col overflow-hidden p-0">
              <div className="relative h-28 w-full bg-gradient-to-br from-brand to-brand-dark">
                {c.coverImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.coverImage}
                    alt={c.name}
                    className="h-full w-full object-cover"
                  />
                ) : null}
                <div className="absolute -bottom-5 left-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-white bg-white shadow">
                    {c.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.logo}
                        alt={c.name}
                        className="h-full w-full rounded-xl object-cover"
                      />
                    ) : (
                      <span className="text-lg font-bold text-brand">
                        {initials(c.name)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-1 flex-col p-4 pt-7">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold leading-tight">{c.name}</p>
                  <Badge color={c.isPaid ? "amber" : "green"}>
                    {c.isPaid ? `${c.currency} ${c.price}` : "Free"}
                  </Badge>
                </div>
                <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                  {c.visibility === "PRIVATE" ? (
                    <Lock className="h-3 w-3" />
                  ) : (
                    <Globe className="h-3 w-3" />
                  )}
                  {c.visibility === "PRIVATE" ? "Private" : "Public"} ·{" "}
                  {c._count?.members ?? 0} members
                </p>
                {c.description ? (
                  <p className="mt-2 line-clamp-2 text-xs text-slate-400">
                    {c.description}
                  </p>
                ) : null}
                <div className="mt-3 flex-1" />
                {joined ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setActiveId(c.id)}
                  >
                    Open
                  </Button>
                ) : (
                  <Button className="w-full" onClick={() => join(c)}>
                    {c.isPaid ? "Join · " + c.currency + " " + c.price : "Join"}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
        {all.length === 0 ? (
          <p className="text-sm text-slate-400">No communities yet.</p>
        ) : null}
      </div>
    </div>
  );
}

/* ===================================================================== */
/*  Community space (single community, all tabs)                         */
/* ===================================================================== */

const TABS: Array<{ key: Tab; label: string; icon: any; modOnly?: boolean }> = [
  { key: "discussion", label: "Discussion", icon: MessageSquare },
  { key: "learning", label: "Learning", icon: GraduationCap },
  { key: "events", label: "Events", icon: Calendar },
  { key: "leaderboard", label: "Leaderboard", icon: Trophy },
  { key: "members", label: "Members", icon: UsersIcon },
  { key: "about", label: "About", icon: Info },
  { key: "settings", label: "Settings", icon: SettingsIcon, modOnly: true },
];

function CommunitySpace({
  communityId,
  currentUser,
  onBack,
}: {
  communityId: string;
  currentUser: any;
  onBack: () => void;
}) {
  const [c, setC] = useState<FullCommunity | null>(null);
  const [tab, setTab] = useState<Tab>("discussion");
  const [error, setError] = useState<string | null>(null);
  const [fab, setFab] = useState(false);
  const [showLive, setShowLive] = useState(false);
  const [showEvent, setShowEvent] = useState(false);
  const [showPost, setShowPost] = useState(false);

  const reload = useCallback(async () => {
    try {
      setC(await api<FullCommunity>(`/communities/${communityId}`));
    } catch (e: any) {
      setError(e.message);
    }
  }, [communityId]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (!c) return <Spinner />;

  const canMod = !!c.canModerate;
  const liveNow = (c.live ?? []).find((l) => l.status === "LIVE");

  return (
    <div className="pb-10">
      {/* top bar */}
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={onBack}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-brand-light">
          {c.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.logo} alt={c.name} className="h-full w-full object-cover" />
          ) : (
            <span className="font-bold text-brand">{initials(c.name)}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-tight">{c.name}</p>
          <p className="flex items-center gap-1 text-xs text-slate-500">
            {c.visibility === "PRIVATE" ? (
              <Lock className="h-3 w-3" />
            ) : (
              <Globe className="h-3 w-3" />
            )}
            {c.isPaid ? "Paid" : "Free"} · {c._count?.members ?? 0} members
          </p>
        </div>
        <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
          <Search className="h-5 w-5" />
        </button>
        <Link
          href="/client/notifications"
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
        >
          <Bell className="h-5 w-5" />
        </Link>
        <Link
          href="/client/messages"
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
        >
          <MessageSquare className="h-5 w-5" />
        </Link>
      </div>

      {liveNow ? (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
          <span className="flex items-center gap-2 text-sm font-medium text-red-700">
            <Radio className="h-4 w-4 animate-pulse" /> Live now: {liveNow.title}
          </span>
          <div className="flex gap-2">
            {liveNow.streamUrl ? (
              <a href={liveNow.streamUrl} target="_blank" rel="noreferrer">
                <Button className="px-3 py-1.5">Join</Button>
              </a>
            ) : null}
            {canMod ? (
              <Button
                variant="outline"
                className="px-3 py-1.5"
                onClick={async () => {
                  await api(`/communities/live/${liveNow.id}/end`, {
                    method: "POST",
                  });
                  reload();
                }}
              >
                End
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* tabs */}
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.filter((t) => !t.modOnly || canMod).map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={clsx(
                "flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition",
                tab === t.key
                  ? "border-brand text-brand"
                  : "border-transparent text-slate-500 hover:text-slate-800",
              )}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      <ErrorText message={error} />

      {tab === "discussion" ? (
        <DiscussionTab
          c={c}
          currentUser={currentUser}
          canMod={canMod}
          openComposer={() => setShowPost(true)}
        />
      ) : null}
      {tab === "learning" ? <LearningTab /> : null}
      {tab === "events" ? (
        <EventsTab c={c} canMod={canMod} openCreate={() => setShowEvent(true)} />
      ) : null}
      {tab === "leaderboard" ? <LeaderboardTab c={c} /> : null}
      {tab === "members" ? (
        <MembersTab c={c} canMod={canMod} onChange={reload} />
      ) : null}
      {tab === "about" ? <AboutTab c={c} /> : null}
      {tab === "settings" && canMod ? (
        <SettingsTab c={c} onChange={reload} />
      ) : null}

      {/* FAB */}
      {c.membership?.status === "ACTIVE" ? (
        <div className="fixed bottom-6 right-6 z-40">
          {fab ? (
            <div className="mb-3 flex flex-col items-end gap-2">
              <FabItem
                label="Create post"
                icon={MessageSquare}
                onClick={() => {
                  setFab(false);
                  setShowPost(true);
                }}
              />
              {canMod ? (
                <FabItem
                  label="Go live"
                  icon={Radio}
                  onClick={() => {
                    setFab(false);
                    setShowLive(true);
                  }}
                />
              ) : null}
              {canMod ? (
                <FabItem
                  label="Create event"
                  icon={Calendar}
                  onClick={() => {
                    setFab(false);
                    setShowEvent(true);
                  }}
                />
              ) : null}
            </div>
          ) : null}
          <button
            onClick={() => setFab((v) => !v)}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-lg transition hover:bg-brand-dark"
          >
            <Plus
              className={clsx("h-6 w-6 transition", fab && "rotate-45")}
            />
          </button>
        </div>
      ) : null}

      {showPost ? (
        <CreatePostModal
          c={c}
          currentUser={currentUser}
          onClose={() => setShowPost(false)}
          onDone={() => {
            setShowPost(false);
            reload();
          }}
        />
      ) : null}
      {showLive ? (
        <GoLiveModal
          c={c}
          onClose={() => setShowLive(false)}
          onDone={() => {
            setShowLive(false);
            reload();
          }}
        />
      ) : null}
      {showEvent ? (
        <CreateEventModal
          c={c}
          onClose={() => setShowEvent(false)}
          onDone={() => {
            setShowEvent(false);
            setTab("events");
          }}
        />
      ) : null}
    </div>
  );
}

function FabItem({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: any;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-full bg-white py-2 pl-3 pr-4 text-sm font-medium text-slate-700 shadow-md hover:bg-slate-50"
    >
      <Icon className="h-4 w-4 text-brand" /> {label}
    </button>
  );
}

/* ---------- Discussion ---------- */

function DiscussionTab({
  c,
  currentUser,
  canMod,
  openComposer,
}: {
  c: FullCommunity;
  currentUser: any;
  canMod: boolean;
  openComposer: () => void;
}) {
  const channels = useMemo(
    () => [...(c.channels ?? [])].sort((a, b) => a.order - b.order),
    [c.channels],
  );
  const [channelId, setChannelId] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [open, setOpen] = useState<Post | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadPosts = useCallback(async () => {
    setPosts(null);
    try {
      const q = channelId ? `?channelId=${channelId}` : "";
      setPosts(await api<Post[]>(`/communities/${c.id}/posts${q}`));
    } catch (e: any) {
      setErr(e.message);
      setPosts([]);
    }
  }, [c.id, channelId]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  async function toggleLike(p: Post) {
    await api(`/communities/posts/${p.id}/like`, { method: "POST" });
    loadPosts();
  }
  async function pin(p: Post) {
    await api(`/communities/posts/${p.id}/pin`, {
      method: "POST",
      body: { pinned: !p.isPinned },
    });
    loadPosts();
  }
  async function del(p: Post) {
    await api(`/communities/posts/${p.id}`, { method: "DELETE" });
    loadPosts();
  }

  const isMember = c.membership?.status === "ACTIVE";

  if (open) {
    return (
      <PostDetail
        post={open}
        community={c}
        currentUser={currentUser}
        canMod={canMod}
        onBack={() => {
          setOpen(null);
          loadPosts();
        }}
      />
    );
  }

  return (
    <div>
      {/* channel chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        <ChannelChip
          active={channelId === null}
          onClick={() => setChannelId(null)}
        >
          All
        </ChannelChip>
        {channels.map((ch) => (
          <ChannelChip
            key={ch.id}
            active={channelId === ch.id}
            onClick={() => setChannelId(ch.id)}
          >
            <span className="flex items-center gap-1">
              {channelIcon(ch)} {ch.name}
            </span>
          </ChannelChip>
        ))}
        {canMod ? <CreateChannelChip communityId={c.id} /> : null}
      </div>

      {/* composer */}
      {isMember ? (
        <Card className="mb-4 flex items-center gap-3">
          <Avatar user={currentUser} />
          <button
            onClick={openComposer}
            className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-left text-sm text-slate-400 hover:bg-slate-50"
          >
            What&apos;s on your mind, {currentUser?.name?.split(" ")[0]}?
          </button>
        </Card>
      ) : null}

      <ErrorText message={err} />
      {posts === null ? (
        <Spinner />
      ) : posts.length === 0 ? (
        <Card className="text-center">
          <p className="text-sm font-medium">No discussions yet!</p>
          <p className="mt-1 text-xs text-slate-400">
            Pehla post likh kar guftugu shuru karein.
          </p>
          {isMember ? (
            <Button className="mt-3" onClick={openComposer}>
              Create post
            </Button>
          ) : null}
        </Card>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => {
            const ch = channels.find((x) => x.id === p.channelId);
            const likes = p.likeCount ?? p._count?.likes ?? 0;
            const comments = p.comments?.length ?? p._count?.comments ?? 0;
            const mine = p.author?.id === currentUser?.id;
            return (
              <Card key={p.id}>
                <div className="flex items-start gap-3">
                  <Avatar user={p.author} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">
                        {p.author?.name}
                      </span>
                      {ch ? (
                        <span className="text-xs text-slate-400">
                          #{ch.name}
                        </span>
                      ) : null}
                      <span className="text-xs text-slate-400">
                        · {timeAgo(p.createdAt)}
                      </span>
                      {p.isPinned ? (
                        <Pin className="h-3.5 w-3.5 text-brand" />
                      ) : null}
                    </div>
                    <button
                      className="mt-1 block w-full text-left"
                      onClick={() => setOpen(p)}
                    >
                      {p.title ? (
                        <p className="font-semibold">{p.title}</p>
                      ) : null}
                      <p className="line-clamp-4 whitespace-pre-wrap text-sm text-slate-700">
                        {p.body}
                      </p>
                    </button>
                    {p.mediaUrl ? (
                      <div className="mt-2 overflow-hidden rounded-lg border border-slate-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.mediaUrl} alt="" className="max-h-80 w-full object-cover" />
                      </div>
                    ) : null}
                    <div className="mt-3 flex items-center gap-4 text-sm text-slate-500">
                      <button
                        onClick={() => toggleLike(p)}
                        className={clsx(
                          "flex items-center gap-1 hover:text-brand",
                          p.likedByMe && "text-brand",
                        )}
                      >
                        <Heart
                          className={clsx(
                            "h-4 w-4",
                            p.likedByMe && "fill-brand",
                          )}
                        />
                        {likes}
                      </button>
                      <button
                        onClick={() => setOpen(p)}
                        className="flex items-center gap-1 hover:text-brand"
                      >
                        <MessageCircle className="h-4 w-4" /> {comments}
                      </button>
                      {(canMod || mine) && (
                        <div className="ml-auto flex items-center gap-2">
                          {canMod ? (
                            <button
                              onClick={() => pin(p)}
                              className="hover:text-brand"
                              title={p.isPinned ? "Unpin" : "Pin"}
                            >
                              <Pin className="h-4 w-4" />
                            </button>
                          ) : null}
                          <button
                            onClick={() => del(p)}
                            className="hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChannelChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition",
        active
          ? "border-brand bg-brand text-white"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
      )}
    >
      {children}
    </button>
  );
}

function CreateChannelChip({ communityId }: { communityId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-full border border-dashed border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
      >
        + Create channel
      </button>
      {open ? (
        <Modal title="Create channel" onClose={() => setOpen(false)}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Channel name"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={busy || !name.trim()}
              onClick={async () => {
                setBusy(true);
                try {
                  await api(`/communities/${communityId}/channels`, {
                    method: "POST",
                    body: { name },
                  });
                  window.location.reload();
                } finally {
                  setBusy(false);
                }
              }}
            >
              Create
            </Button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

function PostDetail({
  post,
  community,
  currentUser,
  canMod,
  onBack,
}: {
  post: Post;
  community: FullCommunity;
  currentUser: any;
  canMod: boolean;
  onBack: () => void;
}) {
  const [p, setP] = useState<Post | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setP(await api<Post>(`/communities/posts/${post.id}`));
    } catch {
      setP(post);
    }
  }, [post]);

  useEffect(() => {
    load();
  }, [load]);

  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await api(`/communities/posts/${post.id}/comments`, {
        method: "POST",
        body: { body: text },
      });
      setText("");
      load();
    } finally {
      setBusy(false);
    }
  }

  const data = p ?? post;
  return (
    <div>
      <button
        onClick={onBack}
        className="mb-3 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
      >
        <ChevronLeft className="h-4 w-4" /> Back
      </button>
      <Card>
        <div className="flex items-start gap-3">
          <Avatar user={data.author} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{data.author?.name}</p>
            <p className="text-xs text-slate-400">{timeAgo(data.createdAt)}</p>
            {data.title ? (
              <p className="mt-2 font-semibold">{data.title}</p>
            ) : null}
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
              {data.body}
            </p>
          </div>
        </div>
      </Card>

      <div className="mt-4 space-y-3">
        {(data.comments ?? []).map((cm) => (
          <div key={cm.id} className="flex items-start gap-3">
            <Avatar user={cm.author} size={30} />
            <div className="flex-1 rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-xs font-semibold">{cm.author?.name}</p>
              <p className="text-sm text-slate-700">{cm.body}</p>
            </div>
            {canMod ? (
              <button
                onClick={async () => {
                  await api(`/communities/comments/${cm.id}`, {
                    method: "DELETE",
                  });
                  load();
                }}
                className="text-slate-300 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        ))}
        {(data.comments ?? []).length === 0 ? (
          <p className="text-sm text-slate-400">No comments yet.</p>
        ) : null}
      </div>

      {community.membership?.status === "ACTIVE" ? (
        <div className="mt-4 flex items-center gap-2">
          <Avatar user={currentUser} size={32} />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Add a comment..."
            className="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm outline-none focus:border-brand"
          />
          <Button disabled={busy} onClick={send} className="px-3">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function CreatePostModal({
  c,
  currentUser,
  onClose,
  onDone,
}: {
  c: FullCommunity;
  currentUser: any;
  onClose: () => void;
  onDone: () => void;
}) {
  const channels = [...(c.channels ?? [])].sort((a, b) => a.order - b.order);
  const [channelId, setChannelId] = useState(channels[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!body.trim()) return;
    setBusy(true);
    try {
      await api(`/communities/${c.id}/posts`, {
        method: "POST",
        body: { title: title || undefined, body, channelId: channelId || undefined },
      });
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Create post" onClose={onClose} wide>
      <div className="mb-3 flex items-center gap-3">
        <Avatar user={currentUser} />
        <select
          value={channelId}
          onChange={(e) => setChannelId(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-brand"
        >
          {channels.map((ch) => (
            <option key={ch.id} value={ch.id}>
              {ch.name}
            </option>
          ))}
        </select>
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (optional)"
        className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium outline-none focus:border-brand"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={6}
        placeholder="Write something..."
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand"
      />
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={busy || !body.trim()} onClick={submit}>
          Post
        </Button>
      </div>
    </Modal>
  );
}

/* ---------- Learning ---------- */

function LearningTab() {
  const [courses, setCourses] = useState<CourseCard[] | null>(null);
  useEffect(() => {
    api<CourseCard[]>("/courses")
      .then(setCourses)
      .catch(() => setCourses([]));
  }, []);
  if (courses === null) return <Spinner />;
  if (courses.length === 0)
    return (
      <Card className="text-center">
        <p className="text-sm text-slate-400">No courses yet.</p>
      </Card>
    );
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {courses.map((c) => (
        <Card key={c.id} className="flex flex-col overflow-hidden p-0">
          <div className="flex h-32 w-full items-center justify-center bg-brand-light">
            {c.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.coverUrl} alt={c.title} className="h-full w-full object-cover" />
            ) : (
              <GraduationCap className="h-10 w-10 text-brand" />
            )}
          </div>
          <div className="flex flex-1 flex-col p-4">
            <p className="line-clamp-2 font-semibold">{c.title}</p>
            <p className="mt-1 text-xs text-slate-500">
              {c._count?.lessons ?? 0} lessons
            </p>
            <div className="flex-1" />
            <Link href={`/client/courses/${c.id}`} className="mt-3">
              <Button className="w-full">View course</Button>
            </Link>
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ---------- Events ---------- */

function EventsTab({
  c,
  canMod,
  openCreate,
}: {
  c: FullCommunity;
  canMod: boolean;
  openCreate: () => void;
}) {
  const [events, setEvents] = useState<EventItem[] | null>(null);
  const load = useCallback(() => {
    api<EventItem[]>(`/communities/${c.id}/events`)
      .then(setEvents)
      .catch(() => setEvents([]));
  }, [c.id]);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      {canMod ? (
        <div className="mb-4 flex justify-end">
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Create event
          </Button>
        </div>
      ) : null}
      {events === null ? (
        <Spinner />
      ) : events.length === 0 ? (
        <Card className="text-center">
          <p className="text-sm text-slate-400">No events yet.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {events.map((e) => {
            const d = new Date(e.startsAt);
            return (
              <Card key={e.id} className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-light text-brand-dark">
                  <span className="text-xs font-medium uppercase">
                    {d.toLocaleString(undefined, { month: "short" })}
                  </span>
                  <span className="text-lg font-bold leading-none">
                    {d.getDate()}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{e.title}</p>
                  <p className="text-xs text-slate-500">
                    {d.toLocaleString(undefined, {
                      weekday: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {e.location ? " · " + e.location : ""}
                  </p>
                  {e.description ? (
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                      {e.description}
                    </p>
                  ) : null}
                  {e.link ? (
                    <a
                      href={e.link}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-xs font-medium text-brand"
                    >
                      Join link
                    </a>
                  ) : null}
                </div>
                {canMod ? (
                  <button
                    onClick={async () => {
                      await api(`/communities/events/${e.id}`, {
                        method: "DELETE",
                      });
                      load();
                    }}
                    className="text-slate-300 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreateEventModal({
  c,
  onClose,
  onDone,
}: {
  c: FullCommunity;
  onClose: () => void;
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [link, setLink] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Create event" onClose={onClose}>
      <div className="space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Event title"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <input
          type="datetime-local"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Location (optional)"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="Join link (optional)"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Description (optional)"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand"
        />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={busy || !title.trim() || !startsAt}
          onClick={async () => {
            setBusy(true);
            try {
              await api(`/communities/${c.id}/events`, {
                method: "POST",
                body: {
                  title,
                  description: description || undefined,
                  location: location || undefined,
                  link: link || undefined,
                  startsAt: new Date(startsAt).toISOString(),
                },
              });
              onDone();
            } finally {
              setBusy(false);
            }
          }}
        >
          Create
        </Button>
      </div>
    </Modal>
  );
}

/* ---------- Leaderboard ---------- */

function LeaderboardTab({ c }: { c: FullCommunity }) {
  const [period, setPeriod] = useState<"all" | "7d" | "30d">("all");
  const [rows, setRows] = useState<LeaderRow[] | null>(null);
  useEffect(() => {
    setRows(null);
    api<LeaderRow[]>(`/communities/${c.id}/leaderboard?period=${period}`)
      .then(setRows)
      .catch(() => setRows([]));
  }, [c.id, period]);

  return (
    <div>
      <div className="mb-4 flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
        {([
          ["all", "All time"],
          ["7d", "7 days"],
          ["30d", "30 days"],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setPeriod(k)}
            className={clsx(
              "flex-1 rounded-lg px-3 py-1.5 text-sm font-medium",
              period === k ? "bg-brand text-white" : "text-slate-600",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {rows === null ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <Card className="text-center">
          <p className="text-sm text-slate-400">No rankings yet.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r, i) => (
            <Card key={r.id} className="flex items-center gap-3 py-3">
              <span
                className={clsx(
                  "flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold",
                  i === 0
                    ? "bg-amber-100 text-amber-700"
                    : "bg-slate-100 text-slate-500",
                )}
              >
                {i + 1}
              </span>
              <Avatar user={r.user} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {r.user?.name}
                </p>
                <p className="text-xs text-slate-400">Level {r.level}</p>
              </div>
              <span className="flex items-center gap-1 text-sm font-semibold text-brand">
                <Crown className="h-4 w-4" /> {r.points}
              </span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Members ---------- */

const MEMBER_FILTERS: Array<{ key: string; label: string; modOnly?: boolean }> = [
  { key: "all", label: "All" },
  { key: "admins", label: "Admins" },
  { key: "contributors", label: "Contributors" },
  { key: "requested", label: "Requested", modOnly: true },
  { key: "banned", label: "Banned", modOnly: true },
  { key: "invited", label: "Invited", modOnly: true },
];

function MembersTab({
  c,
  canMod,
  onChange,
}: {
  c: FullCommunity;
  canMod: boolean;
  onChange: () => void;
}) {
  const [filter, setFilter] = useState("all");
  const [members, setMembers] = useState<Member[] | null>(null);
  const load = useCallback(() => {
    setMembers(null);
    api<Member[]>(`/communities/${c.id}/members?filter=${filter}`)
      .then(setMembers)
      .catch(() => setMembers([]));
  }, [c.id, filter]);
  useEffect(() => {
    load();
  }, [load]);

  async function act(m: Member, action: string, method = "POST", body?: any) {
    await api(`/communities/members/${m.id}/${action}`, { method, body });
    load();
    onChange();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {MEMBER_FILTERS.filter((f) => !f.modOnly || canMod).map((f) => (
          <ChannelChip
            key={f.key}
            active={filter === f.key}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </ChannelChip>
        ))}
      </div>
      {members === null ? (
        <Spinner />
      ) : members.length === 0 ? (
        <Card className="text-center">
          <p className="text-sm text-slate-400">No members here.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <Card key={m.id} className="flex items-center gap-3 py-3">
              <Avatar user={m.user} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold">
                    {m.user?.name}
                  </p>
                  {m.role === "ADMIN" ? (
                    <Badge color="amber">Admin</Badge>
                  ) : null}
                  {m.status !== "ACTIVE" ? (
                    <Badge color={m.status === "BANNED" ? "red" : "slate"}>
                      {m.status}
                    </Badge>
                  ) : null}
                </div>
                <p className="truncate text-xs text-slate-400">
                  {m.user?.email}
                </p>
              </div>
              {canMod ? (
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  {m.status === "REQUESTED" ? (
                    <>
                      <Button
                        className="px-2.5 py-1 text-xs"
                        onClick={() => act(m, "approve")}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        className="px-2.5 py-1 text-xs"
                        onClick={() => act(m, "reject")}
                      >
                        Reject
                      </Button>
                    </>
                  ) : m.status === "BANNED" ? (
                    <Button
                      variant="outline"
                      className="px-2.5 py-1 text-xs"
                      onClick={() => act(m, "unban")}
                    >
                      Unban
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        className="px-2.5 py-1 text-xs"
                        onClick={() =>
                          act(m, "role", "PATCH", {
                            role:
                              m.role === "ADMIN" ? "CONTRIBUTOR" : "ADMIN",
                          })
                        }
                      >
                        {m.role === "ADMIN" ? "Make member" : "Make admin"}
                      </Button>
                      <Button
                        variant="danger"
                        className="px-2.5 py-1 text-xs"
                        onClick={() => act(m, "ban")}
                      >
                        Ban
                      </Button>
                    </>
                  )}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- About ---------- */

function AboutTab({ c }: { c: FullCommunity }) {
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden p-0">
        <div className="h-32 w-full bg-gradient-to-br from-brand to-brand-dark">
          {c.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={c.coverImage}
              alt={c.name}
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
        <div className="p-5">
          <h2 className="text-lg font-semibold">{c.name}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {c.isPaid ? "Paid" : "Free"} ·{" "}
            {c.visibility === "PRIVATE" ? "Private" : "Public"} ·{" "}
            {c._count?.members ?? 0} members
          </p>
          {c.about || c.description ? (
            <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
              {c.about || c.description}
            </p>
          ) : null}
          {c.createdBy ? (
            <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4">
              <Avatar user={c.createdBy} size={32} />
              <div>
                <p className="text-xs text-slate-400">Created by</p>
                <p className="text-sm font-medium">{c.createdBy.name}</p>
              </div>
            </div>
          ) : null}
        </div>
      </Card>
      {(c.links ?? []).length > 0 ? (
        <Card>
          <p className="mb-2 text-sm font-semibold">Links</p>
          <div className="flex flex-wrap gap-2">
            {(c.links ?? []).map((l) => (
              <a
                key={l.id}
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand-light"
              >
                {l.title}
              </a>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

/* ---------- Settings (moderator) ---------- */

function SettingsTab({
  c,
  onChange,
}: {
  c: FullCommunity;
  onChange: () => void;
}) {
  const [links, setLinks] = useState<CLink[]>(c.links ?? []);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [reports, setReports] = useState<ReportItem[] | null>(null);
  const [busy, setBusy] = useState(false);

  const loadReports = useCallback(() => {
    api<ReportItem[]>(`/communities/${c.id}/reports`)
      .then(setReports)
      .catch(() => setReports([]));
  }, [c.id]);
  useEffect(() => {
    loadReports();
  }, [loadReports]);

  async function saveLinks(next: CLink[]) {
    setBusy(true);
    try {
      await api(`/communities/${c.id}/links`, {
        method: "PUT",
        body: { links: next.map((l) => ({ title: l.title, url: l.url })) },
      });
      onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <p className="mb-3 text-sm font-semibold">Links</p>
        <div className="space-y-2">
          {links.map((l, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={l.title}
                onChange={(e) => {
                  const next = [...links];
                  next[i] = { ...l, title: e.target.value };
                  setLinks(next);
                }}
                className="w-40 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-brand"
              />
              <input
                value={l.url}
                onChange={(e) => {
                  const next = [...links];
                  next[i] = { ...l, url: e.target.value };
                  setLinks(next);
                }}
                className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-brand"
              />
              <button
                onClick={() => setLinks(links.filter((_, x) => x !== i))}
                className="text-slate-300 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="w-40 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-brand"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-brand"
          />
          <Button
            variant="outline"
            onClick={() => {
              if (!title.trim() || !url.trim()) return;
              setLinks([
                ...links,
                { id: "new" + links.length, title, url, order: links.length },
              ]);
              setTitle("");
              setUrl("");
            }}
          >
            Add
          </Button>
        </div>
        <div className="mt-4 flex justify-end">
          <Button disabled={busy} onClick={() => saveLinks(links)}>
            Save changes
          </Button>
        </div>
      </Card>

      <Card>
        <p className="mb-3 text-sm font-semibold">Reported content</p>
        {reports === null ? (
          <Spinner />
        ) : reports.length === 0 ? (
          <p className="text-sm text-slate-400">No open reports.</p>
        ) : (
          <div className="space-y-2">
            {reports.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2"
              >
                <Flag className="h-4 w-4 text-red-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{r.reason || "Reported"}</p>
                  <p className="text-xs text-slate-400">
                    by {r.reporter?.name} · {timeAgo(r.createdAt)}
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="px-2.5 py-1 text-xs"
                  onClick={async () => {
                    await api(`/communities/reports/${r.id}/resolve`, {
                      method: "POST",
                    });
                    loadReports();
                  }}
                >
                  Resolve
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------- Go Live ---------- */

function GoLiveModal({
  c,
  onClose,
  onDone,
}: {
  c: FullCommunity;
  onClose: () => void;
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [provider, setProvider] = useState("youtube");
  const [streamUrl, setStreamUrl] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Go live" onClose={onClose}>
      <div className="space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Stream title"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand"
        >
          <option value="youtube">YouTube</option>
          <option value="vimeo">Vimeo</option>
          <option value="zoom">Zoom</option>
          <option value="custom">Custom</option>
        </select>
        <input
          value={streamUrl}
          onChange={(e) => setStreamUrl(e.target.value)}
          placeholder="Stream / join URL"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand"
        />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={busy || !title.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              await api(`/communities/${c.id}/live`, {
                method: "POST",
                body: { title, provider, streamUrl: streamUrl || undefined },
              });
              onDone();
            } finally {
              setBusy(false);
            }
          }}
        >
          <Radio className="h-4 w-4" /> Start live
        </Button>
      </div>
    </Modal>
  );
}
