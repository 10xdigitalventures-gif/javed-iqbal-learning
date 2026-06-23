import React from "react";
import { Image, Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "./theme";

export function formatPrice(amount?: number | null, currency = "PKR"): string {
  if (amount == null) return "";
  return currency + " " + Math.round(amount).toLocaleString();
}

export function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{title}</Text>
      {actionLabel && onAction ? (
        <TouchableOpacity onPress={onAction} hitSlop={8}>
          <Text style={s.sectionAction}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value || 0));
  return (
    <View style={s.track}>
      <View style={[s.fill, { width: (pct + "%") as any }]} />
    </View>
  );
}

export function Pill({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[s.pill, active ? s.pillActive : null]}
    >
      <Text style={[s.pillText, active ? s.pillTextActive : null]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function EmptyState({
  icon = "book-outline",
  title,
  subtitle,
}: {
  icon?: any;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}>
        <Ionicons name={icon} size={34} color={colors.brand} />
      </View>
      <Text style={s.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={s.emptySub}>{subtitle}</Text> : null}
    </View>
  );
}

export function BookCover({
  url,
  title,
  size = "md",
}: {
  url?: string | null;
  title: string;
  size?: "sm" | "md" | "lg";
}) {
  const dims =
    size === "lg"
      ? { width: 132, height: 190 }
      : size === "sm"
        ? { width: 56, height: 80 }
        : { width: 104, height: 150 };
  if (url) {
    const imgSource = { uri: url };
    return <Image source={imgSource} style={[s.cover, dims]} />;
  }
  return (
    <View style={[s.cover, s.coverFallback, dims]}>
      <Text style={s.coverFallbackText} numberOfLines={3}>
        {title}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
  sectionAction: { fontSize: 13, fontWeight: "600", color: colors.brand },
  track: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  fill: { height: 8, backgroundColor: colors.brand, borderRadius: radius.pill },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  pillActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  pillText: { fontSize: 13, fontWeight: "600", color: colors.text },
  pillTextActive: { color: "#fff" },
  empty: { alignItems: "center", paddingVertical: 48, paddingHorizontal: 24 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  emptySub: {
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 19,
  },
  cover: { borderRadius: radius.md, backgroundColor: colors.border },
  coverFallback: {
    backgroundColor: colors.black,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  coverFallbackText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
});
