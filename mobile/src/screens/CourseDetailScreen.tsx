import React, { useCallback, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { api } from "../api";
import { Button, Loading } from "../components";
import { colors, radius, spacing } from "../theme";
import { ProgressBar } from "../ui";
import { trackEvent } from "../activity";

const LESSON_ICON: Record<string, string> = {
  VIDEO: "videocam",
  PDF: "document-text",
  TEXT: "reader",
  QUIZ: "help-circle",
  ASSIGNMENT: "pencil",
};

export default function CourseDetailScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const idOrSlug: string = route.params?.idOrSlug;

  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      api("/courses/" + idOrSlug)
        .then((d: any) => {
          setCourse(d);
          trackEvent("course_viewed", { courseId: d?.id });
        })
        .finally(() => setLoading(false));
    }, [idOrSlug]),
  );

  if (loading) return <Loading />;
  if (!course)
    return (
      <View style={s.center}>
        <Text style={s.muted}>Course not found.</Text>
      </View>
    );

  const hasAccess = !!course.hasAccess;
  const progress = course.enrollment?.percentComplete || 0;

  async function enroll() {
    try {
      setBusy(true);
      await api("/courses/" + course.id + "/enroll", { method: "POST" });
      Alert.alert("Enrolled!", "You can now access all lessons.");
      const d = await api("/courses/" + course.id);
      setCourse(d);
    } catch (e: any) {
      Alert.alert("Enrollment failed", e?.message);
    } finally {
      setBusy(false);
    }
  }

  function openLesson(lesson: any) {
    if (!hasAccess && !lesson.isPreview) {
      Alert.alert("Locked", "Enroll in this course to access this lesson.");
      return;
    }
    nav.navigate("LessonDetail", {
      lessonId: lesson.id,
      courseId: course.id,
      title: lesson.title,
    });
  }

  return (
    <ScrollView style={s.wrap} contentContainerStyle={s.content}>
      <View style={s.header}>
        <Text style={s.title}>{course.title}</Text>
        <Text style={s.desc}>{course.description || "No description"}</Text>
        <View style={s.metaRow}>
          <View style={s.metaItem}>
            <Ionicons name="school" size={16} color={colors.brand} />
            <Text style={s.metaText}>
              {course._count?.lessons || 0} lessons
            </Text>
          </View>
          <View style={s.metaItem}>
            <Ionicons name="people" size={16} color={colors.brand} />
            <Text style={s.metaText}>
              {course._count?.enrollments || 0} students
            </Text>
          </View>
          <Text style={s.price}>Rs {course.price}</Text>
        </View>
      </View>

      {!hasAccess && (
        <Button
          title={busy ? "Please wait..." : "Enroll Now"}
          onPress={enroll}
          disabled={busy}
        />
      )}

      {hasAccess && (
        <View style={s.progressBox}>
          <Text style={s.progressLabel}>
            Your progress: {Math.round(progress)}%
          </Text>
          <ProgressBar value={progress} />
        </View>
      )}

      <Text style={s.sectionTitle}>Lessons</Text>
      {course.lessons?.map((l: any) => (
        <TouchableOpacity
          key={l.id}
          style={[
            s.lesson,
            !hasAccess && !l.isPreview ? s.lessonLocked : null,
          ]}
          activeOpacity={0.85}
          onPress={() => openLesson(l)}
        >
          <View style={s.lessonLeft}>
            <View
              style={[s.lessonIcon, l.isPreview ? s.previewIcon : null]}
            >
              <Ionicons
                name={(LESSON_ICON[l.type] || "reader") as any}
                size={18}
                color={colors.brand}
              />
            </View>
            <View style={s.flex1}>
              <Text style={s.lessonTitle}>
                #{l.index + 1} {l.title}
              </Text>
              <Text style={s.lessonMeta}>
                {l.type}
                {l.durationSec
                  ? " - " + Math.round(l.durationSec / 60) + " min"
                  : ""}
              </Text>
            </View>
          </View>
          {!hasAccess && !l.isPreview ? (
            <Ionicons name="lock-closed" size={16} color={colors.muted} />
          ) : (
            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
          )}
        </TouchableOpacity>
      ))}

      {course.quizzes?.length > 0 && (
        <>
          <Text style={s.sectionTitle}>Quizzes</Text>
          {course.quizzes.map((q: any) => (
            <TouchableOpacity
              key={q.id}
              style={s.lesson}
              activeOpacity={0.85}
              onPress={() =>
                nav.navigate("QuizDetail", {
                  quizId: q.id,
                  courseId: course.id,
                  title: q.title,
                })
              }
            >
              <View style={s.lessonLeft}>
                <View style={s.lessonIcon}>
                  <Ionicons
                    name="help-circle"
                    size={18}
                    color={colors.brand}
                  />
                </View>
                <Text style={s.lessonTitle}>{q.title}</Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={colors.muted}
              />
            </TouchableOpacity>
          ))}
        </>
      )}

      {course.assignments?.length > 0 && (
        <>
          <Text style={s.sectionTitle}>Assignments</Text>
          {course.assignments.map((a: any) => (
            <View key={a.id} style={s.lesson}>
              <View style={s.lessonLeft}>
                <View style={s.lessonIcon}>
                  <Ionicons name="pencil" size={18} color={colors.brand} />
                </View>
                <Text style={s.lessonTitle}>{a.title}</Text>
              </View>
              <Ionicons
                name="document-text"
                size={16}
                color={colors.muted}
              />
            </View>
          ))}
        </>
      )}
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
  header: { marginBottom: 16 },
  title: { fontSize: 22, fontWeight: "800", color: colors.text },
  desc: { fontSize: 14, color: colors.muted, marginTop: 6, lineHeight: 20 },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 10, gap: 16 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, color: colors.muted },
  price: { fontSize: 18, fontWeight: "800", color: colors.brand, marginLeft: "auto" },
  progressBox: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 16,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginTop: 20,
    marginBottom: 8,
  },
  lesson: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 8,
  },
  lessonLocked: { opacity: 0.6 },
  lessonLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  lessonIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  previewIcon: { backgroundColor: "#dcfce7" },
  lessonTitle: { fontSize: 14, fontWeight: "600", color: colors.text, flex: 1 },
  lessonMeta: { fontSize: 11, color: colors.muted, marginTop: 2 },
});
