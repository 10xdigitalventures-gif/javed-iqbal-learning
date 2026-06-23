import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useAuth } from "../auth";
import { Button, Field, ErrorText, styles as ui } from "../components";
import { colors } from "../theme";

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("client@example.com");
  const [password, setPassword] = useState("Password123!");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={s.wrap}>
      <View style={s.logo}>
        <Text style={s.logoText}>CH</Text>
      </View>
      <Text style={ui.title}>Consult Hub</Text>
      <Text style={ui.subtitle}>Sign in to your account</Text>
      <ErrorText message={error} />
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
      />
      <Field
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Button title={busy ? "Signing in..." : "Sign in"} onPress={submit} />
      <Text style={s.hint}>
        Demo: client@example.com / consultant@example.com {"\n"}Password123!
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: {
    padding: 24,
    paddingTop: 100,
    backgroundColor: colors.bg,
    flexGrow: 1,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  logoText: { color: "#fff", fontWeight: "800", fontSize: 20 },
  hint: {
    marginTop: 16,
    fontSize: 12,
    color: colors.muted,
    textAlign: "center",
  },
});
