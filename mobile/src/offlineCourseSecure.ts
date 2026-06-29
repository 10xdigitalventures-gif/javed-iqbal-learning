// Secure offline video storage (Phase 2 + Phase 3).
//
// PHASE 2 — Token-validated encrypted download:
//   1. POST /media/download-token -> { token, aesKey, expiresAt }
//   2. Store token + aesKey in expo-secure-store (hardware-backed Keychain/Keystore)
//   3. Video file downloaded into app-private sandbox (not visible in gallery)
//   4. Before every play, validate the stored token is not expired;
//      if expired, re-fetch a fresh token (requires internet on first play of the day)
//
// PHASE 3 — DRM playback:
//   1. GET /media/drm-token/:lessonId -> { drmToken, licenseUrl }
//   2. Pass drmToken + licenseUrl to expo-video DRM config
//   3. Widevine (Android) / FairPlay (iOS) enforced by the OS itself

import * as FileSystem from "expo-file-system";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";

const COURSE_DIR = (FileSystem.documentDirectory ?? "") + "secure-courses/";
const MANIFEST_KEY = "offline_courses_v1";

// ---- Types ----
export type OfflineLesson = {
  lessonId: string;
  courseId: string;
  courseTitle?: string;
  title?: string;
  sizeBytes?: number;
  downloadedAt: number;
  tokenExpiresAt?: number; // Unix seconds — offline re-validation deadline
  accessUntil?: number | null; // ms epoch — hard access expiry (null = lifetime)
  offlineValidityDays?: number; // YouTube-style reconnect window
};

// Offline status for the player countdown UI ("expires in X days").
export type OfflineStatus = {
  downloaded: boolean;
  // Days until the offline copy must reconnect to the server (token expiry).
  daysUntilOfflineExpiry: number | null;
  // Days until the purchased access window ends (null = lifetime).
  daysUntilAccessExpiry: number | null;
  // True once the offline re-validation window has lapsed (needs internet).
  needsRevalidation: boolean;
  // True once the purchased access has ended/been revoked.
  accessExpired: boolean;
};

export type DrmConfig = {
  type: "widevine" | "fairplay";
  licenseServer: string;
  token: string;
};

// ---- Internal helpers ----
async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(COURSE_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(COURSE_DIR, { intermediates: true });
}

async function fileFor(lessonId: string): Promise<string> {
  const name = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    "lesson:" + lessonId,
  );
  // Stored as .dat to prevent direct media player association
  return COURSE_DIR + name + ".dat";
}

async function readManifest(): Promise<Record<string, OfflineLesson>> {
  try {
    const raw = await AsyncStorage.getItem(MANIFEST_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function writeManifest(m: Record<string, OfflineLesson>): Promise<void> {
  await AsyncStorage.setItem(MANIFEST_KEY, JSON.stringify(m));
}

// Secure store key for the download JWT + AES key
const tokenKey = (lessonId: string) => "dl_token_" + lessonId;
const aesKey   = (lessonId: string) => "aes_key_"  + lessonId;

// ---- Public API ----

export async function localLessonUri(lessonId: string): Promise<string | null> {
  const path = await fileFor(lessonId);
  const info = await FileSystem.getInfoAsync(path);
  return info.exists ? path : null;
}

export async function isLessonDownloaded(lessonId: string): Promise<boolean> {
  return (await localLessonUri(lessonId)) !== null;
}

// Phase 2: download + store token & aesKey in Keychain
export async function downloadLessonSecure(args: {
  lessonId: string;
  courseId: string;
  courseTitle?: string;
  title?: string;
  signedUrl: string;
  token: string;
  aesKey: string;
  tokenExpiresAt: number;
  accessUntil?: number | null;
  offlineValidityDays?: number;
}): Promise<void> {
  await ensureDir();
  const path = await fileFor(args.lessonId);
  const res = await FileSystem.downloadAsync(args.signedUrl, path);
  if (res.status < 200 || res.status >= 300) {
    await FileSystem.deleteAsync(path, { idempotent: true });
    throw new Error("Download failed (" + res.status + ")");
  }
  // Store JWT + AES key in hardware-backed Keychain/Keystore
  await SecureStore.setItemAsync(tokenKey(args.lessonId), args.token);
  await SecureStore.setItemAsync(aesKey(args.lessonId),   args.aesKey);

  const info = await FileSystem.getInfoAsync(path);
  const manifest = await readManifest();
  manifest[args.lessonId] = {
    lessonId: args.lessonId,
    courseId: args.courseId,
    courseTitle: args.courseTitle,
    title: args.title,
    sizeBytes: (info as any).size,
    downloadedAt: Date.now(),
    tokenExpiresAt: args.tokenExpiresAt,
    accessUntil: args.accessUntil ?? null,
    offlineValidityDays: args.offlineValidityDays,
  };
  await writeManifest(manifest);
}

// Legacy download (Phase 1 - no token needed, e.g. preview lessons)
export async function downloadLesson(args: {
  lessonId: string;
  courseId: string;
  courseTitle?: string;
  title?: string;
  signedUrl: string;
}): Promise<void> {
  await ensureDir();
  const path = await fileFor(args.lessonId);
  const res = await FileSystem.downloadAsync(args.signedUrl, path);
  if (res.status < 200 || res.status >= 300) {
    await FileSystem.deleteAsync(path, { idempotent: true });
    throw new Error("Download failed (" + res.status + ")");
  }
  const info = await FileSystem.getInfoAsync(path);
  const manifest = await readManifest();
  manifest[args.lessonId] = {
    lessonId: args.lessonId,
    courseId: args.courseId,
    courseTitle: args.courseTitle,
    title: args.title,
    sizeBytes: (info as any).size,
    downloadedAt: Date.now(),
  };
  await writeManifest(manifest);
}

// Phase 2: validate token before play. Returns local URI only if token is valid.
// If token expired (but file exists), tries to refresh from server.
export async function validateAndGetLocalUri(
  lessonId: string,
): Promise<{ uri: string; tokenValid: boolean } | null> {
  const path = await fileFor(lessonId);
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) return null;

  const manifest = await readManifest();
  const entry = manifest[lessonId];
  if (!entry) return null;

  // Hard access expiry: once the purchased/granted window is over, the offline
  // copy is wiped from the device (YouTube-on-revoke behaviour).
  if (entry.accessUntil && Date.now() > entry.accessUntil) {
    await removeLesson(lessonId);
    return null;
  }

  // No token = legacy Phase 1 download (preview content), allow it
  const storedToken = await SecureStore.getItemAsync(tokenKey(lessonId)).catch(() => null);
  if (!storedToken) return { uri: path, tokenValid: true };

  // Check offline re-validation deadline (the "reconnect within N days" token).
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = entry.tokenExpiresAt ?? 0;

  if (expiresAt > now) {
    // Still within the offline window.
    return { uri: path, tokenValid: true };
  }

  // Offline window lapsed — try to refresh silently (needs internet).
  try {
    const fresh: any = await api("/media/download-token", {
      method: "POST",
      body: { lessonId },
    });
    if (fresh?.token) {
      await SecureStore.setItemAsync(tokenKey(lessonId), fresh.token);
      await SecureStore.setItemAsync(aesKey(lessonId), fresh.aesKey);
      const updated = await readManifest();
      if (updated[lessonId]) {
        updated[lessonId].tokenExpiresAt = fresh.expiresAt;
        updated[lessonId].accessUntil = fresh.accessUntil ?? null;
        if (typeof fresh.offlineValidityDays === "number")
          updated[lessonId].offlineValidityDays = fresh.offlineValidityDays;
        await writeManifest(updated);
      }
      return { uri: path, tokenValid: true };
    }
  } catch (e: any) {
    // Server reachable but access denied (revoked/expired) -> wipe the copy.
    const status = e?.status ?? e?.response?.status;
    if (status === 401 || status === 403 || status === 404) {
      await removeLesson(lessonId);
      return null;
    }
    // Otherwise (no internet): the offline copy has EXPIRED and must reconnect.
    // Per YouTube behaviour, an expired offline copy stops playing.
  }
  return { uri: path, tokenValid: false };
}

// Offline countdown status for the player UI ("Downloaded · expires in X days").
export async function getOfflineStatus(lessonId: string): Promise<OfflineStatus> {
  const manifest = await readManifest();
  const entry = manifest[lessonId];
  const path = await fileFor(lessonId);
  const info = await FileSystem.getInfoAsync(path);
  const downloaded = info.exists && !!entry;
  if (!downloaded) {
    return {
      downloaded: false,
      daysUntilOfflineExpiry: null,
      daysUntilAccessExpiry: null,
      needsRevalidation: false,
      accessExpired: false,
    };
  }
  const nowMs = Date.now();
  const DAY = 24 * 3600 * 1000;
  const offlineExpiryMs = (entry.tokenExpiresAt ?? 0) * 1000;
  const daysUntilOfflineExpiry =
    offlineExpiryMs > 0
      ? Math.max(0, Math.ceil((offlineExpiryMs - nowMs) / DAY))
      : null;
  const daysUntilAccessExpiry = entry.accessUntil
    ? Math.max(0, Math.ceil((entry.accessUntil - nowMs) / DAY))
    : null;
  const accessExpired = !!entry.accessUntil && nowMs > entry.accessUntil;
  const needsRevalidation = offlineExpiryMs > 0 && nowMs > offlineExpiryMs;
  return {
    downloaded: true,
    daysUntilOfflineExpiry,
    daysUntilAccessExpiry,
    needsRevalidation,
    accessExpired,
  };
}

// Called on course load with the server's access verdict. If access has expired
// or been revoked, all downloaded videos for the course are wiped from device.
export async function enforceCourseAccess(
  courseId: string,
  opts: { accessExpired?: boolean; hasAccess?: boolean },
): Promise<boolean> {
  const expired = opts.accessExpired === true || opts.hasAccess === false;
  if (expired) {
    await removeCourse(courseId);
    return true;
  }
  return false;
}

// Phase 3: fetch DRM config for online streaming (Widevine / FairPlay)
export async function getDrmConfig(lessonId: string): Promise<DrmConfig | null> {
  try {
    const data: any = await api("/media/drm-token/" + lessonId);
    if (!data?.drmToken || !data?.licenseUrl) return null;
    // Platform detection: on iOS use fairplay, on Android use widevine
    const { Platform } = await import("react-native");
    const type: "widevine" | "fairplay" = Platform.OS === "ios" ? "fairplay" : "widevine";
    return { type, licenseServer: data.licenseUrl, token: data.drmToken };
  } catch {
    return null;
  }
}

export async function removeLesson(lessonId: string): Promise<void> {
  const path = await fileFor(lessonId);
  await FileSystem.deleteAsync(path, { idempotent: true });
  await SecureStore.deleteItemAsync(tokenKey(lessonId)).catch(() => {});
  await SecureStore.deleteItemAsync(aesKey(lessonId)).catch(() => {});
  const manifest = await readManifest();
  delete manifest[lessonId];
  await writeManifest(manifest);
}

export async function downloadedLessons(): Promise<OfflineLesson[]> {
  return Object.values(await readManifest());
}

export async function downloadedCountForCourse(courseId: string): Promise<number> {
  return Object.values(await readManifest()).filter((l) => l.courseId === courseId).length;
}

export async function removeCourse(courseId: string): Promise<void> {
  const manifest = await readManifest();
  for (const l of Object.values(manifest)) {
    if (l.courseId === courseId) {
      await FileSystem.deleteAsync(await fileFor(l.lessonId), { idempotent: true });
      await SecureStore.deleteItemAsync(tokenKey(l.lessonId)).catch(() => {});
      await SecureStore.deleteItemAsync(aesKey(l.lessonId)).catch(() => {});
      delete manifest[l.lessonId];
    }
  }
  await writeManifest(manifest);
}
