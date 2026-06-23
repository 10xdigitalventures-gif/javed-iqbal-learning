import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

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
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}
