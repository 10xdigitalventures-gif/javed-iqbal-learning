import React, { useRef, useState } from "react";
import { Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Button, Loading } from "../components";
import { colors, radius, spacing } from "../theme";
import { trackEvent } from "../activity";

type Status = "checkout" | "success" | "cancel";

export default function CheckoutScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const url: string = route.params?.url;
  const paymentId: string = route.params?.paymentId;
  const title: string = route.params?.title || "your order";

  const [status, setStatus] = useState<Status>("checkout");
  const [loading, setLoading] = useState(true);
  const handled = useRef(false);
  const webSource = { uri: url };

  function onNavChange(state: any) {
    const current: string = state?.url || "";
    if (handled.current) return;
    if (current.includes("/payment/success")) {
      handled.current = true;
      setStatus("success");
      trackEvent("payment_success", { meta: { paymentId } });
    } else if (
      current.includes("/payment/cancel") ||
      current.includes("/payment/failure")
    ) {
      handled.current = true;
      setStatus("cancel");
    }
  }

  if (status === "success") {
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
            title="Go to My Learning"
            onPress={() => nav.navigate("Tabs", { screen: "My Learning" })}
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

  if (status === "cancel") {
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

  return (
    <View style={s.wrap}>
      {loading ? (
        <View style={s.loadingOverlay}>
          <Loading />
        </View>
      ) : null}
      <WebView
        source={webSource}
        onNavigationStateChange={onNavChange}
        onLoadEnd={() => setLoading(false)}
        startInLoadingState
      />
      <TouchableOpacity style={s.cancelBar} onPress={() => nav.goBack()}>
        <Text style={s.cancelBarText}>Cancel payment</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.card },
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
