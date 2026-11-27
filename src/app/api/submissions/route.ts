import crypto from "crypto";
import { NextResponse } from "next/server";
import type { Assignment } from "@/lib/api";
import { getAuthUser, getStore } from "@/lib/store";
import {
  listStoredAssignments,
  mergeCatalogRecords,
} from "@/lib/catalog";
import {
  createStoredSubmission,
  MAX_SUBMISSION_FILE_SIZE,
} from "@/lib/submissions";
import { isBlobStorageConfigured } from "@/lib/blob";

export async function POST(request: Request) {
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

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { message: "Format pengumpulan harus berupa multipart/form-data." },
      },
      { status: 400 }
    );
  }

  const assignmentId = formData.get("assignment_id");
  const file = formData.get("file");
  if (
    typeof assignmentId !== "string" ||
    !assignmentId.trim() ||
    !(file instanceof File)
  ) {
    return NextResponse.json(
      {
        success: false,
        error: { message: "assignment_id dan berkas file wajib diisi." },
      },
      { status: 400 }
    );
  }
  if (file.size === 0) {
    return NextResponse.json(
      { success: false, error: { message: "Berkas tidak boleh kosong." } },
      { status: 400 }
    );
  }
  if (file.size > MAX_SUBMISSION_FILE_SIZE) {
    return NextResponse.json(
      { success: false, error: { message: "Ukuran berkas maksimal 4 MB." } },
      { status: 413 }
    );
  }

  const store = getStore();
  const normalizedAssignmentId = assignmentId.trim();
  let assignments: Assignment[];
  try {
    assignments = await listStoredAssignments();
  } catch (error) {
    console.error("Gagal memeriksa tugas di Vercel Blob.", error);
    return NextResponse.json(
      {
        success: false,
        error: { message: "Gagal memeriksa tugas di Vercel Blob." },
      },
      { status: 500 }
    );
  }
  if (
    !mergeCatalogRecords(store.assignments, assignments).some(
      (assignment) => assignment.id === normalizedAssignmentId
    )
  ) {
    return NextResponse.json(
      {
        success: false,
        error: { message: "Tugas tidak ditemukan." },
      },
      { status: 404 }
    );
  }

  const fileName = file.name
    .replace(/[/\\]/g, "_")
    .replace(/\.\.+/g, ".")
    .replace(/[\x00-\x1f\x7f]/g, "")
    .trim();
  if (!fileName) {
    return NextResponse.json(
      { success: false, error: { message: "Nama berkas tidak valid." } },
      { status: 400 }
    );
  }

  try {
    const submission = await createStoredSubmission({
      assignmentId: normalizedAssignmentId,
      file,
      fileName,
      submissionId: `sub-${crypto.randomUUID()}`,
      userId: user.id,
      userName: user.name || user.username,
    });
    store.notifications.unshift({
      id: `ntf-${crypto.randomUUID().slice(0, 8)}`,
      user_id: user.id,
      message: `Pengumpulan tugas "${submission.file_name}" berhasil dicatat.`,
      read: false,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json(
      { success: true, data: { submission } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Gagal menyimpan pengumpulan tugas ke Vercel Blob.", error);
    return NextResponse.json(
      {
      success: false,
      error: {
        message:
          error instanceof Error
            ? error.message
            : "Gagal menyimpan pengumpulan ke Vercel Blob.",
      },
      },
      { status: 500 }
    );
  }
}
