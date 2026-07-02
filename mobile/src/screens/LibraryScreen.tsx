import React, { useCallback, useState } from "react";
import {
  FlatList,
  Image,
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
import { BookCover, EmptyState, Pill, ProgressBar } from "../ui";

const arr = (x: any) => (Array.isArray(x) ? x : x?.items || x?.data || []);
const isAudio = (b: any) =>
  (b?.category?.name || b?.categoryName || "").toLowerCase().includes("audio");

// "My Library" shows everything the reader has unlocked. Two tabs only:
//   Courses -> enrolled / purchased courses (cover grid)
//   Books   -> owned ebooks + audiobooks (added after purchase)
export default function LibraryScreen() {
  const nav = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"courses" | "books">("courses");
  const [courses, setCourses] = useState<any[]>([]);
  const [books, setBooks] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [qc, setQc] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api("/courses/me/enrolled").catch(() => []),
      api("/library").catch(() => []),
    ])
      .then(([c, b]) => {
        setCourses(arr(c));
        setBooks(arr(b));
      })
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(load);

  if (loading) return <Loading />;

  const term = q.trim().toLowerCase();

  const termC = qc.trim().toLowerCase();
  const filteredCourses = courses.filter((e: any) => {
    if (!termC) return true;
    const c = e.course || e;
    return (c.title || "").toLowerCase().includes(termC);
  });

  const ownedBooks = books
    .map((row: any) => row.book || row)
    .filter((b: any) => !!b)
    .filter((b: any) => {
      if (!term) return true;
      return (
        (b.title || "").toLowerCase().includes(term) ||
        (b.author || "").toLowerCase().includes(term)
      );
    });

  const renderCourse = ({ item: e }: { item: any }) => {
    const course = e.course || e;
    const cover = course.coverUrl ? { uri: course.coverUrl } : null;
    const pct = typeof e.percentComplete === "number" ? e.percentComplete : 0;
    return (
      <TouchableOpacity
        style={s.courseCard}
        activeOpacity={0.85}
        onPress={() =>
          nav.navigate("CourseDetail", {
            idOrSlug: course.slug || course.id,
            title: course.title,
          })
        }
      >
        <View style={s.courseCover}>
          {cover ? (
            <Image source={cover} style={s.courseCoverImg} />
          ) : (
            <View style={s.courseCoverFallback}>
              <Ionicons name="play-circle" size={30} color={colors.brand} />
            </View>
          )}
        </View>
        <Text style={s.courseTitle} numberOfLines={2}>
          {course.title}
        </Text>
        <View style={s.progressWrap}>
          <ProgressBar value={pct} />
        </View>
        <Text style={s.courseMeta}>{Math.round(pct)}% complete</Text>
      </TouchableOpacity>
    );
  };

  const renderBook = ({ item: b }: { item: any }) => (
    <TouchableOpacity
      style={s.gridItem}
      activeOpacity={0.85}
      onPress={() => nav.navigate("BookDetail", { idOrSlug: b.slug || b.id })}
    >
      <View>
        <BookCover url={b.coverUrl} title={b.title} size="md" fill />
        {isAudio(b) ? (
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
    </TouchableOpacity>
  );

  return (
    <View style={s.wrap}>
      <View style={s.tabs}>
        <Pill
          fill
          label="Courses"
          active={tab === "courses"}
          onPress={() => setTab("courses")}
        />
        <Pill
          fill
          label="Books"
          active={tab === "books"}
          onPress={() => setTab("books")}
        />
      </View>

      {tab === "courses" ? (
        <>
          <View style={s.searchRow}>
            <TextInput
              value={qc}
              onChangeText={setQc}
              placeholder="Search your courses"
              placeholderTextColor={colors.muted}
              style={s.search}
            />
          </View>
          <FlatList
            data={filteredCourses}
            keyExtractor={(e: any, i) => e.id || e.courseId || String(i)}
            renderItem={renderCourse}
            numColumns={2}
            columnWrapperStyle={s.col}
            contentContainerStyle={s.listContent}
            ListEmptyComponent={
              <EmptyState
                icon="school-outline"
                title="No courses yet"
                subtitle="Courses you purchase will appear here."
              />
            }
          />
        </>
      ) : (
        <>
          <View style={s.searchRow}>
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search your books"
              placeholderTextColor={colors.muted}
              style={s.search}
            />
          </View>
          <FlatList
            data={ownedBooks}
            keyExtractor={(b: any, i) => b.id || String(i)}
            renderItem={renderBook}
            numColumns={2}
            columnWrapperStyle={s.col}
            contentContainerStyle={s.listContent}
            ListEmptyComponent={
              <EmptyState
                icon="book-outline"
                title="No books yet"
                subtitle="Ebooks and audiobooks you purchase will appear here."
              />
            }
          />
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  tabs: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
  },
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
  listContent: { padding: spacing.lg, paddingBottom: 32 },
  col: { justifyContent: "space-between", alignItems: "flex-start" },
  gridItem: { width: "48%", marginBottom: 18 },
  title: { fontSize: 14, fontWeight: "700", color: colors.text, marginTop: 8 },
  author: { fontSize: 12, color: colors.muted, marginTop: 2 },
  audioTag: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  courseCard: { width: "48%", marginBottom: 18 },
  courseCover: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.brandLight,
  },
  courseCoverImg: { width: "100%", height: "100%" },
  courseCoverFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  courseTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    marginTop: 8,
  },
  progressWrap: { marginTop: 8 },
  courseMeta: { fontSize: 12, color: colors.muted, marginTop: 6 },
});
