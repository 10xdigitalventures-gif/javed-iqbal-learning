import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Audio, ResizeMode, Video } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { api, uploadMedia } from "../api";
import { useAuth } from "../auth";
import { colors } from "../theme";
import { useContentProtection } from "../protect";

// ---- Limits (enforced in the UI; the server also enforces package limits) ----
const TEXT_CHAR_LIMIT = 2000; // characters per text message
const AUDIO_MAX_SEC = 120; // voice note length (2 min)
const VIDEO_MAX_SEC = 60; // video message length (1 min)

// Quick-reaction palette shown in the message action sheet.
const REACTION_EMOJIS = [
  "\uD83D\uDC4D",
  "\u2764\uFE0F",
  "\uD83D\uDE02",
  "\uD83D\uDE2E",
  "\uD83D\uDE22",
  "\uD83D\uDE4F",
];

function previewText(m: any): string {
  if (!m) return "";
  if (m.type === "TEXT") return m.body || "";
  if (m.type === "IMAGE") return "\uD83D\uDDBC\uFE0F Photo";
  if (m.type === "FILE") return "\uD83D\uDCCE " + (m.fileName || "File");
  if (m.type === "AUDIO") return "\uD83C\uDFA4 Audio message";
  if (m.type === "VIDEO") return "\uD83C\uDFA5 Video message";
  return "";
}

function fmtDur(sec?: number | null) {
  const s = Math.max(0, Math.round(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ":" + r.toString().padStart(2, "0");
}

// Inline audio player for a voice message bubble.
function AudioBubble({
  uri,
  durationSec,
  mine,
}: {
  uri?: string;
  durationSec?: number;
  mine: boolean;
}) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);

  useEffect(() => {
    return () => {
      sound && sound.unloadAsync();
    };
  }, [sound]);

  async function toggle() {
    if (!uri) return;
    try {
      if (sound) {
        if (playing) {
          await sound.pauseAsync();
          setPlaying(false);
        } else {
          await sound.playAsync();
          setPlaying(true);
        }
        return;
      }
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const src = { uri };
      const created = await Audio.Sound.createAsync(src, { shouldPlay: true });
      const snd = created.sound;
      snd.setOnPlaybackStatusUpdate((st: any) => {
        if (!st || !st.isLoaded) return;
        setPos(st.positionMillis ? st.positionMillis / 1000 : 0);
        if (st.didJustFinish) {
          setPlaying(false);
          setPos(0);
          snd.setPositionAsync(0);
        } else {
          setPlaying(!!st.isPlaying);
        }
      });
      setSound(snd);
      setPlaying(true);
    } catch {
      Alert.alert("Playback error", "Could not play this voice message.");
    }
  }

  const tint = mine ? "#fff" : colors.brand;
  const shown = playing || pos > 0 ? pos : durationSec;
  return (
    <View style={s.audioRow}>
      <TouchableOpacity
        onPress={toggle}
        style={[s.playBtn, { borderColor: tint }]}
      >
        <Ionicons name={playing ? "pause" : "play"} size={16} color={tint} />
      </TouchableOpacity>
      <Ionicons name="mic" size={14} color={tint} style={s.audioIcon} />
      <Text style={[s.audioDur, { color: tint }]}>{fmtDur(shown)}</Text>
    </View>
  );
}

// Inline video player for a video message bubble.
function VideoBubble({
  uri,
  durationSec,
  mine,
}: {
  uri?: string;
  durationSec?: number;
  mine: boolean;
}) {
  if (!uri) return null;
  const src = { uri };
  return (
    <View>
      <Video
        source={src}
        style={s.video}
        useNativeControls
        resizeMode={ResizeMode.CONTAIN}
      />
      <View style={s.videoMetaRow}>
        <Ionicons
          name="videocam"
          size={13}
          color={mine ? "#fff" : colors.brand}
        />
        <Text style={[s.videoMeta, { color: mine ? "#fff" : colors.brand }]}>
          {fmtDur(durationSec)}
        </Text>
      </View>
    </View>
  );
}

export default function ChatScreen({ route, navigation }: any) {
  // Block screenshots / screen recording inside the chat.
  useContentProtection();
  const { conversationId, peerName } = route.params;
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recSec, setRecSec] = useState(0);
  const recRef = useRef<Audio.Recording | null>(null);
  const recSecRef = useRef(0);
  const recTimer = useRef<any>(null);
  const listRef = useRef<FlatList>(null);
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [editing, setEditing] = useState<{ id: string } | null>(null);
  const [actionMsg, setActionMsg] = useState<any | null>(null);
  const typingSentAt = useRef(0);
  const [allowance, setAllowance] = useState<any>(null);
  const [consultantId, setConsultantId] = useState<string | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: peerName || "Chat" });
  }, [peerName]);

  async function load() {
    try {
      const convo = await api(`/conversations/${conversationId}`);
      setMessages(convo.messages || []);
      if (convo.consultantId) setConsultantId(convo.consultantId);
      // Clients see remaining package credits; refresh them so the composer
      // can prompt a purchase the moment they run out.
      if (user?.role === "CLIENT" && convo.consultantId) {
        api(`/purchases/allowance?consultantId=${convo.consultantId}`)
          .then(setAllowance)
          .catch(() => {});
      }
      await api(`/conversations/${conversationId}/read`, { method: "POST" });
    } catch {}
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => {
      clearInterval(t);
      if (recTimer.current) clearInterval(recTimer.current);
      recRef.current && recRef.current.stopAndUnloadAsync().catch(() => {});
    };
  }, [conversationId]);

  // Throttled typing ping so the peer sees a "typing…" indicator.
  function onType(t: string) {
    setText(t.slice(0, TEXT_CHAR_LIMIT));
    const now = Date.now();
    if (now - typingSentAt.current > 1500) {
      typingSentAt.current = now;
      api(`/conversations/${conversationId}/typing`, {
        method: "POST",
        body: { typing: true },
      }).catch(() => {});
    }
  }

  async function sendText() {
    if (editing) return saveEdit();
    const body = text.trim();
    if (!body || sending) return;
    const replyId = replyTo?.id;
    setText("");
    setReplyTo(null);
    try {
      setSending(true);
      await api(`/conversations/${conversationId}/messages`, {
        method: "POST",
        body: { type: "TEXT", body, replyToId: replyId },
      });
      await load();
    } catch (err: any) {
      setText(body);
      Alert.alert("Couldn't send", err?.message || "Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    const body = text.trim();
    if (!body) return;
    const id = editing.id;
    setEditing(null);
    setText("");
    try {
      setSending(true);
      await api(`/conversations/${conversationId}/messages/${id}`, {
        method: "PATCH",
        body: { body },
      });
      await load();
    } catch (err: any) {
      Alert.alert("Couldn't edit", err?.message || "Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function deleteMessage(id: string) {
    try {
      await api(`/conversations/${conversationId}/messages/${id}`, {
        method: "DELETE",
      });
      await load();
    } catch (err: any) {
      Alert.alert("Couldn't delete", err?.message || "Please try again.");
    }
  }

  async function toggleReaction(id: string, emoji: string) {
    setActionMsg(null);
    try {
      await api(`/conversations/${conversationId}/messages/${id}/react`, {
        method: "POST",
        body: { emoji },
      });
      await load();
    } catch (err: any) {
      Alert.alert("Reaction failed", err?.message || "Please try again.");
    }
  }

  async function sendMedia(
    type: "AUDIO" | "VIDEO",
    file: { uri: string; name: string; type: string },
    fallbackDur?: number,
  ) {
    try {
      setSending(true);
      const up = await uploadMedia(file);
      await api(`/conversations/${conversationId}/messages`, {
        method: "POST",
        body: {
          type,
          mediaKey: up.key,
          durationSec: up.durationSec != null ? up.durationSec : fallbackDur,
        },
      });
      await load();
    } catch (err: any) {
      Alert.alert("Couldn't send", err?.message || "Upload failed.");
    } finally {
      setSending(false);
    }
  }

  // ---- WhatsApp-style voice recording ----
  async function startRecording() {
    if (sending) return;
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Microphone needed",
          "Please allow microphone access to record voice messages.",
        );
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const created = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recRef.current = created.recording;
      recSecRef.current = 0;
      setRecSec(0);
      setRecording(true);
      recTimer.current = setInterval(() => {
        recSecRef.current += 1;
        setRecSec(recSecRef.current);
        if (recSecRef.current >= AUDIO_MAX_SEC) stopRecording(true);
      }, 1000);
    } catch {
      Alert.alert("Recording error", "Could not start recording.");
    }
  }

  async function stopRecording(shouldSend: boolean) {
    if (recTimer.current) {
      clearInterval(recTimer.current);
      recTimer.current = null;
    }
    const rec = recRef.current;
    recRef.current = null;
    setRecording(false);
    if (!rec) return;
    let dur = recSecRef.current;
    let uri: string | null = null;
    try {
      const status = await rec.stopAndUnloadAsync();
      if (status && status.durationMillis)
        dur = Math.round(status.durationMillis / 1000);
      uri = rec.getURI();
    } catch {}
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    } catch {}
    setRecSec(0);
    recSecRef.current = 0;
    if (shouldSend && uri && dur >= 1) {
      await sendMedia(
        "AUDIO",
        { uri, name: "voice-" + Date.now() + ".m4a", type: "audio/m4a" },
        dur,
      );
    }
  }

  // ---- Video recording via the camera (enforces the time limit natively) ----
  async function recordVideo() {
    if (sending) return;
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Camera needed",
          "Please allow camera access to record video messages.",
        );
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ["videos"] as any,
        videoMaxDuration: VIDEO_MAX_SEC,
        quality: 0.7,
      });
      if (res.canceled || !res.assets || !res.assets.length) return;
      const a = res.assets[0];
      const dur = a.duration ? Math.round(a.duration / 1000) : undefined;
      await sendMedia(
        "VIDEO",
        {
          uri: a.uri,
          name: a.fileName || "video-" + Date.now() + ".mp4",
          type: a.mimeType || "video/mp4",
        },
        dur,
      );
    } catch {
      Alert.alert("Camera error", "Could not record video.");
    }
  }

  // ---- Upload an existing audio/video file from the device ----
  async function attachFile() {
    if (sending) return;
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["audio/*", "video/*"],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets || !res.assets.length) return;
      const a = res.assets[0];
      const mime = a.mimeType || "";
      if (!mime.startsWith("audio") && !mime.startsWith("video")) {
        Alert.alert("Unsupported file", "Please pick an audio or video file.");
        return;
      }
      const type = mime.startsWith("video") ? "VIDEO" : "AUDIO";
      await sendMedia(type, {
        uri: a.uri,
        name: a.name || "upload-" + Date.now(),
        type: mime,
      });
    } catch {
      Alert.alert("Upload error", "Could not upload the file.");
    }
  }

  // ---- Generic attachment (image or any document) ----
  async function sendAttachment(
    type: "IMAGE" | "FILE" | "AUDIO" | "VIDEO",
    file: { uri: string; name: string; type: string },
  ) {
    const replyId = replyTo?.id;
    try {
      setSending(true);
      const up = await uploadMedia(file);
      await api(`/conversations/${conversationId}/messages`, {
        method: "POST",
        body: {
          type,
          mediaKey: up.key,
          fileName: file.name,
          durationSec: up.durationSec != null ? up.durationSec : undefined,
          replyToId: replyId,
        },
      });
      setReplyTo(null);
      await load();
    } catch (err: any) {
      Alert.alert("Couldn't send", err?.message || "Upload failed.");
    } finally {
      setSending(false);
    }
  }

  async function attachPhoto() {
    if (sending) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Photos needed", "Please allow photo library access.");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"] as any,
        quality: 0.8,
      });
      if (res.canceled || !res.assets || !res.assets.length) return;
      const a = res.assets[0];
      await sendAttachment("IMAGE", {
        uri: a.uri,
        name: a.fileName || "photo-" + Date.now() + ".jpg",
        type: a.mimeType || "image/jpeg",
      });
    } catch {
      Alert.alert("Photo error", "Could not attach photo.");
    }
  }

  async function attachDocument() {
    if (sending) return;
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets || !res.assets.length) return;
      const a = res.assets[0];
      const mime = a.mimeType || "";
      const type = mime.startsWith("image")
        ? "IMAGE"
        : mime.startsWith("video")
          ? "VIDEO"
          : mime.startsWith("audio")
            ? "AUDIO"
            : "FILE";
      await sendAttachment(type, {
        uri: a.uri,
        name: a.name || "file-" + Date.now(),
        type: mime || "application/octet-stream",
      });
    } catch {
      Alert.alert("Upload error", "Could not upload the file.");
    }
  }

  // Bottom "+" opens a simple attach menu.
  function openAttachMenu() {
    if (sending) return;
    Alert.alert("Attach", "Choose what to send", [
      { text: "Photo", onPress: attachPhoto },
      { text: "Document / File", onPress: attachDocument },
      { text: "Audio / Video file", onPress: attachFile },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  // Long-press a message to reply / react / edit / delete.
  function openActions(m: any) {
    if (m.deletedAt) return;
    setActionMsg(m);
  }

  // Show a "buy a package" prompt when a client has no remaining text credits
  // with this consultant.
  const showBuy =
    user?.role === "CLIENT" && !!allowance && !allowance.text?.allowed;

  return (
    <KeyboardAvoidingView
      style={s.wrap}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={s.list}
        onContentSizeChange={() =>
          listRef.current?.scrollToEnd({ animated: true })
        }
        renderItem={({ item }) => {
          const mine = item.senderId === user?.id;
          const deleted = !!item.deletedAt;
          const tint = mine ? "#fff" : colors.brand;
          // Group reactions by emoji with counts + whether I reacted.
          const groups: Record<
            string,
            { emoji: string; count: number; mine: boolean }
          > = {};
          (item.reactions || []).forEach((r: any) => {
            const g = groups[r.emoji] || {
              emoji: r.emoji,
              count: 0,
              mine: false,
            };
            g.count += 1;
            if (r.userId === user?.id) g.mine = true;
            groups[r.emoji] = g;
          });
          const reactionGroups = Object.values(groups);
          const imgSrc = item.mediaUrl ? { uri: item.mediaUrl } : undefined;
          return (
            <View style={[s.bubbleRow, mine ? s.right : s.left]}>
              <View style={s.bubbleWrap}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onLongPress={() => openActions(item)}
                  delayLongPress={250}
                  style={[s.bubble, mine ? s.bubbleMine : s.bubbleOther]}
                >
                  {/* Quoted reply */}
                  {item.replyTo ? (
                    <View
                      style={[
                        s.replyQuote,
                        { borderLeftColor: mine ? "#fff" : colors.brand },
                      ]}
                    >
                      <Text
                        style={[s.replyName, { color: tint }]}
                        numberOfLines={1}
                      >
                        {item.replyTo.sender?.name || "Reply"}
                      </Text>
                      <Text
                        style={[s.replyBody, { color: tint }]}
                        numberOfLines={2}
                      >
                        {previewText(item.replyTo)}
                      </Text>
                    </View>
                  ) : null}

                  {deleted ? (
                    <Text
                      style={[
                        mine ? s.textMine : s.text,
                        { fontStyle: "italic", opacity: 0.8 },
                      ]}
                    >
                      This message was deleted
                    </Text>
                  ) : item.type === "AUDIO" ? (
                    <AudioBubble
                      uri={item.mediaUrl}
                      durationSec={item.durationSec}
                      mine={mine}
                    />
                  ) : item.type === "VIDEO" ? (
                    <VideoBubble
                      uri={item.mediaUrl}
                      durationSec={item.durationSec}
                      mine={mine}
                    />
                  ) : item.type === "IMAGE" && item.mediaUrl ? (
                    <TouchableOpacity
                      onPress={() => Linking.openURL(item.mediaUrl)}
                    >
                      <Image
                        source={imgSrc}
                        style={s.image}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  ) : item.type === "FILE" && item.mediaUrl ? (
                    <TouchableOpacity
                      style={s.fileRow}
                      onPress={() => Linking.openURL(item.mediaUrl)}
                    >
                      <Ionicons name="document" size={20} color={tint} />
                      <Text
                        style={[s.fileName, { color: tint }]}
                        numberOfLines={1}
                      >
                        {item.fileName || "Download file"}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={mine ? s.textMine : s.text}>{item.body}</Text>
                  )}

                  {/* Footer: edited + time + read ticks */}
                  <View style={s.metaRow}>
                    {item.editedAt && !deleted ? (
                      <Text style={[s.metaTxt, { color: tint, opacity: 0.8 }]}>
                        edited
                      </Text>
                    ) : null}
                    <Text style={[s.metaTxt, { color: tint, opacity: 0.7 }]}>
                      {new Date(item.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                    {mine && !deleted ? (
                      <Ionicons
                        name={
                          item.status === "READ" || item.status === "DELIVERED"
                            ? "checkmark-done"
                            : "checkmark"
                        }
                        size={14}
                        color={item.status === "READ" ? "#BAE6FD" : tint}
                      />
                    ) : null}
                  </View>
                </TouchableOpacity>

                {/* Reaction chips */}
                {reactionGroups.length > 0 ? (
                  <View
                    style={[
                      s.reactionRow,
                      mine ? { justifyContent: "flex-end" } : null,
                    ]}
                  >
                    {reactionGroups.map((g) => (
                      <TouchableOpacity
                        key={g.emoji}
                        onPress={() => toggleReaction(item.id, g.emoji)}
                        style={[
                          s.reactionChip,
                          g.mine ? s.reactionChipMine : null,
                        ]}
                      >
                        <Text style={s.reactionEmoji}>{g.emoji}</Text>
                        <Text style={s.reactionCount}>{g.count}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
          );
        }}
      />

      {/* Message action sheet (long-press) */}
      <Modal
        visible={!!actionMsg}
        transparent
        animationType="fade"
        onRequestClose={() => setActionMsg(null)}
      >
        <TouchableOpacity
          style={s.sheetBackdrop}
          activeOpacity={1}
          onPress={() => setActionMsg(null)}
        >
          <View style={s.sheet}>
            <View style={s.emojiRow}>
              {REACTION_EMOJIS.map((e) => (
                <TouchableOpacity
                  key={e}
                  onPress={() => actionMsg && toggleReaction(actionMsg.id, e)}
                  style={s.emojiBtn}
                >
                  <Text style={s.emojiBig}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={s.sheetItem}
              onPress={() => {
                setReplyTo(actionMsg);
                setActionMsg(null);
              }}
            >
              <Ionicons name="arrow-undo" size={20} color={colors.text} />
              <Text style={s.sheetText}>Reply</Text>
            </TouchableOpacity>
            {actionMsg &&
            actionMsg.senderId === user?.id &&
            actionMsg.type === "TEXT" ? (
              <TouchableOpacity
                style={s.sheetItem}
                onPress={() => {
                  setEditing({ id: actionMsg.id });
                  setText(actionMsg.body || "");
                  setActionMsg(null);
                }}
              >
                <Ionicons name="create-outline" size={20} color={colors.text} />
                <Text style={s.sheetText}>Edit</Text>
              </TouchableOpacity>
            ) : null}
            {actionMsg && actionMsg.senderId === user?.id ? (
              <TouchableOpacity
                style={s.sheetItem}
                onPress={() => {
                  const id = actionMsg.id;
                  setActionMsg(null);
                  deleteMessage(id);
                }}
              >
                <Ionicons name="trash-outline" size={20} color={colors.red} />
                <Text style={[s.sheetText, { color: colors.red }]}>Delete</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </TouchableOpacity>
      </Modal>

      {showBuy ? (
        <TouchableOpacity
          style={s.buyBar}
          onPress={() => navigation.navigate("Packages", { consultantId })}
        >
          <Ionicons name="lock-closed" size={16} color={colors.brand} />
          <Text style={s.buyText}>
            You're out of message credits. Tap to buy a package.
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.brand} />
        </TouchableOpacity>
      ) : null}

      {recording ? (
        <View style={s.inputBar}>
          <TouchableOpacity
            onPress={() => stopRecording(false)}
            style={s.iconBtn}
          >
            <Ionicons name="trash-outline" size={24} color={colors.red} />
          </TouchableOpacity>
          <View style={s.recInfo}>
            <View style={s.recDot} />
            <Text style={s.recText}>
              {"Recording  " + fmtDur(recSec) + " / " + fmtDur(AUDIO_MAX_SEC)}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => stopRecording(true)}
            style={s.sendBtnRound}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : (
        <View>
          {replyTo ? (
            <View style={s.replyBar}>
              <View style={s.replyBarBody}>
                <Text style={s.replyBarName} numberOfLines={1}>
                  Replying to {replyTo.sender?.name || "message"}
                </Text>
                <Text style={s.replyBarText} numberOfLines={1}>
                  {previewText(replyTo)}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setReplyTo(null)}
                style={s.iconBtn}
              >
                <Ionicons name="close" size={20} color={colors.muted} />
              </TouchableOpacity>
            </View>
          ) : null}
          {editing ? (
            <View style={s.replyBar}>
              <View style={s.replyBarBody}>
                <Text style={s.replyBarName}>Editing message</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setEditing(null);
                  setText("");
                }}
                style={s.iconBtn}
              >
                <Ionicons name="close" size={20} color={colors.muted} />
              </TouchableOpacity>
            </View>
          ) : null}
          <View style={s.inputBar}>
            <TouchableOpacity
              onPress={openAttachMenu}
              style={s.iconBtn}
              disabled={sending}
            >
              <Ionicons
                name="add-circle-outline"
                size={26}
                color={colors.brand}
              />
            </TouchableOpacity>
            <TextInput
              value={text}
              onChangeText={onType}
              placeholder="Type a message..."
              placeholderTextColor={colors.muted}
              style={s.input}
              multiline
              maxLength={TEXT_CHAR_LIMIT}
            />
            {text.trim() ? (
              <TouchableOpacity
                onPress={sendText}
                style={s.sendBtnRound}
                disabled={sending}
              >
                <Ionicons name="send" size={18} color="#fff" />
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  onPress={recordVideo}
                  style={s.iconBtn}
                  disabled={sending}
                >
                  <Ionicons
                    name="videocam-outline"
                    size={24}
                    color={colors.brand}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={startRecording}
                  style={s.iconBtn}
                  disabled={sending}
                >
                  <Ionicons name="mic-outline" size={24} color={colors.brand} />
                </TouchableOpacity>
              </>
            )}
          </View>
          <View style={s.metaBar}>
            {sending ? (
              <View style={s.sendingRow}>
                <ActivityIndicator size="small" color={colors.brand} />
                <Text style={s.sendingText}>Sending…</Text>
              </View>
            ) : (
              <View />
            )}
            {text.length > 0 ? (
              <Text style={s.counter}>
                {text.length + "/" + TEXT_CHAR_LIMIT}
              </Text>
            ) : null}
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  list: { padding: 12 },
  bubbleRow: { marginBottom: 8, flexDirection: "row" },
  left: { justifyContent: "flex-start" },
  right: { justifyContent: "flex-end" },
  bubble: {
    maxWidth: "78%",
    flexShrink: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 13,
  },
  bubbleMine: { backgroundColor: colors.brand },
  bubbleOther: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: { color: colors.text, flexShrink: 1 },
  textMine: { color: "#fff", flexShrink: 1 },
  audioRow: { flexDirection: "row", alignItems: "center", paddingVertical: 2 },
  playBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  audioIcon: { marginRight: 4 },
  audioDur: { fontSize: 13, fontWeight: "600" },
  video: {
    width: 220,
    height: 150,
    borderRadius: 10,
    backgroundColor: "#000",
  },
  videoMetaRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  videoMeta: { fontSize: 12, fontWeight: "600", marginLeft: 4 },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderTopWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
  },
  iconBtn: { padding: 6, alignItems: "center", justifyContent: "center" },
  input: {
    flex: 1,
    maxHeight: 110,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginHorizontal: 4,
    color: colors.text,
  },
  sendBtnRound: {
    marginLeft: 4,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  recInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
  },
  recDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.red,
    marginRight: 8,
  },
  recText: { color: colors.text, fontWeight: "600" },
  metaBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 6,
    backgroundColor: "#fff",
  },
  sendingRow: { flexDirection: "row", alignItems: "center" },
  sendingText: { color: colors.muted, marginLeft: 6, fontSize: 12 },
  counter: { color: colors.muted, fontSize: 12 },
  bubbleWrap: { maxWidth: "82%" },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 3,
  },
  metaTxt: { fontSize: 10, marginRight: 3 },
  replyQuote: {
    borderLeftWidth: 2,
    paddingLeft: 6,
    marginBottom: 5,
    opacity: 0.9,
  },
  replyName: { fontSize: 11, fontWeight: "700" },
  replyBody: { fontSize: 12 },
  image: {
    width: 200,
    height: 200,
    borderRadius: 10,
    backgroundColor: "#0001",
  },
  fileRow: { flexDirection: "row", alignItems: "center", paddingVertical: 2 },
  fileName: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: "600",
    flexShrink: 1,
    textDecorationLine: "underline",
  },
  reactionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 4,
    gap: 4,
  },
  reactionChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginRight: 4,
  },
  reactionChipMine: {
    backgroundColor: colors.brandLight,
    borderColor: colors.brand,
  },
  reactionEmoji: { fontSize: 12 },
  reactionCount: { fontSize: 11, marginLeft: 3, color: colors.text },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "#00000055",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  emojiRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: colors.border,
    marginBottom: 6,
  },
  emojiBtn: { padding: 6 },
  emojiBig: { fontSize: 26 },
  sheetItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  sheetText: { marginLeft: 12, fontSize: 15, color: colors.text },
  replyBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  replyBarBody: {
    flex: 1,
    borderLeftWidth: 2,
    borderLeftColor: colors.brand,
    paddingLeft: 8,
  },
  replyBarName: { fontSize: 12, fontWeight: "700", color: colors.brand },
  replyBarText: { fontSize: 12, color: colors.muted },
  buyBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.brandLight,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: colors.brand,
  },
  buyText: { flex: 1, color: colors.text, fontSize: 13, fontWeight: "600" },
});
