import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { api } from "../api";
import { useAuth } from "../auth";
import { Loading } from "../components";
import { colors, radius, spacing } from "../theme";
import { EmptyState, Pill } from "../ui";

const arr = (x: any): any[] =>
  Array.isArray(x) ? x : x?.items || x?.data || [];

const imgSrc = (u?: string | null) => ({ uri: u as string });

const initials = (name?: string) => (name || "U").slice(0, 1).toUpperCase();
const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString() : "";
const fmtDateTime = (d?: string) =>
  d
    ? new Date(d).toLocaleDateString() +
      " " +
      new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

function Avatar({
  name,
  url,
  size = 36,
}: {
  name?: string;
  url?: string | null;
  size?: number;
}) {
  const dim = { width: size, height: size, borderRadius: size / 2 };
  if (url) {
    const src = { uri: url };
    return <Image source={src} style={[s.avatar, dim]} />;
  }
  return (
    <View style={[s.avatar, dim]}>
      <Text style={s.avatarText}>{initials(name)}</Text>
    </View>
  );
}

// =================================================================
// Root tab screen: browse list <-> single community space
// =================================================================
export default function CommunityScreen() {
  const [activeId, setActiveId] = useState<string | null>(null);

  if (activeId)
    return (
      <CommunitySpace
        communityId={activeId}
        onBack={() => setActiveId(null)}
      />
    );
  return <BrowseList onOpen={(id) => setActiveId(id)} />;
}

// =================================================================
// Browse / discover communities
// =================================================================
function BrowseList({ onOpen }: { onOpen: (id: string) => void }) {
  const nav = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [all, setAll] = useState<any[]>([]);
  const [mine, setMine] = useState<string[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api("/communities"), api("/communities/mine")])
      .then(([list, joined]: any[]) => {
        setAll(arr(list));
        setMine(arr(joined).map((c: any) => c.id));
      })
      .catch(() => setAll([]))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(load);

  async function join(c: any) {
    setBusyId(c.id);
    try {
      const res: any = await api("/communities/" + c.id + "/join", {
        method: "POST",
      });
      if (res?.requiresPayment && res?.paymentId) {
        nav.navigate("Checkout", {
          paymentId: res.paymentId,
          title: c.name,
          amount: c.price,
          currency: c.currency,
        });
        return;
      }
      load();
      onOpen(c.id);
    } catch (e: any) {
      Alert.alert("Could not join", e.message || "Try again later.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <Loading />;

  return (
    <FlatList
      style={s.wrap}
      contentContainerStyle={s.browseList}
      data={all}
      keyExtractor={(c: any) => c.id}
      ListHeaderComponent={
        <View>
          <Text style={s.screenTitle}>Communities</Text>
          <Text style={s.screenSub}>
            Join a community to learn, discuss and grow together.
          </Text>
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          icon="people-outline"
          title="No communities yet"
          subtitle="New communities will appear here."
        />
      }
      renderItem={({ item: c }: { item: any }) => {
        const joined = mine.includes(c.id);
        const cover = c.coverImage || c.coverUrl;
        return (
          <TouchableOpacity
            activeOpacity={0.9}
            style={s.browseCard}
            onPress={() => (joined ? onOpen(c.id) : null)}
          >
            <View style={s.browseCover}>
              {cover ? (
                <Image source={imgSrc(cover)} style={s.browseCoverImg} />
              ) : (
                <View style={s.browseCoverFallback}>
                  <Ionicons name="people" size={30} color={colors.brand} />
                </View>
              )}
              <View style={s.browseBadges}>
                <View
                  style={[
                    s.tag,
                    c.isPaid ? s.tagAmber : s.tagGreen,
                  ]}
                >
                  <Text
                    style={[
                      s.tagText,
                      c.isPaid ? s.tagTextAmber : s.tagTextGreen,
                    ]}
                  >
                    {c.isPaid
                      ? (c.currency || "PKR") + " " + (c.price || 0)
                      : "Free"}
                  </Text>
                </View>
              </View>
            </View>
            <View style={s.browseBody}>
              <View style={s.rowBetween}>
                <Text style={s.browseName} numberOfLines={1}>
                  {c.name}
                </Text>
                <View style={s.rowCenter}>
                  <Ionicons
                    name={
                      c.visibility === "PRIVATE"
                        ? "lock-closed"
                        : "earth"
                    }
                    size={12}
                    color={colors.muted}
                  />
                  <Text style={s.browseMeta}>
                    {" "}
                    {c.visibility === "PRIVATE" ? "Private" : "Public"}
                  </Text>
                </View>
              </View>
              {c.description ? (
                <Text style={s.browseDesc} numberOfLines={2}>
                  {c.description}
                </Text>
              ) : null}
              <View style={s.rowBetween}>
                <Text style={s.browseMeta}>
                  {c._count?.members ?? 0} members
                </Text>
                {joined ? (
                  <TouchableOpacity
                    style={s.openBtn}
                    onPress={() => onOpen(c.id)}
                  >
                    <Text style={s.openBtnText}>Open</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={s.joinBtn}
                    disabled={busyId === c.id}
                    onPress={() => join(c)}
                  >
                    {busyId === c.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={s.joinBtnText}>
                        {c.isPaid ? "Join \u2022 " + (c.currency || "PKR") + " " + (c.price || 0) : "Join"}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </TouchableOpacity>
        );
      }}
    />
  );
}

// =================================================================
// Single community space
// =================================================================
const TABS = [
  "Discussion",
  "Learning",
  "Events",
  "Leaderboard",
  "Members",
  "About",
];

function CommunitySpace({
  communityId,
  onBack,
}: {
  communityId: string;
  onBack: () => void;
}) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [community, setCommunity] = useState<any>(null);
  const [tab, setTab] = useState<string>("Discussion");
  const [fabOpen, setFabOpen] = useState(false);

  const load = useCallback(() => {
    api("/communities/" + communityId)
      .then((d: any) => setCommunity(d))
      .catch(() => setCommunity(null))
      .finally(() => setLoading(false));
  }, [communityId]);

  useFocusEffect(load);

  if (loading) return <Loading />;
  if (!community)
    return (
      <View style={s.wrap}>
        <TouchableOpacity style={s.backRow} onPress={onBack}>
          <Ionicons name="chevron-back" size={20} color={colors.brand} />
          <Text style={s.backText}>Communities</Text>
        </TouchableOpacity>
        <EmptyState title="Community unavailable" />
      </View>
    );

  const canModerate = !!community.canModerate;
  const live = community.live || community.liveSession;
  const tabs = canModerate ? [...TABS, "Settings"] : TABS;
  const cover = community.coverImage || community.coverUrl;

  return (
    <View style={s.wrap}>
      <ScrollView
        stickyHeaderIndices={[1]}
        contentContainerStyle={s.spaceScroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header (index 0) */}
        <View>
          <TouchableOpacity style={s.backRow} onPress={onBack}>
            <Ionicons name="chevron-back" size={20} color={colors.brand} />
            <Text style={s.backText}>Communities</Text>
          </TouchableOpacity>

          <View style={s.banner}>
            {cover ? (
              <Image source={imgSrc(cover)} style={s.bannerImg} />
            ) : (
              <View style={s.bannerFallback} />
            )}
            <View style={s.bannerOverlay} />
            <View style={s.bannerContent}>
              <View style={s.logoBox}>
                {community.logo ? (
                  <Image source={imgSrc(community.logo)} style={s.logoImg} />
                ) : (
                  <Text style={s.logoText}>{initials(community.name)}</Text>
                )}
              </View>
              <Text style={s.bannerName}>{community.name}</Text>
              <Text style={s.bannerMeta}>
                {(community._count?.members ?? 0) + " members \u2022 "}
                {community.isPaid ? "Paid" : "Free"}
                {" \u2022 "}
                {community.visibility === "PRIVATE" ? "Private" : "Public"}
              </Text>
            </View>
          </View>

          {live ? (
            <View style={s.liveBanner}>
              <View style={s.liveDot} />
              <Text style={s.liveText} numberOfLines={1}>
                LIVE • {live.title || "Live session"}
              </Text>
              {canModerate ? (
                <TouchableOpacity
                  onPress={async () => {
                    try {
                      await api("/communities/live/" + live.id + "/end", {
                        method: "POST",
                      });
                      load();
                    } catch {}
                  }}
                >
                  <Text style={s.liveEnd}>End</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* Tab bar (sticky, index 1) */}
        <View style={s.tabBarWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.tabBar}
          >
            {tabs.map((t) => (
              <Pill
                key={t}
                label={t}
                active={tab === t}
                onPress={() => setTab(t)}
              />
            ))}
          </ScrollView>
        </View>

        {/* Tab content (index 2) */}
        <View style={s.tabContent}>
          {tab === "Discussion" ? (
            <DiscussionTab community={community} canModerate={canModerate} />
          ) : tab === "Learning" ? (
            <LearningTab />
          ) : tab === "Events" ? (
            <EventsTab community={community} canModerate={canModerate} />
          ) : tab === "Leaderboard" ? (
            <LeaderboardTab communityId={communityId} />
          ) : tab === "Members" ? (
            <MembersTab community={community} canModerate={canModerate} />
          ) : tab === "About" ? (
            <AboutTab community={community} />
          ) : (
            <SettingsTab community={community} onChange={load} />
          )}
        </View>
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={s.fab}
        activeOpacity={0.9}
        onPress={() => setFabOpen(true)}
      >
        <Ionicons name="add" size={26} color="#fff" />
      </TouchableOpacity>

      <FabMenu
        visible={fabOpen}
        canModerate={canModerate}
        onClose={() => setFabOpen(false)}
        community={community}
        onDone={load}
      />
    </View>
  );
}

// =================================================================
// Discussion tab
// =================================================================
function DiscussionTab({
  community,
  canModerate,
}: {
  community: any;
  canModerate: boolean;
}) {
  const { user } = useAuth();
  const channels = arr(community.channels);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [detail, setDetail] = useState<any>(null);

  const loadPosts = useCallback(() => {
    setLoading(true);
    const q = activeChannel ? "?channelId=" + activeChannel : "";
    api("/communities/" + community.id + "/posts" + q)
      .then((d: any) => setPosts(arr(d)))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, [community.id, activeChannel]);

  useFocusEffect(loadPosts);

  async function submit() {
    if (!draft.trim()) return;
    setSending(true);
    try {
      await api("/communities/" + community.id + "/posts", {
        method: "POST",
        body: { body: draft.trim(), channelId: activeChannel || undefined },
      });
      setDraft("");
      loadPosts();
    } catch (e: any) {
      Alert.alert("Could not post", e.message || "Try again.");
    } finally {
      setSending(false);
    }
  }

  async function like(p: any) {
    try {
      await api("/communities/posts/" + p.id + "/like", { method: "POST" });
      loadPosts();
    } catch {}
  }

  async function togglePin(p: any) {
    try {
      await api("/communities/posts/" + p.id + "/pin", {
        method: "POST",
        body: { pinned: !p.isPinned },
      });
      loadPosts();
    } catch {}
  }

  function removePost(p: any) {
    Alert.alert("Delete post", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api("/communities/posts/" + p.id, { method: "DELETE" });
            loadPosts();
          } catch {}
        },
      },
    ]);
  }

  function postMenu(p: any) {
    const minePost = p.author?.id === user?.id || p.authorId === user?.id;
    if (!canModerate && !minePost) return;
    const opts: any[] = [];
    if (canModerate)
      opts.push({
        text: p.isPinned ? "Unpin" : "Pin",
        onPress: () => togglePin(p),
      });
    opts.push({
      text: "Delete",
      style: "destructive",
      onPress: () => removePost(p),
    });
    opts.push({ text: "Cancel", style: "cancel" });
    Alert.alert("Post options", undefined, opts);
  }

  const sorted = [...posts].sort((a, b) => {
    if (!!a.isPinned !== !!b.isPinned) return a.isPinned ? -1 : 1;
    return (
      new Date(b.createdAt || 0).getTime() -
      new Date(a.createdAt || 0).getTime()
    );
  });

  return (
    <View>
      {/* Channels */}
      {channels.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.channels}
        >
          <Pill
            label="All"
            active={!activeChannel}
            onPress={() => setActiveChannel(null)}
          />
          {channels.map((ch: any) => (
            <Pill
              key={ch.id}
              label={"# " + ch.name}
              active={activeChannel === ch.id}
              onPress={() => setActiveChannel(ch.id)}
            />
          ))}
        </ScrollView>
      ) : null}

      {/* Composer */}
      <View style={s.composer}>
        <Avatar name={user?.name} size={34} />
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="What's on your mind?"
          placeholderTextColor={colors.muted}
          style={s.composerInput}
          multiline
        />
        <TouchableOpacity
          style={[s.sendBtn, !draft.trim() ? s.sendDisabled : null]}
          onPress={submit}
          disabled={sending || !draft.trim()}
        >
          <Ionicons name="send" size={15} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brand} style={s.mt16} />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon="chatbubbles-outline"
          title="No posts yet"
          subtitle="Be the first to start a conversation."
        />
      ) : (
        sorted.map((p: any) => (
          <View key={p.id} style={s.post}>
            <View style={s.postHead}>
              <Avatar name={p.author?.name} url={p.author?.avatarUrl} />
              <View style={s.flex1}>
                <Text style={s.author}>{p.author?.name || "Member"}</Text>
                <Text style={s.time}>{fmtDate(p.createdAt)}</Text>
              </View>
              {p.isPinned ? (
                <Ionicons
                  name="pin"
                  size={15}
                  color={colors.brand}
                  style={s.mr8}
                />
              ) : null}
              <TouchableOpacity onPress={() => postMenu(p)} hitSlop={8}>
                <Ionicons
                  name="ellipsis-horizontal"
                  size={18}
                  color={colors.muted}
                />
              </TouchableOpacity>
            </View>
            {p.title ? <Text style={s.postTitle}>{p.title}</Text> : null}
            {p.body || p.content ? (
              <Text style={s.body}>{p.body || p.content}</Text>
            ) : null}
            {p.mediaUrl ? (
              <Image source={imgSrc(p.mediaUrl)} style={s.postMedia} />
            ) : null}
            <View style={s.metaRow}>
              <TouchableOpacity style={s.metaItem} onPress={() => like(p)}>
                <Ionicons
                  name={p.likedByMe ? "heart" : "heart-outline"}
                  size={17}
                  color={p.likedByMe ? colors.red : colors.muted}
                />
                <Text style={s.metaText}>
                  {p._count?.likes ?? p.likeCount ?? 0}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.metaItem}
                onPress={() => setDetail(p)}
              >
                <Ionicons
                  name="chatbubble-outline"
                  size={16}
                  color={colors.muted}
                />
                <Text style={s.metaText}>
                  {p._count?.comments ?? arr(p.comments).length}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      <PostDetailModal
        post={detail}
        onClose={() => {
          setDetail(null);
          loadPosts();
        }}
      />
    </View>
  );
}

function PostDetailModal({
  post,
  onClose,
}: {
  post: any;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [full, setFull] = useState<any>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    if (!post) return;
    api("/communities/posts/" + post.id)
      .then((d: any) => setFull(d))
      .catch(() => setFull(post));
  }, [post]);

  React.useEffect(() => {
    if (post) {
      setFull(null);
      reload();
    }
  }, [post, reload]);

  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await api("/communities/posts/" + post.id + "/comments", {
        method: "POST",
        body: { body: text.trim() },
      });
      setText("");
      reload();
    } catch {
    } finally {
      setBusy(false);
    }
  }

  const comments = arr(full?.comments);

  return (
    <Modal
      visible={!!post}
      animationType="slide"
      onRequestClose={onClose}
      transparent
    >
      <View style={s.modalBackdrop}>
        <View style={s.modalSheet}>
          <View style={s.modalHandleRow}>
            <View style={s.modalHandle} />
          </View>
          <View style={s.rowBetween}>
            <Text style={s.modalTitle}>Post</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </TouchableOpacity>
          </View>
          {!full ? (
            <ActivityIndicator color={colors.brand} style={s.mt16} />
          ) : (
            <ScrollView style={s.detailScroll}>
              <View style={s.postHead}>
                <Avatar
                  name={full.author?.name}
                  url={full.author?.avatarUrl}
                />
                <View style={s.flex1}>
                  <Text style={s.author}>
                    {full.author?.name || "Member"}
                  </Text>
                  <Text style={s.time}>{fmtDate(full.createdAt)}</Text>
                </View>
              </View>
              {full.title ? (
                <Text style={s.postTitle}>{full.title}</Text>
              ) : null}
              <Text style={s.body}>{full.body || full.content}</Text>

              <Text style={s.commentsHead}>
                {comments.length} comments
              </Text>
              {comments.map((c: any) => (
                <View key={c.id} style={s.comment}>
                  <Avatar
                    name={c.author?.name}
                    url={c.author?.avatarUrl}
                    size={28}
                  />
                  <View style={s.commentBubble}>
                    <Text style={s.commentAuthor}>
                      {c.author?.name || "Member"}
                    </Text>
                    <Text style={s.commentBody}>{c.body || c.content}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
          <View style={s.commentComposer}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Write a comment..."
              placeholderTextColor={colors.muted}
              style={s.commentInput}
            />
            <TouchableOpacity
              style={[s.sendBtn, !text.trim() ? s.sendDisabled : null]}
              onPress={send}
              disabled={busy || !text.trim()}
            >
              <Ionicons name="send" size={15} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// =================================================================
// Learning tab
// =================================================================
function LearningTab() {
  const nav = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<any[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    api("/courses")
      .then((d: any) => setCourses(arr(d)))
      .catch(() => setCourses([]))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(load);

  if (loading) return <ActivityIndicator color={colors.brand} style={s.mt16} />;
  if (!courses.length)
    return (
      <EmptyState
        icon="school-outline"
        title="No courses yet"
        subtitle="Courses shared with this community appear here."
      />
    );

  return (
    <View>
      {courses.map((c: any) => (
        <TouchableOpacity
          key={c.id}
          activeOpacity={0.9}
          style={s.courseCard}
          onPress={() => nav.navigate("CourseDetail", { idOrSlug: c.id })}
        >
          <View style={s.courseThumb}>
            {c.coverUrl ? (
              <Image source={imgSrc(c.coverUrl)} style={s.courseThumbImg} />
            ) : (
              <Ionicons name="play-circle" size={28} color={colors.brand} />
            )}
          </View>
          <View style={s.flex1}>
            <Text style={s.courseTitle} numberOfLines={2}>
              {c.title}
            </Text>
            <Text style={s.browseMeta}>
              {(c._count?.lessons ?? arr(c.lessons).length) + " lessons"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

// =================================================================
// Events tab
// =================================================================
function EventsTab({
  community,
  canModerate,
}: {
  community: any;
  canModerate: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api("/communities/" + community.id + "/events")
      .then((d: any) => setEvents(arr(d)))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [community.id]);

  useFocusEffect(load);

  return (
    <View>
      {canModerate ? (
        <TouchableOpacity
          style={s.outlineBtn}
          onPress={() => setShowForm(true)}
        >
          <Ionicons name="add" size={16} color={colors.brand} />
          <Text style={s.outlineBtnText}>Create event</Text>
        </TouchableOpacity>
      ) : null}

      {loading ? (
        <ActivityIndicator color={colors.brand} style={s.mt16} />
      ) : events.length === 0 ? (
        <EmptyState
          icon="calendar-outline"
          title="No upcoming events"
          subtitle="Scheduled events will show up here."
        />
      ) : (
        events.map((e: any) => (
          <View key={e.id} style={s.eventCard}>
            <View style={s.eventDate}>
              <Text style={s.eventDay}>
                {e.startsAt ? new Date(e.startsAt).getDate() : "--"}
              </Text>
              <Text style={s.eventMonth}>
                {e.startsAt
                  ? new Date(e.startsAt).toLocaleString([], {
                      month: "short",
                    })
                  : ""}
              </Text>
            </View>
            <View style={s.flex1}>
              <Text style={s.eventTitle}>{e.title}</Text>
              <Text style={s.browseMeta}>{fmtDateTime(e.startsAt)}</Text>
              {e.location ? (
                <View style={s.rowCenter}>
                  <Ionicons
                    name="location-outline"
                    size={13}
                    color={colors.muted}
                  />
                  <Text style={s.browseMeta}> {e.location}</Text>
                </View>
              ) : null}
              {e.description ? (
                <Text style={s.eventDesc} numberOfLines={2}>
                  {e.description}
                </Text>
              ) : null}
            </View>
          </View>
        ))
      )}

      <SimpleFormModal
        visible={showForm}
        title="Create event"
        fields={[
          { key: "title", label: "Title", required: true },
          { key: "description", label: "Description", multiline: true },
          { key: "location", label: "Location" },
          { key: "link", label: "Link" },
          { key: "startsAt", label: "Starts (YYYY-MM-DD HH:mm)" },
        ]}
        onClose={() => setShowForm(false)}
        onSubmit={async (vals) => {
          const startsAt = vals.startsAt
            ? new Date(vals.startsAt.replace(" ", "T")).toISOString()
            : new Date().toISOString();
          await api("/communities/" + community.id + "/events", {
            method: "POST",
            body: {
              title: vals.title,
              description: vals.description || undefined,
              location: vals.location || undefined,
              link: vals.link || undefined,
              startsAt,
            },
          });
          setShowForm(false);
          load();
        }}
      />
    </View>
  );
}

// =================================================================
// Leaderboard tab
// =================================================================
function LeaderboardTab({ communityId }: { communityId: string }) {
  const [period, setPeriod] = useState("all");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    api("/communities/" + communityId + "/leaderboard?period=" + period)
      .then((d: any) => setRows(arr(d)))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [communityId, period]);

  useFocusEffect(load);

  const periods = [
    { key: "all", label: "All time" },
    { key: "7d", label: "7 days" },
    { key: "30d", label: "30 days" },
  ];

  return (
    <View>
      <View style={s.segment}>
        {periods.map((p) => (
          <TouchableOpacity
            key={p.key}
            style={[s.segItem, period === p.key ? s.segActive : null]}
            onPress={() => setPeriod(p.key)}
          >
            <Text
              style={[
                s.segText,
                period === p.key ? s.segTextActive : null,
              ]}
            >
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brand} style={s.mt16} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="trophy-outline"
          title="No points yet"
          subtitle="Post and comment to earn points."
        />
      ) : (
        rows.map((r: any, i: number) => {
          const u = r.user || r;
          const points = r.points ?? u.points ?? 0;
          const level = r.level ?? Math.floor(points / 100) + 1;
          return (
            <View key={u.id || i} style={s.lbRow}>
              <Text style={s.lbRank}>{i + 1}</Text>
              <Avatar name={u.name} url={u.avatarUrl} size={34} />
              <View style={s.flex1}>
                <Text style={s.author}>{u.name || "Member"}</Text>
                <Text style={s.time}>Level {level}</Text>
              </View>
              <Text style={s.lbPoints}>{points} pts</Text>
            </View>
          );
        })
      )}
    </View>
  );
}

// =================================================================
// Members tab
// =================================================================
const MEMBER_FILTERS = [
  { key: "", label: "All" },
  { key: "ADMIN", label: "Admins" },
  { key: "CONTRIBUTOR", label: "Contributors" },
  { key: "REQUESTED", label: "Requested" },
  { key: "BANNED", label: "Banned" },
];

function MembersTab({
  community,
  canModerate,
}: {
  community: any;
  canModerate: boolean;
}) {
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<any[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    const q = filter ? "?filter=" + filter : "";
    api("/communities/" + community.id + "/members" + q)
      .then((d: any) => setMembers(arr(d)))
      .catch(() => setMembers([]))
      .finally(() => setLoading(false));
  }, [community.id, filter]);

  useFocusEffect(load);

  async function act(memberId: string, action: string, method = "POST") {
    try {
      await api("/communities/members/" + memberId + "/" + action, {
        method,
      });
      load();
    } catch (e: any) {
      Alert.alert("Action failed", e.message || "Try again.");
    }
  }

  function moderate(m: any) {
    const opts: any[] = [];
    if (m.status === "REQUESTED") {
      opts.push({ text: "Approve", onPress: () => act(m.id, "approve") });
      opts.push({
        text: "Reject",
        style: "destructive",
        onPress: () => act(m.id, "reject"),
      });
    } else if (m.status === "BANNED") {
      opts.push({ text: "Unban", onPress: () => act(m.id, "unban") });
    } else {
      opts.push({
        text: m.role === "ADMIN" ? "Make contributor" : "Make admin",
        onPress: () =>
          api("/communities/members/" + m.id + "/role", {
            method: "PATCH",
            body: { role: m.role === "ADMIN" ? "CONTRIBUTOR" : "ADMIN" },
          })
            .then(load)
            .catch(() => {}),
      });
      opts.push({
        text: "Ban",
        style: "destructive",
        onPress: () => act(m.id, "ban"),
      });
    }
    opts.push({ text: "Cancel", style: "cancel" });
    Alert.alert("Member options", m.user?.name || "Member", opts);
  }

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.channels}
      >
        {MEMBER_FILTERS.map((f) => (
          <Pill
            key={f.key || "all"}
            label={f.label}
            active={filter === f.key}
            onPress={() => setFilter(f.key)}
          />
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={colors.brand} style={s.mt16} />
      ) : members.length === 0 ? (
        <EmptyState icon="person-outline" title="No members here" />
      ) : (
        members.map((m: any) => {
          const u = m.user || m;
          return (
            <View key={m.id} style={s.memberRow}>
              <Avatar name={u.name} url={u.avatarUrl} size={38} />
              <View style={s.flex1}>
                <Text style={s.author}>{u.name || "Member"}</Text>
                <Text style={s.time}>
                  {(m.role || "CONTRIBUTOR") +
                    (m.status && m.status !== "ACTIVE"
                      ? " \u2022 " + m.status
                      : "")}
                </Text>
              </View>
              {canModerate ? (
                <TouchableOpacity onPress={() => moderate(m)} hitSlop={8}>
                  <Ionicons
                    name="ellipsis-horizontal"
                    size={18}
                    color={colors.muted}
                  />
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })
      )}
    </View>
  );
}

// =================================================================
// About tab
// =================================================================
function AboutTab({ community }: { community: any }) {
  const links = arr(community.links);
  return (
    <View>
      <View style={s.aboutCard}>
        <Text style={s.aboutHead}>About</Text>
        <Text style={s.body}>
          {community.about ||
            community.description ||
            "No description provided."}
        </Text>
      </View>

      <View style={s.aboutStats}>
        <View style={s.statItem}>
          <Text style={s.statNum}>{community._count?.members ?? 0}</Text>
          <Text style={s.statLabel}>Members</Text>
        </View>
        <View style={s.statItem}>
          <Text style={s.statNum}>{community._count?.posts ?? 0}</Text>
          <Text style={s.statLabel}>Posts</Text>
        </View>
        <View style={s.statItem}>
          <Text style={s.statNum}>
            {community.isPaid ? "Paid" : "Free"}
          </Text>
          <Text style={s.statLabel}>Access</Text>
        </View>
      </View>

      {links.length ? (
        <View style={s.aboutCard}>
          <Text style={s.aboutHead}>Links</Text>
          {links.map((l: any) => (
            <View key={l.id} style={s.linkRow}>
              <Ionicons name="link" size={15} color={colors.brand} />
              <Text style={s.linkText}>{l.title}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {community.createdBy ? (
        <Text style={s.createdBy}>
          Created by {community.createdBy?.name || "Admin"}
        </Text>
      ) : null}
    </View>
  );
}

// =================================================================
// Settings tab (moderators)
// =================================================================
function SettingsTab({
  community,
  onChange,
}: {
  community: any;
  onChange: () => void;
}) {
  const [links, setLinks] = useState<any[]>(arr(community.links));
  const [reports, setReports] = useState<any[]>([]);
  const [showLink, setShowLink] = useState(false);

  const load = useCallback(() => {
    api("/communities/" + community.id + "/links")
      .then((d: any) => setLinks(arr(d)))
      .catch(() => {});
    api("/communities/" + community.id + "/reports")
      .then((d: any) => setReports(arr(d)))
      .catch(() => setReports([]));
  }, [community.id]);

  useFocusEffect(load);

  function deleteLink(id: string) {
    api("/communities/links/" + id, { method: "DELETE" })
      .then(load)
      .catch(() => {});
  }

  function resolveReport(id: string) {
    api("/communities/reports/" + id + "/resolve", { method: "POST" })
      .then(load)
      .catch(() => {});
  }

  return (
    <View>
      <View style={s.rowBetween}>
        <Text style={s.aboutHead}>Links</Text>
        <TouchableOpacity onPress={() => setShowLink(true)} hitSlop={8}>
          <Ionicons name="add-circle" size={22} color={colors.brand} />
        </TouchableOpacity>
      </View>
      {links.length === 0 ? (
        <Text style={s.time}>No links added.</Text>
      ) : (
        links.map((l: any) => (
          <View key={l.id} style={s.linkRowEdit}>
            <Ionicons name="link" size={15} color={colors.brand} />
            <View style={s.flex1}>
              <Text style={s.linkText}>{l.title}</Text>
              <Text style={s.time} numberOfLines={1}>
                {l.url}
              </Text>
            </View>
            <TouchableOpacity onPress={() => deleteLink(l.id)} hitSlop={8}>
              <Ionicons name="trash-outline" size={17} color={colors.red} />
            </TouchableOpacity>
          </View>
        ))
      )}

      <Text style={[s.aboutHead, s.mt16]}>Reported content</Text>
      {reports.length === 0 ? (
        <Text style={s.time}>Nothing reported. 🎉</Text>
      ) : (
        reports.map((r: any) => (
          <View key={r.id} style={s.reportRow}>
            <View style={s.flex1}>
              <Text style={s.author}>{r.reason || "Reported"}</Text>
              <Text style={s.time}>
                by {r.reporter?.name || "Member"} • {r.status}
              </Text>
            </View>
            {r.status === "OPEN" ? (
              <TouchableOpacity
                style={s.resolveBtn}
                onPress={() => resolveReport(r.id)}
              >
                <Text style={s.resolveText}>Resolve</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ))
      )}

      <SimpleFormModal
        visible={showLink}
        title="Add link"
        fields={[
          { key: "title", label: "Title", required: true },
          { key: "url", label: "URL", required: true },
        ]}
        onClose={() => setShowLink(false)}
        onSubmit={async (vals) => {
          await api("/communities/" + community.id + "/links", {
            method: "POST",
            body: { title: vals.title, url: vals.url },
          });
          setShowLink(false);
          load();
          onChange();
        }}
      />
    </View>
  );
}

// =================================================================
// FAB menu + create flows
// =================================================================
function FabMenu({
  visible,
  canModerate,
  onClose,
  community,
  onDone,
}: {
  visible: boolean;
  canModerate: boolean;
  onClose: () => void;
  community: any;
  onDone: () => void;
}) {
  const [flow, setFlow] = useState<string | null>(null);

  const channels = arr(community.channels);

  const actions = [
    { key: "post", label: "Create post", icon: "create-outline" },
    ...(canModerate
      ? [
          { key: "live", label: "Go live", icon: "videocam-outline" },
          { key: "event", label: "Create event", icon: "calendar-outline" },
        ]
      : []),
  ];

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <TouchableOpacity
          style={s.fabBackdrop}
          activeOpacity={1}
          onPress={onClose}
        >
          <View style={s.fabSheet}>
            {actions.map((a) => (
              <TouchableOpacity
                key={a.key}
                style={s.fabItem}
                onPress={() => {
                  onClose();
                  setFlow(a.key);
                }}
              >
                <View style={s.fabIcon}>
                  <Ionicons
                    name={a.icon as any}
                    size={20}
                    color={colors.brand}
                  />
                </View>
                <Text style={s.fabLabel}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <SimpleFormModal
        visible={flow === "post"}
        title="Create post"
        fields={[
          { key: "title", label: "Title (optional)" },
          { key: "body", label: "Body", required: true, multiline: true },
        ]}
        onClose={() => setFlow(null)}
        onSubmit={async (vals) => {
          await api("/communities/" + community.id + "/posts", {
            method: "POST",
            body: {
              title: vals.title || undefined,
              body: vals.body,
              channelId: channels[0]?.id,
            },
          });
          setFlow(null);
          onDone();
        }}
      />

      <SimpleFormModal
        visible={flow === "live"}
        title="Go live"
        fields={[
          { key: "title", label: "Stream title", required: true },
          { key: "streamUrl", label: "Stream URL (YouTube/Vimeo)" },
        ]}
        onClose={() => setFlow(null)}
        onSubmit={async (vals) => {
          await api("/communities/" + community.id + "/live", {
            method: "POST",
            body: {
              title: vals.title,
              streamUrl: vals.streamUrl || undefined,
              provider: "youtube",
            },
          });
          setFlow(null);
          onDone();
        }}
      />

      <SimpleFormModal
        visible={flow === "event"}
        title="Create event"
        fields={[
          { key: "title", label: "Title", required: true },
          { key: "description", label: "Description", multiline: true },
          { key: "location", label: "Location" },
          { key: "startsAt", label: "Starts (YYYY-MM-DD HH:mm)" },
        ]}
        onClose={() => setFlow(null)}
        onSubmit={async (vals) => {
          const startsAt = vals.startsAt
            ? new Date(vals.startsAt.replace(" ", "T")).toISOString()
            : new Date().toISOString();
          await api("/communities/" + community.id + "/events", {
            method: "POST",
            body: {
              title: vals.title,
              description: vals.description || undefined,
              location: vals.location || undefined,
              startsAt,
            },
          });
          setFlow(null);
          onDone();
        }}
      />
    </>
  );
}

// =================================================================
// Generic form modal
// =================================================================
type FormField = {
  key: string;
  label: string;
  required?: boolean;
  multiline?: boolean;
};

function SimpleFormModal({
  visible,
  title,
  fields,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  title: string;
  fields: FormField[];
  onClose: () => void;
  onSubmit: (vals: Record<string, string>) => Promise<void>;
}) {
  const [vals, setVals] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  React.useEffect(() => {
    if (visible) {
      setVals({});
      setErr(null);
    }
  }, [visible]);

  async function go() {
    for (const f of fields) {
      if (f.required && !(vals[f.key] || "").trim()) {
        setErr(f.label + " is required.");
        return;
      }
    }
    setBusy(true);
    setErr(null);
    try {
      await onSubmit(vals);
    } catch (e: any) {
      setErr(e.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={s.modalBackdrop}>
        <View style={s.modalSheet}>
          <View style={s.modalHandleRow}>
            <View style={s.modalHandle} />
          </View>
          <View style={s.rowBetween}>
            <Text style={s.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </TouchableOpacity>
          </View>
          <ScrollView style={s.formScroll}>
            {fields.map((f) => (
              <View key={f.key} style={s.formField}>
                <Text style={s.formLabel}>{f.label}</Text>
                <TextInput
                  value={vals[f.key] || ""}
                  onChangeText={(t) =>
                    setVals((v) => ({ ...v, [f.key]: t }))
                  }
                  style={[s.formInput, f.multiline ? s.formInputMulti : null]}
                  multiline={f.multiline}
                  placeholderTextColor={colors.muted}
                />
              </View>
            ))}
            {err ? <Text style={s.formErr}>{err}</Text> : null}
          </ScrollView>
          <TouchableOpacity
            style={[s.primaryBtn, busy ? s.sendDisabled : null]}
            onPress={go}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={s.primaryBtnText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  flex1: { flex: 1 },
  mt16: { marginTop: 16 },
  mr8: { marginRight: 8 },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowCenter: { flexDirection: "row", alignItems: "center" },
  screenTitle: { fontSize: 24, fontWeight: "800", color: colors.text },
  screenSub: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 4,
    marginBottom: 12,
  },
  avatar: {
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  avatarText: { color: colors.brandDark, fontWeight: "800" },

  // Browse
  browseList: { padding: spacing.lg, paddingBottom: 32 },
  browseCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    marginBottom: 14,
  },
  browseCover: { height: 120, backgroundColor: colors.brandLight },
  browseCoverImg: { width: "100%", height: "100%" },
  browseCoverFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  browseBadges: { position: "absolute", top: 10, right: 10 },
  tag: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagGreen: { backgroundColor: "#DCFCE7" },
  tagAmber: { backgroundColor: "#FEF3C7" },
  tagText: { fontSize: 11, fontWeight: "700" },
  tagTextGreen: { color: colors.green },
  tagTextAmber: { color: colors.amber },
  browseBody: { padding: 14 },
  browseName: { fontSize: 16, fontWeight: "700", color: colors.text, flex: 1 },
  browseDesc: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 4,
    marginBottom: 10,
    lineHeight: 19,
  },
  browseMeta: { fontSize: 12, color: colors.muted },
  joinBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 64,
    alignItems: "center",
  },
  joinBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  openBtn: {
    borderWidth: 1,
    borderColor: colors.brand,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  openBtnText: { color: colors.brand, fontWeight: "700", fontSize: 13 },

  // Space
  spaceScroll: { paddingBottom: 96 },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
    paddingBottom: 6,
  },
  backText: { color: colors.brand, fontWeight: "600", marginLeft: 2 },
  banner: {
    height: 170,
    marginHorizontal: spacing.lg,
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: colors.brandLight,
  },
  bannerImg: { width: "100%", height: "100%" },
  bannerFallback: { flex: 1, backgroundColor: colors.brandLight },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  bannerContent: { position: "absolute", left: 16, bottom: 14, right: 16 },
  logoBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    overflow: "hidden",
  },
  logoImg: { width: "100%", height: "100%" },
  logoText: { color: colors.brand, fontWeight: "800", fontSize: 20 },
  bannerName: { color: "#fff", fontSize: 20, fontWeight: "800" },
  bannerMeta: { color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 2 },
  liveBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    marginHorizontal: spacing.lg,
    marginTop: 10,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.red,
    marginRight: 8,
  },
  liveText: { flex: 1, color: colors.red, fontWeight: "700", fontSize: 12 },
  liveEnd: { color: colors.red, fontWeight: "700", fontSize: 12 },
  tabBarWrap: {
    backgroundColor: colors.bg,
    paddingTop: 12,
    paddingBottom: 4,
  },
  tabBar: { paddingHorizontal: spacing.lg },
  tabContent: { paddingHorizontal: spacing.lg, paddingTop: 8 },

  // Channels
  channels: { paddingVertical: 8 },

  // Composer
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    marginBottom: 14,
  },
  composerInput: {
    flex: 1,
    color: colors.text,
    maxHeight: 100,
    paddingHorizontal: 6,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  sendDisabled: { opacity: 0.5 },

  // Post
  post: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  postHead: { flexDirection: "row", alignItems: "center" },
  author: { fontSize: 14, fontWeight: "700", color: colors.text },
  time: { fontSize: 11, color: colors.muted, marginTop: 1 },
  postTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    marginTop: 10,
  },
  body: { fontSize: 14, color: colors.text, lineHeight: 21, marginTop: 8 },
  postMedia: {
    width: "100%",
    height: 180,
    borderRadius: radius.md,
    marginTop: 10,
  },
  metaRow: { flexDirection: "row", marginTop: 12 },
  metaItem: { flexDirection: "row", alignItems: "center", marginRight: 20 },
  metaText: { fontSize: 12, color: colors.muted, marginLeft: 5 },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    maxHeight: "86%",
  },
  modalHandleRow: { alignItems: "center", marginBottom: 8 },
  modalHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  detailScroll: { marginTop: 12, marginBottom: 8 },
  commentsHead: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  comment: { flexDirection: "row", marginBottom: 10 },
  commentBubble: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: 10,
  },
  commentAuthor: { fontSize: 12, fontWeight: "700", color: colors.text },
  commentBody: { fontSize: 13, color: colors.text, marginTop: 2 },
  commentComposer: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  commentInput: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    color: colors.text,
  },

  // Course card
  courseCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    marginBottom: 10,
  },
  courseThumb: {
    width: 64,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    overflow: "hidden",
  },
  courseThumbImg: { width: "100%", height: "100%" },
  courseTitle: { fontSize: 14, fontWeight: "700", color: colors.text },

  // Buttons
  outlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: 10,
    marginBottom: 14,
  },
  outlineBtnText: { color: colors.brand, fontWeight: "700", marginLeft: 6 },
  primaryBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 8,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  // Events
  eventCard: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 10,
  },
  eventDate: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  eventDay: { fontSize: 18, fontWeight: "800", color: colors.brandDark },
  eventMonth: { fontSize: 11, fontWeight: "700", color: colors.brand },
  eventTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  eventDesc: { fontSize: 13, color: colors.muted, marginTop: 4 },

  // Leaderboard
  segment: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    marginBottom: 14,
  },
  segItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  segActive: { backgroundColor: colors.brand },
  segText: { fontSize: 13, fontWeight: "600", color: colors.muted },
  segTextActive: { color: "#fff" },
  lbRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    marginBottom: 8,
  },
  lbRank: {
    width: 24,
    textAlign: "center",
    fontWeight: "800",
    color: colors.muted,
    marginRight: 6,
  },
  lbPoints: { fontSize: 13, fontWeight: "800", color: colors.brand },

  // Members
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    marginBottom: 8,
  },

  // About
  aboutCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  aboutHead: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 6,
  },
  aboutStats: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  statItem: { flex: 1, alignItems: "center" },
  statNum: { fontSize: 18, fontWeight: "800", color: colors.text },
  statLabel: { fontSize: 12, color: colors.muted, marginTop: 2 },
  linkRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  linkText: { fontSize: 14, color: colors.text, marginLeft: 8 },
  createdBy: {
    fontSize: 12,
    color: colors.muted,
    textAlign: "center",
    marginTop: 4,
  },
  linkRowEdit: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    marginTop: 8,
  },
  reportRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    marginTop: 8,
  },
  resolveBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  resolveText: { color: "#fff", fontWeight: "700", fontSize: 12 },

  // FAB
  fab: {
    position: "absolute",
    right: 18,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  fabBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "flex-end",
  },
  fabSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 28,
  },
  fabItem: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  fabIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  fabLabel: { fontSize: 15, fontWeight: "600", color: colors.text },

  // Form modal
  formScroll: { marginTop: 12 },
  formField: { marginBottom: 12 },
  formLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 5,
  },
  formInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    backgroundColor: colors.bg,
  },
  formInputMulti: { minHeight: 90, textAlignVertical: "top" },
  formErr: { color: colors.red, fontSize: 13, marginBottom: 8 },
});
