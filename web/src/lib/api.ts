"use client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

// Media (image/video/file) URLs are signed by the BACKEND using its own
// PUBLIC_API_URL env var. If that is misconfigured (e.g. left as localhost in
// production), every signed URL points at localhost and images fail to load.
// The frontend always knows the real API origin via NEXT_PUBLIC_API_URL, so we
// rewrite any relative or localhost media URL onto that origin. This makes
// images work regardless of the backend's PUBLIC_API_URL setting.
function toAbsoluteMediaUrl(url?: string | null): string {
  if (!url) return "";
  try {
    const apiOrigin = new URL(API_URL).origin;
    if (url.startsWith("/")) return apiOrigin + url;
    const u = new URL(url);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
      return apiOrigin + u.pathname + u.search;
    }
    return url;
  } catch {
    return url;
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function setToken(token: string) {
  localStorage.setItem("token", token);
}

export function clearToken() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

type Options = {
  method?: string;
  body?: any;
  auth?: boolean;
};

// Thin fetch wrapper. Throws an Error with the backend message on failure so UI
// can surface it (never silently swallow errors).
export async function api<T = any>(
  path: string,
  opts: Options = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = getToken();
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
    } catch {
      // ignore json parse error
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// Upload a file (audio/video/image) to the media endpoint.
export type UploadResult = {
  assetId?: string;
  key: string;
  url: string;
  filename: string;
  mimetype: string;
  size: number;
  durationSec: number | null;
  storage?: string;
};

// A Media Library item as returned by GET /media/library (each carries a fresh
// signed `url` for inline preview).
export type MediaAsset = {
  id: string;
  ownerId: string;
  key: string;
  type: string; // image | video | audio | pdf | file
  filename: string;
  mimeType: string;
  size: number;
  durationSec: number | null;
  storage: string;
  createdAt: string;
  url: string;
};

export async function uploadFile(file: File): Promise<UploadResult> {
  const token = getToken();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_URL}/media/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) throw new Error("Upload failed");
  const data: UploadResult = await res.json();
  return { ...data, url: toAbsoluteMediaUrl(data.url) };
}

// List Media Library items, optionally filtered by category
// (image|video|audio|pdf|file).
export async function listMedia(type?: string): Promise<MediaAsset[]> {
  const q = type ? `?type=${encodeURIComponent(type)}` : "";
  const items = await api<MediaAsset[]>(`/media/library${q}`);
  return items.map((it) => ({ ...it, url: toAbsoluteMediaUrl(it.url) }));
}

// Fetch a fresh signed playback URL for a stored object key.
export async function signMedia(key: string): Promise<string> {
  const res = await api<{ url: string }>(
    `/media/sign?key=${encodeURIComponent(key)}`,
  );
  return toAbsoluteMediaUrl(res.url);
}

// Fetch a longer-lived shareable link for a Media Library item by id.
export async function shareMedia(
  id: string,
): Promise<{ url: string; type: string; filename: string; mimeType: string }> {
  const res = await api<{
    url: string;
    type: string;
    filename: string;
    mimeType: string;
  }>(`/media/share/${id}`);
  return { ...res, url: toAbsoluteMediaUrl(res.url) };
}

// Resolve a stored media value to a usable URL: external links pass through
// untouched; storage keys are signed on demand.
export async function resolveMediaUrl(
  value?: string | null,
): Promise<string | null> {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return toAbsoluteMediaUrl(value);
  try {
    return await signMedia(value);
  } catch {
    return null;
  }
}

// Build the Server-Sent Events URL (token in query string because EventSource
// cannot send Authorization headers).
export function eventsUrl(): string | null {
  const token = getToken();
  if (!token) return null;
  return `${API_URL}/events?token=${encodeURIComponent(token)}`;
}

export { API_URL };
