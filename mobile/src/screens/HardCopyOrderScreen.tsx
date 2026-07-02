import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { api } from "../api";
import { Button, Field } from "../components";
import { formatPrice } from "../ui";
import { colors, radius, spacing } from "../theme";

// Four ways to pay for a printed copy. The first three reuse the gateways that
// already exist in the app; "Cash on Delivery" is the new manual option.
type PayMethod = { key: string; label: string; hint?: string; icon: any };
const PAY_METHODS: PayMethod[] = [
  {
    key: "payfast",
    label: "PayFast",
    hint: "Card, wallet & bank (PKR)",
    icon: "card-outline",
  },
  {
    key: "whop",
    label: "Whop",
    hint: "Card, BNPL & Crypto (USD)",
    icon: "globe-outline",
  },
  {
    key: "bank_transfer",
    label: "Bank Transfer",
    hint: "Pay to our account, share the receipt",
    icon: "business-outline",
  },
  {
    key: "cod",
    label: "Cash on Delivery",
    hint: "Pay in cash when the book arrives",
    icon: "cash-outline",
  },
];

export default function HardCopyOrderScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const bookId: string | undefined = route.params?.bookId;
  const bookTitle: string | undefined = route.params?.title;
  const unitPrice: number | null =
    typeof route.params?.price === "number" ? route.params.price : null;
  const currency: string = route.params?.currency || "PKR";

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [method, setMethod] = useState("cod");
  const [busy, setBusy] = useState(false);

  const qtyNum = Math.max(1, parseInt(quantity, 10) || 1);
  const total = unitPrice != null ? unitPrice * qtyNum : null;

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
          quantity: qtyNum,
          paymentMethod: method,
          notes:
            unitPrice != null
              ? "Quoted " +
                formatPrice(unitPrice, currency) +
                " x " +
                qtyNum +
                " = " +
                formatPrice(total || 0, currency)
              : undefined,
        },
      });
      const picked = PAY_METHODS.find((m) => m.key === method);
      const payNote =
        method === "cod"
          ? "Please keep the cash ready for delivery."
          : "Our team will contact you to confirm payment via " +
            (picked?.label || "your selected method") +
            ".";
      Alert.alert(
        "Order placed",
        "Your hard copy order has been received. " + payNote,
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
          {unitPrice != null ? (
            <Text style={s.bannerPrice}>
              {formatPrice(unitPrice, currency)} per copy
            </Text>
          ) : null}
        </View>
      ) : null}

      <Text style={s.stepLabel}>1. Your delivery details</Text>
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

      <Text style={s.stepLabel}>2. Payment method</Text>
      {PAY_METHODS.map((m) => {
        const selected = method === m.key;
        return (
          <TouchableOpacity
            key={m.key}
            style={[s.method, selected ? s.methodActive : null]}
            activeOpacity={0.85}
            onPress={() => setMethod(m.key)}
          >
            <Ionicons
              name={selected ? "radio-button-on" : "radio-button-off"}
              size={20}
              color={selected ? colors.brand : colors.muted}
            />
            <Ionicons
              name={m.icon}
              size={18}
              color={colors.brandDark}
              style={s.methodIcon}
            />
            <View style={s.methodTextWrap}>
              <Text style={s.methodLabel}>{m.label}</Text>
              {m.hint ? <Text style={s.methodHint}>{m.hint}</Text> : null}
            </View>
          </TouchableOpacity>
        );
      })}

      {total != null ? (
        <View style={s.totalRow}>
          <Text style={s.totalLabel}>Total ({qtyNum} copies)</Text>
          <Text style={s.totalValue}>{formatPrice(total, currency)}</Text>
        </View>
      ) : null}

      <Button
        title={
          busy
            ? "Placing order\u2026"
            : total != null
              ? "Place order \u2013 " + formatPrice(total, currency)
              : "Place order"
        }
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
  bannerPrice: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.brand,
    marginTop: 6,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    marginBottom: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalLabel: { fontSize: 14, color: colors.muted, fontWeight: "700" },
  totalValue: { fontSize: 18, fontWeight: "900", color: colors.text },
  stepLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
    marginTop: 8,
    marginBottom: 10,
  },
  method: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 10,
  },
  methodActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandLight,
  },
  methodIcon: { marginLeft: 10 },
  methodTextWrap: { marginLeft: 10, flex: 1 },
  methodLabel: { fontSize: 14, fontWeight: "700", color: colors.text },
  methodHint: { fontSize: 12, color: colors.muted, marginTop: 2 },
});
