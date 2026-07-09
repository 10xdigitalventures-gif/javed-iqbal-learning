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

// Four ways to pay for a printed copy. PayFast + Whop open the hosted gateway,
// Bank Transfer opens the manual proof-upload flow, and Cash on Delivery places
// the order with nothing to collect now.
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

  const [step, setStep] = useState<"details" | "pay">("details");

  // Step 1 - delivery details
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [country, setCountry] = useState("");
  const [quantity, setQuantity] = useState("1");

  // Step 2 - payment
  const [method, setMethod] = useState("cod");
  const [busy, setBusy] = useState(false);

  const qtyNum = Math.max(1, parseInt(quantity, 10) || 1);
  const total = unitPrice != null ? unitPrice * qtyNum : null;

  // Online gateways need a price; when the book has none, only COD is shown.
  const payMethods =
    total != null ? PAY_METHODS : PAY_METHODS.filter((m) => m.key === "cod");

  function goToPayment() {
    if (
      !name.trim() ||
      !email.trim() ||
      !whatsapp.trim() ||
      !address1.trim() ||
      !city.trim() ||
      !stateName.trim() ||
      !country.trim()
    ) {
      Alert.alert("Missing details", "Please fill in all the required fields.");
      return;
    }
    if (!email.includes("@")) {
      Alert.alert("Check your email", "Please enter a valid email address.");
      return;
    }
    if (total == null) setMethod("cod");
    setStep("pay");
  }

  async function placeOrder() {
    try {
      setBusy(true);
      const res: any = await api("/hardcopy-orders", {
        method: "POST",
        body: {
          bookId,
          name: name.trim(),
          phone: whatsapp.trim(),
          email: email.trim(),
          address: address1.trim(),
          addressLine2: address2.trim() || undefined,
          city: city.trim(),
          state: stateName.trim(),
          country: country.trim(),
          quantity: qtyNum,
          paymentMethod: method,
        },
      });

      if (method === "cod") {
        Alert.alert(
          "Order placed",
          "Your hard copy order has been received. Please keep the cash ready for delivery.",
          [{ text: "OK", onPress: () => nav.goBack() }],
        );
        return;
      }

      const paymentId = res?.payment?.id;
      if (!paymentId) {
        Alert.alert(
          "Order failed",
          "Could not start the payment. Please try again.",
        );
        return;
      }

      if (method === "bank_transfer") {
        nav.replace("BankTransfer", {
          paymentId,
          amount: total || 0,
          currency,
          title: bookTitle || "Hard copy order",
        });
        return;
      }

      // payfast / whop -> hosted gateway checkout.
      const gw = method === "payfast" ? "gopayfast" : "whop";
      const co: any = await api("/payments/checkout/" + paymentId, {
        method: "POST",
        body: { gateway: gw },
      });
      nav.replace("Checkout", {
        url: co?.url,
        paymentId,
        title: bookTitle || "Hard copy order",
        amount: total || 0,
        currency,
      });
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

      <View style={s.steps}>
        <View style={s.stepDot}>
          <View style={[s.dot, s.dotActive]}>
            <Text style={s.dotText}>1</Text>
          </View>
          <Text style={s.stepName}>Details</Text>
        </View>
        <View style={s.stepLine} />
        <View style={s.stepDot}>
          <View style={[s.dot, step === "pay" ? s.dotActive : null]}>
            <Text style={s.dotText}>2</Text>
          </View>
          <Text style={s.stepName}>Payment</Text>
        </View>
      </View>

      {step === "details" ? (
        <View>
          <Text style={s.stepLabel}>Delivery details</Text>
          <Field
            label="Full name"
            value={name}
            onChangeText={setName}
            placeholder="Your name"
          />
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Field
            label="WhatsApp number"
            value={whatsapp}
            onChangeText={setWhatsapp}
            placeholder="03xx-xxxxxxx"
            keyboardType="phone-pad"
          />
          <Field
            label="Address 1"
            value={address1}
            onChangeText={setAddress1}
            placeholder="Street and area"
          />
          <Field
            label="Address 2"
            value={address2}
            onChangeText={setAddress2}
            placeholder="Apartment & suite no"
          />
          <Field
            label="City"
            value={city}
            onChangeText={setCity}
            placeholder="City"
          />
          <Field
            label="State"
            value={stateName}
            onChangeText={setStateName}
            placeholder="State / province"
          />
          <Field
            label="Country"
            value={country}
            onChangeText={setCountry}
            placeholder="Country"
          />
          <Field
            label="Quantity"
            value={quantity}
            onChangeText={setQuantity}
            placeholder="1"
            keyboardType="number-pad"
          />

          {total != null ? (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Total ({qtyNum} copies)</Text>
              <Text style={s.totalValue}>{formatPrice(total, currency)}</Text>
            </View>
          ) : null}

          <Button title="Continue to payment" onPress={goToPayment} />
        </View>
      ) : (
        <View>
          <Text style={s.stepLabel}>Payment method</Text>
          {payMethods.map((m) => {
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
                ? "Please wait..."
                : method === "cod"
                  ? "Place order"
                  : total != null
                    ? "Pay " + formatPrice(total, currency)
                    : "Continue"
            }
            onPress={placeOrder}
            disabled={busy}
          />
          <TouchableOpacity
            style={s.backLink}
            onPress={() => setStep("details")}
            disabled={busy}
          >
            <Text style={s.backText}>Back to delivery details</Text>
          </TouchableOpacity>
        </View>
      )}
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
  steps: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  stepDot: { alignItems: "center", width: 90 },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.border,
  },
  dotActive: { backgroundColor: colors.brand },
  dotText: { color: "#FFFFFF", fontWeight: "800", fontSize: 13 },
  stepName: { fontSize: 12, color: colors.muted, marginTop: 4 },
  stepLine: {
    height: 2,
    width: 40,
    backgroundColor: colors.border,
    marginBottom: 18,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    marginBottom: 4,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalLabel: { fontSize: 14, color: colors.muted, fontWeight: "700" },
  totalValue: { fontSize: 18, fontWeight: "900", color: colors.text },
  stepLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
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
  backLink: { alignItems: "center", paddingVertical: 14 },
  backText: { color: colors.muted, fontWeight: "600", fontSize: 13 },
});
