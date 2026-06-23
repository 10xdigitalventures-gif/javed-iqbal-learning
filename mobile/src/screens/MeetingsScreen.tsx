import React, { useCallback, useState } from "react";
import { FlatList, Text, View, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Loading, styles as ui } from "../components";
import { colors } from "../theme";

const statusColor: Record<string, string> = {
  REQUESTED: colors.amber,
  APPROVED: colors.green,
  REJECTED: colors.red,
  COMPLETED: colors.brand,
  CANCELLED: colors.muted,
};

export default function MeetingsScreen() {
  const { user } = useAuth();
  const [list, setList] = useState<any[] | null>(null);
  const isConsultant = user?.role === "CONSULTANT";

  function load() {
    api("/meetings")
      .then(setList)
      .catch(() => setList([]));
  }

  useFocusEffect(
    useCallback(() => {
      load();
    }, []),
  );

  async function act(id: string, action: string) {
    await api(`/meetings/${id}/${action}`, { method: "POST" });
    load();
  }

  if (!list) return <Loading />;

  return (
    <FlatList
      style={s.wrap}
      contentContainerStyle={s.content}
      data={list}
      keyExtractor={(m) => m.id}
      ListHeaderComponent={<Text style={ui.title}>Meetings</Text>}
      ListEmptyComponent={<Text style={s.empty}>No meetings yet.</Text>}
      renderItem={({ item }) => {
        const peer = isConsultant ? item.client?.name : item.consultant?.name;
        return (
          <Card>
            <View style={s.head}>
              <Text style={s.title}>{item.title}</Text>
              <Badge text={item.status} color={statusColor[item.status]} />
            </View>
            <Text style={s.sub}>
              {peer} · {new Date(item.scheduledAt).toLocaleString()} ·{" "}
              {item.durationMin} min
            </Text>
            <View style={s.actions}>
              {isConsultant && item.status === "REQUESTED" ? (
                <>
                  <Button
                    title="Approve"
                    onPress={() => act(item.id, "approve")}
                  />
                  <Button
                    title="Reject"
                    variant="outline"
                    onPress={() => act(item.id, "reject")}
                  />
                </>
              ) : null}
              {isConsultant && item.status === "APPROVED" ? (
                <Button
                  title="Complete"
                  onPress={() => act(item.id, "complete")}
                />
              ) : null}
              {!isConsultant &&
              (item.status === "REQUESTED" || item.status === "APPROVED") ? (
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => act(item.id, "cancel")}
                />
              ) : null}
            </View>
          </Card>
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16 },
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontWeight: "700", color: colors.text },
  sub: { color: colors.muted, fontSize: 12, marginTop: 4 },
  actions: { flexDirection: "row", gap: 8, marginTop: 10 },
  empty: { color: colors.muted, marginTop: 12 },
});
