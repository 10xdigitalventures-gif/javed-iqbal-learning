import React, { useCallback, useState } from "react";
import { FlatList, Text, View, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api";
import { Badge, Button, Card, Loading, styles as ui } from "../components";
import { colors } from "../theme";

export default function CommunitiesScreen() {
  const [all, setAll] = useState<any[] | null>(null);
  const [mine, setMine] = useState<string[]>([]);

  async function load() {
    try {
      const [list, joined] = await Promise.all([
        api("/communities"),
        api("/communities/mine"),
      ]);
      setAll(list);
      setMine(joined.map((c: any) => c.id));
    } catch {
      setAll([]);
    }
  }

  useFocusEffect(
    useCallback(() => {
      load();
    }, []),
  );

  async function join(c: any) {
    await api(`/communities/${c.id}/join`, { method: "POST" });
    load();
  }

  if (!all) return <Loading />;

  return (
    <FlatList
      style={s.wrap}
      contentContainerStyle={s.content}
      data={all}
      keyExtractor={(c) => c.id}
      ListHeaderComponent={<Text style={ui.title}>Communities</Text>}
      renderItem={({ item }) => (
        <Card>
          <View style={s.head}>
            <Text style={s.name}>{item.name}</Text>
            <Badge
              text={item.isPaid ? `${item.currency} ${item.price}` : "Free"}
              color={item.isPaid ? colors.amber : colors.green}
            />
          </View>
          <Text style={s.desc}>{item.description}</Text>
          <Text style={s.meta}>{item._count?.members ?? 0} members</Text>
          <View style={s.btn}>
            {mine.includes(item.id) ? (
              <Badge text="Joined" color={colors.brand} />
            ) : (
              <Button title="Join" onPress={() => join(item)} />
            )}
          </View>
        </Card>
      )}
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
  name: { fontWeight: "700", fontSize: 15, color: colors.text },
  desc: { color: colors.muted, fontSize: 13, marginTop: 4 },
  meta: { color: colors.muted, fontSize: 12, marginTop: 4 },
  btn: { marginTop: 10, flexDirection: "row" },
});
