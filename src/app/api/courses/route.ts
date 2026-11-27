import crypto from "crypto";
import { NextResponse } from "next/server";
import { getAuthUser, getStore } from "@/lib/store";
import {
  listStoredCourses,
  mergeCatalogRecords,
  saveStoredCourse,
} from "@/lib/catalog";
import { isBlobStorageConfigured } from "@/lib/blob";

export async function GET(request: Request) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: { message: "Tidak terautentikasi." } },
      { status: 401 }
    );
  }

  if (!isBlobStorageConfigured()) {
    return NextResponse.json(
      {
        success: false,
        error: {
          message:
            "Penyimpanan Vercel Blob belum dikonfigurasi. Hubungkan Blob store privat ke project.",
        },
      },
      { status: 503 }
    );
  }

  try {
    const storedCourses = await listStoredCourses();
    const store = getStore();
    return NextResponse.json({
      success: true,
      data: { courses: mergeCatalogRecords(store.courses, storedCourses) },
    });
  } catch (error) {
    console.error("Gagal memuat mata kuliah dari Vercel Blob.", error);
    return NextResponse.json(
      {
        success: false,
        error: { message: "Gagal memuat mata kuliah dari Vercel Blob." },
      },
      { status: 500 }
    );
  }
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
  if (!isBlobStorageConfigured()) {
    return NextResponse.json(
      {
        success: false,
        error: {
          message:
            "Penyimpanan Vercel Blob belum dikonfigurasi. Hubungkan Blob store privat ke project.",
        },
      },
      { status: 503 }
    );
  }

  let body: { code?: string; name?: string; description?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { success: false, error: { message: "Data mata kuliah tidak valid." } },
      { status: 400 }
    );
  }
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

  try {
    const course = {
      id: `crs-${crypto.randomUUID().slice(0, 8)}`,
      code,
      name,
      description,
    };
    await saveStoredCourse(course);
    const store = getStore();
    store.courses.push(course);

    return NextResponse.json(
      { success: true, data: { course } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Gagal menyimpan mata kuliah ke Vercel Blob.", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message:
            error instanceof Error
              ? error.message
              : "Gagal menyimpan mata kuliah ke Vercel Blob.",
        },
      },
      { status: 500 }
    );
  }
}
