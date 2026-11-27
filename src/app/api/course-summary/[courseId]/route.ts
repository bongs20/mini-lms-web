import { NextResponse } from "next/server";
import { isBlobStorageConfigured } from "@/lib/blob";
import { getAuthUser, getStore } from "@/lib/store";
import { listStoredSubmissions } from "@/lib/submissions";
import {
  listDeletedAssignmentIds,
  listDeletedCourseIds,
  listStoredAssignments,
  listStoredCourses,
  mergeCatalogRecords,
} from "@/lib/catalog";

export async function GET(
  request: Request,
  context: { params: Promise<{ courseId: string }> }
) {
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

  const { courseId } = await context.params;
  const store = getStore();

  try {
  const [
    storedCourses,
    storedAssignments,
    submissions,
    deletedCourseIds,
    deletedAssignmentIds,
  ] =
    await Promise.all([
      listStoredCourses(),
      listStoredAssignments(),
      listStoredSubmissions(),
      listDeletedCourseIds(),
      listDeletedAssignmentIds(),
    ]);
  if (deletedCourseIds.has(courseId)) {
    return NextResponse.json(
      { success: false, error: { message: "Mata kuliah tidak ditemukan." } },
      { status: 404 }
    );
  }
  const course = mergeCatalogRecords(store.courses, storedCourses).find(
    (item) => item.id === courseId
  );
  if (!course) {
    return NextResponse.json(
      { success: false, error: { message: "Mata kuliah tidak ditemukan." } },
      { status: 404 }
    );
  }

  const assignments = mergeCatalogRecords(
    store.assignments,
    storedAssignments
  )
    .filter(
      (a) =>
        a.course_id === courseId && !deletedAssignmentIds.has(a.id)
    )
    .map((a) => ({
      ...a,
      submissions: submissions.filter(
        (s) =>
          s.assignment_id === a.id &&
          (user.role === "dosen" ||
            user.role === "admin" ||
            s.user_id === user.id)
      ),
    }));
  return NextResponse.json({
    success: true,
    data: { course, assignments },
  });
  } catch (error) {
  console.error("Gagal memuat pengumpulan tugas dari Vercel Blob.", error);
  return NextResponse.json(
    {
      success: false,
      error: { message: "Gagal memuat data pengumpulan dari Vercel Blob." },
    },
    { status: 500 }
  );
  }
}
