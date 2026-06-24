import React, { useCallback, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { api } from "../api";
import { Button, Loading } from "../components";
import { colors, radius, spacing } from "../theme";
import { trackEvent } from "../activity";

export default function LessonDetailScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const lessonId: string = route.params?.lessonId;
  const courseId: string = route.params?.courseId;

  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<any>(null);
  const [currentIdx, setCurrentIdx] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      api("/courses/" + courseId)
        .then((d: any) => {
          setCourse(d);
          const idx = d.lessons?.findIndex((l: any) => l.id === lessonId) ?? 0;
          setCurrentIdx(idx >= 0 ? idx : 0);
          trackEvent("lesson_opened", { courseId, meta: { lessonIndex: idx } });
        })
        .finally(() => setLoading(false));
    }, [courseId, lessonId]),
  );

  if (loading) return <Loading />;
  if (!course) return <View style={s.center}><Text style={s.muted}>Lesson not found.</Text></View>;

  const lesson = course.lessons?.[currentIdx];
  if (!lesson) return <View style={s.center}><Text style={s.muted}>No lessons available.</Text></View>;

  function next() {
    if (currentIdx < course.lessons.length - 1) {
      const nextLesson = course.lessons[currentIdx + 1];
      nav.setParams({ lessonId: nextLesson.id, title: nextLesson.title });
      setCurrentIdx(currentIdx + 1);
      trackEvent("lesson_completed", { courseId, meta: { lessonIndex: currentIdx } });
    } else {
      Alert.alert("Course Complete!", "You have finished all lessons.");
    }
  }

  const isVideo = lesson.type === "VIDEO";
  const isPdf = lesson.type === "PDF";
  const isText = lesson.type === "TEXT";

  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>
          #{lesson.index + 1} {lesson.title}
        </Text>
      </View>

      <ScrollView style={s.body} contentContainerStyle={s.bodyContent}>
        {isVideo && (
          <View style={s.videoPlaceholder}>
            <Ionicons name="play-circle" size={64} color={colors.brand} />
            <Text style={s.videoLabel}>Video Lesson</Text>
            <Text style={s.videoHint}>
              {lesson.durationSec
                ? Math.round(lesson.durationSec / 60) + " minutes"
                : "Duration: N/A"}
            </Text>
            <Text style={s.contentKey}>
              {lesson.contentKey ? "Content available" : "Content not uploaded yet"}
            </Text>
          </View>
        )}

        {isPdf && (
          <View style={s.videoPlaceholder}>
            <Ionicons name="document-text" size={64} color={colors.brand} />
            <Text style={s.videoLabel}>PDF Lesson</Text>
            <Text style={s.videoHint}>
              {lesson.contentKey ? "Tap to read" : "Content not uploaded yet"}
            </Text>
          </View>
        )}

        {isText && (
          <View>
            <Text style={s.textContent}>
              {lesson.contentKey || "Lesson content will appear here once uploaded."}
            </Text>
          </View>
        )}

        {lesson.type === "QUIZ" && (
          <Button
            title="Start Quiz"
            onPress={() => {
              const quiz = course.quizzes?.find((q: any) => q.lessonId === lesson.id);
              if (quiz) {
                nav.navigate("QuizDetail", { quizId: quiz.id, courseId, title: quiz.title });
              } else {
                Alert.alert("No Quiz", "Quiz not configured for this lesson yet.");
              }
            }}
          />
        )}
      </ScrollView>

      <View style={s.footer}>
        <Text style={s.footerMeta}>
          {currentIdx + 1} / {course.lessons.length}
        </Text>
        <TouchableOpacity style={s.nextBtn} onPress={next}>
          <Text style={s.nextText}>
            {currentIdx < course.lessons.length - 1 ? "Next Lesson" : "Finish"}
          </Text>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.card },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: 52,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.text, marginLeft: 8 },
  body: { flex: 1 },
  bodyContent: { padding: spacing.lg, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  muted: { color: colors.muted },
  videoPlaceholder: { alignItems: "center", justifyContent: "center", paddingVertical: 48 },
  videoLabel: { fontSize: 18, fontWeight: "700", color: colors.text, marginTop: 16 },
  videoHint: { fontSize: 13, color: colors.muted, marginTop: 6 },
  contentKey: { fontSize: 12, color: colors.brand, marginTop: 8 },
  textContent: { fontSize: 16, color: colors.text, lineHeight: 26 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerMeta: { fontSize: 13, color: colors.muted },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 6,
  },
  nextText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
