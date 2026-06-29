import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../api";

type DeviceRow = {
  id: string;
  label: string;
  platform?: string | null;
  lastSeenAt: string;
  createdAt: string;
  current: boolean;
};

function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - d);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + "m ago";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  const days = Math.floor(hrs / 24);
  return days + "d ago";
}

export default function DevicesScreen() {
  const [rows, setRows] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    try {
      const data = await api<DeviceRow[]>("/auth/devices");
      setRows(data);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not load devices");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function confirmRevoke(row: DeviceRow) {
    if (row.current) {
      Alert.alert(
        "This device",
        "This is the device you are using now. Use Log out instead.",
      );
      return;
    }
    Alert.alert(
      "Sign out device?",
      `\"${row.label}\" will be signed out. Any videos downloaded on it will be removed.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: async () => {
            setBusy(row.id);
            try {
              await api(`/auth/devices/${row.id}/revoke`, { method: "POST" });
              setRows((r) => r.filter((d) => d.id !== row.id));
            } catch (e: any) {
              Alert.alert("Error", e?.message || "Could not sign out device");
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0F766E" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={load} />
      }
    >
      <Text style={styles.intro}>
        These devices are currently signed in to your account. If you reach your
        device limit, the oldest device is signed out automatically.
      </Text>

      {rows.map((row) => {
        const ios = (row.platform || "").toLowerCase() === "ios";
        return (
          <View key={row.id} style={styles.card}>
            <View style={styles.iconWrap}>
              <Ionicons
                name={ios ? "phone-portrait-outline" : "hardware-chip-outline"}
                size={22}
                color="#0F766E"
              />
            </View>
            <View style={styles.cardBody}>
              <View style={styles.titleRow}>
                <Text style={styles.deviceLabel} numberOfLines={1}>
                  {row.label}
                </Text>
                {row.current ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>This device</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.meta}>
                Last active {timeAgo(row.lastSeenAt)}
              </Text>
            </View>
            {!row.current ? (
              <TouchableOpacity
                style={styles.revokeBtn}
                disabled={busy === row.id}
                onPress={() => confirmRevoke(row)}
              >
                {busy === row.id ? (
                  <ActivityIndicator size="small" color="#DC2626" />
                ) : (
                  <Ionicons name="log-out-outline" size={20} color="#DC2626" />
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        );
      })}

      {rows.length === 0 ? (
        <Text style={styles.empty}>No active devices.</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  content: { padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  intro: { color: "#475569", fontSize: 14, marginBottom: 16, lineHeight: 20 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#CCFBF1",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  cardBody: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center" },
  deviceLabel: { fontSize: 15, fontWeight: "600", color: "#0F172A", flexShrink: 1 },
  badge: {
    marginLeft: 8,
    backgroundColor: "#0F766E",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "600" },
  meta: { color: "#64748B", fontSize: 13, marginTop: 3 },
  revokeBtn: { padding: 8 },
  empty: { color: "#94A3B8", textAlign: "center", marginTop: 40 },
});
