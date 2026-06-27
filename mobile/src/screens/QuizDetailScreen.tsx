import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { api } from "../api";
import { Button, Loading } from "../components";
import { colors, radius, spacing } from "../theme";

// Fisher-Yates shuffle (returns a new array).
function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Seconds -> mm:ss.
function fmtClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m + ":" + (s < 10 ? "0" + s : String(s));
}

export default function QuizDetailScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const quizId: string = route.params?.quizId;
  const courseId: string = route.params?.courseId;

  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState<any>(null);
  // Answers keyed by ORIGINAL question index. Value is an option index (SINGLE /
  // TRUE_FALSE) or an array of option indices (MULTI).
  const [answers, setAnswers] = useState<Record<number, number | number[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Display ordering (supports shuffle). qOrder = original question indices in
  // display order; optOrder[qi] = original option indices in display order.
  const [qOrder, setQOrder] = useState<number[]>([]);
  const [optOrder, setOptOrder] = useState<Record<number, number[]>>({});
  const [remaining, setRemaining] = useState<number | null>(null);
  const startRef = useRef<number>(Date.now());

  useEffect(() => {
    api("/courses/" + courseId)
      .then((d: any) => {
        const q = d.quizzes?.find((qq: any) => qq.id === quizId);
        setQuiz(q);
      })
      .finally(() => setLoading(false));
  }, [courseId, quizId]);

  // Build display order + per-question option order once the quiz arrives.
  useEffect(() => {
    if (!quiz) return;
    const qs = quiz.questions || [];
    const optMap: Record<number, number[]> = {};
    qs.forEach((q: any, i: number) => {
      let opts: string[] = [];
      try {
        opts = JSON.parse(q.options);
      } catch {
        opts = [];
      }
      let oo = opts.map((_: string, oi: number) => oi);
      if (quiz.shuffle) oo = shuffled(oo);
      optMap[i] = oo;
    });
    let order = qs.map((_: any, i: number) => i);
    if (quiz.shuffle) order = shuffled(order);
    setQOrder(order);
    setOptOrder(optMap);
    if (quiz.timeLimitSec) setRemaining(quiz.timeLimitSec);
    startRef.current = Date.now();
  }, [quiz]);

  const questions = quiz?.questions || [];
  const reviewing = !!result;

  const submit = useCallback(async () => {
    if (submitting || result) return;
    // Build the answers array indexed by ORIGINAL question order.
    const payload = questions.map((q: any, i: number) => {
      const a = answers[i];
      if (q.type === "MULTI") return Array.isArray(a) ? a : [];
      return a === undefined ? -1 : a;
    });
    const timeTakenSec = Math.round((Date.now() - startRef.current) / 1000);
    try {
      setSubmitting(true);
      const attempt: any = await api("/courses/quizzes/" + quizId + "/submit", {
        method: "POST",
        body: { answers: payload, timeTakenSec },
      });
      setResult(attempt);
      setRemaining(null);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not submit quiz.");
    } finally {
      setSubmitting(false);
    }
  }, [answers, questions, quizId, submitting, result]);

  // Countdown timer; auto-submits when it hits zero.
  useEffect(() => {
    if (reviewing || remaining === null) return;
    if (remaining <= 0) {
      submit();
      return;
    }
    const t = setTimeout(
      () => setRemaining((r) => (r === null ? null : r - 1)),
      1000,
    );
    return () => clearTimeout(t);
  }, [remaining, reviewing, submit]);

  if (loading) return <Loading />;
  if (!quiz)
    return (
      <View style={s.center}>
        <Text style={s.muted}>Quiz not found.</Text>
      </View>
    );

  function pick(origQ: number, origOpt: number, type: string) {
    if (reviewing) return;
    if (type === "MULTI") {
      const cur = Array.isArray(answers[origQ])
        ? (answers[origQ] as number[])
        : [];
      const next = cur.includes(origOpt)
        ? cur.filter((x) => x !== origOpt)
        : [...cur, origOpt];
      setAnswers({ ...answers, [origQ]: next });
    } else {
      setAnswers({ ...answers, [origQ]: origOpt });
    }
  }

  const allAnswered = questions.every((q: any, i: number) => {
    const a = answers[i];
    if (q.type === "MULTI") return Array.isArray(a) && a.length > 0;
    return a !== undefined;
  });

  const totalPoints = questions.reduce(
    (sum: number, q: any) => sum + (q.points || 1),
    0,
  );

  return (
    <ScrollView style={s.wrap} contentContainerStyle={s.content}>
      <Text style={s.title}>{quiz.title}</Text>
      <Text style={s.subtitle}>
        Pass score: {quiz.passScore || 70}% · {totalPoints} pts
        {quiz.maxAttempts ? " · " + quiz.maxAttempts + " attempts" : ""}
      </Text>

      {!reviewing && remaining !== null ? (
        <View style={[s.timer, remaining <= 30 ? s.timerLow : null]}>
          <Text style={s.timerText}>Time left: {fmtClock(remaining)}</Text>
        </View>
      ) : null}

      {reviewing ? (
        <View style={[s.banner, result.passed ? s.bannerPass : s.bannerFail]}>
          <Text style={s.bannerScore}>{result.score}%</Text>
          <Text style={s.bannerLabel}>
            {result.passed ? "Passed" : "Not passed - try again"}
          </Text>
        </View>
      ) : null}

      {qOrder.map((qi: number) => {
        const q = questions[qi];
        if (!q) return null;
        let options: string[] = [];
        try {
          options = JSON.parse(q.options);
        } catch {
          options = [];
        }
        const order = optOrder[qi] || options.map((_, oi) => oi);
        const isMulti = q.type === "MULTI";
        let correctSet: number[] = [];
        if (isMulti) {
          try {
            correctSet = q.correct ? JSON.parse(q.correct) : [];
          } catch {
            correctSet = [];
          }
        } else {
          correctSet = [q.answer];
        }
        const picked = answers[qi];
        const pickedArr = Array.isArray(picked)
          ? picked
          : picked === undefined
            ? []
            : [picked];
        return (
          <View key={q.id} style={s.questionBox}>
            <View style={s.qHeader}>
              <Text style={s.questionPrompt}>{q.prompt}</Text>
              <Text style={s.pointsTag}>
                {q.points || 1} pt{(q.points || 1) > 1 ? "s" : ""}
              </Text>
            </View>
            {isMulti && !reviewing ? (
              <Text style={s.multiHint}>Select all that apply</Text>
            ) : null}
            {order.map((origOpt: number) => {
              const opt = options[origOpt];
              const isPicked = pickedArr.includes(origOpt);
              const isCorrect = correctSet.includes(origOpt);
              const rowStyle: any[] = [s.option];
              const textStyle: any[] = [s.optionText];
              if (reviewing) {
                if (isCorrect) {
                  rowStyle.push(s.optionCorrect);
                  textStyle.push(s.optionTextSelected);
                } else if (isPicked) {
                  rowStyle.push(s.optionWrong);
                }
              } else if (isPicked) {
                rowStyle.push(s.optionSelected);
                textStyle.push(s.optionTextSelected);
              }
              return (
                <TouchableOpacity
                  key={origOpt}
                  style={rowStyle}
                  disabled={reviewing}
                  onPress={() => pick(qi, origOpt, q.type)}
                >
                  <View
                    style={[
                      isMulti ? s.checkbox : s.radio,
                      isPicked && !reviewing ? s.radioSelected : null,
                    ]}
                  />
                  <Text style={textStyle}>{opt}</Text>
                  {reviewing && isCorrect ? (
                    <Text style={s.tagCorrect}>Correct</Text>
                  ) : null}
                  {reviewing && isPicked && !isCorrect ? (
                    <Text style={s.tagWrong}>Your answer</Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
            {reviewing && q.explanation ? (
              <View style={s.explainBox}>
                <Text style={s.explainLabel}>Why?</Text>
                <Text style={s.explainText}>{q.explanation}</Text>
              </View>
            ) : null}
          </View>
        );
      })}

      {reviewing ? (
        <Button title="Back to course" onPress={() => nav.goBack()} />
      ) : (
        <Button
          title={submitting ? "Submitting..." : "Submit Quiz"}
          onPress={submit}
          disabled={!allAnswered || submitting}
        />
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
  title: { fontSize: 22, fontWeight: "800", color: colors.text },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 4,
    marginBottom: 16,
  },
  timer: {
    backgroundColor: colors.brandLight,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
    alignItems: "center",
  },
  timerLow: { backgroundColor: "#fee2e2" },
  timerText: { fontSize: 15, fontWeight: "800", color: colors.brandDark },
  banner: {
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 18,
    alignItems: "center",
  },
  bannerPass: { backgroundColor: "#dcfce7" },
  bannerFail: { backgroundColor: "#fee2e2" },
  bannerScore: { fontSize: 28, fontWeight: "800", color: colors.text },
  bannerLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    marginTop: 2,
  },
  questionBox: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 14,
  },
  qHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 12,
  },
  questionPrompt: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  pointsTag: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.brandDark,
    backgroundColor: colors.brandLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  multiHint: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 6,
    fontStyle: "italic",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionSelected: { backgroundColor: colors.brandLight, borderBottomWidth: 0 },
  optionCorrect: { backgroundColor: "#dcfce7", borderBottomWidth: 0 },
  optionWrong: { backgroundColor: "#fee2e2", borderBottomWidth: 0 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    marginRight: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.border,
    marginRight: 12,
  },
  radioSelected: { borderColor: colors.brand, backgroundColor: colors.brand },
  optionText: { fontSize: 14, color: colors.text, flex: 1 },
  optionTextSelected: { fontWeight: "600", color: colors.brandDark },
  tagCorrect: { fontSize: 11, fontWeight: "700", color: "#16a34a" },
  tagWrong: { fontSize: 11, fontWeight: "700", color: "#dc2626" },
  explainBox: {
    marginTop: 12,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: 12,
  },
  explainLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.brandDark,
    marginBottom: 2,
  },
  explainText: { fontSize: 13, color: colors.text, lineHeight: 19 },
});
