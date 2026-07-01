import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { api } from "../api";
import { colors, radius, spacing } from "../theme";
import { BookCover, EmptyState } from "../ui";

const arr = (x: any) => (Array.isArray(x) ? x : x?.items || x?.data || []);

type Result = {
  key: string;
  title: string;
  subtitle?: string;
  coverUrl?: string;
  onPress: () => void;
};

export default function SearchScreen() {
  const nav = useNavigation<any>();
  const [q, setQ] = useState("");
  const [books, setBooks] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [bundles, setBundles] = useState<any[]>([]);

  useEffect(() => {
    api("/books")
      .then((d: any) => setBooks(arr(d)))
      .catch(() => setBooks([]));
    api("/courses/offers/all")
      .then((d: any) => setOffers(arr(d)))
      .catch(() => setOffers([]));
    api("/books/bundles")
      .then((d: any) => setBundles(arr(d)))
      .catch(() => setBundles([]));
  }, []);

  const term = q.trim().toLowerCase();

  const results = useMemo<Result[]>(() => {
    if (!term) return [];
    const out: Result[] = [];
    books.forEach((b: any) => {
      const t = (b.title || "").toLowerCase();
      const a = (b.author || "").toLowerCase();
      if (t.includes(term) || a.includes(term)) {
        out.push({
          key: "b_" + b.id,
          title: b.title,
          subtitle: b.author || "E-book",
          coverUrl: b.coverUrl,
          onPress: () =>
            nav.navigate("BookDetail", { idOrSlug: b.slug || b.id }),
        });
      }
    });
    offers.forEach((o: any) => {
      const t = (o.course?.title || o.name || "").toLowerCase();
      if (t.includes(term)) {
        out.push({
          key: "c_" + o.id,
          title: o.course?.title || o.name,
          subtitle: "Course",
          coverUrl: o.course?.coverUrl,
          onPress: () =>
            nav.navigate("CourseDetail", {
              idOrSlug: o.course?.slug || o.courseId,
            }),
        });
      }
    });
    bundles.forEach((bn: any) => {
      const t = (bn.title || "").toLowerCase();
      if (t.includes(term)) {
        out.push({
          key: "bn_" + bn.id,
          title: bn.title,
          subtitle: "Bundle",
          coverUrl: bn.coverUrl,
          onPress: () =>
            nav.navigate("BookDetail", {
              idOrSlug: bn.slug || bn.id,
              type: "bundle",
            }),
        });
      }
    });
    return out;
  }, [term, books, offers, bundles]);

  return (
    <View style={s.wrap}>
      <View style={s.searchRow}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          autoFocus
          placeholder="Search books, courses, bundles"
          placeholderTextColor={colors.muted}
          style={s.search}
        />
      </View>
      <FlatList
        data={results}
        keyExtractor={(r) => r.key}
        contentContainerStyle={s.listContent}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <EmptyState
            icon="search-outline"
            title={term ? "No results" : "Search the library"}
            subtitle={
              term
                ? "Try a different keyword."
                : "Find books, courses and bundles."
            }
          />
        }
        renderItem={({ item: r }: { item: Result }) => (
          <TouchableOpacity
            style={s.row}
            activeOpacity={0.85}
            onPress={r.onPress}
          >
            <BookCover url={r.coverUrl} title={r.title} size="sm" />
            <View style={s.rowText}>
              <Text style={s.title} numberOfLines={2}>
                {r.title}
              </Text>
              <Text style={s.sub}>{r.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    margin: spacing.lg,
    paddingHorizontal: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
  },
  search: { flex: 1, paddingVertical: 10, color: colors.text },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: 32 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowText: { flex: 1 },
  title: { fontSize: 15, fontWeight: "700", color: colors.text },
  sub: { fontSize: 12, color: colors.muted, marginTop: 2 },
});
