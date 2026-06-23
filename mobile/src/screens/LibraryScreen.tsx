import React, { useCallback, useState } from "react";
import {
  FlatList,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { api } from "../api";
import { Loading } from "../components";
import { colors, radius, spacing } from "../theme";
import { BookCover, EmptyState, Pill, formatPrice } from "../ui";

const arr = (x: any) => (Array.isArray(x) ? x : x?.items || x?.data || []);

export default function LibraryScreen() {
  const nav = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"books" | "bundles">("books");
  const [books, setBooks] = useState<any[]>([]);
  const [bundles, setBundles] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [cat, setCat] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api("/books").catch(() => []),
      api("/books/bundles").catch(() => []),
      api("/categories").catch(() => []),
    ])
      .then(([b, bn, c]) => {
        setBooks(arr(b));
        setBundles(arr(bn));
        setCats(arr(c));
      })
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(load);

  if (loading) return <Loading />;

  const term = q.trim().toLowerCase();
  const filteredBooks = books.filter((b: any) => {
    const catOk = !cat || b.categoryId === cat || b.category?.id === cat;
    const qOk =
      !term ||
      (b.title || "").toLowerCase().includes(term) ||
      (b.author || "").toLowerCase().includes(term);
    return catOk && qOk;
  });

  const renderBook = ({ item: b }: { item: any }) => (
    <TouchableOpacity
      style={s.gridItem}
      activeOpacity={0.85}
      onPress={() => nav.navigate("BookDetail", { idOrSlug: b.slug || b.id })}
    >
      <BookCover url={b.coverUrl} title={b.title} size="md" />
      <Text style={s.title} numberOfLines={2}>
        {b.title}
      </Text>
      <Text style={s.author} numberOfLines={1}>
        {b.author || "Prof. Dr. Javed Iqbal"}
      </Text>
      <Text style={s.price}>{formatPrice(b.price, b.currency)}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={s.wrap}>
      <View style={s.searchRow}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search books and authors"
          placeholderTextColor={colors.muted}
          style={s.search}
        />
      </View>

      <View style={s.tabs}>
        <Pill
          label="Books"
          active={tab === "books"}
          onPress={() => setTab("books")}
        />
        <Pill
          label="Bundles"
          active={tab === "bundles"}
          onPress={() => setTab("bundles")}
        />
      </View>

      {tab === "books" ? (
        <>
          {cats.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.catBar}
              contentContainerStyle={s.catContent}
            >
              <Pill label="All" active={!cat} onPress={() => setCat(null)} />
              {cats.map((c: any) => (
                <Pill
                  key={c.id}
                  label={c.name}
                  active={cat === c.id}
                  onPress={() => setCat(c.id)}
                />
              ))}
            </ScrollView>
          ) : null}
          <FlatList
            data={filteredBooks}
            keyExtractor={(b: any) => b.id}
            renderItem={renderBook}
            numColumns={2}
            columnWrapperStyle={s.col}
            contentContainerStyle={s.listContent}
            ListEmptyComponent={
              <EmptyState
                title="No books found"
                subtitle="Try a different search or category."
              />
            }
          />
        </>
      ) : (
        <FlatList
          data={bundles}
          keyExtractor={(b: any) => b.id}
          contentContainerStyle={s.listContent}
          ListEmptyComponent={
            <EmptyState
              icon="albums-outline"
              title="No bundles yet"
              subtitle="Curated collections are coming soon."
            />
          }
          renderItem={({ item: bn }: { item: any }) => (
            <TouchableOpacity
              style={s.bundleCard}
              activeOpacity={0.85}
              onPress={() =>
                nav.navigate("BookDetail", {
                  idOrSlug: bn.slug || bn.id,
                  type: "bundle",
                })
              }
            >
              <View style={s.flex1}>
                <Text style={s.bundleTitle}>{bn.title}</Text>
                <Text style={s.bundleMeta} numberOfLines={2}>
                  {bn.description || "Book bundle"}
                </Text>
                <Text style={s.bundleCount}>
                  {arr(bn.items).length || bn.bookCount || ""} books included
                </Text>
              </View>
              <Text style={s.bundlePrice}>
                {formatPrice(bn.price, bn.currency)}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  flex1: { flex: 1 },
  searchRow: { paddingHorizontal: spacing.lg, paddingTop: 12 },
  search: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: colors.text,
  },
  tabs: { flexDirection: "row", paddingHorizontal: spacing.lg, paddingTop: 12 },
  catBar: { maxHeight: 48, marginTop: 4 },
  catContent: { paddingHorizontal: spacing.lg, paddingVertical: 8 },
  listContent: { padding: spacing.lg, paddingBottom: 32 },
  col: { justifyContent: "space-between" },
  gridItem: { width: "48%", marginBottom: 18 },
  title: { fontSize: 14, fontWeight: "700", color: colors.text, marginTop: 8 },
  author: { fontSize: 12, color: colors.muted, marginTop: 2 },
  price: { fontSize: 13, fontWeight: "700", color: colors.brand, marginTop: 4 },
  bundleCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  bundleTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  bundleMeta: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 4,
    lineHeight: 18,
  },
  bundleCount: {
    fontSize: 12,
    color: colors.brand,
    fontWeight: "600",
    marginTop: 6,
  },
  bundlePrice: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.brand,
    marginLeft: 12,
  },
});
