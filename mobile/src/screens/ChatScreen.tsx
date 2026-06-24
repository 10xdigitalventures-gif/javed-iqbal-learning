import React, { useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import { api } from "../api";
import { useAuth } from "../auth";
import { colors } from "../theme";

export default function ChatScreen({ route, navigation }: any) {
  const { conversationId, peerName } = route.params;
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
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
    return () => clearInterval(t);
  }, [conversationId]);

  async function send() {
    if (!text.trim()) return;
    const body = text;
    setText("");
    try {
      await api(`/conversations/${conversationId}/messages`, {
        method: "POST",
        body: { type: "TEXT", body },
      });
      load();
    } catch (err: any) {
      setText(body);
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
        onContentSizeChange={() => listRef.current?.scrollToEnd()}
        renderItem={({ item }) => {
          const mine = item.senderId === user?.id;
          return (
            <View style={[s.bubbleRow, mine ? s.right : s.left]}>
              <View style={[s.bubble, mine ? s.bubbleMine : s.bubbleOther]}>
                {item.type !== "TEXT" ? (
                  <Text style={mine ? s.metaMine : s.meta}>
                    {item.type === "AUDIO" ? "Audio message" : "Video message"}
                  </Text>
                ) : null}
                <Text style={mine ? s.textMine : s.text}>{item.body}</Text>
              </View>
            </View>
          );
        }}
      />
      <View style={s.inputBar}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Type a message..."
          style={s.input}
        />
        <TouchableOpacity onPress={send} style={s.sendBtn}>
          <Text style={s.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
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
  meta: { fontSize: 11, color: colors.muted, marginBottom: 2 },
  metaMine: { fontSize: 11, color: "#dbe2ff", marginBottom: 2 },
  inputBar: {
    flexDirection: "row",
    padding: 10,
    borderTopWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  sendBtn: {
    marginLeft: 8,
    backgroundColor: colors.brand,
    borderRadius: 20,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  sendText: { color: "#fff", fontWeight: "600" },
});
