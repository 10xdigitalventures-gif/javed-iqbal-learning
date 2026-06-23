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
import { Loading } from "../components";
import { colors, radius, spacing } from "../theme";
import { BookCover, EmptyState, ProgressBar, SectionHeader } from "../ui";

const arr = (x: any) => (Array.isArray(x) ? x : x?.items || x?.data || []);
const pickBook = (it: any) => it.book || it;
const pickProgress = (it: any) => it.progress || it.readingProgress || it;

export default function MyLearningScreen() {
  const nav = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    api("/library")
      .then((d: any) => setItems(arr(d)))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(load);

  if (loading) return <Loading />;

  const withProgress = items.filter((it: any) => {
    const p = pickProgress(it);
    return (p?.percentComplete || 0) > 0;
  });
  const totalSeconds = items.reduce((acc: number, it: any) => {
    const p = pickProgress(it);
    return acc + (p?.readingSeconds || 0);
  }, 0);
  const completed = items.filter((it: any) => {
    const p = pickProgress(it);
    return p?.isCompleted || (p?.percentComplete || 0) >= 100;
  }).length;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);

  const openBook = (b: any) =>
    nav.navigate("Reader", { bookId: b.id, title: b.title });

  return (
    <ScrollView style={s.wrap} contentContainerStyle={s.content}>
      <View style={s.statsRow}>
        <View style={s.stat}>
          <Text style={s.statValue}>{items.length}</Text>
          <Text style={s.statLabel}>Books</Text>
        </View>
        <View style={s.stat}>
          <Text style={s.statValue}>{completed}</Text>
          <Text style={s.statLabel}>Completed</Text>
        </View>
        <View style={s.stat}>
          <Text style={s.statValue}>
            {hours > 0 ? hours + "h " : ""}
            {minutes}m
          </Text>
          <Text style={s.statLabel}>Read time</Text>
        </View>
      </View>

      {withProgress.length ? (
        <>
          <SectionHeader title="Continue reading" />
          {withProgress.map((it: any) => {
            const b = pickBook(it);
            const p = pickProgress(it);
            return (
              <TouchableOpacity
                key={b.id}
                style={s.row}
                activeOpacity={0.85}
                onPress={() => openBook(b)}
              >
                <BookCover url={b.coverUrl} title={b.title} size="sm" />
                <View style={s.rowBody}>
                  <Text style={s.rowTitle} numberOfLines={2}>
                    {b.title}
                  </Text>
                  <Text style={s.rowMeta}>
                    {Math.round(p?.percentComplete || 0)}% · chapter{" "}
                    {(p?.lastChapterIndex || 0) + 1}
                  </Text>
                  <ProgressBar value={p?.percentComplete || 0} />
                </View>
              </TouchableOpacity>
            );
          })}
        </>
      ) : null}

      <SectionHeader title="My books" />
      {items.length ? (
        items.map((it: any) => {
          const b = pickBook(it);
          const p = pickProgress(it);
          return (
            <TouchableOpacity
              key={"all" + b.id}
              style={s.row}
              activeOpacity={0.85}
              onPress={() => openBook(b)}
            >
              <BookCover url={b.coverUrl} title={b.title} size="sm" />
              <View style={s.rowBody}>
                <Text style={s.rowTitle} numberOfLines={2}>
                  {b.title}
                </Text>
                <Text style={s.rowMeta}>
                  {b.author || "Prof. Dr. Javed Iqbal"}
                </Text>
                <ProgressBar value={p?.percentComplete || 0} />
              </View>
            </TouchableOpacity>
          );
        })
      ) : (
        <EmptyState
          icon="book-outline"
          title="Your shelf is empty"
          subtitle="Books you purchase will appear here for secure offline reading."
        />
      )}
      <View style={s.footer} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 32 },
  statsRow: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 16,
  },
  stat: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 20, fontWeight: "800", color: colors.brand },
  statLabel: { fontSize: 12, color: colors.muted, marginTop: 2 },
  row: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 10,
  },
  rowBody: { flex: 1, marginLeft: 12, justifyContent: "center" },
  rowTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  rowMeta: { fontSize: 12, color: colors.muted, marginVertical: 6 },
  footer: { height: 24 },
});
