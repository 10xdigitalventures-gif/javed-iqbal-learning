import React, { useCallback, useState } from "react";
import {
  FlatList,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api";
import { Loading } from "../components";
import { colors, radius, spacing } from "../theme";
import { EmptyState, Pill } from "../ui";

const arr = (x: any) => (Array.isArray(x) ? x : x?.items || x?.data || []);

export default function CommunityScreen() {
  const [loading, setLoading] = useState(true);
  const [communities, setCommunities] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const loadPosts = useCallback((communityId: string) => {
    api("/communities/" + communityId + "/posts")
      .then((d: any) => setPosts(arr(d)))
      .catch(() => setPosts([]));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    api("/communities")
      .then((d: any) => {
        const list = arr(d);
        setCommunities(list);
        const first = activeId || list[0]?.id || null;
        setActiveId(first);
        if (first) loadPosts(first);
      })
      .catch(() => setCommunities([]))
      .finally(() => setLoading(false));
  }, [activeId, loadPosts]);

  useFocusEffect(load);

  function selectCommunity(id: string) {
    setActiveId(id);
    loadPosts(id);
  }

  async function submit() {
    if (!draft.trim() || !activeId) return;
    try {
      setSending(true);
      await api("/communities/" + activeId + "/posts", {
        method: "POST",
        body: { body: draft.trim() },
      });
      setDraft("");
      loadPosts(activeId);
    } catch {
    } finally {
      setSending(false);
    }
  }

  if (loading) return <Loading />;

  const header = (
    <View>
      {communities.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.groups}
        >
          {communities.map((c: any) => (
            <Pill
              key={c.id}
              label={c.name}
              active={activeId === c.id}
              onPress={() => selectCommunity(c.id)}
            />
          ))}
        </ScrollView>
      ) : null}
      <View style={s.composer}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Share something with the community…"
          placeholderTextColor={colors.muted}
          style={s.input}
          multiline
        />
        <TouchableOpacity
          style={[s.sendBtn, !draft.trim() ? s.sendDisabled : null]}
          onPress={submit}
          disabled={sending || !draft.trim()}
        >
          <Ionicons name="send" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={s.wrap}>
      <FlatList
        data={posts}
        keyExtractor={(p: any) => p.id}
        ListHeaderComponent={header}
        contentContainerStyle={s.list}
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title="No posts yet"
            subtitle="Be the first to start a conversation."
          />
        }
        renderItem={({ item: p }: { item: any }) => (
          <View style={s.post}>
            <View style={s.postHead}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>
                  {(p.author?.name || "U").slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={s.flex1}>
                <Text style={s.author}>{p.author?.name || "Member"}</Text>
                <Text style={s.time}>
                  {p.createdAt
                    ? new Date(p.createdAt).toLocaleDateString()
                    : ""}
                </Text>
              </View>
              {p.isAnnouncement ? (
                <View style={s.annPill}>
                  <Text style={s.annText}>Announcement</Text>
                </View>
              ) : null}
            </View>
            {p.title ? <Text style={s.postTitle}>{p.title}</Text> : null}
            <Text style={s.body}>{p.body || p.content}</Text>
            <View style={s.metaRow}>
              <View style={s.metaItem}>
                <Ionicons name="heart-outline" size={15} color={colors.muted} />
                <Text style={s.metaText}>
                  {p._count?.likes ?? p.likeCount ?? 0}
                </Text>
              </View>
              <View style={s.metaItem}>
                <Ionicons
                  name="chatbubble-outline"
                  size={15}
                  color={colors.muted}
                />
                <Text style={s.metaText}>
                  {p._count?.comments ?? arr(p.comments).length}
                </Text>
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  flex1: { flex: 1 },
  list: { padding: spacing.lg, paddingBottom: 32 },
  groups: { paddingBottom: 12 },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    marginBottom: 16,
  },
  input: { flex: 1, color: colors.text, maxHeight: 100, paddingHorizontal: 4 },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  sendDisabled: { backgroundColor: colors.border },
  post: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  postHead: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  avatarText: { color: colors.brandDark, fontWeight: "800" },
  author: { fontSize: 14, fontWeight: "700", color: colors.text },
  time: { fontSize: 11, color: colors.muted, marginTop: 1 },
  annPill: {
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  annText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  postTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    marginTop: 10,
  },
  body: { fontSize: 14, color: colors.text, lineHeight: 21, marginTop: 8 },
  metaRow: { flexDirection: "row", marginTop: 12 },
  metaItem: { flexDirection: "row", alignItems: "center", marginRight: 18 },
  metaText: { fontSize: 12, color: colors.muted, marginLeft: 5 },
});
