// Secure offline COURSE media (purchased lesson videos).
//
// Same sandbox guarantees as secure.ts (books):
//   - Files are written under FileSystem.documentDirectory (app-private). They
//     never appear in the gallery or a file-manager, cannot be opened/shared by
//     other apps, and are wiped automatically on uninstall.
//   - Filenames are SHA-256 hashes of the lesson id, so they are not
//     human-meaningful and cannot be guessed/browsed.
//   - Combined with the screen-capture block on the player (protect.ts), this
//     stops casual re-sharing or screen-recording of purchased videos.
//
// Video files are large, so (unlike small book text) we do NOT XOR-encrypt the
// bytes in JS — that would be far too slow on device. The app-private sandbox
// is what prevents forward-sharing; recording is deterred separately.
import * as FileSystem from "expo-file-system";
import * as Crypto from "expo-crypto";
import AsyncStorage from "@react-native-async-storage/async-storage";

const COURSE_DIR = FileSystem.documentDirectory + "secure-courses/";
const MANIFEST_KEY = "offline_courses_v1";

export type OfflineLesson = {
  lessonId: string;
  courseId: string;
  courseTitle?: string;
  title?: string;
  sizeBytes?: number;
  downloadedAt: number;
};

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(COURSE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(COURSE_DIR, { intermediates: true });
  }
}

async function fileFor(lessonId: string): Promise<string> {
  const name = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    "lesson:" + lessonId,
  );
  return COURSE_DIR + name + ".mp4";
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

// Returns the local file uri for an offline lesson, or null if not downloaded.
export async function localLessonUri(lessonId: string): Promise<string | null> {
  const path = await fileFor(lessonId);
  const info = await FileSystem.getInfoAsync(path);
  return info.exists ? path : null;
}

export async function isLessonDownloaded(lessonId: string): Promise<boolean> {
  return (await localLessonUri(lessonId)) !== null;
}

// Download a lesson video (via a short-lived signed URL) into the app sandbox.
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

export async function removeLesson(lessonId: string): Promise<void> {
  const path = await fileFor(lessonId);
  await FileSystem.deleteAsync(path, { idempotent: true });
  const manifest = await readManifest();
  delete manifest[lessonId];
  await writeManifest(manifest);
}

export async function downloadedLessons(): Promise<OfflineLesson[]> {
  const manifest = await readManifest();
  return Object.values(manifest);
}

export async function downloadedCountForCourse(
  courseId: string,
): Promise<number> {
  const manifest = await readManifest();
  return Object.values(manifest).filter((l) => l.courseId === courseId).length;
}

// Remove every offline lesson belonging to a course (e.g. on un-enroll).
export async function removeCourse(courseId: string): Promise<void> {
  const manifest = await readManifest();
  for (const l of Object.values(manifest)) {
    if (l.courseId === courseId) {
      await FileSystem.deleteAsync(await fileFor(l.lessonId), {
        idempotent: true,
      });
      delete manifest[l.lessonId];
    }
  }
  await writeManifest(manifest);
}
