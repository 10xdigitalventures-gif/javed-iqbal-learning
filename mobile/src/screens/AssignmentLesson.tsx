import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { api, uploadMedia } from "../api";
import { colors, radius, spacing } from "../theme";

// A file attached to an assignment task or a learner submission.
type SubFile = { key: string; name: string; size?: number };

type Submission = {
  id: string;
  status: "UNDER_REVIEW" | "APPROVED" | "REJECTED";
  answerText?: string | null;
  attachments?: SubFile[];
  grade?: number | null;
  feedback?: string | null;
  submittedAt?: string;
  reviewedAt?: string | null;
};

type Assignment = {
  id: string;
  title: string;
  description?: string | null;
  attachments?: SubFile[];
  mySubmission?: Submission | null;
};

const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB per file

// Mime types accepted by the picker (mirrors the reference screenshots).
const ACCEPT_TYPES = [
  "image/*",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

function prettySize(bytes?: number) {
  if (!bytes || bytes <= 0) return "";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return mb.toFixed(1) + " MB";
  return Math.max(1, Math.round(bytes / 1024)) + " KB";
}

async function openStoredFile(key: string) {
  try {
    const signed: any = await api("/media/sign?key=" + encodeURIComponent(key));
    if (signed?.url) Linking.openURL(signed.url);
  } catch {
    Alert.alert("Could not open", "This file is not available right now.");
  }
}

export default function AssignmentLesson({
  assignment,
  locked,
  prevTitle,
  onSubmitted,
}: {
  assignment: Assignment;
  locked: boolean;
  prevTitle?: string;
  onSubmitted: () => void;
}) {
  const mySub = assignment.mySubmission || null;
  const [tab, setTab] = useState<"details" | "attachments">("details");
  const [editing, setEditing] = useState(
    !mySub || mySub.status === "REJECTED",
  );
  const [answer, setAnswer] = useState(mySub?.answerText || "");
  const [files, setFiles] = useState<SubFile[]>(mySub?.attachments || []);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ----- Locked state (prerequisite not complete yet) -----
  if (locked) {
    return (
      <View style={s.lockedCard}>
        <Ionicons name="lock-closed" size={40} color={colors.brand} />
        <Text style={s.lockedTitle}>This lesson is locked</Text>
        <Text style={s.lockedBody}>
          To unlock this assignment, please complete the required lesson below.
        </Text>
        {prevTitle ? (
          <View style={s.prereqRow}>
            <Ionicons name="ellipse-outline" size={18} color={colors.muted} />
            <Text style={s.prereqText} numberOfLines={2}>
              {prevTitle}
            </Text>
          </View>
        ) : null}
        <Text style={s.lockedProgress}>Progress 0/1 done</Text>
      </View>
    );
  }

  async function pickFiles() {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ACCEPT_TYPES,
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.length) return;
      setUploading(true);
      for (const a of res.assets) {
        if (a.size && a.size > MAX_FILE_BYTES) {
          Alert.alert(
            "File too large",
            (a.name || "This file") + " is over the 50 MB limit.",
          );
          continue;
        }
        const uploaded = await uploadMedia({
          uri: a.uri,
          name: a.name || "upload-" + Date.now(),
          type: a.mimeType || "application/octet-stream",
        });
        const entry: SubFile = {
          key: uploaded.key,
          name: a.name || "upload",
          size: a.size,
        };
        setFiles((prev) => [...prev, entry]);
      }
    } catch {
      Alert.alert("Upload error", "Could not upload one of the files.");
    } finally {
      setUploading(false);
    }
  }

  function removeFile(key: string) {
    setFiles((prev) => prev.filter((f) => f.key !== key));
  }

  async function submit() {
    if (!answer.trim() && files.length === 0) {
      Alert.alert(
        "Nothing to submit",
        "Please write an answer or attach a file first.",
      );
      return;
    }
    setSubmitting(true);
    try {
      await api("/courses/assignments/" + assignment.id + "/submit", {
        method: "POST",
        body: {
          answerText: answer.trim() || null,
          attachments: JSON.stringify(files),
        },
      });
      setEditing(false);
      Alert.alert(
        "Submitted",
        "Your assignment is now under review by the instructor.",
      );
      onSubmitted();
    } catch (e: any) {
      Alert.alert("Submit failed", e?.message || "Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const refFiles = assignment.attachments || [];

  return (
    <View>
      {/* Tabs: Details | Attachments */}
      <View style={s.tabs}>
        {(["details", "attachments"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={tab === t ? s.tabActive : s.tab}
            onPress={() => setTab(t)}
          >
            <Text style={tab === t ? s.tabActiveText : s.tabText}>
              {t === "details" ? "Details" : "Attachments"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "details" ? (
        <Text style={s.taskText}>
          {assignment.description ||
            "The instructor has not added task details yet."}
        </Text>
      ) : (
        <View>
          {refFiles.length === 0 ? (
            <View style={s.emptyAttach}>
              <Ionicons
                name="document-outline"
                size={32}
                color={colors.muted}
              />
              <Text style={s.emptyAttachText}>No attachments available</Text>
            </View>
          ) : (
            refFiles.map((f) => (
              <TouchableOpacity
                key={f.key}
                style={s.fileRow}
                onPress={() => openStoredFile(f.key)}
              >
                <Ionicons
                  name="document-text-outline"
                  size={18}
                  color={colors.brand}
                />
                <Text style={s.fileName} numberOfLines={1}>
                  {f.name}
                  {f.size ? "  (" + prettySize(f.size) + ")" : ""}
                </Text>
                <Ionicons name="download-outline" size={18} color={colors.muted} />
              </TouchableOpacity>
            ))
          )}
        </View>
      )}

      <View style={s.divider} />

      {/* Submission area */}
      {editing ? (
        <View>
          {mySub?.status === "REJECTED" && mySub.feedback ? (
            <View style={s.rejectedBanner}>
              <Text style={s.rejectedTitle}>Changes requested</Text>
              <Text style={s.rejectedBody}>{mySub.feedback}</Text>
            </View>
          ) : null}

          <Text style={s.fieldLabel}>Your answer</Text>
          <TextInput
            style={s.answerInput}
            value={answer}
            onChangeText={setAnswer}
            placeholder="Enter your answer here"
            placeholderTextColor={colors.muted}
            multiline
          />

          <Text style={s.fieldLabel}>Attachments</Text>
          <TouchableOpacity
            style={s.uploadBox}
            onPress={pickFiles}
            disabled={uploading}
            activeOpacity={0.85}
          >
            {uploading ? (
              <ActivityIndicator color={colors.brand} />
            ) : (
              <>
                <Ionicons
                  name="cloud-upload-outline"
                  size={26}
                  color={colors.brand}
                />
                <Text style={s.uploadText}>Click to upload</Text>
                <Text style={s.uploadHint}>
                  SVG, PNG, JPG, JPEG, WEBP, XLSX, DOC, PPT, PDF (max 50MB)
                </Text>
              </>
            )}
          </TouchableOpacity>

          {files.map((f) => (
            <View key={f.key} style={s.uploadedRow}>
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={colors.green}
              />
              <Text style={s.fileName} numberOfLines={1}>
                {f.name}
                {f.size ? "  (" + prettySize(f.size) + ")" : ""}
              </Text>
              <TouchableOpacity onPress={() => removeFile(f.key)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={colors.red} />
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity
            style={s.submitBtn}
            onPress={submit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={s.submitText}>Submit assignment</Text>
            )}
          </TouchableOpacity>

          {mySub ? (
            <TouchableOpacity
              style={s.cancelLink}
              onPress={() => setEditing(false)}
            >
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <View>
          {/* Reviewed / under-review status */}
          {mySub?.status === "APPROVED" ? (
            <View style={s.approvedBanner}>
              <Ionicons name="checkmark-circle" size={22} color={colors.green} />
              <View style={s.flex1}>
                <Text style={s.approvedTitle}>Assignment approved</Text>
                {mySub.grade != null ? (
                  <Text style={s.approvedBody}>Grade: {mySub.grade}</Text>
                ) : null}
                {mySub.feedback ? (
                  <Text style={s.approvedBody}>{mySub.feedback}</Text>
                ) : null}
              </View>
            </View>
          ) : (
            <View style={s.reviewBanner}>
              <Ionicons name="time-outline" size={22} color={colors.brand} />
              <View style={s.flex1}>
                <Text style={s.reviewTitle}>Assignment under review</Text>
                <Text style={s.reviewBody}>
                  Your assignment is currently under review by the instructor.
                  You will receive feedback and your final grade once the
                  review is complete.
                </Text>
              </View>
            </View>
          )}

          {/* Your submission */}
          <Text style={s.subHeading}>Your submission</Text>
          {mySub?.answerText ? (
            <Text style={s.submittedAnswer}>{mySub.answerText}</Text>
          ) : null}
          {(mySub?.attachments || []).length > 0 ? (
            <View>
              <Text style={s.docsLabel}>Documents submitted</Text>
              {(mySub?.attachments || []).map((f) => (
                <TouchableOpacity
                  key={f.key}
                  style={s.fileRow}
                  onPress={() => openStoredFile(f.key)}
                >
                  <Ionicons
                    name="document-text-outline"
                    size={18}
                    color={colors.brand}
                  />
                  <Text style={s.fileName} numberOfLines={1}>
                    {f.name}
                    {f.size ? "  (" + prettySize(f.size) + ")" : ""}
                  </Text>
                  <Ionicons
                    name="download-outline"
                    size={18}
                    color={colors.muted}
                  />
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          {/* Next steps + actions */}
          <Text style={s.nextSteps}>
            {mySub?.status === "APPROVED"
              ? "Great work! The next lesson is now unlocked."
              : "Note: once the instructor approves your work, the next video unlocks within 12 hours."}
          </Text>

          <View style={s.actionRow}>
            <TouchableOpacity
              style={s.retakeBtn}
              onPress={() => setEditing(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="refresh" size={16} color={colors.brand} />
              <Text style={s.retakeText}>Retake</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  tabs: { flexDirection: "row", gap: 8, marginBottom: spacing.md },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
  },
  tabActive: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  tabText: { color: colors.muted, fontWeight: "700", fontSize: 13 },
  tabActiveText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  taskText: { fontSize: 15, color: colors.text, lineHeight: 24 },
  emptyAttach: { alignItems: "center", paddingVertical: 28, gap: 8 },
  emptyAttachText: { color: colors.muted, fontSize: 13 },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },
  fileName: { flex: 1, color: colors.text, fontSize: 13, fontWeight: "600" },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 6,
    marginTop: 4,
  },
  answerInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    minHeight: 110,
    textAlignVertical: "top",
    color: colors.text,
    fontSize: 14,
    marginBottom: spacing.md,
  },
  uploadBox: {
    borderWidth: 1.5,
    borderColor: colors.brand,
    borderStyle: "dashed",
    borderRadius: radius.md,
    paddingVertical: 22,
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.brandLight,
  },
  uploadText: { color: colors.brand, fontWeight: "700", fontSize: 14 },
  uploadHint: {
    color: colors.muted,
    fontSize: 11,
    textAlign: "center",
    paddingHorizontal: 16,
  },
  uploadedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  submitBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  submitText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  cancelLink: { alignItems: "center", paddingVertical: 12 },
  cancelText: { color: colors.muted, fontSize: 13 },
  reviewBanner: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: colors.brandLight,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: spacing.lg,
  },
  reviewTitle: { fontWeight: "700", color: colors.text, fontSize: 14 },
  reviewBody: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 4 },
  approvedBanner: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#dcfce7",
    borderRadius: radius.md,
    padding: 14,
    marginBottom: spacing.lg,
  },
  approvedTitle: { fontWeight: "700", color: colors.green, fontSize: 14 },
  approvedBody: { color: colors.text, fontSize: 13, marginTop: 2 },
  rejectedBanner: {
    backgroundColor: "#fee2e2",
    borderRadius: radius.md,
    padding: 14,
    marginBottom: spacing.md,
  },
  rejectedTitle: { fontWeight: "700", color: colors.red, fontSize: 14 },
  rejectedBody: { color: colors.text, fontSize: 13, marginTop: 4 },
  flex1: { flex: 1 },
  subHeading: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 8,
  },
  submittedAnswer: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: spacing.md,
  },
  docsLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
    marginBottom: 8,
  },
  nextSteps: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 20,
    marginTop: spacing.md,
  },
  actionRow: { flexDirection: "row", gap: 12, marginTop: spacing.lg },
  retakeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.brand,
    borderRadius: radius.pill,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retakeText: { color: colors.brand, fontWeight: "700", fontSize: 14 },
  lockedCard: { alignItems: "center", paddingVertical: 36, gap: 10 },
  lockedTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
  lockedBody: {
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 24,
  },
  prereqRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 8,
    width: "100%",
  },
  prereqText: { flex: 1, color: colors.text, fontSize: 13, fontWeight: "600" },
  lockedProgress: { fontSize: 12, color: colors.muted, marginTop: 4 },
});
