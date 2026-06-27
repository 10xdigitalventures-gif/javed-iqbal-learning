import React, { useEffect, useRef, useState } from "react";
import {
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
  ScrollView,
} from "react-native";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { api } from "../api";
import { Button, Loading } from "../components";
import { colors, radius, spacing } from "../theme";
import { trackEvent } from "../activity";

type Step = "select" | "pay" | "success" | "cancel";

const GATEWAY_LABEL: Record<string, string> = {
  gopayfast: "PayFast \u2013 Card, wallet & bank (PKR)",
  whop: "Whop \u2013 Card, BNPL & Crypto (USD)",
  mock: "Test payment (sandbox)",
};

export default function CheckoutScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const paymentId: string = route.params?.paymentId;
  const title: string = route.params?.title || "your order";
  const amount: number | undefined = route.params?.amount;
  const currency: string = route.params?.currency || "PKR";
  // Legacy callers may already pass a ready checkout url; skip gateway picking.
  const presetUrl: string | undefined = route.params?.url;

  const [step, setStep] = useState<Step>(presetUrl ? "pay" : "select");
  const [payUrl, setPayUrl] = useState<string | undefined>(presetUrl);
  const [providers, setProviders] = useState<string[]>([]);
  const [gateway, setGateway] = useState<string>("");
  const [loadingProviders, setLoadingProviders] = useState(!presetUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [webLoading, setWebLoading] = useState(true);
  const handled = useRef(false);
  const webSource = payUrl ? { uri: payUrl } : undefined;

  useEffect(() => {
    if (presetUrl) return;
    api("/payments/providers")
      .then((r: any) => {
        const list: string[] = (r?.providers || []).filter(Boolean);
        setProviders(list);
        setGateway(list[0] || "");
      })
      .catch(() => setProviders([]))
      .finally(() => setLoadingProviders(false));
  }, [presetUrl]);

  async function pay() {
    try {
      setBusy(true);
      setError(null);
      const res = await api("/payments/checkout/" + paymentId, {
        method: "POST",
        body: gateway ? { gateway } : {},
      });
      setPayUrl(res.url);
      setStep("pay");
    } catch (e: any) {
      setError(e?.message || "Could not start checkout.");
    } finally {
      setBusy(false);
    }
  }

  function onNavChange(state: any) {
    const current: string = state?.url || "";
    if (handled.current) return;
    if (current.includes("/payment/success")) {
      handled.current = true;
      setStep("success");
      trackEvent("payment_success", { meta: { paymentId } });
    } else if (
      current.includes("/payment/cancel") ||
      current.includes("/payment/failure")
    ) {
      handled.current = true;
      setStep("cancel");
    }
  }

  if (step === "success") {
    return (
      <View style={s.result}>
        <View style={[s.badge, s.okBadge]}>
          <Ionicons name="checkmark" size={40} color="#fff" />
        </View>
        <Text style={s.resultTitle}>Payment successful</Text>
        <Text style={s.resultSub}>
          {title} has been unlocked and added to your library.
        </Text>
        <View style={s.actions}>
          <Button
            title="Go to My Library"
            onPress={() => nav.navigate("Tabs", { screen: "Library" })}
          />
          <View style={s.spacer} />
          <Button
            title="Back to home"
            variant="outline"
            onPress={() => nav.navigate("Tabs", { screen: "Home" })}
          />
        </View>
      </View>
    );
  }

  if (step === "cancel") {
    return (
      <View style={s.result}>
        <View style={[s.badge, s.cancelBadge]}>
          <Ionicons name="close" size={40} color="#fff" />
        </View>
        <Text style={s.resultTitle}>Payment cancelled</Text>
        <Text style={s.resultSub}>
          No charge was made. You can try again whenever you are ready.
        </Text>
        <View style={s.actions}>
          <Button title="Close" onPress={() => nav.goBack()} />
        </View>
      </View>
    );
  }

  // Gateway selection step.
  if (step === "select") {
    return (
      <ScrollView style={s.wrap} contentContainerStyle={s.selectContent}>
        <Text style={s.heading}>Checkout</Text>
        <Text style={s.itemName}>{title}</Text>
        {typeof amount === "number" ? (
          <Text style={s.amount}>
            {currency} {amount.toLocaleString()}
          </Text>
        ) : null}

        <Text style={s.sectionLabel}>Choose a payment method</Text>

        {loadingProviders ? (
          <Loading />
        ) : providers.length === 0 ? (
          <Text style={s.muted}>No payment gateway is configured yet.</Text>
        ) : (
          providers.map((g) => {
            const selected = gateway === g;
            return (
              <TouchableOpacity
                key={g}
                style={[s.gwOption, selected ? s.gwOptionActive : null]}
                activeOpacity={0.85}
                onPress={() => setGateway(g)}
              >
                <Ionicons
                  name={selected ? "radio-button-on" : "radio-button-off"}
                  size={20}
                  color={selected ? colors.brand : colors.muted}
                />
                <Text style={s.gwText}>{GATEWAY_LABEL[g] || g}</Text>
              </TouchableOpacity>
            );
          })
        )}

        {error ? <Text style={s.error}>{error}</Text> : null}

        <View style={s.payBtn}>
          <Button
            title={busy ? "Please wait..." : "Proceed to payment"}
            onPress={pay}
            disabled={busy || providers.length === 0}
          />
        </View>
        <Text style={s.secure}>Secure checkout via your selected gateway</Text>
      </ScrollView>
    );
  }

  // Payment (hosted gateway) step.
  return (
    <View style={s.wrap}>
      {webLoading ? (
        <View style={s.loadingOverlay}>
          <Loading />
        </View>
      ) : null}
      {payUrl ? (
        <WebView
          source={webSource}
          onNavigationStateChange={onNavChange}
          onLoadEnd={() => setWebLoading(false)}
          startInLoadingState
        />
      ) : null}
      <TouchableOpacity style={s.cancelBar} onPress={() => nav.goBack()}>
        <Text style={s.cancelBarText}>Cancel payment</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.card },
  selectContent: { padding: spacing.lg, paddingBottom: 32 },
  heading: { fontSize: 22, fontWeight: "800", color: colors.text },
  itemName: { fontSize: 14, color: colors.muted, marginTop: 4 },
  amount: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.brand,
    marginTop: 12,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    marginTop: 24,
    marginBottom: 10,
  },
  muted: { color: colors.muted },
  gwOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 10,
  },
  gwOptionActive: { borderColor: colors.brand, backgroundColor: colors.brandLight },
  gwText: { fontSize: 14, fontWeight: "600", color: colors.text, flex: 1 },
  error: { color: colors.red, marginTop: 8 },
  payBtn: { marginTop: 16 },
  secure: {
    fontSize: 11,
    color: colors.muted,
    textAlign: "center",
    marginTop: 12,
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
    backgroundColor: colors.bg,
  },
  cancelBar: {
    paddingVertical: 12,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelBarText: { color: colors.muted, fontWeight: "600" },
  result: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    backgroundColor: colors.bg,
  },
  badge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  okBadge: { backgroundColor: colors.green },
  cancelBadge: { backgroundColor: colors.red },
  resultTitle: { fontSize: 22, fontWeight: "800", color: colors.text },
  resultSub: {
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  actions: { alignSelf: "stretch", marginTop: 28 },
  spacer: { height: 10 },
});
