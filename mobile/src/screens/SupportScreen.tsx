import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { api } from "../api";
import { colors, radius, spacing } from "../theme";

const CATEGORIES = [
  { key: "TECHNICAL", label: "Technical" },
  { key: "BILLING", label: "Billing / Financial" },
  { key: "BOOKS", label: "Books" },
  { key: "COURSES", label: "Courses" },
  { key: "OTHER", label: "Other" },
];

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

function catLabel(key: string) {
  const c = CATEGORIES.find((x) => x.key === key);
  return c ? c.label : key;
}

export default function SupportScreen() {
  const nav = useNavigation<any>();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("TECHNICAL");
  const [message, setMessage] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    api("/support")
      .then((d: any) => setTickets(Array.isArray(d) ? d : []))
      .catch(() => setTickets([]))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(load);

  async function submit() {
    if (subject.trim().length < 3) {
      Alert.alert(
        "Support",
        "Please enter a short subject (at least 3 characters).",
      );
      return;
    }
    if (!message.trim()) {
      Alert.alert("Support", "Please describe your issue.");
      return;
    }
    try {
      setCreating(true);
      const t: any = await api("/support", {
        method: "POST",
        body: { subject: subject.trim(), category, message: message.trim() },
      });
      setSubject("");
      setMessage("");
      setCategory("TECHNICAL");
      setShowForm(false);
      load();
      nav.navigate("SupportTicket", { id: t.id, subject: t.subject });
    } catch (e: any) {
      Alert.alert("Support", e?.message || "Could not create ticket.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <View style={s.wrap}>
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={load}
            tintColor={colors.brand}
          />
        }
      >
        <View style={s.intro}>
          <Ionicons name="chatbubbles-outline" size={22} color={colors.brand} />
          <Text style={s.introText}>
            Need help? Create a support ticket and our team will reply here.
          </Text>
        </View>

        {showForm ? (
          <View style={s.form}>
            <Text style={s.label}>Subject</Text>
            <TextInput
              style={s.input}
              placeholder="Brief title of your issue"
              placeholderTextColor={colors.muted}
              value={subject}
              onChangeText={setSubject}
            />
            <Text style={s.label}>Category</Text>
            <View style={s.chips}>
              {CATEGORIES.map((c) => {
                const on = category === c.key;
                return (
                  <TouchableOpacity
                    key={c.key}
                    style={[s.chip, on ? s.chipOn : null]}
                    onPress={() => setCategory(c.key)}
                  >
                    <Text style={[s.chipText, on ? s.chipTextOn : null]}>
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={s.label}>Message</Text>
            <TextInput
              style={[s.input, s.textarea]}
              placeholder="Describe your issue in detail"
              placeholderTextColor={colors.muted}
              value={message}
              onChangeText={setMessage}
              multiline
            />
            <TouchableOpacity
              style={s.submit}
              onPress={submit}
              disabled={creating}
            >
              <Text style={s.submitText}>
                {creating ? "Submitting" : "Submit ticket"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.cancel}
              onPress={() => setShowForm(false)}
            >
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={s.newBtn} onPress={() => setShowForm(true)}>
            <Ionicons name="add" size={18} color={colors.black} />
            <Text style={s.newText}>New support ticket</Text>
          </TouchableOpacity>
        )}

        <Text style={s.section}>Your tickets</Text>
        {loading && tickets.length === 0 ? (
          <ActivityIndicator color={colors.brand} style={s.spin} />
        ) : tickets.length === 0 ? (
          <Text style={s.empty}>You have no support tickets yet.</Text>
        ) : (
          tickets.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={s.card}
              onPress={() =>
                nav.navigate("SupportTicket", { id: t.id, subject: t.subject })
              }
            >
              <View style={s.cardTop}>
                <Text style={s.cardTitle} numberOfLines={1}>
                  {t.subject}
                </Text>
                <View style={s.badge}>
                  <Text style={s.badgeText}>
                    {STATUS_LABEL[t.status] || t.status}
                  </Text>
                </View>
              </View>
              <Text style={s.cardMeta}>
                {catLabel(t.category)}
                {"  |  "}
                {new Date(t.lastReplyAt).toLocaleDateString()}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 40 },
  intro: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.brandLight,
    borderRadius: radius.lg,
    padding: 14,
  },
  introText: { flex: 1, color: colors.text, fontSize: 13, lineHeight: 18 },
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.brand,
    borderRadius: radius.lg,
    paddingVertical: 14,
    marginTop: 16,
  },
  newText: { color: colors.black, fontWeight: "700", fontSize: 14 },
  form: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginTop: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
  },
  textarea: { minHeight: 110, textAlignVertical: "top" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  chipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontSize: 12, color: colors.text, fontWeight: "600" },
  chipTextOn: { color: colors.black },
  submit: {
    backgroundColor: colors.brand,
    borderRadius: radius.lg,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 18,
  },
  submitText: { color: colors.black, fontWeight: "700", fontSize: 14 },
  cancel: { alignItems: "center", paddingVertical: 12 },
  cancelText: { color: colors.muted, fontWeight: "600", fontSize: 13 },
  section: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.muted,
    marginTop: 24,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  spin: { marginTop: 20 },
  empty: { color: colors.muted, fontSize: 13, marginTop: 8 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.text },
  badge: {
    backgroundColor: colors.brandLight,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: { fontSize: 11, fontWeight: "700", color: colors.brand },
  cardMeta: { fontSize: 12, color: colors.muted, marginTop: 6 },
});
