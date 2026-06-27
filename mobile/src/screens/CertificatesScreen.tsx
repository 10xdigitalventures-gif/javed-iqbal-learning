import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  Share,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api";
import { colors, radius, spacing } from "../theme";

type Certificate = {
  id: string;
  serial: string;
  issuedAt: string;
  courseId: string;
  courseTitle: string;
  verifyUrl: string;
};

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return value;
  }
}

export default function CertificatesScreen() {
  const [certs, setCerts] = useState<Certificate[] | null>(null);

  const load = useCallback(() => {
    api<Certificate[]>("/certificates/mine")
      .then(setCerts)
      .catch(() => setCerts([]));
  }, []);

  useFocusEffect(load);

  function openVerify(cert: Certificate) {
    if (cert.verifyUrl) Linking.openURL(cert.verifyUrl);
  }

  function share(cert: Certificate) {
    Share.share({
      message:
        'Verify my certificate for "' +
        cert.courseTitle +
        '": ' +
        cert.verifyUrl,
    });
  }

  if (!certs) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {certs.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="ribbon-outline" size={30} color={colors.brand} />
          </View>
          <Text style={styles.emptyTitle}>No certificates yet</Text>
          <Text style={styles.emptyHint}>
            Finish a course to earn your first certificate. It will show up here
            automatically.
          </Text>
        </View>
      ) : (
        certs.map((cert) => (
          <View key={cert.id} style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.badge}>
                <Ionicons name="ribbon" size={22} color={colors.brand} />
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {cert.courseTitle}
                </Text>
                <Text style={styles.cardMeta}>
                  Issued {formatDate(cert.issuedAt)}
                </Text>
                <Text style={styles.serial}>{cert.serial}</Text>
              </View>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => openVerify(cert)}
              >
                <Ionicons name="open-outline" size={16} color={colors.black} />
                <Text style={styles.primaryText}>Verify online</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.outlineBtn}
                onPress={() => share(cert)}
              >
                <Ionicons
                  name="share-social-outline"
                  size={16}
                  color={colors.text}
                />
                <Text style={styles.outlineText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.lg },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  empty: { alignItems: "center", paddingVertical: 48 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  emptyHint: {
    marginTop: 6,
    textAlign: "center",
    color: colors.muted,
    paddingHorizontal: 24,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  cardHead: { flexDirection: "row", gap: 12 },
  badge: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
  },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  cardMeta: { marginTop: 2, color: colors.muted, fontSize: 13 },
  serial: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 12,
    fontFamily: "monospace",
  },
  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
  primaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.brand,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  primaryText: { color: colors.black, fontWeight: "700" },
  outlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  outlineText: { color: colors.text, fontWeight: "600" },
});
