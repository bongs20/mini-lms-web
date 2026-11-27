import crypto from "crypto";
import { NextResponse } from "next/server";
import { getAuthUser, getStore } from "@/lib/store";

export async function GET(request: Request) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: { message: "Tidak terautentikasi." } },
      { status: 401 }
    );
  }

  const store = getStore();
  return NextResponse.json({
    success: true,
    data: { courses: store.courses },
  });
}

export async function POST(request: Request) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: { message: "Tidak terautentikasi." } },
      { status: 401 }
    );
  }

  if (user.role !== "dosen" && user.role !== "admin") {
    return NextResponse.json(
      {
        success: false,
        error: { message: "Hanya dosen atau admin yang dapat menambah mata kuliah." },
      },
      { status: 403 }
    );
  }

  try {
    const body = (await request.json()) as {
      code?: string;
      name?: string;
      description?: string;
    };
    const code = body.code?.trim();
    const name = body.name?.trim();
    const description = body.description?.trim() || "";

    if (!code || !name) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "Kode dan nama mata kuliah wajib diisi." },
        },
        { status: 400 }
      );
    }

    const store = getStore();
    const course = {
      id: `crs-${crypto.randomUUID().slice(0, 8)}`,
      code,
      name,
      description,
    };
    store.courses.push(course);

    return NextResponse.json(
      { success: true, data: { course } },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: { message: "Data mata kuliah tidak valid." } },
      { status: 400 }
    );
  }
}
