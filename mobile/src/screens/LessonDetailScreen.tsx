import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { ResizeMode, Video } from "expo-av";
import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import { api } from "../api";
import { Button, Loading } from "../components";
import { colors, radius, spacing } from "../theme";
import { trackEvent } from "../activity";
import { useContentProtection } from "../protect";
import { downloadLesson, localLessonUri, removeLesson } from "../offlineCourse";
import AssignmentLesson from "./AssignmentLesson";

// expo-av needs an object source. Build it through a helper so we never emit a
// double-brace JSX literal (which the bundler can mangle).
const vsrc = (uri: string) => ({ uri });

export default function LessonDetailScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const lessonId: string = route.params?.lessonId;
  const courseId: string = route.params?.courseId;

  // Deter screen recording while a protected lesson is on screen. (Screenshots
  // are not a concern for courses, but the same native flag also blocks them.)
  useContentProtection();

  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<any>(null);
  const [currentIdx, setCurrentIdx] = useState(0);

  // Playback + offline state for the current lesson.
  const [playUri, setPlayUri] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [dlBusy, setDlBusy] = useState(false);
  const [marked, setMarked] = useState(false);
  // Throttle: timestamp of the last watch-progress report.
  const lastReportRef = useRef(0);
  // expo-av player handle + one-shot resume flag for seek-to-last-position.
  const videoRef = useRef<Video | null>(null);
  const didSeekRef = useRef(false);

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

  const lesson = course?.lessons?.[currentIdx];

  // Resolve the playback source whenever the current lesson changes:
  //   1) an offline copy in the app sandbox (works with no internet),
  //   2) an external streaming link (source = LINK), or
  //   3) a fresh signed stream URL for uploaded content.
  useEffect(() => {
    let active = true;
    setMarked(false);
    lastReportRef.current = 0;
    didSeekRef.current = false;
    if (!lesson || lesson.type !== "VIDEO") {
      setPlayUri(null);
      setDownloaded(false);
      return;
    }
    (async () => {
      setResolving(true);
      setPlayUri(null);
      try {
        const local = await localLessonUri(lesson.id);
        if (!active) return;
        setDownloaded(!!local);
        if (local) {
          setPlayUri(local);
          return;
        }
        if (lesson.source === "LINK" && lesson.videoUrl) {
          setPlayUri(lesson.videoUrl);
          return;
        }
        if (lesson.contentKey) {
          const signed: any = await api(
            "/media/sign?key=" + encodeURIComponent(lesson.contentKey),
          );
          if (active && signed?.url) setPlayUri(signed.url);
        }
      } catch {
        // leave the placeholder visible on failure
      } finally {
        if (active) setResolving(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [lesson?.id]);

  if (loading) return <Loading />;
  if (!course)
    return (
      <View style={s.center}>
        <Text style={s.muted}>Lesson not found.</Text>
      </View>
    );
  if (!lesson)
    return (
      <View style={s.center}>
        <Text style={s.muted}>No lessons available.</Text>
      </View>
    );

  function next() {
    markComplete();
    if (currentIdx < course.lessons.length - 1) {
      const nextLesson = course.lessons[currentIdx + 1];
      nav.setParams({ lessonId: nextLesson.id, title: nextLesson.title });
      setCurrentIdx(currentIdx + 1);
      trackEvent("lesson_completed", {
        courseId,
        meta: { lessonIndex: currentIdx },
      });
    } else {
      Alert.alert("Course Complete!", "You have finished all lessons.");
    }
  }

  async function download() {
    if (!lesson.contentKey) return;
    setDlBusy(true);
    try {
      const signed: any = await api(
        "/media/sign?key=" + encodeURIComponent(lesson.contentKey),
      );
      if (!signed?.url) throw new Error("Could not get the download link.");
      await downloadLesson({
        lessonId: lesson.id,
        courseId,
        courseTitle: course.title,
        title: lesson.title,
        signedUrl: signed.url,
      });
      setDownloaded(true);
      const local = await localLessonUri(lesson.id);
      if (local) setPlayUri(local);
      Alert.alert(
        "Downloaded",
        "This lesson is now saved for offline viewing.",
      );
    } catch (e: any) {
      Alert.alert("Download failed", e?.message || "Could not download.");
    } finally {
      setDlBusy(false);
    }
  }

  async function removeOffline() {
    setDlBusy(true);
    try {
      await removeLesson(lesson.id);
      setDownloaded(false);
      Alert.alert("Removed", "Offline copy deleted from this device.");
    } finally {
      setDlBusy(false);
    }
  }

  // Mark this lesson complete so course progress updates live. The server call
  // is idempotent, so replays or repeated taps are harmless.
  async function markComplete() {
    if (marked) return;
    try {
      await api("/courses/lessons/" + lesson.id + "/complete", {
        method: "POST",
      });
      setMarked(true);
    } catch {
      // progress is best-effort; ignore failures
    }
  }

  // Report how much of the video has been watched (0..1) so the course bar
  // grows gradually. Near the end we just mark the lesson complete.
  async function reportWatch(fraction: number, positionSec?: number) {
    if (fraction >= 0.95) {
      markComplete();
      return;
    }
    try {
      await api("/courses/lessons/" + lesson.id + "/progress", {
        method: "POST",
        body:
          positionSec != null
            ? { progress: fraction, positionSec: Math.round(positionSec) }
            : { progress: fraction },
      });
    } catch {
      // progress is best-effort; ignore failures
    }
  }

  // Re-fetch the course so freshly computed lock/completion + submission state
  // is reflected after an assignment is submitted.
  async function reloadCourse() {
    try {
      const d: any = await api("/courses/" + courseId);
      setCourse(d);
    } catch {
      // best-effort refresh
    }
  }

  const isVideo = lesson.type === "VIDEO";
  const isPdf = lesson.type === "PDF";
  const isText = lesson.type === "TEXT";
  const isAssignment = lesson.type === "ASSIGNMENT";
  const isLink = lesson.source === "LINK";
  const canDownload = isVideo && !isLink && !!lesson.contentKey;
  const prevTitle =
    currentIdx > 0 ? course.lessons[currentIdx - 1]?.title : undefined;

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
          <View>
            {playUri ? (
              <Video
                ref={videoRef}
                source={vsrc(playUri)}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
                style={s.video}
                onLoad={(st: any) => {
                  // Resume where the learner left off (once per lesson load).
                  if (didSeekRef.current) return;
                  didSeekRef.current = true;
                  const resumeSec = lesson.resumeSec || 0;
                  const durMs = st?.durationMillis || 0;
                  if (
                    resumeSec > 0 &&
                    videoRef.current &&
                    (!durMs || resumeSec * 1000 < durMs - 5000)
                  ) {
                    videoRef.current
                      .setPositionAsync(resumeSec * 1000)
                      .catch(() => {});
                  }
                }}
                onPlaybackStatusUpdate={(st: any) => {
                  if (!st?.isLoaded) return;
                  if (st.didJustFinish) {
                    markComplete();
                    return;
                  }
                  if (st.isPlaying && st.durationMillis) {
                    const frac = st.positionMillis / st.durationMillis;
                    const now = Date.now();
                    // report at most once every 8s of playback
                    if (now - lastReportRef.current > 8000) {
                      lastReportRef.current = now;
                      reportWatch(frac, st.positionMillis / 1000);
                    }
                  }
                }}
              />
            ) : resolving ? (
              <View style={s.videoPlaceholder}>
                <ActivityIndicator color={colors.brand} />
                <Text style={s.videoHint}>Preparing video...</Text>
              </View>
            ) : (
              <View style={s.videoPlaceholder}>
                <Ionicons name="play-circle" size={64} color={colors.brand} />
                <Text style={s.videoLabel}>Video Lesson</Text>
                <Text style={s.videoHint}>
                  {lesson.contentKey
                    ? "Not available offline. Connect to the internet to stream."
                    : "Content not uploaded yet"}
                </Text>
              </View>
            )}

            {canDownload ? (
              <View style={s.dlRow}>
                {downloaded ? (
                  <>
                    <View style={s.dlBadge}>
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color="#16a34a"
                      />
                      <Text style={s.dlBadgeText}>Saved offline</Text>
                    </View>
                    <TouchableOpacity onPress={removeOffline} disabled={dlBusy}>
                      <Text style={s.dlRemove}>Remove</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={s.dlBtn}
                    onPress={download}
                    disabled={dlBusy}
                    activeOpacity={0.85}
                  >
                    {dlBusy ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Ionicons
                        name="download-outline"
                        size={16}
                        color="#fff"
                      />
                    )}
                    <Text style={s.dlBtnText}>
                      {dlBusy ? "Downloading..." : "Download for offline"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null}

            {isLink ? (
              <Text style={s.note}>
                This lesson streams from an external source, so it cannot be
                saved for offline viewing.
              </Text>
            ) : (
              <Text style={s.note}>
                Protected content - plays inside the app only and cannot be
                shared outside it.
              </Text>
            )}
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
              {lesson.contentKey ||
                "Lesson content will appear here once uploaded."}
            </Text>
          </View>
        )}

        {isAssignment && lesson.assignment && (
          <AssignmentLesson
            assignment={lesson.assignment}
            locked={!!lesson.locked}
            prevTitle={prevTitle}
            onSubmitted={reloadCourse}
          />
        )}

        {lesson.type !== "QUIZ" && lesson.type !== "ASSIGNMENT" && (
          <TouchableOpacity
            style={[s.completeBtn, marked ? s.completeBtnDone : null]}
            onPress={markComplete}
            disabled={marked}
            activeOpacity={0.85}
          >
            <Ionicons
              name={marked ? "checkmark-circle" : "ellipse-outline"}
              size={18}
              color={marked ? "#16a34a" : colors.brand}
            />
            <Text style={[s.completeText, marked ? s.completeTextDone : null]}>
              {marked ? "Completed" : "Mark as complete"}
            </Text>
          </TouchableOpacity>
        )}

        {lesson.type !== "QUIZ" && <LessonNotesQA lessonId={lesson.id} />}

        {lesson.type === "QUIZ" && (
          <Button
            title="Start Quiz"
            onPress={() => {
              const quiz = course.quizzes?.find(
                (q: any) => q.lessonId === lesson.id,
              );
              if (quiz) {
                nav.navigate("QuizDetail", {
                  quizId: quiz.id,
                  courseId,
                  title: quiz.title,
                });
              } else {
                Alert.alert(
                  "No Quiz",
                  "Quiz not configured for this lesson yet.",
                );
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
  headerTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    marginLeft: 8,
  },
  body: { flex: 1 },
  bodyContent: { padding: spacing.lg, paddingBottom: 40 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  muted: { color: colors.muted },
  video: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#000",
    borderRadius: radius.md,
  },
  videoPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
  videoLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    marginTop: 16,
  },
  videoHint: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 6,
    textAlign: "center",
  },
  dlRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 14,
  },
  dlBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  dlBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  dlBadge: { flexDirection: "row", alignItems: "center", gap: 6 },
  dlBadgeText: { color: "#16a34a", fontWeight: "700", fontSize: 13 },
  dlRemove: {
    color: colors.muted,
    fontSize: 13,
    textDecorationLine: "underline",
  },
  note: { fontSize: 12, color: colors.muted, marginTop: 12, lineHeight: 18 },
  completeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.brandLight,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.brand,
    paddingVertical: 12,
    marginTop: 20,
  },
  completeBtnDone: { backgroundColor: "#dcfce7", borderColor: "#16a34a" },
  completeText: { color: colors.brand, fontWeight: "700", fontSize: 14 },
  completeTextDone: { color: "#16a34a" },
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

// ============== Lesson notes + Q&A (mobile) ==============
function LessonNotesQA({ lessonId }: { lessonId: string }) {
  const [tab, setTab] = useState<"notes" | "qa">("notes");
  const [notes, setNotes] = useState<any[]>([]);
  const [noteBody, setNoteBody] = useState("");
  const [questions, setQuestions] = useState<any[]>([]);
  const [qBody, setQBody] = useState("");
  const [answerFor, setAnswerFor] = useState<string | null>(null);
  const [answerBody, setAnswerBody] = useState("");
  const [busy, setBusy] = useState(false);

  const loadNotes = useCallback(() => {
    api("/courses/lessons/" + lessonId + "/notes")
      .then((d: any) => setNotes(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [lessonId]);
  const loadQuestions = useCallback(() => {
    api("/courses/lessons/" + lessonId + "/questions")
      .then((d: any) => setQuestions(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [lessonId]);

  useEffect(() => {
    loadNotes();
    loadQuestions();
    setNoteBody("");
    setQBody("");
    setAnswerFor(null);
  }, [loadNotes, loadQuestions]);

  async function addNote() {
    if (!noteBody.trim()) return;
    setBusy(true);
    try {
      await api("/courses/notes", {
        method: "POST",
        body: { lessonId, body: noteBody.trim() },
      });
      setNoteBody("");
      loadNotes();
    } catch {
    } finally {
      setBusy(false);
    }
  }
  async function delNote(id: string) {
    await api("/courses/notes/" + id, { method: "DELETE" }).catch(() => {});
    loadNotes();
  }
  async function ask() {
    if (!qBody.trim()) return;
    setBusy(true);
    try {
      await api("/courses/questions", {
        method: "POST",
        body: { lessonId, body: qBody.trim() },
      });
      setQBody("");
      loadQuestions();
    } catch {
    } finally {
      setBusy(false);
    }
  }
  async function sendAnswer(qid: string) {
    if (!answerBody.trim()) return;
    setBusy(true);
    try {
      await api("/courses/questions/" + qid + "/answers", {
        method: "POST",
        body: { body: answerBody.trim() },
      });
      setAnswerBody("");
      setAnswerFor(null);
      loadQuestions();
    } catch {
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={qs.wrap}>
      <View style={qs.tabs}>
        <TouchableOpacity onPress={() => setTab("notes")} style={qs.tabBtn}>
          <Ionicons
            name="create-outline"
            size={16}
            color={tab === "notes" ? colors.brand : colors.muted}
          />
          <Text style={[qs.tabText, tab === "notes" ? qs.tabActive : null]}>
            My Notes
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTab("qa")} style={qs.tabBtn}>
          <Ionicons
            name="chatbubbles-outline"
            size={16}
            color={tab === "qa" ? colors.brand : colors.muted}
          />
          <Text style={[qs.tabText, tab === "qa" ? qs.tabActive : null]}>
            Q&A ({questions.length})
          </Text>
        </TouchableOpacity>
      </View>

      {tab === "notes" ? (
        <View>
          <TextInput
            value={noteBody}
            onChangeText={setNoteBody}
            placeholder="Add a private note..."
            placeholderTextColor={colors.muted}
            multiline
            style={qs.input}
          />
          <TouchableOpacity
            style={qs.sendBtn}
            onPress={addNote}
            disabled={busy}
          >
            <Text style={qs.sendText}>Save note</Text>
          </TouchableOpacity>
          {notes.map((n) => (
            <View key={n.id} style={qs.noteRow}>
              <Text style={qs.noteText}>{n.body}</Text>
              <TouchableOpacity onPress={() => delNote(n.id)} hitSlop={8}>
                <Ionicons name="trash-outline" size={16} color={colors.red} />
              </TouchableOpacity>
            </View>
          ))}
          {notes.length === 0 ? (
            <Text style={qs.empty}>
              Your notes are private and only visible to you.
            </Text>
          ) : null}
        </View>
      ) : (
        <View>
          <TextInput
            value={qBody}
            onChangeText={setQBody}
            placeholder="Ask a question about this lesson..."
            placeholderTextColor={colors.muted}
            multiline
            style={qs.input}
          />
          <TouchableOpacity style={qs.sendBtn} onPress={ask} disabled={busy}>
            <Text style={qs.sendText}>Post question</Text>
          </TouchableOpacity>
          {questions.map((q) => (
            <View key={q.id} style={qs.qCard}>
              <View style={qs.qHead}>
                <Text style={qs.qAuthor}>{q.user?.name || "Learner"}</Text>
                {q.resolved ? (
                  <View style={qs.resolvedTag}>
                    <Ionicons name="checkmark" size={12} color="#16a34a" />
                    <Text style={qs.resolvedText}>Resolved</Text>
                  </View>
                ) : null}
              </View>
              <Text style={qs.qBody}>{q.body}</Text>
              {(q.answers || []).map((a: any) => (
                <View key={a.id} style={qs.answer}>
                  <View style={qs.qHead}>
                    <Text style={qs.aAuthor}>{a.user?.name || "User"}</Text>
                    {a.isInstructor ? (
                      <View style={qs.instrTag}>
                        <Text style={qs.instrText}>Instructor</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={qs.aBody}>{a.body}</Text>
                </View>
              ))}
              {answerFor === q.id ? (
                <View>
                  <TextInput
                    value={answerBody}
                    onChangeText={setAnswerBody}
                    placeholder="Write an answer..."
                    placeholderTextColor={colors.muted}
                    multiline
                    style={qs.input}
                  />
                  <View style={qs.answerActions}>
                    <TouchableOpacity
                      style={qs.sendBtn}
                      onPress={() => sendAnswer(q.id)}
                      disabled={busy}
                    >
                      <Text style={qs.sendText}>Reply</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setAnswerFor(null)}>
                      <Text style={qs.cancel}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => {
                    setAnswerFor(q.id);
                    setAnswerBody("");
                  }}
                >
                  <Text style={qs.replyLink}>Reply</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          {questions.length === 0 ? (
            <Text style={qs.empty}>
              No questions yet. Start the conversation!
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

const qs = StyleSheet.create({
  wrap: {
    marginTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  tabs: { flexDirection: "row", gap: 18, marginBottom: spacing.md },
  tabBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  tabText: { fontSize: 14, fontWeight: "600", color: colors.muted },
  tabActive: { color: colors.brand },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 10,
    minHeight: 44,
    color: colors.text,
    backgroundColor: colors.card,
    textAlignVertical: "top",
  },
  sendBtn: {
    alignSelf: "flex-start",
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 8,
  },
  sendText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  noteRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 10,
    marginTop: 8,
  },
  noteText: { flex: 1, color: colors.text, fontSize: 14 },
  empty: { color: colors.muted, fontSize: 13, marginTop: 10 },
  qCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 10,
    marginTop: 10,
  },
  qHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  qAuthor: { fontWeight: "700", color: colors.text, fontSize: 13 },
  qBody: { color: colors.text, fontSize: 14, marginTop: 4 },
  answer: {
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
    paddingLeft: 10,
    marginTop: 8,
  },
  aAuthor: { fontWeight: "700", color: colors.text, fontSize: 12 },
  aBody: { color: colors.muted, fontSize: 13, marginTop: 2 },
  instrTag: {
    backgroundColor: colors.brandLight,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  instrText: { color: colors.brand, fontSize: 11, fontWeight: "700" },
  resolvedTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#dcfce7",
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  resolvedText: { color: "#16a34a", fontSize: 11, fontWeight: "700" },
  replyLink: {
    color: colors.brand,
    fontWeight: "700",
    fontSize: 12,
    marginTop: 8,
  },
  cancel: { color: colors.muted, fontWeight: "600", fontSize: 13 },
  answerActions: { flexDirection: "row", alignItems: "center", gap: 14 },
});
