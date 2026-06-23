// Learning activity tracking with offline-first sync.
//
// Every tracked action is sent to the server immediately when online. If the
// request fails (offline), the event is queued locally and replayed by
// syncActivity() the next time the app has connectivity. The backend
// /activity/sync endpoint replays events in chronological order.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";

const QUEUE_KEY = "activity_queue_v1";

export type ActivityEvent = {
  type: string;
  bookId?: string;
  chapterIndex?: number;
  percent?: number;
  seconds?: number;
  meta?: Record<string, any>;
  at: string;
};

async function readQueue(): Promise<ActivityEvent[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? (JSON.parse(raw) as ActivityEvent[]) : [];
}

async function writeQueue(events: ActivityEvent[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(events));
}

export async function trackEvent(
  type: string,
  payload: Partial<ActivityEvent> = {},
): Promise<void> {
  const event: ActivityEvent = {
    type,
    at: new Date().toISOString(),
    ...payload,
  };
  try {
    await api("/activity", { method: "POST", body: event });
  } catch {
    const queue = await readQueue();
    queue.push(event);
    await writeQueue(queue);
  }
}

// Replay any locally queued offline events. Returns the number synced.
export async function syncActivity(): Promise<number> {
  const queue = await readQueue();
  if (queue.length === 0) return 0;
  try {
    await api("/activity/sync", { method: "POST", body: { events: queue } });
    await writeQueue([]);
    return queue.length;
  } catch {
    return 0;
  }
}

export async function pendingActivityCount(): Promise<number> {
  return (await readQueue()).length;
}
