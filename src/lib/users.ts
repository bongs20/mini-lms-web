import crypto from "crypto";
import { get, put } from "@vercel/blob";
import type { Role } from "./api";
import type { StoredUser } from "./store";

const USER_PREFIX = "users/by-username/";
const ROLES: Role[] = ["mahasiswa", "dosen", "admin"];

function getUserPath(username: string): string {
  const usernameHash = crypto
    .createHash("sha256")
    .update(username)
    .digest("hex");
  return `${USER_PREFIX}${usernameHash}.json`;
}

function isStoredUser(value: unknown): value is StoredUser {
  if (!value || typeof value !== "object") return false;
  const user = value as Partial<StoredUser>;
  return (
    typeof user.id === "string" &&
    typeof user.username === "string" &&
    typeof user.passwordHash === "string" &&
    typeof user.role === "string" &&
    ROLES.includes(user.role as Role) &&
    (user.name === undefined || typeof user.name === "string")
  );
}

export async function getStoredUserByUsername(
  username: string
): Promise<StoredUser | null> {
  const pathname = getUserPath(username);
  const result = await get(pathname, { access: "private", useCache: false });
  if (!result) return null;
  if (result.statusCode !== 200 || !result.stream) {
    throw new Error("Rekaman akun tidak dapat dibaca dari Vercel Blob.");
  }

  const value: unknown = await new Response(result.stream).json();
  if (!isStoredUser(value) || value.username !== username) {
    throw new Error("Format rekaman akun di Vercel Blob tidak valid.");
  }
  return value;
}

export async function saveStoredUser(user: StoredUser): Promise<boolean> {
  const pathname = getUserPath(user.username);
  try {
    await put(pathname, JSON.stringify(user), {
      access: "private",
      addRandomSuffix: false,
      contentType: "application/json",
    });
    return true;
  } catch (error) {
    if (await getStoredUserByUsername(user.username)) {
      return false;
    }
    throw error;
  }
}
