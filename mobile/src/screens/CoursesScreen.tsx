import React, { useCallback, useState } from "react";
import { FlatList, Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../api";
import { Loading } from "../components";
import { colors, radius, spacing } from "../theme";
import { EmptyState, ProgressBar } from "../ui";

const arr = (x: any) => (Array.isArray(x) ? x : x?.items || x?.data || []);

export default function CoursesScreen() {
  const nav = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<any[]>([]);
  const [enrolled, setEnrolled] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      Promise.all([
        api("/courses").catch(() => []),
        api("/courses/me/enrolled").catch(() => []),
      ])
        .then(([c, e]) => {
          setCourses(arr(c));
          setEnrolled(arr(e));
        })
        .finally(() => setLoading(false));
    }, []),
  );

  if (loading) return <Loading />;

  const enrolledIds = new Set(enrolled.map((e: any) => e.courseId));

  const renderEnrolled = ({ item: e }: { item: any }) => (
    <TouchableOpacity
      style={s.enrollCard}
      activeOpacity={0.85}
      onPress={() =>
        nav.navigate("CourseDetail", {
          idOrSlug: e.courseId,
          title: e.course?.title,
        })
      }
    >
      <Text style={s.courseTitle} numberOfLines={2}>
        {e.course?.title}
      </Text>
      <Text style={s.courseMeta}>
        {e.lessonsComplete}/{e.course?._count?.lessons || 0} lessons
      </Text>
      <ProgressBar value={e.percentComplete} />
    </TouchableOpacity>
  );

  const renderCourse = ({ item: c }: { item: any }) => (
    <TouchableOpacity
      style={s.courseCard}
      activeOpacity={0.85}
      onPress={() =>
        nav.navigate("CourseDetail", {
          idOrSlug: c.slug || c.id,
          title: c.title,
        })
      }
    >
      <View style={s.courseIcon}>
        <Ionicons name="play-circle" size={32} color={colors.brand} />
      </View>
      <Text style={s.courseTitle} numberOfLines={2}>
        {c.title}
      </Text>
      <Text style={s.courseDesc} numberOfLines={2}>
        {c.description || "No description"}
      </Text>
      <Text style={s.coursePrice}>Rs {c.price}</Text>
      {enrolledIds.has(c.id) && (
        <Text style={s.enrolledBadge}>Enrolled</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={s.wrap}>
      {enrolled.length > 0 && (
        <>
          <Text style={s.section}>My Courses</Text>
          <FlatList
            horizontal
            data={enrolled}
            keyExtractor={(e: any) => e.courseId}
            renderItem={renderEnrolled}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.hScroll}
          />
        </>
      )}

      <Text style={s.section}>All Courses</Text>
      <FlatList
        data={courses}
        keyExtractor={(c: any) => c.id}
        renderItem={renderCourse}
        numColumns={2}
        columnWrapperStyle={s.col}
        contentContainerStyle={s.list}
        ListEmptyComponent={
          <EmptyState
            icon="school-outline"
            title="No courses yet"
            subtitle="Courses will appear here soon."
          />
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  section: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    padding: spacing.lg,
    paddingBottom: 8,
  },
  hScroll: { paddingHorizontal: spacing.lg, paddingBottom: 12 },
  enrollCard: {
    width: 220,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginRight: 12,
  },
  courseCard: {
    width: "48%",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  col: { justifyContent: "space-between" },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 32 },
  courseIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  courseTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  courseDesc: { fontSize: 12, color: colors.muted, marginTop: 4, lineHeight: 18 },
  courseMeta: {
    fontSize: 12,
    color: colors.brand,
    fontWeight: "600",
    marginTop: 6,
  },
  coursePrice: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.brand,
    marginTop: 8,
  },
  enrolledBadge: {
    fontSize: 11,
    color: colors.green,
    fontWeight: "600",
    marginTop: 4,
  },
});
