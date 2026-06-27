import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api";
import { colors, radius, spacing } from "../theme";

type Pref = {
  inApp: boolean;
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  push: boolean;
  mutedTypes: string[];
};

type ChannelKey = "inApp" | "email" | "sms" | "whatsapp" | "push";

const CHANNELS: Array<{
  key: ChannelKey;
  icon: any;
  label: string;
  hint: string;
}> = [
  {
    key: "inApp",
    icon: "notifications-outline",
    label: "In-app",
    hint: "Alerts inside the app",
  },
  {
    key: "push",
    icon: "phone-portrait-outline",
    label: "Push",
    hint: "Mobile push notifications",
  },
  {
    key: "email",
    icon: "mail-outline",
    label: "Email",
    hint: "Important updates by email",
  },
  {
    key: "sms",
    icon: "chatbox-outline",
    label: "SMS",
    hint: "Text messages to your phone",
  },
  {
    key: "whatsapp",
    icon: "logo-whatsapp",
    label: "WhatsApp",
    hint: "Messages to your WhatsApp",
  },
];

// Precomputed objects so we never emit inline object literals in JSX props.
const SWITCH_TRACK = { false: colors.border, true: colors.brand };

export default function NotificationSettingsScreen() {
  const [pref, setPref] = useState<Pref | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api<Pref>("/notifications/preferences")
      .then((p) =>
        setPref({
          inApp: p.inApp,
          email: p.email,
          sms: p.sms,
          whatsapp: p.whatsapp,
          push: p.push,
          mutedTypes: p.mutedTypes || [],
        }),
      )
      .catch(() =>
        setPref({
          inApp: true,
          email: true,
          sms: false,
          whatsapp: false,
          push: true,
          mutedTypes: [],
        }),
      );
  }, []);

  useFocusEffect(load);

  async function toggle(key: ChannelKey) {
    if (!pref) return;
    const next = { ...pref, [key]: !pref[key] };
    setPref(next);
    setSaving(true);
    try {
      await api("/notifications/preferences", {
        method: "PATCH",
        body: { [key]: next[key] },
      });
    } catch {
      // Revert on failure.
      setPref(pref);
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    try {
      await api("/notifications/test", { method: "POST" });
      Alert.alert(
        "Test sent",
        "Check the channels you enabled. SMS / WhatsApp / email run in mock mode until the server is configured.",
      );
    } catch {
      Alert.alert("Test", "Could not send the test notification right now.");
    }
  }

  if (!pref) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return (
    <ScrollView style={s.wrap} contentContainerStyle={s.content}>
      <Text style={s.intro}>
        Choose how you want to be notified. SMS and WhatsApp use the phone
        number on your account.
      </Text>

      <View style={s.card}>
        {CHANNELS.map((c, i) => (
          <View
            key={c.key}
            style={[s.row, i < CHANNELS.length - 1 ? s.rowBorder : null]}
          >
            <View style={s.rowIcon}>
              <Ionicons name={c.icon} size={19} color={colors.brand} />
            </View>
            <View style={s.flex1}>
              <Text style={s.rowLabel}>{c.label}</Text>
              <Text style={s.rowHint}>{c.hint}</Text>
            </View>
            <Switch
              value={pref[c.key]}
              onValueChange={() => toggle(c.key)}
              trackColor={SWITCH_TRACK}
              thumbColor="#fff"
            />
          </View>
        ))}
      </View>

      <TouchableOpacity style={s.testBtn} onPress={sendTest}>
        <Ionicons name="paper-plane-outline" size={18} color="#fff" />
        <Text style={s.testText}>Send test notification</Text>
      </TouchableOpacity>

      <Text style={s.saved}>
        {saving ? "Saving…" : "Changes save automatically"}
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 40 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  flex1: { flex: 1 },
  intro: {
    fontSize: 13,
    color: colors.muted,
    marginBottom: 16,
    lineHeight: 19,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  row: { flexDirection: "row", alignItems: "center", padding: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  rowLabel: { fontSize: 14, fontWeight: "600", color: colors.text },
  rowHint: { fontSize: 12, color: colors.muted, marginTop: 2 },
  testBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand,
    borderRadius: radius.lg,
    paddingVertical: 14,
    marginTop: 20,
  },
  testText: { color: "#fff", fontWeight: "700", marginLeft: 8 },
  saved: {
    textAlign: "center",
    color: colors.muted,
    fontSize: 12,
    marginTop: 16,
  },
});
