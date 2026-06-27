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
import { useAuth } from "../auth";
import { Card, Loading, styles as ui } from "../components";
import { colors } from "../theme";

function fmtDur(sec?: number | null) {
  const s = Math.max(0, Math.round(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ":" + r.toString().padStart(2, "0");
}

function fmtWhen(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay)
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

// Build the preview shown under each conversation name.
function previewOf(m: any): { icon?: any; text: string } {
  if (!m) return { text: "No messages yet" };
  if (m.type === "AUDIO")
    return { icon: "mic", text: "Voice message " + fmtDur(m.durationSec) };
  if (m.type === "VIDEO")
    return { icon: "videocam", text: "Video " + fmtDur(m.durationSec) };
  if (m.type === "IMAGE") return { icon: "image", text: "Photo" };
  if (m.type === "FILE")
    return { icon: "document", text: m.fileName || "File" };
  if (m.deletedAt) return { text: "Message deleted" };
  return { text: m.body || "" };
}

export default function MessagesScreen({ navigation }: any) {
  const { user } = useAuth();
  const [list, setList] = useState<any[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      api("/conversations")
        .then(setList)
        .catch(() => setList([]));
    }, []),
  );

  if (!list) return <Loading />;

  const isConsultant = user?.role === "CONSULTANT";

  return (
    <FlatList
      style={s.wrap}
      contentContainerStyle={s.content}
      data={list}
      keyExtractor={(c) => c.id}
      ListHeaderComponent={<Text style={ui.title}>Messages</Text>}
      ListEmptyComponent={<Text style={s.empty}>No conversations yet.</Text>}
      renderItem={({ item }) => {
        const peer = isConsultant ? item.client?.name : item.consultant?.name;
        const last = item.messages && item.messages[0];
        const preview = previewOf(last);
        return (
          <TouchableOpacity
            onPress={() =>
              navigation.navigate("Chat", {
                conversationId: item.id,
                peerName: peer,
              })
            }
          >
            <Card>
              <View style={s.row}>
                <Text style={s.name} numberOfLines={1}>
                  {peer || "Conversation"}
                </Text>
                <Text style={s.when}>
                  {fmtWhen(last?.createdAt || item.lastMessageAt)}
                </Text>
              </View>
              <View style={s.previewRow}>
                {preview.icon ? (
                  <Ionicons
                    name={preview.icon}
                    size={13}
                    color={colors.muted}
                    style={s.previewIcon}
                  />
                ) : null}
                <Text style={s.preview} numberOfLines={1}>
                  {preview.text}
                </Text>
              </View>
            </Card>
          </TouchableOpacity>
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  name: { fontWeight: "600", color: colors.text, flex: 1, marginRight: 8 },
  when: { color: colors.muted, fontSize: 12 },
  previewRow: { flexDirection: "row", alignItems: "center", marginTop: 3 },
  previewIcon: { marginRight: 4 },
  preview: { color: colors.muted, fontSize: 13, flex: 1 },
  empty: { color: colors.muted, marginTop: 12 },
});
