import React from "react";
import {
  ActivityIndicator,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "./theme";

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "outline";
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.btn,
        variant === "outline" ? styles.btnOutline : styles.btnPrimary,
        disabled ? styles.btnDisabled : null,
      ]}
    >
      <Text
        style={variant === "outline" ? styles.btnOutlineText : styles.btnText}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  secureTextEntry,
  placeholder,
  keyboardType,
}: any) {
  return (
    <View style={styles.fieldWrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        placeholder={placeholder}
        keyboardType={keyboardType}
        autoCapitalize="none"
        style={styles.input}
      />
    </View>
  );
}

export function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function Badge({
  text,
  color = colors.muted,
}: {
  text: string;
  color?: string;
}) {
  return (
    <View style={[styles.badge, { backgroundColor: color + "22" }]}>
      <Text style={[styles.badgeText, { color }]}>{text}</Text>
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.brand} size="large" />
    </View>
  );
}

export function ErrorText({ message }: { message?: string | null }) {
  if (!message) return null;
  return <Text style={styles.error}>{message}</Text>;
}

// Friendly metadata for each payment gateway key returned by /payments/providers.
const GATEWAY_META: Record<
  string,
  { label: string; sub: string; icon: any }
> = {
  gopayfast: {
    label: "PayFast",
    sub: "Cards, wallets & bank \u2022 Pakistan",
    icon: "card-outline",
  },
  payfast: {
    label: "PayFast",
    sub: "Cards, wallets & bank \u2022 Pakistan",
    icon: "card-outline",
  },
  whop: {
    label: "Whop",
    sub: "International cards & wallets",
    icon: "globe-outline",
  },
  mock: {
    label: "Test checkout",
    sub: "Development sandbox",
    icon: "flask-outline",
  },
  bank_transfer: {
    label: "Bank transfer",
    sub: "Direct deposit \u2022 manual verification",
    icon: "business-outline",
  },
};

// Bottom-sheet style picker that lets the user choose a payment gateway
// (e.g. PayFast or Whop) before a checkout session is created.
export function GatewayModal({
  visible,
  providers,
  busy,
  onPick,
  onClose,
}: {
  visible: boolean;
  providers: string[];
  busy?: boolean;
  onPick: (gateway: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={gw.backdrop}>
        <View style={gw.sheet}>
          <View style={gw.handle} />
          <Text style={gw.title}>Choose payment method</Text>
          <Text style={gw.sub}>Select how you would like to pay.</Text>
          {providers.map((p) => {
            const m =
              GATEWAY_META[p] || {
                label: p,
                sub: "",
                icon: "card-outline",
              };
            return (
              <TouchableOpacity
                key={p}
                style={gw.option}
                activeOpacity={0.85}
                disabled={busy}
                onPress={() => onPick(p)}
              >
                <View style={gw.optIcon}>
                  <Ionicons name={m.icon} size={20} color={colors.brand} />
                </View>
                <View style={gw.optBody}>
                  <Text style={gw.optLabel}>{m.label}</Text>
                  {m.sub ? <Text style={gw.optSub}>{m.sub}</Text> : null}
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.muted}
                />
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={gw.cancel}
            onPress={onClose}
            disabled={busy}
          >
            <Text style={gw.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export const styles = StyleSheet.create({
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  btnPrimary: { backgroundColor: colors.brand },
  btnOutline: { borderWidth: 1, borderColor: colors.border },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "600" },
  btnOutlineText: { color: colors.text, fontWeight: "600" },
  label: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 4,
    color: colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: "600" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  error: {
    backgroundColor: "#fee2e2",
    color: colors.red,
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  fieldWrap: { marginBottom: 12 },
  title: { fontSize: 22, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 13, color: colors.muted, marginBottom: 12 },
});

const gw = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginBottom: 14,
  },
  title: { fontSize: 18, fontWeight: "800", color: colors.text },
  sub: { fontSize: 13, color: colors.muted, marginTop: 4, marginBottom: 14 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  optIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  optBody: { flex: 1 },
  optLabel: { fontSize: 15, fontWeight: "700", color: colors.text },
  optSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  cancel: { alignItems: "center", paddingVertical: 12, marginTop: 2 },
  cancelText: { fontSize: 15, fontWeight: "600", color: colors.muted },
});
