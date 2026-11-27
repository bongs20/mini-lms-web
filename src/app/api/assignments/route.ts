import crypto from "crypto";
import { NextResponse } from "next/server";
import { getAuthUser, getStore } from "@/lib/store";
import {
  deleteStoredAssignmentRecords,
  listDeletedAssignmentIds,
  listDeletedCourseIds,
  listStoredAssignments,
  listStoredCourses,
  markAssignmentDeleted,
  mergeCatalogRecords,
  saveStoredAssignment,
} from "@/lib/catalog";
import { deleteStoredSubmissionsForAssignments } from "@/lib/submissions";
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
    const [storedAssignments, deletedAssignmentIds, deletedCourseIds] =
      await Promise.all([
        listStoredAssignments(),
        listDeletedAssignmentIds(),
        listDeletedCourseIds(),
      ]);
    const store = getStore();
    const assignments = mergeCatalogRecords(
      store.assignments,
      storedAssignments
    ).filter(
      (assignment) =>
        !deletedAssignmentIds.has(assignment.id) &&
        !deletedCourseIds.has(assignment.course_id) &&
        (!courseId || assignment.course_id === courseId)
    );
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

export async function DELETE(request: Request) {
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
        error: { message: "Hanya dosen atau admin yang dapat menghapus tugas." },
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

  const assignmentId = new URL(request.url).searchParams.get("id")?.trim();
  if (!assignmentId || !/^asg-[a-zA-Z0-9-]+$/.test(assignmentId)) {
    return NextResponse.json(
      { success: false, error: { message: "ID tugas tidak valid." } },
      { status: 400 }
    );
  }

  try {
    const [storedAssignments, deletedAssignmentIds] = await Promise.all([
      listStoredAssignments(),
      listDeletedAssignmentIds(),
    ]);
    const store = getStore();
    const assignmentExists = mergeCatalogRecords(
      store.assignments,
      storedAssignments
    ).some((assignment) => assignment.id === assignmentId);
    if (!assignmentExists && !deletedAssignmentIds.has(assignmentId)) {
      return NextResponse.json(
        { success: false, error: { message: "Tugas tidak ditemukan." } },
        { status: 404 }
      );
    }

    await markAssignmentDeleted(assignmentId);
    const deletedSubmissions =
      await deleteStoredSubmissionsForAssignments([assignmentId]);
    await deleteStoredAssignmentRecords([assignmentId]);
    store.assignments = store.assignments.filter(
      (assignment) => assignment.id !== assignmentId
    );

    return NextResponse.json({
      success: true,
      data: { deleted: true, deleted_submissions: deletedSubmissions },
    });
  } catch (error) {
    console.error("Gagal menghapus tugas beserta pengumpulan terkait.", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message:
            "Penghapusan tugas belum selesai. Coba ulangi; pengumpulan terkait mungkin sedang dibersihkan.",
        },
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
    const [storedCourses, deletedCourseIds] = await Promise.all([
      listStoredCourses(),
      listDeletedCourseIds(),
    ]);
    const store = getStore();
    if (
      deletedCourseIds.has(courseId) ||
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
