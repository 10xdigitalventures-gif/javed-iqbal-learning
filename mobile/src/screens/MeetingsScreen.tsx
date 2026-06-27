import React, { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Linking,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Loading, styles as ui } from "../components";
import { colors } from "../theme";

const statusColor: Record<string, string> = {
  REQUESTED: colors.amber,
  APPROVED: colors.green,
  REJECTED: colors.red,
  COMPLETED: colors.brand,
  CANCELLED: colors.muted,
};

// Compact UTC stamp Google Calendar expects: YYYYMMDDTHHMMSSZ
function gcalStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// Build an "Add to Google Calendar" link for a meeting. Needs no API keys - it
// just opens Google Calendar's event-template page pre-filled with the meeting
// details (and the Meet/join link in the description + location).
function googleCalendarUrl(meeting: any): string {
  const start = new Date(meeting.scheduledAt);
  const end = new Date(start.getTime() + (meeting.durationMin || 30) * 60000);
  const dates = gcalStamp(start) + "/" + gcalStamp(end);
  const details =
    (meeting.notes ? meeting.notes + "\n\n" : "") +
    (meeting.meetingUrl ? "Join: " + meeting.meetingUrl : "");
  let url =
    "https://calendar.google.com/calendar/render?action=TEMPLATE" +
    "&text=" +
    encodeURIComponent(meeting.title || "Consultation") +
    "&dates=" +
    dates +
    "&details=" +
    encodeURIComponent(details);
  if (meeting.meetingUrl)
    url += "&location=" + encodeURIComponent(meeting.meetingUrl);
  return url;
}

export default function MeetingsScreen() {
  const { user } = useAuth();
  const [list, setList] = useState<any[] | null>(null);
  const [approving, setApproving] = useState<any | null>(null);
  const [linkText, setLinkText] = useState("");
  const [busy, setBusy] = useState(false);
  const isConsultant = user?.role === "CONSULTANT";

  function load() {
    api("/meetings")
      .then(setList)
      .catch(() => setList([]));
  }

  useFocusEffect(
    useCallback(() => {
      load();
    }, []),
  );

  async function act(id: string, action: string, body?: any) {
    await api(`/meetings/${id}/${action}`, { method: "POST", body });
    load();
  }

  // Consultant approves: attach a Google Meet (or any) link for the client.
  function openApprove(m: any) {
    setApproving(m);
    setLinkText(m.meetingUrl || "");
  }

  async function confirmApprove() {
    if (!approving) return;
    try {
      setBusy(true);
      await act(approving.id, "approve", {
        meetingUrl: linkText.trim() || undefined,
      });
      setApproving(null);
      setLinkText("");
    } catch (e: any) {
      Alert.alert("Couldn't approve", e?.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function openMeet() {
    Linking.openURL("https://meet.google.com/new");
  }

  if (!list) return <Loading />;

  return (
    <>
      <FlatList
        style={s.wrap}
        contentContainerStyle={s.content}
        data={list}
        keyExtractor={(m) => m.id}
        ListHeaderComponent={<Text style={ui.title}>Meetings</Text>}
        ListEmptyComponent={<Text style={s.empty}>No meetings yet.</Text>}
        renderItem={({ item }) => {
          const peer = isConsultant ? item.client?.name : item.consultant?.name;
          const hasLink = !!item.meetingUrl;
          const joinable = item.status === "APPROVED" && hasLink;
          return (
            <Card>
              <View style={s.head}>
                <Text style={s.title}>{item.title}</Text>
                <Badge text={item.status} color={statusColor[item.status]} />
              </View>
              <Text style={s.sub}>
                {peer} {"\u00b7"} {new Date(item.scheduledAt).toLocaleString()}{" "}
                {"\u00b7"} {item.durationMin} min
              </Text>

              {joinable ? (
                <TouchableOpacity
                  style={s.joinBtn}
                  onPress={() => Linking.openURL(item.meetingUrl)}
                >
                  <Ionicons name="videocam" size={16} color="#fff" />
                  <Text style={s.joinText}>Join Google Meet</Text>
                </TouchableOpacity>
              ) : null}

              {item.status === "APPROVED" ? (
                <TouchableOpacity
                  style={s.calBtn}
                  onPress={() => Linking.openURL(googleCalendarUrl(item))}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={16}
                    color={colors.brand}
                  />
                  <Text style={s.calText}>Add to Google Calendar</Text>
                </TouchableOpacity>
              ) : null}

              <View style={s.actions}>
                {isConsultant && item.status === "REQUESTED" ? (
                  <>
                    <Button title="Approve" onPress={() => openApprove(item)} />
                    <Button
                      title="Reject"
                      variant="outline"
                      onPress={() => act(item.id, "reject")}
                    />
                  </>
                ) : null}
                {isConsultant && item.status === "APPROVED" ? (
                  <>
                    <Button
                      title={hasLink ? "Edit link" : "Add link"}
                      variant="outline"
                      onPress={() => openApprove(item)}
                    />
                    <Button
                      title="Complete"
                      onPress={() => act(item.id, "complete")}
                    />
                  </>
                ) : null}
                {!isConsultant &&
                (item.status === "REQUESTED" || item.status === "APPROVED") ? (
                  <Button
                    title="Cancel"
                    variant="outline"
                    onPress={() => act(item.id, "cancel")}
                  />
                ) : null}
              </View>
            </Card>
          );
        }}
      />

      <Modal
        visible={!!approving}
        transparent
        animationType="slide"
        onRequestClose={() => setApproving(null)}
      >
        <View style={s.backdrop}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Meeting link</Text>
            <Text style={s.sheetSub}>
              Paste a Google Meet (or Zoom) link so your client can join the
              session.
            </Text>
            <TouchableOpacity style={s.meetBtn} onPress={openMeet}>
              <Ionicons name="logo-google" size={16} color={colors.brand} />
              <Text style={s.meetText}>Create a Google Meet link</Text>
            </TouchableOpacity>
            <TextInput
              value={linkText}
              onChangeText={setLinkText}
              placeholder="https://meet.google.com/..."
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              style={s.input}
            />
            <View style={s.sheetActions}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setApproving(null)}
              />
              <Button
                title={busy ? "Saving..." : "Approve & send"}
                onPress={confirmApprove}
                disabled={busy}
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 28 },
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontWeight: "700", color: colors.text, flex: 1, marginRight: 8 },
  sub: { color: colors.muted, fontSize: 12, marginTop: 4 },
  actions: { flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" },
  empty: { color: colors.muted, marginTop: 12 },
  joinBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.green,
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 10,
  },
  joinText: { color: "#fff", fontWeight: "700" },
  calBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.brand,
    borderRadius: 10,
    paddingVertical: 9,
    marginTop: 8,
  },
  calText: { color: colors.brand, fontWeight: "700" },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  sheetSub: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 4,
    marginBottom: 14,
  },
  meetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  meetText: { color: colors.text, fontWeight: "600", fontSize: 13 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
    color: colors.text,
  },
  sheetActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 16,
  },
});
