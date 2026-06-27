import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { api, uploadMedia } from "../api";
import { Button, Loading } from "../components";
import { colors, radius, spacing } from "../theme";
import { formatPrice } from "../ui";

// Wrap a uri in an object outside JSX so we never emit a brace-in-brace image
// source attribute (which the editor can mangle).
const imgSrc = (u: string) => ({ uri: u });

type BankDetails = {
  bankName: string;
  accountTitle: string;
  accountNumber: string;
  iban: string;
  instructions: string;
};

// Manual offline payment screen. The buyer transfers money to our bank account,
// uploads the receipt + transaction id, and submits it for admin verification.
// Access is granted once an admin confirms the transfer in the backend.
export default function BankTransferScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const paymentId: string = route.params?.paymentId;
  const amount: number = route.params?.amount || 0;
  const currency: string = route.params?.currency || "PKR";
  const title: string = route.params?.title || "Your order";

  const [bank, setBank] = useState<BankDetails | null>(null);
  const [loadingBank, setLoadingBank] = useState(true);
  const [proofKey, setProofKey] = useState<string | null>(null);
  const [proofUri, setProofUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [senderName, setSenderName] = useState("");
  const [senderRef, setSenderRef] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    api("/payments/bank-details")
      .then((d: any) => setBank(d))
      .catch(() => setBank(null))
      .finally(() => setLoadingBank(false));
  }, []);

  async function pickProof() {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Permission needed",
          "Please allow photo access to upload your receipt.",
        );
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
      if (res.canceled || !res.assets || !res.assets.length) return;
      const asset = res.assets[0];
      setUploading(true);
      setProofUri(asset.uri);
      const up = await uploadMedia({
        uri: asset.uri,
        name: asset.fileName || "receipt.jpg",
        type: asset.mimeType || "image/jpeg",
      });
      setProofKey(up.key);
    } catch (e: any) {
      setProofUri(null);
      Alert.alert("Upload failed", e?.message || "Could not upload the image.");
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (!proofKey && !senderRef.trim()) {
      Alert.alert(
        "Add proof",
        "Please upload your receipt or enter the transaction id.",
      );
      return;
    }
    try {
      setSubmitting(true);
      await api("/payments/" + paymentId + "/bank-transfer", {
        method: "POST",
        body: {
          proofKey: proofKey || undefined,
          senderName: senderName.trim() || undefined,
          senderRef: senderRef.trim() || undefined,
          note: note.trim() || undefined,
        },
      });
      setDone(true);
    } catch (e: any) {
      Alert.alert("Could not submit", e?.message || "Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingBank) return <Loading />;

  if (done) {
    return (
      <View style={s.doneWrap}>
        <View style={s.doneIcon}>
          <Ionicons name="checkmark-circle" size={64} color={colors.green} />
        </View>
        <Text style={s.doneTitle}>Proof submitted</Text>
        <Text style={s.doneText}>
          Thank you! We have received your bank transfer details and will verify
          them shortly. Your access activates as soon as the payment is
          confirmed — you will get a notification.
        </Text>
        <View style={s.doneBtn}>
          <Button
            title="Go to my library"
            onPress={() => nav.navigate("Tabs", { screen: "Library" })}
          />
        </View>
      </View>
    );
  }

  const rows: Array<{ label: string; value: string }> = bank
    ? [
        { label: "Bank", value: bank.bankName },
        { label: "Account title", value: bank.accountTitle },
        { label: "Account number", value: bank.accountNumber },
        { label: "IBAN", value: bank.iban },
      ]
    : [];

  return (
    <ScrollView style={s.wrap} contentContainerStyle={s.content}>
      <View style={s.bill}>
        <Text style={s.billLabel}>Amount to transfer</Text>
        <Text style={s.billAmount}>{formatPrice(amount, currency)}</Text>
        <Text style={s.billItem} numberOfLines={2}>
          {title}
        </Text>
      </View>

      <Text style={s.sectionTitle}>Send payment to</Text>
      <View style={s.card}>
        {rows.map((r, i) => (
          <View
            key={r.label}
            style={[s.row, i === rows.length - 1 ? s.rowLast : null]}
          >
            <Text style={s.rowLabel}>{r.label}</Text>
            <Text style={s.rowValue} selectable>
              {r.value}
            </Text>
          </View>
        ))}
      </View>
      <Text style={s.hint}>Tap & hold any value above to copy it.</Text>

      {bank?.instructions ? (
        <View style={s.infoBox}>
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={colors.brandDark}
          />
          <Text style={s.infoText}>{bank.instructions}</Text>
        </View>
      ) : null}

      <Text style={s.sectionTitle}>Upload receipt</Text>
      <TouchableOpacity
        style={s.upload}
        activeOpacity={0.85}
        onPress={pickProof}
        disabled={uploading}
      >
        {uploading ? (
          <ActivityIndicator color={colors.brand} />
        ) : proofUri ? (
          <Image source={imgSrc(proofUri)} style={s.preview} />
        ) : (
          <View style={s.uploadInner}>
            <Ionicons name="cloud-upload-outline" size={26} color={colors.brand} />
            <Text style={s.uploadText}>Tap to upload your transfer receipt</Text>
          </View>
        )}
      </TouchableOpacity>
      {proofKey ? (
        <Text style={s.uploadedOk}>✓ Receipt attached</Text>
      ) : null}

      <Text style={s.sectionTitle}>Transaction details</Text>
      <Text style={s.fieldLabel}>Transaction ID / reference</Text>
      <TextInput
        style={s.input}
        value={senderRef}
        onChangeText={setSenderRef}
        placeholder="e.g. TXN123456789"
        placeholderTextColor={colors.muted}
        autoCapitalize="characters"
      />
      <Text style={s.fieldLabel}>Sender account name</Text>
      <TextInput
        style={s.input}
        value={senderName}
        onChangeText={setSenderName}
        placeholder="Name on the account you paid from"
        placeholderTextColor={colors.muted}
      />
      <Text style={s.fieldLabel}>Note (optional)</Text>
      <TextInput
        style={[s.input, s.textArea]}
        value={note}
        onChangeText={setNote}
        placeholder="Anything we should know about your payment"
        placeholderTextColor={colors.muted}
        multiline
      />

      <View style={s.submit}>
        <Button
          title={submitting ? "Submitting\u2026" : "I have paid \u2014 submit proof"}
          onPress={submit}
          disabled={submitting || uploading}
        />
      </View>
      <Text style={s.foot}>
        Your purchase stays pending until our team verifies the transfer.
      </Text>
      <View style={s.footer} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 40 },
  bill: {
    backgroundColor: colors.brand,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  billLabel: { color: "#FFE9D6", fontSize: 13, fontWeight: "600" },
  billAmount: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "800",
    marginTop: 4,
  },
  billItem: { color: "#FFE9D6", fontSize: 13, marginTop: 6 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
    marginTop: 18,
    marginBottom: 8,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { color: colors.muted, fontSize: 13, flex: 1 },
  rowValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    flex: 1.4,
    textAlign: "right",
  },
  hint: { color: colors.muted, fontSize: 12, marginTop: 6 },
  infoBox: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: colors.brandLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  infoText: { color: colors.brandDark, fontSize: 13, flex: 1, lineHeight: 19 },
  upload: {
    minHeight: 130,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    overflow: "hidden",
  },
  uploadInner: { alignItems: "center", padding: spacing.lg },
  uploadText: { color: colors.muted, fontSize: 13, marginTop: 8 },
  preview: { width: "100%", height: 200 },
  uploadedOk: {
    color: colors.green,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 6,
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 10,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  textArea: { height: 90, textAlignVertical: "top" },
  submit: { marginTop: spacing.lg },
  foot: {
    color: colors.muted,
    fontSize: 12,
    textAlign: "center",
    marginTop: 10,
  },
  footer: { height: 24 },
  doneWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    backgroundColor: colors.bg,
  },
  doneIcon: { marginBottom: 12 },
  doneTitle: { fontSize: 20, fontWeight: "800", color: colors.text },
  doneText: {
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    marginTop: 10,
    lineHeight: 21,
  },
  doneBtn: { marginTop: 24, alignSelf: "stretch" },
});
