import React, { useCallback, useState } from "react";
import {
  FlatList,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api";
import { Loading } from "../components";
import { colors, radius, spacing } from "../theme";
import { EmptyState } from "../ui";

function fmtWhen(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay)
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// In-app notification inbox. Every notification created after install is saved
// server-side, so this list shows the full history and lets the user mark items
// as read.
export default function NotificationsScreen() {
  const [list, setList] = useState<any[] | null>(null);

  const load = useCallback(() => {
    api("/notifications")
      .then((r: any) => setList(Array.isArray(r) ? r : r?.items || []))
      .catch(() => setList([]));
  }, []);

  useFocusEffect(load);

  async function markAll() {
    try {
      await api("/notifications/read-all", { method: "POST" });
    } catch {
      // best-effort
    }
    setList((prev) => (prev || []).map((n) => ({ ...n, read: true })));
  }

  async function openItem(item: any) {
    if (item.read) return;
    try {
      await api("/notifications/" + item.id + "/read", { method: "POST" });
    } catch {
      // best-effort
    }
    setList((prev) =>
      (prev || []).map((n) => (n.id === item.id ? { ...n, read: true } : n)),
    );
  }

  if (!list) return <Loading />;

  const hasUnread = list.some((n) => !n.read);

  return (
    <FlatList
      style={s.wrap}
      contentContainerStyle={s.content}
      data={list}
      keyExtractor={(n) => n.id}
      ListHeaderComponent={
        hasUnread ? (
          <TouchableOpacity
            style={s.markAll}
            onPress={markAll}
            activeOpacity={0.7}
          >
            <Ionicons name="checkmark-done" size={16} color={colors.brand} />
            <Text style={s.markAllText}>Mark all as read</Text>
          </TouchableOpacity>
        ) : null
      }
      ListEmptyComponent={
        <EmptyState
          icon="notifications-outline"
          title="No notifications yet"
          subtitle="Updates and announcements will appear here."
        />
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => openItem(item)}
          style={[s.card, !item.read ? s.cardUnread : null]}
        >
          <View style={s.iconWrap}>
            <Ionicons name="notifications" size={16} color={colors.brand} />
          </View>
          <View style={s.flex1}>
            <Text style={s.title} numberOfLines={2}>
              {item.title}
            </Text>
            {item.body ? (
              <Text style={s.body} numberOfLines={4}>
                {item.body}
              </Text>
            ) : null}
            <Text style={s.when}>{fmtWhen(item.createdAt)}</Text>
          </View>
          {!item.read ? <View style={s.dot} /> : null}
        </TouchableOpacity>
      )}
    />
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 32 },
  flex1: { flex: 1 },
  markAll: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    marginBottom: 10,
  },
  markAllText: {
    color: colors.brand,
    fontWeight: "700",
    fontSize: 13,
    marginLeft: 6,
  },
  card: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  cardUnread: { borderColor: colors.brand, backgroundColor: "#FFF7F0" },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFF1E6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  title: { fontSize: 15, fontWeight: "700", color: colors.text },
  body: { fontSize: 13, color: colors.muted, marginTop: 3, lineHeight: 18 },
  when: { fontSize: 11, color: colors.muted, marginTop: 6 },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.brand,
    marginLeft: 8,
    marginTop: 4,
  },
});
