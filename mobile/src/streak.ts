// Local, offline-first weekly reading streak.
//
// Every time the Home screen opens we mark "today" as an active day. The streak
// increments on consecutive days and resets after a missed day. Everything is
// stored on-device (AsyncStorage) so it works without any backend changes.
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "streak_v1";
const LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export type StreakDay = { label: string; active: boolean; today: boolean };
export type StreakState = { count: number; week: StreakDay[] };

type Saved = { lastDay?: string; count?: number; days?: string[] };

function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T00:00:00");
  const db = new Date(b + "T00:00:00");
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

function buildWeek(days: string[], todayKey: string): StreakDay[] {
  const now = new Date();
  const dow = (now.getDay() + 6) % 7; // 0 = Monday
  const monday = new Date(now);
  monday.setDate(now.getDate() - dow);
  const set = new Set(days);
  const week: StreakDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const k = dayKey(d);
    week.push({ label: LABELS[i], active: set.has(k), today: k === todayKey });
  }
  return week;
}

// Marks today active, updates the streak and returns the current state.
export async function touchStreak(): Promise<StreakState> {
  const today = dayKey(new Date());
  let count = 1;
  let days: string[] = [];
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Saved;
      days = Array.isArray(saved.days) ? saved.days : [];
      if (saved.lastDay === today) {
        count = saved.count || 1;
      } else if (saved.lastDay && daysBetween(saved.lastDay, today) === 1) {
        count = (saved.count || 0) + 1;
      } else {
        count = 1;
      }
    }
  } catch {
    // start fresh on any read/parse error
  }
  if (!days.includes(today)) days.push(today);
  days = days.slice(-21);
  try {
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({ lastDay: today, count, days }),
    );
  } catch {
    // ignore write errors
  }
  return { count, week: buildWeek(days, today) };
}
