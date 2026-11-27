export type Role = "mahasiswa" | "dosen" | "admin";

export interface User {
  id: string;
  name?: string;
  username: string;
  role: Role;
}

export interface Course {
  id: string;
  code: string;
  name: string;
  description?: string;
}

export interface Assignment {
  id: string;
  course_id: string;
  title: string;
  description?: string;
  due_date?: string;
}

export interface Submission {
  id: string;
  assignment_id: string;
  user_id: string;
  user_name?: string;
  file_name: string;
  file_path: string;
  submitted_at?: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  message: string;
  read?: boolean;
  created_at?: string;
}

export interface ServiceHealth {
  name: string;
  status: string;
  url?: string;
  latency_ms?: number;
}

const TOKEN_KEY = "mini-lms-token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const { method = "GET", body } = options;
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    headers["X-Request-ID"] = `ui-${crypto.randomUUID()}`;
  }

  const res = await fetch(path, {
    method,
    headers,
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });

  let payload: { success?: boolean; data?: T; error?: { message?: string } };
  try {
    payload = await res.json();
  } catch {
    throw new Error("Server mengirim respons yang tidak dapat dibaca.");
  }

  if (!res.ok || payload.success === false) {
    if (res.status === 401 && token) {
      setToken(null);
    }
    throw new Error(
      payload.error?.message || `Permintaan gagal (${res.status}).`
    );
  }

  return (payload.data !== undefined ? payload.data : payload) as T;
}
