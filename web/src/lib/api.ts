"use client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

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
  key: string;
  url: string;
  filename: string;
  mimetype: string;
  size: number;
  durationSec: number | null;
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
  return res.json();
}

// Build the Server-Sent Events URL (token in query string because EventSource
// cannot send Authorization headers).
export function eventsUrl(): string | null {
  const token = getToken();
  if (!token) return null;
  return `${API_URL}/events?token=${encodeURIComponent(token)}`;
}

export { API_URL };
