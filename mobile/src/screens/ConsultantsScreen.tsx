import React, { useEffect, useState } from "react";
import { FlatList, Text, View, StyleSheet } from "react-native";
import { api } from "../api";
import { Button, Card, ErrorText, Loading, styles as ui } from "../components";
import { colors } from "../theme";

export default function ConsultantsScreen({ navigation }: any) {
  const [list, setList] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api("/users/consultants")
      .then(setList)
      .catch(() => setList([]));
  }, []);

  async function startChat(c: any) {
    setError(null);
    try {
      const convo = await api("/conversations", {
        method: "POST",
        body: { consultantId: c.id },
      });
      navigation.navigate("Messages");
    } catch (err: any) {
      setError(err.message);
    }
  }

  if (!list) return <Loading />;

  return (
    <FlatList
      style={s.wrap}
      contentContainerStyle={s.content}
      data={list}
      keyExtractor={(c) => c.id}
      ListHeaderComponent={
        <View>
          <Text style={ui.title}>Find consultants</Text>
          <ErrorText message={error} />
        </View>
      }
      renderItem={({ item }) => (
        <Card>
          <Text style={s.name}>{item.name}</Text>
          {item.title ? <Text style={s.title}>{item.title}</Text> : null}
          {item.bio ? <Text style={s.bio}>{item.bio}</Text> : null}
          <View style={s.btn}>
            <Button title="Message" onPress={() => startChat(item)} />
          </View>
        </Card>
      )}
    />
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16 },
  name: { fontWeight: "700", fontSize: 15, color: colors.text },
  title: { color: colors.brand, fontSize: 13 },
  bio: { color: colors.muted, fontSize: 13, marginTop: 4 },
  btn: { marginTop: 10 },
});
