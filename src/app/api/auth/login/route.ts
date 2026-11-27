import { NextResponse } from "next/server";
import {
  getStore,
  sanitizeUser,
  signToken,
  verifyPassword,
} from "@/lib/store";
import { isBlobStorageConfigured } from "@/lib/blob";
import { getStoredUserByUsername } from "@/lib/users";

export async function POST(request: Request) {
  let input: Record<string, unknown>;
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error("Invalid login body");
    }
    input = body as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { success: false, error: { message: "Permintaan login tidak valid." } },
      { status: 400 }
    );
  }

  const username =
    typeof input.username === "string" ? input.username.trim() : "";
  const password = typeof input.password === "string" ? input.password : "";
  if (!username || !password) {
    return NextResponse.json(
      {
        success: false,
        error: { message: "Username dan password wajib diisi." },
      },
      { status: 400 }
    );
  }

  try {
    const store = getStore();
    const storedUser = isBlobStorageConfigured()
      ? await getStoredUserByUsername(username)
      : null;
    const user =
      storedUser || store.users.find((item) => item.username === username);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "Username atau password salah." },
        },
        { status: 401 }
      );
    }

    const safeUser = sanitizeUser(user);
    const token = signToken(safeUser);

    return NextResponse.json({
      success: true,
      data: { token, user: safeUser },
    });
  } catch (error) {
    console.error("Gagal membaca akun dari Vercel Blob.", error);
    return NextResponse.json(
      {
        success: false,
        error: { message: "Gagal membaca data akun. Silakan coba lagi." },
      },
      { status: 500 }
    );
  }
}
