import { NextResponse } from "next/server";
import type { Role } from "@/lib/api";
import { createUserRecord, getStore, sanitizeUser } from "@/lib/store";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      username?: string;
      password?: string;
      role?: Role;
    };
    const username = body.username?.trim();
    const password = body.password || "";
    const role: Role =
      body.role === "dosen" || body.role === "admin" ? body.role : "mahasiswa";

    if (!username || !password) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "Username dan password wajib diisi." },
        },
        { status: 400 }
      );
    }

    const store = getStore();
    if (store.users.some((u) => u.username === username)) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "Username sudah terdaftar." },
        },
        { status: 409 }
      );
    }

    const newUser = createUserRecord({
      name: body.name?.trim(),
      username,
      password,
      role,
    });
    store.users.push(newUser);

    store.notifications.unshift({
      id: `ntf-${Date.now()}`,
      user_id: newUser.id,
      message: `Selamat datang, ${newUser.name}! Akun ${newUser.role} Anda telah aktif.`,
      read: false,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        success: true,
        data: { user: sanitizeUser(newUser) },
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { message: "Permintaan registrasi tidak valid." },
      },
      { status: 400 }
    );
  }
}
