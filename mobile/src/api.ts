import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as Device from "expo-device";
import { Platform } from "react-native";

export const API_URL =
  (Constants.expoConfig?.extra as any)?.apiUrl || "http://10.0.2.2:4000/api";

let token: string | null = null;

export async function loadToken() {
  token = await AsyncStorage.getItem("token");
  return token;
}

export async function setToken(t: string) {
  token = t;
  await AsyncStorage.setItem("token", t);
}

export async function clearToken() {
  token = null;
  await AsyncStorage.removeItem("token");
}

// Stable per-install device id used for the concurrent-device limit. Generated
// once and persisted; survives logout so re-login on the same phone reuses it.
export async function getDeviceInfo(): Promise<{
  deviceId: string;
  deviceLabel: string;
  devicePlatform: string;
}> {
  let id = await AsyncStorage.getItem("device_id");
  if (!id) {
    id =
      (Crypto as any).randomUUID?.() ??
      String(Date.now()) + "-" + Math.random().toString(36).slice(2);
    await AsyncStorage.setItem("device_id", id);
  }
  const label =
    [Device.brand, Device.modelName].filter(Boolean).join(" ") ||
    Device.deviceName ||
    (Platform.OS === "ios" ? "iPhone" : "Android device");
  return {
    deviceId: id,
    deviceLabel: label,
    devicePlatform: Platform.OS,
  };
}

// Optional callback invoked when the server signs this device out (401 with a
// device-revoked message). The auth layer wires this to force a logout.
let onSignedOut: (() => void) | null = null;
export function setOnSignedOut(cb: (() => void) | null) {
  onSignedOut = cb;
}

export async function api<T = any>(
  path: string,
  opts: { method?: string; body?: any } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method || "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      message = Array.isArray(data.message)
        ? data.message.join(", ")
        : data.message || message;
    } catch {}
    // Device signed out remotely / kicked by the concurrent-device limit.
    if (
      res.status === 401 &&
      /signed out|device/i.test(message) &&
      onSignedOut
    ) {
      onSignedOut();
    }
    const err: any = new Error(message);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// Upload a local audio/video file to /media/upload and return its stable key
// plus the server-verified duration. Uses multipart/form-data (no JSON body).
export async function uploadMedia(file: {
  uri: string;
  name: string;
  type: string;
}): Promise<{ key: string; url?: string; durationSec?: number }> {
  const form = new FormData();
  form.append("file", { uri: file.uri, name: file.name, type: file.type } as any);
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}/media/upload`, {
    method: "POST",
    headers,
    body: form as any,
  });
  if (!res.ok) {
    let message = `Upload failed (${res.status})`;
    try {
      const data = await res.json();
      message = Array.isArray(data.message)
        ? data.message.join(", ")
        : data.message || message;
    } catch {}
    throw new Error(message);
  }
  return res.json();
}
