export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export const ROOT_DOMAIN =
  process.env.NEXT_PUBLIC_ROOT_DOMAIN || "10xdigitalventures.com";

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(API_URL + path, { cache: "no-store" });
  if (!res.ok) throw new Error("Request failed: " + res.status);
  return (await res.json()) as T;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(API_URL + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      (data && (data.message || data.error)) || "Request failed: " + res.status;
    throw new Error(Array.isArray(msg) ? msg.join(", ") : String(msg));
  }
  return data as T;
}
