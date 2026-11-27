import crypto from "crypto";
import { NextResponse } from "next/server";
import { getAuthUser, getStore } from "@/lib/store";
import {
  deleteStoredCourseRecord,
  deleteStoredAssignmentRecords,
  getCourseDeletionAssignmentIds,
  listDeletedCourseIds,
  listStoredAssignments,
  listStoredCourses,
  markAssignmentDeleted,
  mergeCatalogRecords,
  markCourseDeleted,
  saveStoredCourse,
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
    const [storedCourses, deletedCourseIds] = await Promise.all([
      listStoredCourses(),
      listDeletedCourseIds(),
    ]);
    const store = getStore();
    return NextResponse.json({
      success: true,
      data: {
        courses: mergeCatalogRecords(store.courses, storedCourses).filter(
          (course) => !deletedCourseIds.has(course.id)
        ),
      },
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
        error: { message: "Hanya dosen atau admin yang dapat menghapus mata kuliah." },
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

  const courseId = new URL(request.url).searchParams.get("id")?.trim();
  if (!courseId || !/^crs-[a-zA-Z0-9-]+$/.test(courseId)) {
    return NextResponse.json(
      { success: false, error: { message: "ID mata kuliah tidak valid." } },
      { status: 400 }
    );
  }

  const store = getStore();
  try {
    const [
      storedCourses,
      storedAssignments,
      priorDeletionAssignmentIds,
    ] = await Promise.all([
      listStoredCourses(),
      listStoredAssignments(),
      getCourseDeletionAssignmentIds(courseId),
    ]);
    const courseExists =
      priorDeletionAssignmentIds !== null ||
      mergeCatalogRecords(store.courses, storedCourses).some(
        (course) => course.id === courseId
      );
    if (!courseExists) {
      return NextResponse.json(
        { success: false, error: { message: "Mata kuliah tidak ditemukan." } },
        { status: 404 }
      );
    }

    const assignmentIds = Array.from(
      new Set([
        ...(priorDeletionAssignmentIds || []),
        ...mergeCatalogRecords(store.assignments, storedAssignments)
          .filter((assignment) => assignment.course_id === courseId)
          .map((assignment) => assignment.id),
      ])
    );
    await markCourseDeleted(courseId, assignmentIds);
    for (const assignmentId of assignmentIds) {
      await markAssignmentDeleted(assignmentId);
    }

    const deletedSubmissions =
      await deleteStoredSubmissionsForAssignments(assignmentIds);
    await deleteStoredAssignmentRecords(assignmentIds);
    await deleteStoredCourseRecord(courseId);

    store.courses = store.courses.filter((course) => course.id !== courseId);
    store.assignments = store.assignments.filter(
      (assignment) => assignment.course_id !== courseId
    );
    return NextResponse.json({
      success: true,
      data: {
        deleted: true,
        deleted_assignments: assignmentIds.length,
        deleted_submissions: deletedSubmissions,
      },
    });
  } catch (error) {
    console.error("Gagal menghapus mata kuliah beserta data terkait.", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message:
            "Penghapusan mata kuliah belum selesai. Coba ulangi; data terkait mungkin sedang dibersihkan.",
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
