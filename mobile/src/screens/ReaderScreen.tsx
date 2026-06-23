import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { api } from "../api";
import { Loading } from "../components";
import { colors, radius, spacing } from "../theme";
import {
  isAvailableOffline,
  loadProtectedContent,
  saveProtectedContent,
} from "../secure";
import { trackEvent } from "../activity";

type Chapter = { id: string; index: number; title: string };

export default function ReaderScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const bookId: string = route.params?.bookId;
  const title: string = route.params?.title || "Reader";
  const preview: boolean = !!route.params?.preview;

  const [loading, setLoading] = useState(true);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [idx, setIdx] = useState(0);
  const [content, setContent] = useState("");
  const [fontSize, setFontSize] = useState(17);
  const [offline, setOffline] = useState(false);
  const [query, setQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showChapters, setShowChapters] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [highlighted, setHighlighted] = useState<Record<number, boolean>>({});

  const startRef = useRef(Date.now());
  const scrollRef = useRef<ScrollView>(null);

  const secureKey = useCallback(
    (chapterId: string | null) => bookId + "::" + (chapterId || "main"),
    [bookId],
  );

  function persistProgress(chapterIndex: number, list: Chapter[]) {
    if (preview) return;
    const seconds = Math.round((Date.now() - startRef.current) / 1000);
    startRef.current = Date.now();
    const pct = list.length
      ? Math.round(((chapterIndex + 1) / list.length) * 100)
      : 0;
    api("/library/progress/" + bookId, {
      method: "PUT",
      body: {
        lastChapterIndex: chapterIndex,
        percentComplete: pct,
        chaptersCompleted: chapterIndex + 1,
        addReadingSeconds: seconds > 0 ? seconds : 0,
        isCompleted: pct >= 100,
      },
    }).catch(() => {});
    trackEvent("chapter_read", {
      bookId,
      chapterIndex,
      percent: pct,
      seconds,
    });
  }

  const fetchChapter = useCallback(
    async (chapterId: string | null, chapterIndex: number) => {
      // Try the authenticated content API first; fall back to the secure
      // on-device copy when offline.
      if (preview) {
        const data = await api("/books/" + bookId + "/preview").catch(
          () => null,
        );
        setContent(
          (data && (data.content || data.text)) ||
            "Preview is not available for this book.",
        );
        return;
      }
      try {
        const qs = chapterId ? "?chapterId=" + chapterId : "";
        const data: any = await api("/library/content/" + bookId + qs);
        const text = data.content || "";
        setContent(text);
        setOffline(false);
        // Re-encrypt and store privately for offline reading.
        saveProtectedContent(
          secureKey(data.chapterId || chapterId),
          text,
        ).catch(() => {});
      } catch {
        const cached = await loadProtectedContent(secureKey(chapterId));
        if (cached != null) {
          setContent(cached);
          setOffline(true);
        } else {
          setContent("This chapter is not available offline yet.");
        }
      }
    },
    [bookId, preview, secureKey],
  );

  const boot = useCallback(async () => {
    setLoading(true);
    try {
      const data: any = await api("/library/content/" + bookId).catch(
        () => null,
      );
      let list: Chapter[] = [];
      let startIdx = 0;
      if (data) {
        list = (data.chapters || []) as Chapter[];
        setChapters(list);
        setContent(data.content || "");
        if (data.content)
          saveProtectedContent(secureKey(data.chapterId), data.content).catch(
            () => {},
          );
      }
      if (!preview) {
        const prog = await api("/library/progress/" + bookId).catch(() => null);
        if (prog && typeof prog.lastChapterIndex === "number") {
          startIdx = Math.min(
            prog.lastChapterIndex,
            Math.max(0, list.length - 1),
          );
        }
        trackEvent("book_opened", { bookId });
      }
      if (startIdx > 0 && list[startIdx]) {
        setIdx(startIdx);
        await fetchChapter(list[startIdx].id, startIdx);
      } else if (data && !data.content) {
        const cached = await loadProtectedContent(secureKey(null));
        if (cached != null) {
          setContent(cached);
          setOffline(true);
        }
      }
    } finally {
      startRef.current = Date.now();
      setLoading(false);
    }
  }, [bookId, preview, secureKey, fetchChapter]);

  useEffect(() => {
    boot();
    return () => {
      persistProgress(idx, chapters);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function goChapter(newIndex: number) {
    if (newIndex < 0 || newIndex >= chapters.length) return;
    persistProgress(idx, chapters);
    setIdx(newIndex);
    setShowChapters(false);
    setQuery("");
    await fetchChapter(chapters[newIndex].id, newIndex);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  async function bookmark() {
    if (preview) return;
    await api("/library/" + bookId + "/bookmarks", {
      method: "POST",
      body: {
        page: idx,
        chapterId: chapters[idx]?.id,
        label: chapters[idx]?.title,
      },
    }).catch(() => {});
    trackEvent("bookmark_added", { bookId, chapterIndex: idx });
  }

  async function toggleHighlight(paragraphIndex: number, text: string) {
    setHighlighted((prev) => {
      const next = { ...prev };
      next[paragraphIndex] = !next[paragraphIndex];
      return next;
    });
    if (preview) return;
    await api("/library/" + bookId + "/highlights", {
      method: "POST",
      body: {
        page: idx,
        text: text.slice(0, 280),
        chapterId: chapters[idx]?.id,
        position: String(paragraphIndex),
      },
    }).catch(() => {});
  }

  async function saveNote() {
    const value = noteText.trim();
    setNoteOpen(false);
    setNoteText("");
    if (!value || preview) return;
    await api("/library/" + bookId + "/notes", {
      method: "POST",
      body: { page: idx, body: value, chapterId: chapters[idx]?.id },
    }).catch(() => {});
    trackEvent("note_added", { bookId, chapterIndex: idx });
  }

  if (loading) return <Loading />;

  const term = query.trim().toLowerCase();
  const paragraphs = content
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  const visible = term
    ? paragraphs.filter((p) => p.toLowerCase().includes(term))
    : paragraphs;
  const chapterTitle = chapters[idx]?.title || title;

  return (
    <View style={s.wrap}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.topTitle} numberOfLines={1}>
          {title}
        </Text>
        <View style={s.topActions}>
          <TouchableOpacity
            onPress={() => setFontSize((f) => Math.max(13, f - 1))}
            hitSlop={6}
          >
            <Text style={s.zoom}>A-</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFontSize((f) => Math.min(28, f + 1))}
            hitSlop={6}
          >
            <Text style={s.zoomBig}>A+</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowSearch((v) => !v)}
            hitSlop={6}
          >
            <Ionicons name="search" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {showSearch ? (
        <View style={s.searchBar}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search in this chapter"
            placeholderTextColor={colors.muted}
            style={s.searchInput}
            autoFocus
          />
          {term ? (
            <Text style={s.searchCount}>{visible.length} match(es)</Text>
          ) : null}
        </View>
      ) : null}

      <View style={s.statusRow}>
        <Text style={s.chapterLabel} numberOfLines={1}>
          {chapterTitle}
        </Text>
        {offline ? (
          <View style={s.offlinePill}>
            <Ionicons name="cloud-offline" size={12} color={colors.brandDark} />
            <Text style={s.offlineText}>Offline</Text>
          </View>
        ) : null}
      </View>

      <ScrollView
        ref={scrollRef}
        style={s.reader}
        contentContainerStyle={s.readerContent}
      >
        {visible.length ? (
          visible.map((p, i) => (
            <TouchableOpacity
              key={i}
              activeOpacity={0.7}
              onLongPress={() => toggleHighlight(i, p)}
              delayLongPress={250}
            >
              <Text
                style={[
                  s.paragraph,
                  { fontSize, lineHeight: fontSize * 1.6 },
                  highlighted[i] ? s.hl : null,
                ]}
              >
                {p}
              </Text>
            </TouchableOpacity>
          ))
        ) : (
          <Text style={s.noMatch}>No matches in this chapter.</Text>
        )}
        <Text style={s.tip}>Tip: long-press a paragraph to highlight it.</Text>
      </ScrollView>

      <View style={s.navBar}>
        <TouchableOpacity
          style={[s.navBtn, idx <= 0 ? s.navDisabled : null]}
          onPress={() => goChapter(idx - 1)}
          disabled={idx <= 0}
        >
          <Ionicons name="arrow-back" size={18} color={colors.text} />
          <Text style={s.navText}>Prev</Text>
        </TouchableOpacity>

        <View style={s.toolGroup}>
          <TouchableOpacity onPress={bookmark} hitSlop={6} style={s.tool}>
            <Ionicons name="bookmark-outline" size={20} color={colors.brand} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setNoteOpen(true)}
            hitSlop={6}
            style={s.tool}
          >
            <Ionicons name="create-outline" size={20} color={colors.brand} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowChapters(true)}
            hitSlop={6}
            style={s.tool}
          >
            <Ionicons name="list" size={22} color={colors.brand} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[s.navBtn, idx >= chapters.length - 1 ? s.navDisabled : null]}
          onPress={() => goChapter(idx + 1)}
          disabled={idx >= chapters.length - 1}
        >
          <Text style={s.navText}>Next</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      <Modal
        visible={showChapters}
        animationType="slide"
        transparent
        onRequestClose={() => setShowChapters(false)}
      >
        <View style={s.sheetBackdrop}>
          <View style={s.sheet}>
            <View style={s.sheetHead}>
              <Text style={s.sheetTitle}>Chapters</Text>
              <TouchableOpacity onPress={() => setShowChapters(false)}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {chapters.map((c, i) => (
                <TouchableOpacity
                  key={c.id}
                  style={s.chapterRow}
                  onPress={() => goChapter(i)}
                >
                  <Text
                    style={[
                      s.chapterRowText,
                      i === idx ? s.chapterActive : null,
                    ]}
                  >
                    {i + 1}. {c.title}
                  </Text>
                  {i === idx ? (
                    <Ionicons name="book" size={16} color={colors.brand} />
                  ) : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={noteOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setNoteOpen(false)}
      >
        <View style={s.noteBackdrop}>
          <View style={s.noteCard}>
            <Text style={s.sheetTitle}>Add note</Text>
            <TextInput
              value={noteText}
              onChangeText={setNoteText}
              placeholder="Write a note for this chapter…"
              placeholderTextColor={colors.muted}
              style={s.noteInput}
              multiline
            />
            <View style={s.noteActions}>
              <TouchableOpacity onPress={() => setNoteOpen(false)}>
                <Text style={s.cancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={saveNote}>
                <Text style={s.saveText}>Save note</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.card },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: 52,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginLeft: 8,
  },
  topActions: { flexDirection: "row", alignItems: "center" },
  zoom: {
    fontSize: 14,
    color: colors.muted,
    marginRight: 12,
    fontWeight: "700",
  },
  zoomBig: {
    fontSize: 17,
    color: colors.text,
    marginRight: 12,
    fontWeight: "700",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    color: colors.text,
  },
  searchCount: { fontSize: 12, color: colors.muted, marginLeft: 10 },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
  },
  chapterLabel: {
    flex: 1,
    fontSize: 13,
    color: colors.muted,
    fontWeight: "600",
  },
  offlinePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.brandLight,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  offlineText: {
    fontSize: 11,
    color: colors.brandDark,
    fontWeight: "700",
    marginLeft: 4,
  },
  reader: { flex: 1 },
  readerContent: { padding: spacing.lg, paddingBottom: 40 },
  paragraph: { color: colors.text, marginBottom: 16 },
  hl: { backgroundColor: "#FFF3C4", borderRadius: 4 },
  noMatch: {
    color: colors.muted,
    fontSize: 14,
    textAlign: "center",
    marginTop: 40,
  },
  tip: {
    color: colors.muted,
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 12,
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  navBtn: { flexDirection: "row", alignItems: "center" },
  navDisabled: { opacity: 0.35 },
  navText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginHorizontal: 4,
  },
  toolGroup: { flexDirection: "row", alignItems: "center" },
  tool: { paddingHorizontal: 10 },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "#00000055",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
    padding: spacing.lg,
  },
  sheetHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sheetTitle: { fontSize: 17, fontWeight: "800", color: colors.text },
  chapterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  chapterRowText: { fontSize: 14, color: colors.text, flex: 1 },
  chapterActive: { color: colors.brand, fontWeight: "700" },
  noteBackdrop: {
    flex: 1,
    backgroundColor: "#00000055",
    justifyContent: "center",
    padding: spacing.lg,
  },
  noteCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    minHeight: 100,
    padding: 12,
    marginTop: 12,
    color: colors.text,
    textAlignVertical: "top",
  },
  noteActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 14,
  },
  cancel: { color: colors.muted, fontWeight: "600", marginRight: 20 },
  saveBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  saveText: { color: "#fff", fontWeight: "700" },
});
