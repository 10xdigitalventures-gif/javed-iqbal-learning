import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import { api } from "../api";
import { Button, Loading } from "../components";
import { colors, radius, spacing } from "../theme";
import { ProgressBar } from "../ui";
import { trackEvent } from "../activity";
import {
  downloadLesson,
  downloadedCountForCourse,
  isLessonDownloaded,
} from "../offlineCourse";

// Human-friendly remaining time until an ISO timestamp.
function fmtRemaining(iso?: string | null): string {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "now";
  const mins = Math.floor(ms / 60000);
  const days = Math.floor(mins / (60 * 24));
  const hours = Math.floor((mins % (60 * 24)) / 60);
  const m = mins % 60;
  if (days > 0) return days + "d " + hours + "h";
  if (hours > 0) return hours + "h " + m + "m";
  return m + "m";
}

// Short label explaining why a lesson / module is locked.
function lockLabel(reason?: string | null, unlockAt?: string | null): string {
  switch (reason) {
    case "ACCESS":
      return "Enroll to unlock";
    case "PREV_MODULE":
      return "Complete the previous module first";
    case "PREV_LESSON":
      return "Complete the previous lesson first";
    case "MODULE_TIME":
    case "TIME":
      return unlockAt ? "Unlocks in " + fmtRemaining(unlockAt) : "Locked";
    default:
      return "Locked";
  }
}

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
  const [savedCount, setSavedCount] = useState(0);
  const [dlAll, setDlAll] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      api("/courses/" + idOrSlug)
        .then((d: any) => {
          setCourse(d);
          trackEvent("course_viewed", { courseId: d?.id });
          if (d?.id)
            downloadedCountForCourse(d.id)
              .then(setSavedCount)
              .catch(() => {});
        })
        .finally(() => setLoading(false));
    }, [idOrSlug]),
  );

  // Re-fetch the course (used after a review is added / removed).
  const reload = useCallback(() => {
    api("/courses/" + idOrSlug)
      .then((d: any) => setCourse(d))
      .catch(() => {});
  }, [idOrSlug]);

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
    // Free course -> enroll directly. Paid course -> create the order and open
    // the dedicated checkout screen, where the customer picks a payment gateway
    // (PayFast / Whop) before being redirected.
    if (!course.price || course.price <= 0) {
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
      return;
    }
    try {
      setBusy(true);
      const order = await api("/orders", {
        method: "POST",
        body: { kind: "COURSE", courseId: course.id },
      });
      nav.navigate("Checkout", {
        paymentId: order.payment.id,
        title: course.title,
        amount: course.price,
        currency: course.currency,
      });
    } catch (e: any) {
      Alert.alert("Checkout", e?.message || "Could not start checkout.");
    } finally {
      setBusy(false);
    }
  }

  function openLesson(lesson: any) {
    if (lesson.locked) {
      Alert.alert("Locked", lockLabel(lesson.lockReason, lesson.unlockAt));
      return;
    }
    nav.navigate("LessonDetail", {
      lessonId: lesson.id,
      courseId: course.id,
      title: lesson.title,
    });
  }

  // A single lesson row, shared by the grouped + flat rendering paths.
  function renderLesson(l: any) {
    return (
      <TouchableOpacity
        key={l.id}
        style={[s.lesson, l.locked ? s.lessonLocked : null]}
        activeOpacity={0.85}
        onPress={() => openLesson(l)}
      >
        <View style={s.lessonLeft}>
          <View style={[s.lessonIcon, l.isPreview ? s.previewIcon : null]}>
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
            {l.locked && l.lockReason ? (
              <Text style={s.lessonLockText}>
                {lockLabel(l.lockReason, l.unlockAt)}
              </Text>
            ) : null}
          </View>
        </View>
        {l.locked ? (
          <Ionicons name="lock-closed" size={16} color={colors.muted} />
        ) : l.completed ? (
          <Ionicons name="checkmark-circle" size={18} color={colors.green} />
        ) : (
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        )}
      </TouchableOpacity>
    );
  }

  const courseModules = course.modules || [];
  const ungroupedLessons = (course.lessons || []).filter(
    (l: any) => !l.moduleId,
  );

  // Lessons whose video can be saved for offline (uploaded, not external links).
  const videoLessons = (course.lessons || []).filter(
    (l: any) => l.type === "VIDEO" && l.source !== "LINK" && l.contentKey,
  );

  async function downloadAll() {
    if (videoLessons.length === 0) {
      Alert.alert(
        "Nothing to download",
        "This course has no downloadable videos.",
      );
      return;
    }
    setDlAll(true);
    let ok = 0;
    try {
      for (const l of videoLessons) {
        if (await isLessonDownloaded(l.id)) {
          ok++;
          setSavedCount(ok);
          continue;
        }
        const signed: any = await api(
          "/media/sign?key=" + encodeURIComponent(l.contentKey),
        );
        if (signed?.url) {
          await downloadLesson({
            lessonId: l.id,
            courseId: course.id,
            courseTitle: course.title,
            title: l.title,
            signedUrl: signed.url,
          });
          ok++;
          setSavedCount(ok);
        }
      }
      Alert.alert(
        "Offline ready",
        ok + " of " + videoLessons.length + " videos saved on this device.",
      );
    } catch (e: any) {
      Alert.alert(
        "Download incomplete",
        e?.message || "Some videos could not be downloaded.",
      );
    } finally {
      setDlAll(false);
      downloadedCountForCourse(course.id)
        .then(setSavedCount)
        .catch(() => {});
    }
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
          title={
            busy
              ? "Please wait..."
              : course.price > 0
                ? "Enroll - Rs " + course.price
                : "Enroll for free"
          }
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

      {hasAccess && videoLessons.length > 0 && (
        <TouchableOpacity
          style={s.offlineBtn}
          onPress={downloadAll}
          disabled={dlAll}
          activeOpacity={0.85}
        >
          {dlAll ? (
            <ActivityIndicator color={colors.brand} size="small" />
          ) : (
            <Ionicons
              name="cloud-download-outline"
              size={18}
              color={colors.brand}
            />
          )}
          <Text style={s.offlineBtnText}>
            {dlAll
              ? "Downloading... " + savedCount + "/" + videoLessons.length
              : savedCount >= videoLessons.length
                ? "All videos saved offline"
                : "Download all videos (" +
                  savedCount +
                  "/" +
                  videoLessons.length +
                  ")"}
          </Text>
        </TouchableOpacity>
      )}

      <Text style={s.sectionTitle}>Lessons</Text>
      {courseModules.length > 0 ? (
        <>
          {courseModules.map((m: any) => {
            const mLessons = (course.lessons || []).filter(
              (l: any) => l.moduleId === m.id,
            );
            return (
              <View key={m.id} style={s.moduleBlock}>
                <View style={s.moduleHeader}>
                  <View style={s.flex1}>
                    <Text style={s.moduleTitle}>{m.title}</Text>
                    {m.locked ? (
                      <Text style={s.moduleLockText}>
                        {lockLabel(m.lockReason, m.unlockAt)}
                      </Text>
                    ) : m.completed ? (
                      <Text style={s.moduleDoneText}>Completed</Text>
                    ) : null}
                  </View>
                  <Ionicons
                    name={
                      m.locked
                        ? "lock-closed"
                        : m.completed
                          ? "checkmark-circle"
                          : "ellipse-outline"
                    }
                    size={16}
                    color={m.completed ? colors.green : colors.muted}
                  />
                </View>
                {mLessons.map((l: any) => renderLesson(l))}
              </View>
            );
          })}
          {ungroupedLessons.length > 0 && (
            <View style={s.moduleBlock}>
              <Text style={s.moduleTitle}>Other lessons</Text>
              {ungroupedLessons.map((l: any) => renderLesson(l))}
            </View>
          )}
        </>
      ) : (
        course.lessons?.map((l: any) => renderLesson(l))
      )}

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
                  <Ionicons name="help-circle" size={18} color={colors.brand} />
                </View>
                <Text style={s.lessonTitle}>{q.title}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
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
              <Ionicons name="document-text" size={16} color={colors.muted} />
            </View>
          ))}
        </>
      )}

      <CourseReviews
        courseId={course.id}
        canReview={hasAccess}
        summary={course.reviewSummary}
        myReview={course.myReview}
        onChange={reload}
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
  header: { marginBottom: 16 },
  title: { fontSize: 22, fontWeight: "800", color: colors.text },
  desc: { fontSize: 14, color: colors.muted, marginTop: 6, lineHeight: 20 },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    gap: 16,
  },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, color: colors.muted },
  price: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.brand,
    marginLeft: "auto",
  },
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
  lessonLockText: { fontSize: 11, color: colors.brandDark, marginTop: 3 },
  moduleBlock: { marginBottom: 10 },
  moduleHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  moduleTitle: { fontSize: 15, fontWeight: "800", color: colors.text },
  moduleLockText: { fontSize: 11, color: colors.muted, marginTop: 2 },
  moduleDoneText: { fontSize: 11, color: colors.green, marginTop: 2 },
  offlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.brandLight,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.brand,
    paddingVertical: 12,
    marginBottom: 16,
  },
  offlineBtnText: { color: colors.brand, fontWeight: "700", fontSize: 13 },
});

// ============== Ratings & reviews (mobile) ==============
function StarRow({
  value,
  onSelect,
  size = 20,
}: {
  value: number;
  onSelect?: (n: number) => void;
  size?: number;
}) {
  return (
    <View style={rs.starRow}>
      {[1, 2, 3, 4, 5].map((n) => {
        const star = (
          <Ionicons
            name={n <= value ? "star" : "star-outline"}
            size={size}
            color={n <= value ? "#f59e0b" : colors.muted}
          />
        );
        if (!onSelect) return <View key={n}>{star}</View>;
        return (
          <TouchableOpacity key={n} onPress={() => onSelect(n)} hitSlop={4}>
            {star}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function CourseReviews({
  courseId,
  canReview,
  summary,
  myReview,
  onChange,
}: {
  courseId: string;
  canReview: boolean;
  summary?: { avg: number; count: number };
  myReview?: { id: string; rating: number; comment?: string | null } | null;
  onChange: () => void;
}) {
  const [reviews, setReviews] = useState<any[]>([]);
  const [rating, setRating] = useState(myReview?.rating || 0);
  const [comment, setComment] = useState(myReview?.comment || "");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api("/courses/" + courseId + "/reviews")
      .then((d: any) => setReviews(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [courseId]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    setRating(myReview?.rating || 0);
    setComment(myReview?.comment || "");
  }, [myReview?.rating, myReview?.comment]);

  async function submit() {
    if (rating < 1) {
      Alert.alert("Rating required", "Please pick a star rating first.");
      return;
    }
    setBusy(true);
    try {
      await api("/courses/" + courseId + "/reviews", {
        method: "POST",
        body: { rating, comment: comment.trim() || undefined },
      });
      load();
      onChange();
    } catch (e: any) {
      Alert.alert("Could not save", e?.message);
    } finally {
      setBusy(false);
    }
  }
  async function removeMine() {
    setBusy(true);
    try {
      await api("/courses/" + courseId + "/reviews", { method: "DELETE" });
      setRating(0);
      setComment("");
      load();
      onChange();
    } catch {
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={rs.wrap}>
      <View style={rs.head}>
        <Text style={rs.title}>Ratings & reviews</Text>
        {summary && summary.count > 0 ? (
          <View style={rs.summary}>
            <Text style={rs.avg}>{summary.avg.toFixed(1)}</Text>
            <StarRow value={Math.round(summary.avg)} size={14} />
            <Text style={rs.count}>({summary.count})</Text>
          </View>
        ) : (
          <Text style={rs.count}>No reviews yet</Text>
        )}
      </View>

      {canReview ? (
        <View style={rs.form}>
          <Text style={rs.formTitle}>
            {myReview ? "Your review" : "Write a review"}
          </Text>
          <StarRow value={rating} onSelect={setRating} />
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Share your thoughts (optional)"
            placeholderTextColor={colors.muted}
            multiline
            style={rs.input}
          />
          <View style={rs.actions}>
            <TouchableOpacity style={rs.btn} onPress={submit} disabled={busy}>
              <Text style={rs.btnText}>{myReview ? "Update" : "Submit"}</Text>
            </TouchableOpacity>
            {myReview ? (
              <TouchableOpacity onPress={removeMine} disabled={busy}>
                <Text style={rs.delete}>Delete</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ) : (
        <Text style={rs.count}>Enroll to leave a review.</Text>
      )}

      {reviews.map((r) => (
        <View key={r.id} style={rs.item}>
          <View style={rs.itemHead}>
            <Text style={rs.author}>{r.user?.name || "Learner"}</Text>
            <StarRow value={r.rating} size={13} />
          </View>
          {r.comment ? <Text style={rs.comment}>{r.comment}</Text> : null}
        </View>
      ))}
      {reviews.length === 0 ? (
        <Text style={rs.count}>Be the first to review this course.</Text>
      ) : null}
    </View>
  );
}

const rs = StyleSheet.create({
  wrap: {
    marginTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  starRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 16, fontWeight: "800", color: colors.text },
  summary: { flexDirection: "row", alignItems: "center", gap: 6 },
  avg: { fontSize: 16, fontWeight: "800", color: colors.text },
  count: { fontSize: 12, color: colors.muted, marginTop: 6 },
  form: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
  },
  formTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 10,
    minHeight: 44,
    marginTop: 10,
    color: colors.text,
    backgroundColor: colors.card,
    textAlignVertical: "top",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 10,
  },
  btn: {
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  delete: { color: colors.red, fontWeight: "700", fontSize: 13 },
  item: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 10,
  },
  itemHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  author: { fontSize: 13, fontWeight: "700", color: colors.text },
  comment: { fontSize: 14, color: colors.muted, marginTop: 4 },
});
