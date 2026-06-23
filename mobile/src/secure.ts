// Secure offline book storage.
//
// Goals (per product spec):
//   - Purchased content stays INSIDE the app sandbox.
//   - Content is encrypted at rest and is not exportable / shareable / visible
//     in the device file manager.
//   - Reading works fully offline and resumes from the last page.
//
// Implementation notes:
//   - Files are written under FileSystem.documentDirectory (app-private storage,
//     not the shared MediaLibrary), so they never appear in the gallery or a
//     file-manager browseable location, and are removed when the app is
//     uninstalled.
//   - Filenames are hashed so they are not human-meaningful.
//   - Bytes are encrypted with a per-book random key kept in the OS keystore
//     via expo-secure-store (Keychain on iOS / Keystore on Android). The key
//     never touches normal storage.
//   - The keystream cipher below uses a SHA-256 CTR keystream from expo-crypto
//     so it works without any extra native module. For production hardening you
//     can swap this for hardware-backed AES-256-GCM (the backend already
//     encrypts payloads with AES-256-GCM) without changing the public API.
import * as FileSystem from "expo-file-system";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";

const SECURE_DIR = FileSystem.documentDirectory + "secure-library/";

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(SECURE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(SECURE_DIR, { intermediates: true });
  }
}

function toBytes(str: string): number[] {
  const bin = unescape(encodeURIComponent(str));
  const bytes: number[] = [];
  for (let i = 0; i < bin.length; i++) bytes.push(bin.charCodeAt(i) & 0xff);
  return bytes;
}

function fromBytes(bytes: number[]): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return decodeURIComponent(escape(bin));
}

function hexToBytes(hex: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16));
  }
  return bytes;
}

function bytesToHex(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function keystreamBytes(
  seedHex: string,
  length: number,
): Promise<number[]> {
  let hex = "";
  let counter = 0;
  while (hex.length < length * 2) {
    hex += await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      seedHex + ":" + counter,
    );
    counter++;
  }
  return hexToBytes(hex.slice(0, length * 2));
}

async function fileFor(bookId: string): Promise<string> {
  const name = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    "book:" + bookId,
  );
  return SECURE_DIR + name + ".dat";
}

function keyName(bookId: string): string {
  return "bookkey_" + bookId.replace(/[^a-zA-Z0-9_]/g, "");
}

async function getOrCreateKey(bookId: string): Promise<string> {
  let keyHex = await SecureStore.getItemAsync(keyName(bookId));
  if (!keyHex) {
    const rand = await Crypto.getRandomBytesAsync(32);
    keyHex = bytesToHex(Array.from(rand));
    await SecureStore.setItemAsync(keyName(bookId), keyHex);
  }
  return keyHex;
}

// Persist server-decrypted content securely on device for offline reading.
export async function saveProtectedContent(
  bookId: string,
  plaintext: string,
): Promise<void> {
  await ensureDir();
  const keyHex = await getOrCreateKey(bookId);
  const data = toBytes(plaintext);
  const ks = await keystreamBytes(keyHex, data.length);
  const enc = data.map((b, i) => b ^ ks[i]);
  await FileSystem.writeAsStringAsync(await fileFor(bookId), bytesToHex(enc));
}

export async function loadProtectedContent(
  bookId: string,
): Promise<string | null> {
  const path = await fileFor(bookId);
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) return null;
  const keyHex = await SecureStore.getItemAsync(keyName(bookId));
  if (!keyHex) return null;
  const enc = hexToBytes(await FileSystem.readAsStringAsync(path));
  const ks = await keystreamBytes(keyHex, enc.length);
  const dec = enc.map((b, i) => b ^ ks[i]);
  return fromBytes(dec);
}

export async function isAvailableOffline(bookId: string): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(await fileFor(bookId));
  return info.exists;
}

export async function removeProtectedContent(bookId: string): Promise<void> {
  const path = await fileFor(bookId);
  const info = await FileSystem.getInfoAsync(path);
  if (info.exists) await FileSystem.deleteAsync(path, { idempotent: true });
  await SecureStore.deleteItemAsync(keyName(bookId));
}
