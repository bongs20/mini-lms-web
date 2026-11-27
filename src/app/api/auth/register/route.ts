import { NextResponse } from "next/server";
import type { Role } from "@/lib/api";
import { createUserRecord, getStore, sanitizeUser } from "@/lib/store";
import { isBlobStorageConfigured } from "@/lib/blob";
import { saveStoredUser } from "@/lib/users";

export async function POST(request: Request) {
  let input: Record<string, unknown>;
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error("Invalid registration body");
    }
    input = body as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { message: "Data registrasi tidak valid." },
      },
      { status: 400 }
    );
  }

  const username =
    typeof input.username === "string" ? input.username.trim() : "";
  const password = typeof input.password === "string" ? input.password : "";
  const role: Role = input.role === "dosen" ? "dosen" : "mahasiswa";

  if (!username || !password) {
    return NextResponse.json(
      {
        success: false,
        error: { message: "Username dan password wajib diisi." },
      },
      { status: 400 }
    );
  }
  if (input.role === "admin") {
    return NextResponse.json(
      {
        success: false,
        error: { message: "Akun admin tidak dapat dibuat melalui registrasi." },
      },
      { status: 403 }
    );
  }
  if (!isBlobStorageConfigured()) {
    return NextResponse.json(
      {
        success: false,
        error: {
          message:
            "Penyimpanan akun belum tersedia. Hubungkan private Vercel Blob store ke project.",
        },
      },
      { status: 503 }
    );
  }

  const store = getStore();
  if (store.users.some((u) => u.username === username)) {
    return NextResponse.json(
      { success: false, error: { message: "Username sudah terdaftar." } },
      { status: 409 }
    );
  }

  const newUser = createUserRecord({
    name: typeof input.name === "string" ? input.name.trim() : undefined,
    username,
    password,
    role,
  });

  try {
    if (!(await saveStoredUser(newUser))) {
      return NextResponse.json(
        { success: false, error: { message: "Username sudah terdaftar." } },
        { status: 409 }
      );
    }

    store.users.push(newUser);
    store.notifications.unshift({
      id: `ntf-${Date.now()}`,
      user_id: newUser.id,
      message: `Selamat datang, ${newUser.name}! Akun ${newUser.role} Anda telah aktif.`,
      read: false,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json(
      { success: true, data: { user: sanitizeUser(newUser) } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Gagal menyimpan akun ke Vercel Blob.", error);
    return NextResponse.json(
      {
        success: false,
        error: { message: "Gagal menyimpan akun. Silakan coba lagi." },
      },
      { status: 500 }
    );
  }
}
