import React, { useCallback, useState } from "react";
import { FlatList, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api";
import { useAuth } from "../auth";
import { Card, Loading, styles as ui } from "../components";
import { colors } from "../theme";

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
              <Text style={s.name}>{peer || "Conversation"}</Text>
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
  name: { fontWeight: "600", color: colors.text },
  empty: { color: colors.muted, marginTop: 12 },
});
