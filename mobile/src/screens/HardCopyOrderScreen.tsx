import React, { useState } from "react";
import { Alert, ScrollView, Text, View, StyleSheet } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { api } from "../api";
import { Button, Field } from "../components";
import { colors, radius, spacing } from "../theme";

export default function HardCopyOrderScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const bookId: string | undefined = route.params?.bookId;
  const bookTitle: string | undefined = route.params?.title;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim() || !phone.trim() || !address.trim() || !city.trim()) {
      Alert.alert("Missing details", "Please fill in all required fields.");
      return;
    }
    try {
      setBusy(true);
      await api("/hardcopy-orders", {
        method: "POST",
        body: {
          bookId,
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
          city: city.trim(),
          quantity: Math.max(1, parseInt(quantity, 10) || 1),
        },
      });
      Alert.alert(
        "Order placed",
        "Your hard copy order has been received. We will contact you to confirm delivery.",
        [{ text: "OK", onPress: () => nav.goBack() }],
      );
    } catch (e: any) {
      Alert.alert("Order failed", e?.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={s.wrap} contentContainerStyle={s.content}>
      {bookTitle ? (
        <View style={s.banner}>
          <Text style={s.bannerLabel}>Ordering hard copy of</Text>
          <Text style={s.bannerTitle}>{bookTitle}</Text>
        </View>
      ) : null}

      <Field
        label="Full name"
        value={name}
        onChangeText={setName}
        placeholder="Your name"
      />
      <Field
        label="Phone number"
        value={phone}
        onChangeText={setPhone}
        placeholder="03xx-xxxxxxx"
        keyboardType="phone-pad"
      />
      <Field
        label="Delivery address"
        value={address}
        onChangeText={setAddress}
        placeholder="House, street, area"
      />
      <Field
        label="City"
        value={city}
        onChangeText={setCity}
        placeholder="City"
      />
      <Field
        label="Quantity"
        value={quantity}
        onChangeText={setQuantity}
        placeholder="1"
        keyboardType="number-pad"
      />

      <View style={s.note}>
        <Text style={s.noteText}>
          Payment for hard copies is collected on delivery or confirmed by our
          team after you place the order.
        </Text>
      </View>

      <Button
        title={busy ? "Placing order…" : "Place order"}
        onPress={submit}
        disabled={busy}
      />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 32 },
  banner: {
    backgroundColor: colors.brandLight,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 16,
  },
  bannerLabel: { fontSize: 12, color: colors.brandDark },
  bannerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    marginTop: 2,
  },
  note: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 16,
  },
  noteText: { fontSize: 12, color: colors.muted, lineHeight: 18 },
});
