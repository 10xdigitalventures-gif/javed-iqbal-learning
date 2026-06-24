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
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { api } from "../api";
import { Loading } from "../components";
import { colors, radius, spacing } from "../theme";
import { BookCover, EmptyState, Pill, formatPrice } from "../ui";

const arr = (x: any) => (Array.isArray(x) ? x : x?.items || x?.data || []);
const isAudio = (b: any) =>
  (b?.category?.name || b?.categoryName || "").toLowerCase().includes("audio");

// Top-level Explore categories. "browse" categories render the catalog with a
// Single / Bundle sub-toggle; "link" categories jump to their dedicated screen.
type Cat = {
  key: string;
  label: string;
  icon: string;
  kind: "browse" | "link";
  route?: string;
};

const CATEGORIES: Cat[] = [
  { key: "books", label: "Books", icon: "book", kind: "browse" },
  { key: "ebooks", label: "E-Books", icon: "tablet-portrait", kind: "browse" },
  { key: "audio", label: "Audio Books", icon: "headset", kind: "browse" },
  { key: "courses", label: "Courses", icon: "school", kind: "link", route: "Courses" },
  { key: "community", label: "Community", icon: "people", kind: "link", route: "Community" },
  { key: "messaging", label: "Messaging", icon: "chatbubbles", kind: "link", route: "Messages" },
];

export default function ExploreScreen() {
  const nav = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState("books");
  const [sub, setSub] = useState<"single" | "bundle">("single");
  const [books, setBooks] = useState<any[]>([]);
  const [bundles, setBundles] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [catFilter, setCatFilter] = useState<string | null>(null);
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

  function onCategory(c: Cat) {
    if (c.kind === "link" && c.route) {
      nav.navigate(c.route as never);
      return;
    }
    setCat(c.key);
    setCatFilter(null);
    setQ("");
  }

  if (loading) return <Loading />;

  const term = q.trim().toLowerCase();
  // Books / E-Books => non-audio catalog. Audio Books => audio catalog.
  const base = books.filter((b: any) => (cat === "audio" ? isAudio(b) : !isAudio(b)));
  const filteredBooks = base.filter((b: any) => {
    const catOk = !catFilter || b.categoryId === catFilter || b.category?.id === catFilter;
    const qOk =
      !term ||
      (b.title || "").toLowerCase().includes(term) ||
      (b.author || "").toLowerCase().includes(term);
    return catOk && qOk;
  });

  const activeCat = CATEGORIES.find((c) => c.key === cat)!;

  const renderBook = ({ item: b }: { item: any }) => (
    <TouchableOpacity
      style={s.gridItem}
      activeOpacity={0.85}
      onPress={() => nav.navigate("BookDetail", { idOrSlug: b.slug || b.id })}
    >
      <View>
        <BookCover url={b.coverUrl} title={b.title} size="md" />
        {cat === "audio" ? (
          <View style={s.audioTag}>
            <Ionicons name="headset" size={12} color="#fff" />
          </View>
        ) : null}
      </View>
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
      {/* Category bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.catBar}
        contentContainerStyle={s.catBarContent}
      >
        {CATEGORIES.map((c) => {
          const active = c.kind === "browse" && c.key === cat;
          return (
            <TouchableOpacity
              key={c.key}
              style={[s.catChip, active ? s.catChipActive : null]}
              activeOpacity={0.85}
              onPress={() => onCategory(c)}
            >
              <Ionicons
                name={(active ? c.icon : c.icon + "-outline") as any}
                size={16}
                color={active ? "#fff" : colors.brand}
                style={s.catChipIcon}
              />
              <Text style={[s.catChipText, active ? s.catChipTextActive : null]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Single / Bundle sub-categories */}
      <View style={s.subTabs}>
        <Pill
          label="Single"
          active={sub === "single"}
          onPress={() => setSub("single")}
        />
        <Pill
          label="Bundle"
          active={sub === "bundle"}
          onPress={() => setSub("bundle")}
        />
      </View>

      {sub === "single" ? (
        <>
          <View style={s.searchRow}>
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder={`Search ${activeCat.label.toLowerCase()}`}
              placeholderTextColor={colors.muted}
              style={s.search}
            />
          </View>
          {cats.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.filterBar}
              contentContainerStyle={s.filterContent}
            >
              <Pill
                label="All"
                active={!catFilter}
                onPress={() => setCatFilter(null)}
              />
              {cats.map((c: any) => (
                <Pill
                  key={c.id}
                  label={c.name}
                  active={catFilter === c.id}
                  onPress={() => setCatFilter(c.id)}
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
                icon={cat === "audio" ? "headset-outline" : "book-outline"}
                title={`No ${activeCat.label.toLowerCase()} found`}
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
  catBar: { maxHeight: 56, marginTop: 8 },
  catBarContent: { paddingHorizontal: spacing.lg, paddingVertical: 8 },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  catChipIcon: { marginRight: 6 },
  catChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  catChipText: { fontSize: 13, fontWeight: "700", color: colors.brand },
  catChipTextActive: { color: "#fff" },
  subTabs: { flexDirection: "row", paddingHorizontal: spacing.lg, paddingTop: 4 },
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
  filterBar: { maxHeight: 48, marginTop: 4 },
  filterContent: { paddingHorizontal: spacing.lg, paddingVertical: 8 },
  listContent: { padding: spacing.lg, paddingBottom: 32 },
  col: { justifyContent: "space-between" },
  gridItem: { width: "48%", marginBottom: 18 },
  audioTag: {
    position: "absolute",
    right: 8,
    bottom: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
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
  bundleMeta: { fontSize: 13, color: colors.muted, marginTop: 4, lineHeight: 18 },
  bundleCount: { fontSize: 12, color: colors.brand, fontWeight: "600", marginTop: 6 },
  bundlePrice: { fontSize: 16, fontWeight: "800", color: colors.brand, marginLeft: 12 },
});
