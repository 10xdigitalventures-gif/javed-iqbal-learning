import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Audio } from "expo-av";
import { api } from "../api";
import { Loading } from "../components";
import { colors, radius, spacing, shadow } from "../theme";
import { BookCover, EmptyState, Pill, ProgressBar, formatPrice } from "../ui";
import { useContentProtection } from "../protect";

const arr = (x: any) => (Array.isArray(x) ? x : x?.items || x?.data || []);

// Audio books reuse the books pipeline: any book whose category name contains
// "audio" is treated as an audiobook (admins create an "Audiobooks" category).
const isAudio = (b: any) =>
  (b?.category?.name || b?.categoryName || "").toLowerCase().includes("audio");

const SPEEDS = [1, 1.25, 1.5, 2];
const SLEEP_OPTIONS = [0, 15, 30, 60]; // minutes (0 = off)

function fmt(ms: number) {
  if (!ms || ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function AudioBooksScreen() {
  const nav = useNavigation<any>();
  // Block screenshots / screen recording while protected audiobooks play.
  useContentProtection();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"mine" | "browse">("browse");
  const [books, setBooks] = useState<any[]>([]);
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");

  // ---- player state ----
  const soundRef = useRef<Audio.Sound | null>(null);
  const sleepRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Throttle for progress saves + the position (ms) to resume the next load at.
  const saveRef = useRef(0);
  const resumeMsRef = useRef(0);
  const [active, setActive] = useState<any | null>(null);
  const [chapters, setChapters] = useState<any[]>([]);
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(0);
  const [sleepMin, setSleepMin] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const [showChapters, setShowChapters] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api("/books").catch(() => []),
      api("/library").catch(() => []),
    ])
      .then(([b, mine]) => {
        setBooks(arr(b).filter(isAudio));
        setOwnedIds(new Set(arr(mine).map((e: any) => e.bookId)));
      })
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(load);

  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    }).catch(() => {});
    return () => {
      if (sleepRef.current) clearTimeout(sleepRef.current);
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  async function unload() {
    if (sleepRef.current) {
      clearTimeout(sleepRef.current);
      sleepRef.current = null;
    }
    const sound = soundRef.current;
    soundRef.current = null;
    if (sound) await sound.unloadAsync().catch(() => {});
  }

  // Persist the listening position (throttled) so the book resumes later.
  function saveAudioProgress(
    book: any,
    chId: string | null,
    posMs: number,
    durMs: number,
    force: boolean,
  ) {
    if (!book) return;
    const now = Date.now();
    if (!force && now - saveRef.current < 10000) return;
    saveRef.current = now;
    const pos = Math.round((posMs || 0) / 1000);
    const dur = Math.round((durMs || 0) / 1000);
    api(`/library/progress/${book.id}`, {
      method: "PUT",
      body: {
        lastAudioPositionSec: pos,
        lastAudioChapterId: chId || undefined,
        percentComplete: dur ? Math.min(100, (pos / dur) * 100) : undefined,
      },
    }).catch(() => {});
  }

  async function playMedia(book: any, chId: string | null) {
    setBuffering(true);
    setPlayerError(null);
    try {
      await unload();
      const qs = chId ? `?chapterId=${encodeURIComponent(chId)}` : "";
      const media: any = await api(`/library/media/${book.id}${qs}`);
      // Resume from the saved position; consumed once so chapter switches start fresh.
      const startAtMs = resumeMsRef.current;
      resumeMsRef.current = 0;
      const { sound } = await Audio.Sound.createAsync(
        { uri: media.url },
        {
          shouldPlay: true,
          rate: SPEEDS[speedIdx],
          shouldCorrectPitch: true,
          positionMillis: startAtMs > 0 ? startAtMs : 0,
        },
        (st: any) => {
          if (!st) return;
          if (st.isLoaded) {
            setIsPlaying(!!st.isPlaying);
            setPosition(st.positionMillis || 0);
            setDuration(st.durationMillis || 0);
            setBuffering(!!st.isBuffering);
            saveAudioProgress(
              book,
              chId,
              st.positionMillis,
              st.durationMillis,
              false,
            );
            if (st.didJustFinish) {
              setIsPlaying(false);
              saveAudioProgress(
                book,
                chId,
                st.positionMillis,
                st.durationMillis,
                true,
              );
            }
          } else if (st.error) {
            setPlayerError("Playback error");
          }
        },
      );
      soundRef.current = sound;
      setChapterId(chId);
    } catch (e: any) {
      setPlayerError(e?.message || "Could not start playback");
    } finally {
      setBuffering(false);
    }
  }

  async function openBook(book: any) {
    if (!ownedIds.has(book.id)) {
      nav.navigate("BookDetail", { idOrSlug: book.slug || book.id });
      return;
    }
    setActive(book);
    setPosition(0);
    setDuration(0);
    setSpeedIdx(0);
    setSleepMin(0);
    // Load chapters + saved progress together so playback can resume.
    let chs: any[] = [];
    let prog: any = null;
    try {
      const [detail, p]: any = await Promise.all([
        api(`/books/${book.slug || book.id}`),
        api(`/library/progress/${book.id}`).catch(() => null),
      ]);
      chs = arr(detail?.chapters);
      prog = p;
    } catch {}
    setChapters(chs);
    resumeMsRef.current = (prog?.lastAudioPositionSec || 0) * 1000;
    saveRef.current = 0;
    // Resume on the saved chapter when it still exists, else the first one.
    const savedCh =
      prog?.lastAudioChapterId &&
      chs.find((c: any) => c.id === prog.lastAudioChapterId);
    const startCh = savedCh ? savedCh.id : chs.length ? chs[0].id : null;
    playMedia(book, startCh);
  }

  async function togglePlay() {
    const sound = soundRef.current;
    if (!sound) return;
    if (isPlaying) await sound.pauseAsync().catch(() => {});
    else await sound.playAsync().catch(() => {});
  }

  async function skip(deltaMs: number) {
    const sound = soundRef.current;
    if (!sound) return;
    const next = Math.max(
      0,
      Math.min(duration || position, position + deltaMs),
    );
    await sound.setPositionAsync(next).catch(() => {});
  }

  async function cycleSpeed() {
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    await soundRef.current?.setRateAsync(SPEEDS[next], true).catch(() => {});
  }

  function cycleSleep() {
    const idx = SLEEP_OPTIONS.indexOf(sleepMin);
    const next = SLEEP_OPTIONS[(idx + 1) % SLEEP_OPTIONS.length];
    setSleepMin(next);
    if (sleepRef.current) clearTimeout(sleepRef.current);
    if (next > 0) {
      sleepRef.current = setTimeout(
        () => {
          soundRef.current?.pauseAsync().catch(() => {});
          setSleepMin(0);
        },
        next * 60 * 1000,
      );
    }
  }

  async function closePlayer() {
    saveAudioProgress(active, chapterId, position, duration, true);
    await unload();
    setActive(null);
    setChapters([]);
    setIsPlaying(false);
  }

  if (loading) return <Loading />;

  const term = q.trim().toLowerCase();
  const visible = books.filter((b) => {
    const owned = ownedIds.has(b.id);
    const tabOk = tab === "mine" ? owned : true;
    const qOk =
      !term ||
      (b.title || "").toLowerCase().includes(term) ||
      (b.author || "").toLowerCase().includes(term);
    return tabOk && qOk;
  });

  const renderItem = ({ item: b }: { item: any }) => {
    const owned = ownedIds.has(b.id);
    return (
      <TouchableOpacity
        style={s.card}
        activeOpacity={0.85}
        onPress={() => openBook(b)}
      >
        <View>
          <BookCover url={b.coverUrl} title={b.title} size="md" />
          <View style={s.badge}>
            <Ionicons
              name={owned ? "play" : "lock-closed"}
              size={14}
              color="#fff"
            />
          </View>
        </View>
        <Text style={s.title} numberOfLines={2}>
          {b.title}
        </Text>
        <Text style={s.author} numberOfLines={1}>
          {b.author || "Prof. Dr. Javed Iqbal"}
        </Text>
        <Text style={s.meta}>
          {owned ? "Listen now" : formatPrice(b.price, b.currency) || "Premium"}
        </Text>
      </TouchableOpacity>
    );
  };

  const speed = SPEEDS[speedIdx];
  const activeChapterTitle =
    chapters.find((c) => c.id === chapterId)?.title || active?.title;

  return (
    <View style={s.wrap}>
      <View style={s.searchRow}>
        <Ionicons name="headset" size={18} color={colors.brand} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search audio books"
          placeholderTextColor={colors.muted}
          style={s.search}
        />
      </View>

      <View style={s.tabs}>
        <Pill
          label="Browse"
          active={tab === "browse"}
          onPress={() => setTab("browse")}
        />
        <Pill
          label="My Audiobooks"
          active={tab === "mine"}
          onPress={() => setTab("mine")}
        />
      </View>

      <FlatList
        data={visible}
        keyExtractor={(b: any) => b.id}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={s.col}
        contentContainerStyle={s.listContent}
        ListEmptyComponent={
          <EmptyState
            icon="headset-outline"
            title="No audio books yet"
            subtitle={
              tab === "mine"
                ? "Audio books you own will appear here."
                : "Narrated titles will appear here soon."
            }
          />
        }
      />

      {/* ---- Now Playing player ---- */}
      <Modal visible={!!active} animationType="slide" transparent>
        <View style={s.playerBackdrop}>
          <View style={s.player}>
            <View style={s.playerHandle} />
            <View style={s.playerTop}>
              <BookCover
                url={active?.coverUrl}
                title={active?.title || ""}
                size="lg"
              />
              <View style={s.playerInfo}>
                <Text style={s.playerTitle} numberOfLines={2}>
                  {active?.title}
                </Text>
                <Text style={s.playerChapter} numberOfLines={2}>
                  {activeChapterTitle}
                </Text>
                <Text style={s.playerAuthor}>
                  {active?.author || "Prof. Dr. Javed Iqbal"}
                </Text>
              </View>
              <TouchableOpacity onPress={closePlayer} hitSlop={10}>
                <Ionicons name="chevron-down" size={26} color={colors.muted} />
              </TouchableOpacity>
            </View>

            {playerError ? <Text style={s.error}>{playerError}</Text> : null}

            <View style={s.progressWrap}>
              <ProgressBar value={duration ? (position / duration) * 100 : 0} />
              <View style={s.timeRow}>
                <Text style={s.time}>{fmt(position)}</Text>
                <Text style={s.time}>{fmt(duration)}</Text>
              </View>
            </View>

            <View style={s.controls}>
              <TouchableOpacity onPress={() => skip(-15000)} hitSlop={8}>
                <Ionicons name="play-back" size={30} color={colors.text} />
                <Text style={s.skipLabel}>15</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.playBtn}
                onPress={togglePlay}
                activeOpacity={0.85}
              >
                <Ionicons
                  name={buffering ? "sync" : isPlaying ? "pause" : "play"}
                  size={32}
                  color="#fff"
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => skip(15000)} hitSlop={8}>
                <Ionicons name="play-forward" size={30} color={colors.text} />
                <Text style={s.skipLabel}>15</Text>
              </TouchableOpacity>
            </View>

            <View style={s.extras}>
              <TouchableOpacity style={s.extraBtn} onPress={cycleSpeed}>
                <Ionicons
                  name="speedometer-outline"
                  size={18}
                  color={colors.brand}
                />
                <Text style={s.extraText}>{speed}x</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.extraBtn} onPress={cycleSleep}>
                <Ionicons name="moon-outline" size={18} color={colors.brand} />
                <Text style={s.extraText}>
                  {sleepMin ? `${sleepMin}m` : "Sleep"}
                </Text>
              </TouchableOpacity>
              {chapters.length ? (
                <TouchableOpacity
                  style={s.extraBtn}
                  onPress={() => setShowChapters(true)}
                >
                  <Ionicons
                    name="list-outline"
                    size={18}
                    color={colors.brand}
                  />
                  <Text style={s.extraText}>Chapters</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>

        {/* chapter picker */}
        <Modal visible={showChapters} animationType="fade" transparent>
          <TouchableOpacity
            style={s.chBackdrop}
            activeOpacity={1}
            onPress={() => setShowChapters(false)}
          >
            <View style={s.chSheet}>
              <Text style={s.chTitle}>Chapters</Text>
              <ScrollView style={s.flex1}>
                {chapters.map((c, i) => (
                  <TouchableOpacity
                    key={c.id}
                    style={s.chRow}
                    onPress={() => {
                      setShowChapters(false);
                      if (active) playMedia(active, c.id);
                    }}
                  >
                    <Text
                      style={[
                        s.chRowText,
                        c.id === chapterId ? s.chRowActive : null,
                      ]}
                    >
                      {i + 1}. {c.title}
                    </Text>
                    {c.id === chapterId ? (
                      <Ionicons
                        name="volume-high"
                        size={16}
                        color={colors.brand}
                      />
                    ) : null}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  flex1: { flex: 1 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    marginHorizontal: spacing.lg,
    marginTop: 12,
    paddingHorizontal: 14,
  },
  search: { flex: 1, paddingVertical: 10, color: colors.text },
  tabs: { flexDirection: "row", paddingHorizontal: spacing.lg, paddingTop: 12 },
  listContent: { padding: spacing.lg, paddingBottom: 32 },
  col: { justifyContent: "space-between" },
  card: { width: "48%", marginBottom: 18 },
  badge: {
    position: "absolute",
    right: 8,
    bottom: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 14, fontWeight: "700", color: colors.text, marginTop: 8 },
  author: { fontSize: 12, color: colors.muted, marginTop: 2 },
  meta: { fontSize: 13, fontWeight: "700", color: colors.brand, marginTop: 4 },

  playerBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  player: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: 28,
    ...shadow,
  },
  playerHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 16,
  },
  playerTop: { flexDirection: "row", gap: 14 },
  playerInfo: { flex: 1 },
  playerTitle: { fontSize: 17, fontWeight: "800", color: colors.text },
  playerChapter: {
    fontSize: 13,
    color: colors.brand,
    marginTop: 4,
    fontWeight: "600",
  },
  playerAuthor: { fontSize: 12, color: colors.muted, marginTop: 4 },
  error: { color: colors.red, fontSize: 13, marginTop: 12 },
  progressWrap: { marginTop: 20 },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  time: { fontSize: 12, color: colors.muted },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 36,
    marginTop: 18,
  },
  skipLabel: {
    fontSize: 10,
    color: colors.muted,
    textAlign: "center",
    marginTop: -4,
  },
  playBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  extras: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginTop: 22,
  },
  extraBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.brandLight,
  },
  extraText: { fontSize: 13, fontWeight: "700", color: colors.brandDark },
  chBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  chSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: "70%",
  },
  chTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 12,
  },
  chRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  chRowText: { fontSize: 14, color: colors.text, flex: 1 },
  chRowActive: { color: colors.brand, fontWeight: "700" },
});
