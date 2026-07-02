import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../api";
import { Loading } from "../components";
import { colors, radius, spacing } from "../theme";
import {
  isAvailableOffline,
  loadProtectedContent,
  saveProtectedContent,
} from "../secure";
import { trackEvent } from "../activity";
import { useContentProtection } from "../protect";

type Chapter = {
  id: string;
  index: number;
  title: string;
  titleUrdu?: string;
  isFree?: boolean;
};
type ThemeName = "light" | "sepia" | "dark";
type AiMsg = { role: "user" | "assistant"; content: string };
type SavedTab = "bookmarks" | "notes" | "highlights";

type ReaderTheme = {
  bg: string;
  text: string;
  muted: string;
  sub: string;
  border: string;
  hl: string;
};

const THEMES: Record<ThemeName, ReaderTheme> = {
  light: {
    bg: "#FFFFFF",
    text: "#15151A",
    muted: "#6B7280",
    sub: "#F5F6F8",
    border: "#ECECF1",
    hl: "#FFF3C4",
  },
  sepia: {
    bg: "#F6ECD8",
    text: "#4A3B28",
    muted: "#8C7452",
    sub: "#EFE3C9",
    border: "#E2D4B6",
    hl: "#EAD79A",
  },
  dark: {
    bg: "#15151A",
    text: "#E7E7EC",
    muted: "#9A9AA6",
    sub: "#1E1E26",
    border: "#2A2A33",
    hl: "#4A431F",
  },
};

const LINE_OPTIONS = [
  { label: "Compact", value: 1.4 },
  { label: "Normal", value: 1.6 },
  { label: "Relaxed", value: 1.9 },
];

const SETTINGS_KEY = "reader-settings-v1";

function Seg(props: {
  options: { label: string; value: any }[];
  value: any;
  onChange: (v: any) => void;
  th: ReaderTheme;
}) {
  const { options, value, onChange, th } = props;
  return (
    <View style={[s.seg, { borderColor: th.border }]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <TouchableOpacity
            key={String(o.value)}
            style={[s.segItem, active ? s.segActive : null]}
            onPress={() => onChange(o.value)}
          >
            <Text
              style={[
                s.segText,
                active ? s.segTextActive : { color: th.muted },
              ]}
            >
              {o.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function ReaderScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const bookId: string = route.params?.bookId;
  const title: string = route.params?.title || "Reader";
  const preview: boolean = !!route.params?.preview;

  // Block screenshots / screen recording while reading protected books.
  useContentProtection();

  const [loading, setLoading] = useState(true);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [idx, setIdx] = useState(0);
  const [content, setContent] = useState("");
  const [offline, setOffline] = useState(false);
  const [query, setQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showChapters, setShowChapters] = useState(false);
  const [lang, setLang] = useState<"en" | "ur">("en");
  const [hasUrdu, setHasUrdu] = useState(false);
  const [locked, setLocked] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [highlighted, setHighlighted] = useState<Record<number, boolean>>({});

  // ---- reader appearance settings (persisted) ----
  const [fontSize, setFontSize] = useState(17);
  const [theme, setTheme] = useState<ThemeName>("light");
  const [lineMult, setLineMult] = useState(1.6);
  const [serif, setSerif] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // ---- saved items (bookmarks / notes / highlights) ----
  const [showSaved, setShowSaved] = useState(false);
  const [savedTab, setSavedTab] = useState<SavedTab>("bookmarks");
  const [savedLoading, setSavedLoading] = useState(false);
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [highlights, setHighlights] = useState<any[]>([]);

  // ---- Hawwa AI companion ----
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMsgs, setAiMsgs] = useState<AiMsg[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiName, setAiName] = useState("Hawwa");

  const startRef = useRef(Date.now());
  const scrollRef = useRef<ScrollView>(null);
  const aiScrollRef = useRef<ScrollView>(null);

  const secureKey = useCallback(
    (chapterId: string | null) => bookId + "::" + (chapterId || "main"),
    [bookId],
  );

  // Load the admin-configured AI name once (falls back to "Hawwa").
  useEffect(() => {
    api("/settings")
      .then((sx: any) => {
        if (sx?.aiName) setAiName(String(sx.aiName));
      })
      .catch(() => undefined);
  }, []);

  // Load persisted appearance settings once.
  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY)
      .then((raw) => {
        if (!raw) return;
        const cfg = JSON.parse(raw);
        if (typeof cfg.fontSize === "number") setFontSize(cfg.fontSize);
        if (cfg.theme) setTheme(cfg.theme);
        if (typeof cfg.lineMult === "number") setLineMult(cfg.lineMult);
        if (typeof cfg.serif === "boolean") setSerif(cfg.serif);
      })
      .catch(() => {});
  }, []);

  // Persist appearance settings whenever they change.
  useEffect(() => {
    AsyncStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ fontSize, theme, lineMult, serif }),
    ).catch(() => {});
  }, [fontSize, theme, lineMult, serif]);

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
    async (
      chapterId: string | null,
      chapterIndex: number,
      langOverride?: string,
    ) => {
      const activeLang = langOverride ?? lang;
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
      setLocked(false);
      try {
        let qs = chapterId ? "?chapterId=" + chapterId : "";
        if (activeLang === "ur") qs += (qs ? "&" : "?") + "lang=ur";
        const data: any = await api("/library/content/" + bookId + qs);
        if (data.locked) {
          setLocked(true);
          setContent("");
          return;
        }
        const text = data.content || "";
        setContent(text);
        setOffline(false);
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
    [bookId, preview, secureKey, lang],
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
        if (data.hasUrdu) setHasUrdu(true);
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
    setHighlighted({});
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

  // ---- saved items ----
  const loadSaved = useCallback(async () => {
    if (preview) return;
    setSavedLoading(true);
    try {
      const [b, n, h] = await Promise.all([
        api("/library/" + bookId + "/bookmarks").catch(() => []),
        api("/library/" + bookId + "/notes").catch(() => []),
        api("/library/" + bookId + "/highlights").catch(() => []),
      ]);
      setBookmarks(Array.isArray(b) ? b : []);
      setNotes(Array.isArray(n) ? n : []);
      setHighlights(Array.isArray(h) ? h : []);
    } finally {
      setSavedLoading(false);
    }
  }, [bookId, preview]);

  function openSaved() {
    setShowSaved(true);
    loadSaved();
  }

  async function deleteSaved(kind: SavedTab, id: string) {
    const path =
      kind === "bookmarks"
        ? "/library/bookmarks/" + id
        : kind === "notes"
          ? "/library/notes/" + id
          : "/library/highlights/" + id;
    await api(path, { method: "DELETE" }).catch(() => {});
    loadSaved();
  }

  function jumpToChapterId(chapterId?: string | null) {
    if (!chapterId) return;
    const i = chapters.findIndex((c) => c.id === chapterId);
    if (i >= 0) {
      setShowSaved(false);
      goChapter(i);
    }
  }

  // ---- Hawwa AI ----
  function openHawwa() {
    if (aiMsgs.length === 0) {
      setAiMsgs([
        {
          role: "assistant",
          content:
            "Salam! Main " +
            aiName +
            " hoon — is kitaab ko parhne me aap ki madad ke " +
            "liye. Is chapter ke baare me kuch bhi poochein: khulasa, mushkil " +
            "alfaaz ka matlab, ya koi sawal.",
        },
      ]);
    }
    setAiOpen(true);
  }

  async function askHawwa() {
    const text = aiInput.trim();
    if (!text || aiBusy) return;
    const next: AiMsg[] = [...aiMsgs, { role: "user", content: text }];
    setAiMsgs(next);
    setAiInput("");
    setAiBusy(true);
    setTimeout(() => aiScrollRef.current?.scrollToEnd({ animated: true }), 60);
    try {
      const res: any = await api("/ai/hawwa", {
        method: "POST",
        body: {
          bookId,
          chapterId: chapters[idx]?.id,
          chapterTitle: chapters[idx]?.title || title,
          messages: next.slice(-10),
        },
      });
      setAiMsgs((m) => [
        ...m,
        { role: "assistant", content: res?.reply || "..." },
      ]);
    } catch {
      setAiMsgs((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "Hawwa abhi jawab nahi de saki. Thori dair baad dobara koshish karein.",
        },
      ]);
    } finally {
      setAiBusy(false);
      setTimeout(
        () => aiScrollRef.current?.scrollToEnd({ animated: true }),
        60,
      );
    }
  }

  if (loading) return <Loading />;

  const th = THEMES[theme];
  const term = query.trim().toLowerCase();
  const paragraphs = content
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  const visible = term
    ? paragraphs.filter((p) => p.toLowerCase().includes(term))
    : paragraphs;
  const chapterTitle = chapters[idx]?.title || title;
  const savedItems =
    savedTab === "bookmarks"
      ? bookmarks
      : savedTab === "notes"
        ? notes
        : highlights;

  return (
    <View style={[s.wrap, { backgroundColor: th.bg }]}>
      <View style={[s.topBar, { borderBottomColor: th.border }]}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={th.text} />
        </TouchableOpacity>
        <Text style={[s.topTitle, { color: th.text }]} numberOfLines={1}>
          {title}
        </Text>
        <View style={s.topActions}>
          {hasUrdu && (
            <TouchableOpacity
              onPress={() => {
                const next: "en" | "ur" = lang === "en" ? "ur" : "en";
                setLang(next);
                fetchChapter(chapters[idx]?.id ?? null, idx, next);
              }}
              hitSlop={6}
              style={[
                s.topBtn,
                s.langBtn,
                lang === "ur" ? s.langBtnActive : null,
              ]}
            >
              <Text
                style={[
                  s.langBtnText,
                  lang === "ur" ? s.langBtnTextActive : { color: th.muted },
                ]}
              >
                {lang === "ur" ? "EN" : "UR"}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => setShowSearch((v) => !v)}
            hitSlop={6}
            style={s.topBtn}
          >
            <Ionicons name="search" size={20} color={th.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowSettings(true)}
            hitSlop={6}
            style={s.topBtn}
          >
            <Ionicons name="settings-outline" size={20} color={th.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={openHawwa} hitSlop={6} style={s.topBtn}>
            <Ionicons name="sparkles" size={20} color={colors.brand} />
          </TouchableOpacity>
        </View>
      </View>

      {showSearch ? (
        <View style={[s.searchBar, { borderBottomColor: th.border }]}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search in this chapter"
            placeholderTextColor={th.muted}
            style={[s.searchInput, { backgroundColor: th.sub, color: th.text }]}
            autoFocus
          />
          {term ? (
            <Text style={[s.searchCount, { color: th.muted }]}>
              {visible.length} match(es)
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={s.statusRow}>
        <Text style={[s.chapterLabel, { color: th.muted }]} numberOfLines={1}>
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
        {locked ? (
          <View style={s.lockedBox}>
            <Ionicons name="lock-closed" size={40} color={colors.brand} />
            <Text style={[s.lockedTitle, { color: th.text }]}>
              Chapter Locked
            </Text>
            <Text style={[s.lockedSub, { color: th.muted }]}>
              Purchase this book to read this chapter.
            </Text>
          </View>
        ) : visible.length ? (
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
                  {
                    fontSize,
                    lineHeight: Math.round(fontSize * lineMult),
                    color: th.text,
                    fontFamily: serif ? "serif" : undefined,
                    textAlign: lang === "ur" ? "right" : "left",
                    writingDirection: lang === "ur" ? "rtl" : "ltr",
                  },
                  highlighted[i]
                    ? { backgroundColor: th.hl, borderRadius: 4 }
                    : null,
                ]}
              >
                {p}
              </Text>
            </TouchableOpacity>
          ))
        ) : (
          <Text style={[s.noMatch, { color: th.muted }]}>
            No matches in this chapter.
          </Text>
        )}
        {!locked && (
          <Text style={[s.tip, { color: th.muted }]}>
            Tip: long-press a paragraph to highlight it.
          </Text>
        )}
      </ScrollView>

      <View style={[s.navBar, { borderTopColor: th.border }]}>
        <TouchableOpacity
          style={[s.navBtn, idx <= 0 ? s.navDisabled : null]}
          onPress={() => goChapter(idx - 1)}
          disabled={idx <= 0}
        >
          <Ionicons name="arrow-back" size={18} color={th.text} />
          <Text style={[s.navText, { color: th.text }]}>Prev</Text>
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
          <TouchableOpacity onPress={openSaved} hitSlop={6} style={s.tool}>
            <Ionicons name="bookmarks-outline" size={20} color={colors.brand} />
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
          <Text style={[s.navText, { color: th.text }]}>Next</Text>
          <Ionicons name="arrow-forward" size={18} color={th.text} />
        </TouchableOpacity>
      </View>

      {/* Chapters */}
      <Modal
        visible={showChapters}
        animationType="slide"
        transparent
        onRequestClose={() => setShowChapters(false)}
      >
        <View style={s.sheetBackdrop}>
          <View style={[s.sheet, { backgroundColor: th.bg }]}>
            <View style={s.sheetHead}>
              <Text style={[s.sheetTitle, { color: th.text }]}>Chapters</Text>
              <TouchableOpacity onPress={() => setShowChapters(false)}>
                <Ionicons name="close" size={22} color={th.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {chapters.map((c, i) => (
                <TouchableOpacity
                  key={c.id}
                  style={[s.chapterRow, { borderBottomColor: th.border }]}
                  onPress={() => goChapter(i)}
                >
                  <Text
                    style={[
                      s.chapterRowText,
                      { color: th.text },
                      i === idx ? s.chapterActive : null,
                    ]}
                    numberOfLines={2}
                  >
                    {i + 1}.{" "}
                    {lang === "ur" && c.titleUrdu ? c.titleUrdu : c.title}
                  </Text>
                  <View style={s.chapterRowRight}>
                    {c.isFree ? (
                      <View style={s.freeBadge}>
                        <Text style={s.freeBadgeText}>Free</Text>
                      </View>
                    ) : null}
                    {i === idx ? (
                      <Ionicons name="book" size={16} color={colors.brand} />
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Appearance settings */}
      <Modal
        visible={showSettings}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSettings(false)}
      >
        <View style={s.sheetBackdrop}>
          <View style={[s.sheet, { backgroundColor: th.bg }]}>
            <View style={s.sheetHead}>
              <Text style={[s.sheetTitle, { color: th.text }]}>
                Display settings
              </Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <Ionicons name="close" size={22} color={th.text} />
              </TouchableOpacity>
            </View>

            <Text style={[s.settingLabel, { color: th.muted }]}>Theme</Text>
            <Seg
              th={th}
              value={theme}
              onChange={(v) => setTheme(v)}
              options={[
                { label: "Light", value: "light" },
                { label: "Sepia", value: "sepia" },
                { label: "Dark", value: "dark" },
              ]}
            />

            <Text style={[s.settingLabel, { color: th.muted }]}>Font size</Text>
            <View style={s.fontRow}>
              <TouchableOpacity
                style={[s.fontBtn, { borderColor: th.border }]}
                onPress={() => setFontSize((f) => Math.max(13, f - 1))}
              >
                <Text style={[s.fontBtnText, { color: th.text }]}>A-</Text>
              </TouchableOpacity>
              <Text style={[s.fontValue, { color: th.text }]}>{fontSize}</Text>
              <TouchableOpacity
                style={[s.fontBtn, { borderColor: th.border }]}
                onPress={() => setFontSize((f) => Math.min(30, f + 1))}
              >
                <Text style={[s.fontBtnText, { color: th.text }]}>A+</Text>
              </TouchableOpacity>
            </View>

            <Text style={[s.settingLabel, { color: th.muted }]}>
              Line spacing
            </Text>
            <Seg
              th={th}
              value={lineMult}
              onChange={(v) => setLineMult(v)}
              options={LINE_OPTIONS}
            />

            <Text style={[s.settingLabel, { color: th.muted }]}>Typeface</Text>
            <Seg
              th={th}
              value={serif}
              onChange={(v) => setSerif(v)}
              options={[
                { label: "Sans", value: false },
                { label: "Serif", value: true },
              ]}
            />

            <Text
              style={[
                s.paragraph,
                {
                  marginTop: 18,
                  fontSize,
                  lineHeight: Math.round(fontSize * lineMult),
                  color: th.text,
                  fontFamily: serif ? "serif" : undefined,
                },
              ]}
            >
              The quick brown fox jumps over the lazy dog.
            </Text>
          </View>
        </View>
      </Modal>

      {/* Saved items */}
      <Modal
        visible={showSaved}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSaved(false)}
      >
        <View style={s.sheetBackdrop}>
          <View style={[s.sheet, { backgroundColor: th.bg }]}>
            <View style={s.sheetHead}>
              <Text style={[s.sheetTitle, { color: th.text }]}>My library</Text>
              <TouchableOpacity onPress={() => setShowSaved(false)}>
                <Ionicons name="close" size={22} color={th.text} />
              </TouchableOpacity>
            </View>

            <Seg
              th={th}
              value={savedTab}
              onChange={(v) => setSavedTab(v)}
              options={[
                { label: "Bookmarks", value: "bookmarks" },
                { label: "Notes", value: "notes" },
                { label: "Highlights", value: "highlights" },
              ]}
            />

            {savedLoading ? (
              <ActivityIndicator color={colors.brand} style={s.savedLoading} />
            ) : savedItems.length === 0 ? (
              <Text style={[s.savedEmpty, { color: th.muted }]}>
                Nothing here yet.
              </Text>
            ) : (
              <ScrollView style={s.savedList}>
                {savedItems.map((it: any) => (
                  <View
                    key={it.id}
                    style={[s.savedRow, { borderBottomColor: th.border }]}
                  >
                    <TouchableOpacity
                      style={s.flex1}
                      onPress={() => jumpToChapterId(it.chapterId)}
                    >
                      <Text style={[s.savedText, { color: th.text }]}>
                        {savedTab === "notes"
                          ? it.body
                          : savedTab === "highlights"
                            ? it.text
                            : it.label || "Bookmark"}
                      </Text>
                      {it.chapterId ? (
                        <Text style={[s.savedMeta, { color: th.muted }]}>
                          {chapters.find((c) => c.id === it.chapterId)?.title ||
                            "Go to location"}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                    <TouchableOpacity
                      hitSlop={8}
                      onPress={() => deleteSaved(savedTab, it.id)}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color={colors.red}
                      />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Add note */}
      <Modal
        visible={noteOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setNoteOpen(false)}
      >
        <View style={s.noteBackdrop}>
          <View style={[s.noteCard, { backgroundColor: th.bg }]}>
            <Text style={[s.sheetTitle, { color: th.text }]}>Add note</Text>
            <TextInput
              value={noteText}
              onChangeText={setNoteText}
              placeholder="Write a note for this chapter..."
              placeholderTextColor={th.muted}
              style={[s.noteInput, { borderColor: th.border, color: th.text }]}
              multiline
            />
            <View style={s.noteActions}>
              <TouchableOpacity onPress={() => setNoteOpen(false)}>
                <Text style={[s.cancel, { color: th.muted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={saveNote}>
                <Text style={s.saveText}>Save note</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Hawwa AI companion */}
      <Modal
        visible={aiOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setAiOpen(false)}
      >
        <View style={s.sheetBackdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={s.aiWrap}
          >
            <View style={[s.aiSheet, { backgroundColor: th.bg }]}>
              <View style={[s.aiHead, { borderBottomColor: th.border }]}>
                <View style={s.aiTitleRow}>
                  <View style={s.aiAvatar}>
                    <Ionicons name="sparkles" size={16} color="#fff" />
                  </View>
                  <View>
                    <Text style={[s.sheetTitle, { color: th.text }]}>
                      {aiName}
                    </Text>
                    <Text style={[s.aiSub, { color: th.muted }]}>
                      Reading companion
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setAiOpen(false)}>
                  <Ionicons name="close" size={22} color={th.text} />
                </TouchableOpacity>
              </View>

              <ScrollView
                ref={aiScrollRef}
                style={s.aiBody}
                contentContainerStyle={s.aiBodyContent}
              >
                {aiMsgs.map((m, i) => {
                  const mine = m.role === "user";
                  return (
                    <View
                      key={i}
                      style={[
                        s.bubble,
                        mine
                          ? s.bubbleMine
                          : [s.bubbleAi, { backgroundColor: th.sub }],
                      ]}
                    >
                      <Text
                        style={[
                          s.bubbleText,
                          { color: mine ? "#fff" : th.text },
                        ]}
                      >
                        {m.content}
                      </Text>
                    </View>
                  );
                })}
                {aiBusy ? (
                  <View
                    style={[s.bubble, s.bubbleAi, { backgroundColor: th.sub }]}
                  >
                    <ActivityIndicator color={colors.brand} size="small" />
                  </View>
                ) : null}
              </ScrollView>

              <View style={[s.aiInputRow, { borderTopColor: th.border }]}>
                <TextInput
                  value={aiInput}
                  onChangeText={setAiInput}
                  placeholder={`Ask ${aiName} about this chapter...`}
                  placeholderTextColor={th.muted}
                  style={[
                    s.aiInput,
                    { backgroundColor: th.sub, color: th.text },
                  ]}
                  multiline
                  onSubmitEditing={askHawwa}
                />
                <TouchableOpacity
                  style={[
                    s.aiSend,
                    aiBusy || !aiInput.trim() ? s.aiSendOff : null,
                  ]}
                  onPress={askHawwa}
                  disabled={aiBusy || !aiInput.trim()}
                >
                  <Ionicons name="send" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
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
  topBtn: { paddingHorizontal: 8 },
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
    maxHeight: "78%",
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
  settingLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
  },
  seg: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  segItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  segActive: { backgroundColor: colors.brand },
  segText: { fontSize: 13, fontWeight: "700", color: colors.muted },
  segTextActive: { color: "#fff" },
  fontRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  fontBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 22,
    paddingVertical: 8,
  },
  fontBtnText: { fontSize: 16, fontWeight: "800", color: colors.text },
  fontValue: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
    marginHorizontal: 24,
    minWidth: 28,
    textAlign: "center",
  },
  savedLoading: { marginTop: 30 },
  savedEmpty: {
    textAlign: "center",
    color: colors.muted,
    marginTop: 30,
    marginBottom: 10,
  },
  savedList: { marginTop: 4 },
  savedRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  flex1: { flex: 1, paddingRight: 12 },
  savedText: { fontSize: 14, color: colors.text },
  savedMeta: { fontSize: 12, color: colors.muted, marginTop: 4 },
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
  aiWrap: { justifyContent: "flex-end" },
  aiSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: "82%",
  },
  aiHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  aiTitleRow: { flexDirection: "row", alignItems: "center" },
  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  aiSub: { fontSize: 12, color: colors.muted },
  aiBody: { flex: 1 },
  aiBodyContent: { padding: spacing.lg },
  bubble: {
    maxWidth: "85%",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  bubbleMine: {
    backgroundColor: colors.brand,
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  bubbleAi: {
    backgroundColor: colors.bg,
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 14, lineHeight: 21 },
  aiInputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  aiInput: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxHeight: 120,
    color: colors.text,
    marginRight: 10,
  },
  aiSend: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  aiSendOff: { opacity: 0.4 },
  langBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 4,
  },
  langBtnActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  langBtnText: { fontSize: 11, fontWeight: "800", color: colors.muted },
  langBtnTextActive: { color: "#fff" },
  lockedBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  lockedTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginTop: 16,
    color: colors.text,
  },
  lockedSub: {
    fontSize: 14,
    color: colors.muted,
    marginTop: 8,
    textAlign: "center",
  },
  chapterRowRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  freeBadge: {
    backgroundColor: "#dcfce7",
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  freeBadgeText: { fontSize: 10, fontWeight: "800", color: "#16a34a" },
});
