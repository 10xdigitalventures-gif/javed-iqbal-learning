import React, { useCallback, useState } from "react";
import {
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import { api } from "../api";
import { Button, GatewayModal, Loading } from "../components";
import { colors, radius, spacing } from "../theme";
import { BookCover, formatPrice } from "../ui";
import { trackEvent } from "../activity";

const arr = (x: any) => (Array.isArray(x) ? x : x?.items || x?.data || []);

export default function BookDetailScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const idOrSlug: string = route.params?.idOrSlug;
  const type: string = route.params?.type || "book";
  const isBundle = type === "bundle";

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [item, setItem] = useState<any>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [gwVisible, setGwVisible] = useState(false);
  const [providers, setProviders] = useState<string[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    const path = isBundle ? "/books/bundles/" + idOrSlug : "/books/" + idOrSlug;
    api(path)
      .then(async (data: any) => {
        setItem(data);
        if (!isBundle && data?.id) {
          const res = await api("/library/access/" + data.id).catch(() => ({
            hasAccess: false,
          }));
          setHasAccess(!!res?.hasAccess);
          trackEvent("book_viewed", { bookId: data.id });
        }
      })
      .finally(() => setLoading(false));
  }, [idOrSlug, isBundle]);

  useFocusEffect(load);

  if (loading) return <Loading />;
  if (!item)
    return (
      <View style={s.center}>
        <Text style={s.muted}>This item is unavailable.</Text>
      </View>
    );

  // Step 1 \u2013 figure out which gateways are available. If more than one is
  // enabled (e.g. PayFast + Whop) we ask the user to choose; otherwise we go
  // straight to checkout with the only option.
  async function buy() {
    try {
      setBusy(true);
      const res = await api("/payments/providers").catch(() => ({
        providers: [],
      }));
      const list: string[] = (res?.providers || []).filter(Boolean);
      if (list.length > 1) {
        setProviders(list);
        setGwVisible(true);
        setBusy(false);
        return;
      }
      await proceed(list[0]);
    } catch (e: any) {
      Alert.alert("Checkout", e?.message || "Could not start checkout.");
      setBusy(false);
    }
  }

  // Step 2 \u2013 create the order + payment, record the chosen gateway, and open
  // the hosted checkout in the in-app WebView.
  async function proceed(gateway?: string) {
    try {
      setBusy(true);
      setGwVisible(false);
      const body: any = { kind: isBundle ? "BUNDLE" : "BOOK" };
      if (isBundle) body.bundleId = item.id;
      else body.bookId = item.id;
      const order = await api("/orders", { method: "POST", body });
      // Manual bank transfer has no hosted checkout: send the buyer to the
      // dedicated screen to upload proof for admin verification.
      if (gateway === "bank_transfer") {
        nav.navigate("BankTransfer", {
          paymentId: order.payment.id,
          amount: order.payment.amount,
          currency: order.payment.currency,
          title: item.title,
        });
        return;
      }
      const pay = await api("/payments/checkout/" + order.payment.id, {
        method: "POST",
        body: gateway ? { gateway } : {},
      });
      nav.navigate("Checkout", {
        url: pay.url,
        paymentId: order.payment.id,
        title: item.title,
      });
    } catch (e: any) {
      Alert.alert("Checkout", e?.message || "Could not start checkout.");
    } finally {
      setBusy(false);
    }
  }

  function read() {
    nav.navigate("Reader", { bookId: item.id, title: item.title });
  }

  function preview() {
    nav.navigate("Reader", {
      bookId: item.id,
      title: item.title,
      preview: true,
    });
  }

  const bundleBooks = isBundle
    ? arr(item.items).map((it: any) => it.book || it)
    : [];

  return (
    <ScrollView style={s.wrap} contentContainerStyle={s.content}>
      <View style={s.hero}>
        <BookCover url={item.coverUrl} title={item.title} size="lg" />
        <View style={s.heroInfo}>
          <Text style={s.title}>{item.title}</Text>
          <Text style={s.author}>{item.author || "Prof. Dr. Javed Iqbal"}</Text>
          {item.category?.name ? (
            <View style={s.catPill}>
              <Text style={s.catText}>{item.category.name}</Text>
            </View>
          ) : null}
          <Text style={s.price}>{formatPrice(item.price, item.currency)}</Text>
        </View>
      </View>

      {hasAccess ? (
        <View style={s.ownedBadge}>
          <Text style={s.ownedText}>\u2713 In your library</Text>
        </View>
      ) : null}

      <View style={s.actions}>
        {hasAccess ? (
          <Button title="Read now" onPress={read} />
        ) : (
          <Button
            title={
              busy
                ? "Please wait\u2026"
                : "Buy " + formatPrice(item.price, item.currency)
            }
            onPress={buy}
            disabled={busy}
          />
        )}
        {!isBundle ? (
          <View style={s.secondaryRow}>
            <View style={s.flex1}>
              <Button title="Preview" variant="outline" onPress={preview} />
            </View>
            {item.allowHardCopy ? (
              <View style={s.gap}>
                <View style={s.flex1}>
                  <Button
                    title="Hard copy"
                    variant="outline"
                    onPress={() =>
                      nav.navigate("HardCopyOrder", {
                        bookId: item.id,
                        title: item.title,
                      })
                    }
                  />
                </View>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      <Text style={s.sectionTitle}>
        About this {isBundle ? "bundle" : "book"}
      </Text>
      <Text style={s.desc}>
        {item.description || "No description available yet."}
      </Text>

      {isBundle && bundleBooks.length ? (
        <>
          <Text style={s.sectionTitle}>Included books</Text>
          {bundleBooks.map((b: any) => (
            <TouchableOpacity
              key={b.id}
              style={s.includeRow}
              activeOpacity={0.85}
              onPress={() =>
                nav.navigate("BookDetail", { idOrSlug: b.slug || b.id })
              }
            >
              <BookCover url={b.coverUrl} title={b.title} size="sm" />
              <View style={s.includeBody}>
                <Text style={s.includeTitle} numberOfLines={2}>
                  {b.title}
                </Text>
                <Text style={s.includeAuthor}>
                  {b.author || "Prof. Dr. Javed Iqbal"}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </>
      ) : null}
      <View style={s.footer} />

      <GatewayModal
        visible={gwVisible}
        providers={providers}
        busy={busy}
        onPick={proceed}
        onClose={() => setGwVisible(false)}
      />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 32 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  muted: { color: colors.muted },
  flex1: { flex: 1 },
  gap: { flex: 1, marginLeft: 10 },
  hero: { flexDirection: "row" },
  heroInfo: { flex: 1, marginLeft: 16, justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "800", color: colors.text },
  author: { fontSize: 14, color: colors.muted, marginTop: 4 },
  catPill: {
    alignSelf: "flex-start",
    backgroundColor: colors.brandLight,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 8,
  },
  catText: { fontSize: 12, color: colors.brandDark, fontWeight: "600" },
  price: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.brand,
    marginTop: 10,
  },
  ownedBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#dcfce7",
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 16,
  },
  ownedText: { color: colors.green, fontWeight: "700", fontSize: 12 },
  actions: { marginTop: 16 },
  secondaryRow: { flexDirection: "row", marginTop: 10 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginTop: 24,
    marginBottom: 8,
  },
  desc: { fontSize: 14, color: colors.text, lineHeight: 22 },
  includeRow: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    marginBottom: 10,
  },
  includeBody: { flex: 1, marginLeft: 12, justifyContent: "center" },
  includeTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  includeAuthor: { fontSize: 12, color: colors.muted, marginTop: 2 },
  footer: { height: 24 },
});
