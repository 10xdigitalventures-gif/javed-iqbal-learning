import React, { useEffect, useState } from "react";
import { FlatList, Linking, Text, View, StyleSheet } from "react-native";
import { api } from "../api";
import {
  Badge,
  Button,
  Card,
  ErrorText,
  Loading,
  styles as ui,
} from "../components";
import { colors } from "../theme";

export default function PackagesScreen() {
  const [list, setList] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api("/packages")
      .then(setList)
      .catch(() => setList([]));
  }, []);

  async function buy(pkg: any) {
    setError(null);
    setBusy(pkg.id);
    try {
      const res = await api("/purchases", {
        method: "POST",
        body: { packageId: pkg.id },
      });
      const checkout = await api(`/payments/checkout/${res.payment.id}`, {
        method: "POST",
      });
      Linking.openURL(checkout.url);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  if (!list) return <Loading />;

  return (
    <FlatList
      style={s.wrap}
      contentContainerStyle={s.content}
      data={list}
      keyExtractor={(p) => p.id}
      ListHeaderComponent={
        <View>
          <Text style={ui.title}>Packages</Text>
          <ErrorText message={error} />
        </View>
      }
      renderItem={({ item }) => (
        <Card>
          <View style={s.head}>
            <Text style={s.name}>{item.name}</Text>
            <Badge text={item.type} color={colors.brand} />
          </View>
          <Text style={s.desc}>{item.description}</Text>
          <Text style={s.price}>
            {item.currency} {Number(item.price).toLocaleString()}
          </Text>
          <Text style={s.limits}>
            Text: {item.textLimit ?? "Unlimited"} · Audio:{" "}
            {item.audioLimit ?? "Unlimited"} · Video:{" "}
            {item.videoLimit ?? "Unlimited"} · Sessions:{" "}
            {item.sessionLimit ?? "Unlimited"}
          </Text>
          <View style={s.btn}>
            <Button
              title={busy === item.id ? "Starting..." : "Buy now"}
              onPress={() => buy(item)}
              disabled={busy === item.id}
            />
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
  price: { color: colors.brand, fontWeight: "800", fontSize: 20, marginTop: 8 },
  limits: { color: colors.text, fontSize: 12, marginTop: 6 },
  btn: { marginTop: 10 },
});
