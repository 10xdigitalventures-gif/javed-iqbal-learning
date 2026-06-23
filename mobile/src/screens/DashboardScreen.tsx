import React, { useEffect, useState } from "react";
import { ScrollView, Text, View, StyleSheet } from "react-native";
import { api } from "../api";
import { useAuth } from "../auth";
import { Button, Card, Loading, styles as ui } from "../components";
import { colors } from "../theme";

function remaining(r: any) {
  if (!r) return "-";
  if (r.unlimited) return "Unlimited";
  return `${r.remaining} left`;
}

export default function DashboardScreen() {
  const { user, logout } = useAuth();
  const [data, setData] = useState<any>(null);

  const isClient = user?.role === "CLIENT";
  const endpoint = isClient ? "/reports/client/me" : "/reports/consultant/me";

  useEffect(() => {
    api(endpoint)
      .then(setData)
      .catch(() => setData({ activePackages: [] }));
  }, []);

  if (!data) return <Loading />;

  return (
    <ScrollView style={s.wrap} contentContainerStyle={s.content}>
      <Text style={ui.title}>Hi, {user?.name}</Text>
      <Text style={ui.subtitle}>
        {isClient ? "Your active packages" : "Your client package usage"}
      </Text>
      {(data.activePackages || []).map((p: any, i: number) => (
        <Card key={i}>
          <Text style={s.cardTitle}>
            {p.package || p.client?.name || "Package"}
          </Text>
          <Text style={s.cardSub}>
            {isClient ? p.consultant?.name : p.client?.name}
          </Text>
          <View style={s.row}>
            <Text style={s.metric}>Text: {remaining(p.text)}</Text>
            <Text style={s.metric}>Audio: {remaining(p.audio)}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.metric}>Video: {remaining(p.video)}</Text>
            <Text style={s.metric}>Sessions: {remaining(p.sessions)}</Text>
          </View>
        </Card>
      ))}
      {(data.activePackages || []).length === 0 ? (
        <Text style={s.empty}>No active packages yet.</Text>
      ) : null}
      <View style={s.logout}>
        <Button title="Log out" variant="outline" onPress={logout} />
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16 },
  cardTitle: { fontWeight: "700", fontSize: 15, color: colors.text },
  cardSub: { color: colors.muted, fontSize: 13, marginBottom: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  metric: { fontSize: 12, color: colors.text },
  empty: { color: colors.muted, fontSize: 13 },
  logout: { marginTop: 20 },
});
