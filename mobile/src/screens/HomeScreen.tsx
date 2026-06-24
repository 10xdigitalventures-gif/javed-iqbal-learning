import React, { useCallback, useState } from "react";
import {
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { api } from "../api";
import { useAuth } from "../auth";
import { Loading } from "../components";
import { colors, radius, spacing } from "../theme";
import { brandingSource } from "../branding";
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
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [books, setBooks] = useState<any[]>([]);
  const [bundles, setBundles] = useState<any[]>([]);
  const [cont, setCont] = useState<any[]>([]);
  const [sub, setSub] = useState<any>(null);
  const [brandMode, setBrandMode] = useState<string>("picture");

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api("/books").catch(() => []),
      api("/books/bundles").catch(() => []),
      api("/library/continue").catch(() => []),
      api("/subscriptions/me").catch(() => null),
      api("/settings").catch(() => null),
    ])
      .then(([b, bn, c, s, settings]: any[]) => {
        setBooks(arr(b));
        setBundles(arr(bn));
        setCont(arr(c));
        setSub(s);
        if (settings?.brandingMode) setBrandMode(settings.brandingMode);
      })
      .finally(() => setLoading(false));
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
      <View style={s.brandRow}>
        <Image source={brandingSource(brandMode)} style={s.brandLogo} />
        <Text style={s.brandName}>Prof. Dr. Javed Iqbal</Text>
      </View>
      <Text style={s.hello}>Assalam-o-Alaikum,</Text>
      <Text style={s.name}>{user?.name || "Reader"}</Text>
      <Text style={s.tagline}>
        Continue your learning journey with Prof. Dr. Javed Iqbal.
      </Text>

      {sub ? (
        <View style={s.subBanner}>
          <View style={s.subIcon}>
            <Text style={s.subStar}>★</Text>
          </View>
          <View style={s.flex1}>
            <Text style={s.subTitle}>{sub.plan?.name || "Subscription"}</Text>
            <Text style={s.subSub}>
              {sub.expiresAt
                ? "Active until " + new Date(sub.expiresAt).toLocaleDateString()
                : "Lifetime access"}
            </Text>
          </View>
        </View>
      ) : null}

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
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
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
