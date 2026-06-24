import React, { useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { api } from "../api";
import { Button, Loading } from "../components";
import { colors, radius, spacing } from "../theme";

export default function QuizDetailScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const quizId: string = route.params?.quizId;
  const courseId: string = route.params?.courseId;

  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    api("/courses/" + courseId)
      .then((d: any) => {
        const q = d.quizzes?.find((qq: any) => qq.id === quizId);
        setQuiz(q);
      })
      .finally(() => setLoading(false));
  }, [courseId, quizId]);

  if (loading) return <Loading />;
  if (!quiz) return <View style={s.center}><Text style={s.muted}>Quiz not found.</Text></View>;

  const questions = quiz.questions || [];
  const allAnswered = questions.every((q: any, i: number) => answers[i] !== undefined);

  function calculateScore() {
    let score = 0;
    questions.forEach((q: any, i: number) => {
      if (answers[i] === q.answer) score++;
    });
    return Math.round((score / questions.length) * 100);
  }

  async function submit() {
    const score = calculateScore();
    const passed = score >= (quiz.passScore || 70);
    try {
      setSubmitting(true);
      await api("/courses/quizzes/" + quizId + "/submit", {
        method: "POST",
        body: { score, passed },
      });
      Alert.alert(
        passed ? "Passed!" : "Try Again",
        `Your score: ${score}% (${quiz.passScore}% to pass)`,
        [{ text: "OK", onPress: () => nav.goBack() }]
      );
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not submit quiz.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={s.wrap} contentContainerStyle={s.content}>
      <Text style={s.title}>{quiz.title}</Text>
      <Text style={s.subtitle}>Pass score: {quiz.passScore || 70}%</Text>

      {questions.map((q: any, i: number) => {
        const options: string[] = (() => {
          try {
            return JSON.parse(q.options);
          } catch {
            return [];
          }
        })();
        return (
          <View key={q.id} style={s.questionBox}>
            <Text style={s.questionPrompt}>
              {i + 1}. {q.prompt}
            </Text>
            {options.map((opt: string, oi: number) => (
              <TouchableOpacity
                key={oi}
                style={[s.option, answers[i] === oi ? s.optionSelected : null]}
                onPress={() => setAnswers({ ...answers, [i]: oi })}
              >
                <View style={[s.radio, answers[i] === oi ? s.radioSelected : null]} />
                <Text style={[s.optionText, answers[i] === oi ? s.optionTextSelected : null]}>
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        );
      })}

      <Button
        title={submitting ? "Submitting..." : "Submit Quiz"}
        onPress={submit}
        disabled={!allAnswered || submitting}
      />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 32 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  muted: { color: colors.muted },
  title: { fontSize: 22, fontWeight: "800", color: colors.text },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 4, marginBottom: 20 },
  questionBox: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 14,
  },
  questionPrompt: { fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: 12 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionSelected: { backgroundColor: colors.brandLight, borderRadius: 8, paddingHorizontal: 8, borderWidth: 0 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    marginRight: 12,
  },
  radioSelected: { borderColor: colors.brand, backgroundColor: colors.brand },
  optionText: { fontSize: 14, color: colors.text, flex: 1 },
  optionTextSelected: { fontWeight: "600", color: colors.brandDark },
});
