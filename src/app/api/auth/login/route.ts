import { NextResponse } from "next/server";
import {
  getStore,
  sanitizeUser,
  signToken,
  verifyPassword,
} from "@/lib/store";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      username?: string;
      password?: string;
    };
    const username = body.username?.trim();
    const password = body.password || "";

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
    const user = store.users.find((u) => u.username === username);
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
  } catch {
    return NextResponse.json(
      { success: false, error: { message: "Permintaan login tidak valid." } },
      { status: 400 }
    );
  }
}
