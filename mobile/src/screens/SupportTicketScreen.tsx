import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api";
import { colors, radius, spacing } from "../theme";

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export default function SupportTicketScreen({ route }: any) {
  const id = route?.params?.id as string;
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    api("/support/" + id)
      .then((d: any) => setTicket(d))
      .catch(() => setTicket(null))
      .finally(() => setLoading(false));
  }, [id]);

  useFocusEffect(load);

  const closed = ticket?.status === "RESOLVED" || ticket?.status === "CLOSED";

  async function send() {
    if (!reply.trim()) return;
    try {
      setSending(true);
      const t: any = await api("/support/" + id + "/reply", {
        method: "POST",
        body: { body: reply.trim() },
      });
      setReply("");
      setTicket(t);
    } catch (e: any) {
      Alert.alert("Support", e?.message || "Could not send your reply.");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  if (!ticket) {
    return (
      <View style={s.center}>
        <Text style={s.empty}>This ticket could not be loaded.</Text>
      </View>
    );
  }

  const messages = ticket.messages || [];

  return (
    <KeyboardAvoidingView
      style={s.wrap}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.head}>
          <Text style={s.subject}>{ticket.subject}</Text>
          <View style={s.badge}>
            <Text style={s.badgeText}>
              {STATUS_LABEL[ticket.status] || ticket.status}
            </Text>
          </View>
        </View>

        {messages.map((m: any) => {
          const staff = !!m.isStaff;
          return (
            <View
              key={m.id}
              style={[s.bubbleRow, staff ? s.rowStart : s.rowEnd]}
            >
              <View style={[s.bubble, staff ? s.bubbleStaff : s.bubbleMine]}>
                <Text style={[s.who, staff ? s.whoStaff : s.whoMine]}>
                  {staff ? "Support team" : m.sender?.name || "You"}
                </Text>
                <Text style={[s.body, staff ? s.bodyStaff : s.bodyMine]}>
                  {m.body}
                </Text>
                <Text style={[s.time, staff ? s.timeStaff : s.timeMine]}>
                  {new Date(m.createdAt).toLocaleString()}
                </Text>
              </View>
            </View>
          );
        })}

        {closed ? (
          <Text style={s.note}>
            This ticket is {STATUS_LABEL[ticket.status].toLowerCase()}. Sending
            a new message will reopen it.
          </Text>
        ) : null}
      </ScrollView>

      <View style={s.inputBar}>
        <TextInput
          style={s.input}
          placeholder="Write a reply"
          placeholderTextColor={colors.muted}
          value={reply}
          onChangeText={setReply}
          multiline
        />
        <TouchableOpacity
          style={s.sendBtn}
          onPress={send}
          disabled={sending || !reply.trim()}
        >
          <Ionicons name="send" size={18} color={colors.black} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  empty: { color: colors.muted, fontSize: 13 },
  content: { padding: spacing.lg, paddingBottom: 20 },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 14,
  },
  subject: { flex: 1, fontSize: 17, fontWeight: "800", color: colors.text },
  badge: {
    backgroundColor: colors.brandLight,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: { fontSize: 11, fontWeight: "700", color: colors.brand },
  bubbleRow: { flexDirection: "row", marginBottom: 10 },
  rowStart: { justifyContent: "flex-start" },
  rowEnd: { justifyContent: "flex-end" },
  bubble: {
    maxWidth: "86%",
    borderRadius: radius.lg,
    padding: 12,
  },
  bubbleStaff: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleMine: { backgroundColor: colors.brand },
  who: { fontSize: 11, fontWeight: "700", marginBottom: 3 },
  whoStaff: { color: colors.brand },
  whoMine: { color: colors.black },
  body: { fontSize: 14, lineHeight: 20 },
  bodyStaff: { color: colors.text },
  bodyMine: { color: colors.black },
  time: { fontSize: 10, marginTop: 5 },
  timeStaff: { color: colors.muted },
  timeMine: { color: colors.black },
  note: {
    color: colors.muted,
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: colors.text,
    fontSize: 14,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
});
