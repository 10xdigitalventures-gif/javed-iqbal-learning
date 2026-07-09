import React, { useCallback, useState } from "react";
import {
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { api } from "../api";
import { useAuth } from "../auth";
import { colors, radius, spacing } from "../theme";
import { pendingActivityCount, syncActivity } from "../activity";

type Row = {
  icon: any;
  label: string;
  hint?: string;
  onPress?: () => void;
};

export default function ProfileScreen() {
  const nav = useNavigation<any>();
  const { user, logout } = useAuth();
  const [sub, setSub] = useState<any>(null);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(() => {
    api("/subscriptions/me")
      .then((d: any) => setSub(d))
      .catch(() => setSub(null));
    pendingActivityCount()
      .then(setPending)
      .catch(() => setPending(0));
  }, []);

  useFocusEffect(load);

  async function doSync() {
    try {
      setSyncing(true);
      const sent = await syncActivity();
      setPending(0);
      Alert.alert("Sync complete", sent + " activity event(s) synced.");
    } catch {
      Alert.alert("Sync", "Could not sync right now. We will retry later.");
    } finally {
      setSyncing(false);
    }
  }

  const [renewing, setRenewing] = useState(false);
  async function renewNow() {
    try {
      setRenewing(true);
      const res: any = await api("/subscriptions/me/renew", { method: "POST" });
      nav.navigate("Checkout", {
        paymentId: res.payment.id,
        title: "Renew " + (res.itemName || "subscription"),
        amount: res.payment.amount,
        currency: res.payment.currency,
      });
    } catch (e: any) {
      Alert.alert("Renew", e?.message || "Could not start renewal right now.");
    } finally {
      setRenewing(false);
    }
  }

  function confirmLogout() {
    Alert.alert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: () => logout() },
    ]);
  }

  const initials = (user?.name || "U")
    .split(" ")
    .map((w) => w.slice(0, 1))
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const isAdmin = user?.role === "ADMIN";

  const accountRows: Row[] = [
    {
      icon: "ribbon-outline",
      label: "My certificates",
      hint: "View and share certificates you've earned",
      onPress: () => nav.navigate("Certificates", {}),
    },
    {
      icon: "people-outline",
      label: "Find a consultant",
      hint: "Browse consultants and start a conversation",
      onPress: () => nav.navigate("Consultants", {}),
    },
    {
      icon: "pricetags-outline",
      label: "Message & session packages",
      hint: "Buy text, audio, video and session credits",
      onPress: () => nav.navigate("Packages", {}),
    },
    {
      icon: "calendar-outline",
      label: "My meetings",
      hint: "View and manage your booked sessions",
      onPress: () => nav.navigate("Meetings", {}),
    },
    {
      icon: "notifications-outline",
      label: "Notifications",
      hint: "Choose how you get alerts (email, SMS, WhatsApp, push)",
      onPress: () => nav.navigate("NotificationSettings", {}),
    },
    {
      icon: "phone-portrait-outline",
      label: "Devices",
      hint: "See and sign out devices logged in to your account",
      onPress: () => nav.navigate("Devices", {}),
    },
    {
      icon: "cube-outline",
      label: "Hard copy orders",
      hint: "Track your physical book deliveries",
      onPress: () => nav.navigate("HardCopyOrder", {}),
    },
    {
      icon: "cloud-offline-outline",
      label: "Offline library",
      hint: "Books stored securely on this device",
      onPress: () => nav.navigate("Tabs", { screen: "My Learning" }),
    },
    {
      icon: "sync-outline",
      label: syncing ? "Syncing…" : "Sync activity",
      hint:
        pending > 0
          ? pending + " action(s) waiting to sync"
          : "All activity is up to date",
      onPress: doSync,
    },
  ];

  return (
    <ScrollView style={s.wrap} contentContainerStyle={s.content}>
      <View style={s.header}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{initials}</Text>
        </View>
        <Text style={s.name}>{user?.name || "Reader"}</Text>
        <Text style={s.email}>{user?.email}</Text>
        <View style={s.roleBadge}>
          <Text style={s.roleText}>{user?.role || "MEMBER"}</Text>
        </View>
      </View>

      <View style={s.subCard}>
        <View style={s.subLeft}>
          <Ionicons name="star" size={20} color={colors.brand} />
          <View style={s.subInfo}>
            <Text style={s.subTitle}>
              {sub ? sub.plan?.name || "Active plan" : "No active subscription"}
            </Text>
            <Text style={s.subSub}>
              {sub
                ? sub.expiresAt
                  ? "Active until " +
                    new Date(sub.expiresAt).toLocaleDateString()
                  : "Lifetime access"
                : "Unlock all books with a plan"}
            </Text>
          </View>
        </View>
        {sub && sub.expiresAt ? (
          <TouchableOpacity
            style={s.renewBtn}
            onPress={renewNow}
            disabled={renewing}
          >
            <Ionicons name="refresh" size={15} color={colors.black} />
            <Text style={s.renewText}>
              {renewing ? "Please wait…" : "Renew"}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <TouchableOpacity
        style={s.supportCard}
        onPress={() => nav.navigate("Support", {})}
      >
        <View style={s.supportIcon}>
          <Ionicons name="chatbubbles" size={20} color={colors.brand} />
        </View>
        <View style={s.flex1}>
          <Text style={s.supportTitle}>Support chat</Text>
          <Text style={s.supportSub}>
            Open a ticket for any issue — technical, billing, books or courses
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </TouchableOpacity>

      <Text style={s.section}>Account</Text>
      <View style={s.card}>
        {accountRows.map((r, i) => (
          <TouchableOpacity
            key={r.label}
            style={[s.row, i < accountRows.length - 1 ? s.rowBorder : null]}
            onPress={r.onPress}
            disabled={!r.onPress}
          >
            <View style={s.rowIcon}>
              <Ionicons name={r.icon} size={19} color={colors.brand} />
            </View>
            <View style={s.flex1}>
              <Text style={s.rowLabel}>{r.label}</Text>
              {r.hint ? <Text style={s.rowHint}>{r.hint}</Text> : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </TouchableOpacity>
        ))}
      </View>

      {isAdmin ? (
        <>
          <Text style={s.section}>Administration</Text>
          <View style={s.card}>
            <View style={s.row}>
              <View style={s.rowIcon}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={19}
                  color={colors.brand}
                />
              </View>
              <View style={s.flex1}>
                <Text style={s.rowLabel}>Admin dashboard</Text>
                <Text style={s.rowHint}>
                  Manage books, bundles, plans, orders and analytics from the
                  web admin panel.
                </Text>
              </View>
            </View>
          </View>
        </>
      ) : null}

      <TouchableOpacity style={s.logout} onPress={confirmLogout}>
        <Ionicons name="log-out-outline" size={19} color={colors.red} />
        <Text style={s.logoutText}>Log out</Text>
      </TouchableOpacity>

      <Text style={s.version}>Prof. Dr. Javed Iqbal Learning App</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 40 },
  flex1: { flex: 1 },
  header: { alignItems: "center", paddingVertical: 12 },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 30, fontWeight: "800" },
  name: { fontSize: 20, fontWeight: "800", color: colors.text, marginTop: 12 },
  email: { fontSize: 13, color: colors.muted, marginTop: 2 },
  roleBadge: {
    backgroundColor: colors.black,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: 8,
  },
  roleText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  subCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  subLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  renewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.brand,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  renewText: { color: colors.black, fontWeight: "700", fontSize: 13 },
  subInfo: { flex: 1, marginLeft: 12 },
  subTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  subSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  supportCard: {
    backgroundColor: colors.brandLight,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.brand,
    padding: 16,
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  supportIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  supportTitle: { fontSize: 15, fontWeight: "800", color: colors.text },
  supportSub: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
    lineHeight: 16,
  },
  section: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.muted,
    marginTop: 24,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
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
  logout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    marginTop: 24,
  },
  logoutText: { color: colors.red, fontWeight: "700", marginLeft: 8 },
  version: {
    textAlign: "center",
    color: colors.muted,
    fontSize: 12,
    marginTop: 20,
  },
});
