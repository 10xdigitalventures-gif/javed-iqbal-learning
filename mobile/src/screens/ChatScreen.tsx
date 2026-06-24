import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
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

// ---- Limits (enforced in the UI; the server also enforces package limits) ----
const TEXT_CHAR_LIMIT = 2000; // characters per text message
const AUDIO_MAX_SEC = 120; // voice note length (2 min)
const VIDEO_MAX_SEC = 60; // video message length (1 min)

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
      <TouchableOpacity onPress={toggle} style={[s.playBtn, { borderColor: tint }]}>
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

  useEffect(() => {
    navigation.setOptions({ title: peerName || "Chat" });
  }, [peerName]);

  async function load() {
    try {
      const convo = await api(`/conversations/${conversationId}`);
      setMessages(convo.messages || []);
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

  async function sendText() {
    const body = text.trim();
    if (!body || sending) return;
    setText("");
    try {
      setSending(true);
      await api(`/conversations/${conversationId}/messages`, {
        method: "POST",
        body: { type: "TEXT", body },
      });
      await load();
    } catch (err: any) {
      setText(body);
      Alert.alert("Couldn't send", err?.message || "Please try again.");
    } finally {
      setSending(false);
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
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const mine = item.senderId === user?.id;
          return (
            <View style={[s.bubbleRow, mine ? s.right : s.left]}>
              <View style={[s.bubble, mine ? s.bubbleMine : s.bubbleOther]}>
                {item.type === "AUDIO" ? (
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
                ) : (
                  <Text style={mine ? s.textMine : s.text}>{item.body}</Text>
                )}
              </View>
            </View>
          );
        }}
      />

      {recording ? (
        <View style={s.inputBar}>
          <TouchableOpacity onPress={() => stopRecording(false)} style={s.iconBtn}>
            <Ionicons name="trash-outline" size={24} color={colors.red} />
          </TouchableOpacity>
          <View style={s.recInfo}>
            <View style={s.recDot} />
            <Text style={s.recText}>
              {"Recording  " + fmtDur(recSec) + " / " + fmtDur(AUDIO_MAX_SEC)}
            </Text>
          </View>
          <TouchableOpacity onPress={() => stopRecording(true)} style={s.sendBtnRound}>
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : (
        <View>
          <View style={s.inputBar}>
            <TouchableOpacity onPress={attachFile} style={s.iconBtn} disabled={sending}>
              <Ionicons name="add-circle-outline" size={26} color={colors.brand} />
            </TouchableOpacity>
            <TextInput
              value={text}
              onChangeText={(t) => setText(t.slice(0, TEXT_CHAR_LIMIT))}
              placeholder="Type a message..."
              placeholderTextColor={colors.muted}
              style={s.input}
              multiline
              maxLength={TEXT_CHAR_LIMIT}
            />
            {text.trim() ? (
              <TouchableOpacity onPress={sendText} style={s.sendBtnRound} disabled={sending}>
                <Ionicons name="send" size={18} color="#fff" />
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity onPress={recordVideo} style={s.iconBtn} disabled={sending}>
                  <Ionicons name="videocam-outline" size={24} color={colors.brand} />
                </TouchableOpacity>
                <TouchableOpacity onPress={startRecording} style={s.iconBtn} disabled={sending}>
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
              <Text style={s.counter}>{text.length + "/" + TEXT_CHAR_LIMIT}</Text>
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
  recInfo: { flex: 1, flexDirection: "row", alignItems: "center", marginLeft: 8 },
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
});
