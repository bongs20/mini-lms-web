import crypto from "crypto";
import { NextResponse } from "next/server";
import { getAuthUser, getStore } from "@/lib/store";
import {
  listStoredAssignments,
  listStoredCourses,
  mergeCatalogRecords,
  saveStoredAssignment,
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

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("course_id");

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
    const storedAssignments = await listStoredAssignments();
    const store = getStore();
    const assignments = mergeCatalogRecords(
      store.assignments,
      storedAssignments
    ).filter((assignment) => !courseId || assignment.course_id === courseId);
    return NextResponse.json({
      success: true,
      data: { assignments },
    });
  } catch (error) {
    console.error("Gagal memuat tugas dari Vercel Blob.", error);
    return NextResponse.json(
      {
        success: false,
        error: { message: "Gagal memuat tugas dari Vercel Blob." },
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
        error: { message: "Hanya dosen atau admin yang dapat membuat tugas." },
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

  let body: {
    course_id?: string;
    title?: string;
    description?: string;
    due_date?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { success: false, error: { message: "Data tugas tidak valid." } },
      { status: 400 }
    );
  }
  const courseId = body.course_id?.trim();
  const title = body.title?.trim();

  if (!courseId || !title) {
    return NextResponse.json(
      {
        success: false,
        error: { message: "course_id dan title wajib diisi." },
      },
      { status: 400 }
    );
  }

  try {
    const storedCourses = await listStoredCourses();
    const store = getStore();
    if (
      !mergeCatalogRecords(store.courses, storedCourses).some(
        (course) => course.id === courseId
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "Mata kuliah tidak ditemukan." },
        },
        { status: 404 }
      );
    }

    const assignment = {
      id: `asg-${crypto.randomUUID().slice(0, 8)}`,
      course_id: courseId,
      title,
      description: body.description?.trim() || "",
      due_date: body.due_date || undefined,
    };
    await saveStoredAssignment(assignment);
    store.assignments.push(assignment);

    return NextResponse.json(
      { success: true, data: { assignment } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Gagal menyimpan tugas ke Vercel Blob.", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message:
            error instanceof Error
              ? error.message
              : "Gagal menyimpan tugas ke Vercel Blob.",
        },
      },
      { status: 500 }
    );
  }
}
