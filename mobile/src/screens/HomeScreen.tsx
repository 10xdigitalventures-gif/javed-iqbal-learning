import React, { useCallback, useState } from "react";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { api } from "../api";
import { touchStreak, StreakState } from "../streak";
import { Loading } from "../components";
import { colors, radius, spacing } from "../theme";
import {
  BookCover,
  EmptyState,
  ProgressBar,
  SectionHeader,
  formatPrice,
} from "../ui";

const arr = (x: any) => (Array.isArray(x) ? x : x?.items || x?.data || []);

export default function HomeScreen() {
  const nav = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [books, setBooks] = useState<any[]>([]);
  const [bundles, setBundles] = useState<any[]>([]);
  const [cont, setCont] = useState<any[]>([]);
  const [streak, setStreak] = useState<StreakState | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api("/books").catch(() => []),
      api("/books/bundles").catch(() => []),
      api("/library/continue").catch(() => []),
    ])
      .then(([b, bn, c]: any[]) => {
        setBooks(arr(b));
        setBundles(arr(bn));
        setCont(arr(c));
      })
      .finally(() => setLoading(false));
    touchStreak()
      .then(setStreak)
      .catch(() => undefined);
  }, []);

  useFocusEffect(load);

  if (loading) return <Loading />;

  const featured = books.filter((b: any) => b.isFeatured);
  const featuredList = featured.length ? featured : books.slice(0, 6);
  const recommended = books.slice(0, 8);
  const continueItem: any = cont[0];

  const openBook = (b: any) =>
    nav.navigate("BookDetail", { idOrSlug: b.slug || b.id });

  return (
    <ScrollView style={s.wrap} contentContainerStyle={s.content}>
      <View style={s.streakCard}>
        <View style={s.streakTop}>
          <View style={s.flex1}>
            <Text style={s.streakCount}>
              {streak?.count || 1}
              <Text style={s.streakUnit}>
                {" "}
                {(streak?.count || 1) === 1 ? "day" : "days"} streak
              </Text>
            </Text>
            <Text style={s.streakSub}>
              {(streak?.count || 1) > 1
                ? "Keep it up — read a little every day!"
                : "Read today to start your streak!"}
            </Text>
          </View>
          <View style={s.streakFlame}>
            <Text style={s.streakFlameText}>🔥</Text>
          </View>
        </View>
        <View style={s.streakWeek}>
          {(
            streak?.week ||
            ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => ({
              label,
              active: false,
              today: false,
            }))
          ).map((d, i) => (
            <View key={i} style={s.streakDay}>
              <View
                style={[
                  s.streakDot,
                  d.active ? s.streakDotActive : null,
                  d.today ? s.streakDotToday : null,
                ]}
              >
                {d.active ? <Text style={s.streakTick}>✓</Text> : null}
              </View>
              <Text style={s.streakDayLabel}>{d.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {continueItem ? (
        <>
          <SectionHeader
            title="Continue reading"
            actionLabel="My Learning"
            onAction={() => nav.navigate("My Learning")}
          />
          <TouchableOpacity
            style={s.continueCard}
            activeOpacity={0.85}
            onPress={() => openBook(continueItem.book || continueItem)}
          >
            <BookCover
              url={(continueItem.book || continueItem).coverUrl}
              title={(continueItem.book || continueItem).title}
              size="sm"
            />
            <View style={s.continueBody}>
              <Text style={s.continueTitle} numberOfLines={2}>
                {(continueItem.book || continueItem).title}
              </Text>
              <Text style={s.continueMeta}>
                {Math.round(continueItem.percentComplete || 0)}% complete
              </Text>
              <ProgressBar value={continueItem.percentComplete || 0} />
            </View>
          </TouchableOpacity>
        </>
      ) : null}

      <SectionHeader
        title="Featured books"
        actionLabel="Browse"
        onAction={() => nav.navigate("Library")}
      />
      {featuredList.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.hList}
        >
          {featuredList.map((b: any) => (
            <TouchableOpacity
              key={b.id}
              style={s.bookCard}
              activeOpacity={0.85}
              onPress={() => openBook(b)}
            >
              <BookCover url={b.coverUrl} title={b.title} size="md" />
              <Text style={s.bookTitle} numberOfLines={2}>
                {b.title}
              </Text>
              <Text style={s.bookPrice}>
                {formatPrice(b.price, b.currency)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <EmptyState
          title="No books yet"
          subtitle="New titles are on the way."
        />
      )}

      {bundles.length ? (
        <>
          <SectionHeader
            title="Book bundles"
            actionLabel="See all"
            onAction={() => nav.navigate("Library")}
          />
          {bundles.slice(0, 3).map((bn: any) => (
            <TouchableOpacity
              key={bn.id}
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
                <Text style={s.bundleTitle} numberOfLines={1}>
                  {bn.title}
                </Text>
                <Text style={s.bundleMeta}>
                  {arr(bn.items).length || bn.bookCount || ""} books · save more
                </Text>
              </View>
              <Text style={s.bundlePrice}>
                {formatPrice(bn.price, bn.currency)}
              </Text>
            </TouchableOpacity>
          ))}
        </>
      ) : null}

      <SectionHeader
        title="Recommended for you"
        actionLabel="Browse"
        onAction={() => nav.navigate("Library")}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.hList}
      >
        {recommended.map((b: any) => (
          <TouchableOpacity
            key={"r" + b.id}
            style={s.bookCard}
            activeOpacity={0.85}
            onPress={() => openBook(b)}
          >
            <BookCover url={b.coverUrl} title={b.title} size="md" />
            <Text style={s.bookTitle} numberOfLines={2}>
              {b.title}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={s.footer} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 32 },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  brandLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  brandName: { fontSize: 15, fontWeight: "700", color: colors.text },
  flex1: { flex: 1 },
  streakCard: {
    backgroundColor: colors.black,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: spacing.lg,
  },
  streakTop: { flexDirection: "row", alignItems: "center" },
  streakCount: { color: "#fff", fontSize: 26, fontWeight: "900" },
  streakUnit: { color: "#fff", fontSize: 14, fontWeight: "700" },
  streakSub: { color: "#C9C9D2", fontSize: 12, marginTop: 4 },
  streakFlame: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  streakFlameText: { fontSize: 22 },
  streakWeek: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  streakDay: { alignItems: "center", flex: 1 },
  streakDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#3A3A44",
    alignItems: "center",
    justifyContent: "center",
  },
  streakDotActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  streakDotToday: { borderColor: "#fff", borderWidth: 2 },
  streakTick: { color: "#fff", fontSize: 14, fontWeight: "900" },
  streakDayLabel: { color: "#C9C9D2", fontSize: 11, marginTop: 6 },
  hello: { fontSize: 14, color: colors.muted },
  name: { fontSize: 24, fontWeight: "800", color: colors.text, marginTop: 2 },
  tagline: { fontSize: 13, color: colors.muted, marginTop: 4, lineHeight: 19 },
  subBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.black,
    borderRadius: radius.lg,
    padding: 14,
    marginTop: spacing.lg,
  },
  subIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  subStar: { color: "#fff", fontSize: 18 },
  subTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  subSub: { color: "#C9C9D2", fontSize: 12, marginTop: 2 },
  continueCard: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  continueBody: { flex: 1, marginLeft: 12, justifyContent: "center" },
  continueTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  continueMeta: { fontSize: 12, color: colors.muted, marginVertical: 6 },
  hList: { paddingVertical: 4, paddingRight: 8 },
  bookCard: { width: 120, marginRight: 12 },
  bookTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    marginTop: 8,
  },
  bookPrice: {
    fontSize: 12,
    color: colors.brand,
    fontWeight: "700",
    marginTop: 2,
  },
  bundleCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  bundleTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  bundleMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  bundlePrice: { fontSize: 15, fontWeight: "800", color: colors.brand },
  footer: { height: 24 },
});
