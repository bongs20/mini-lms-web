import { get } from "@vercel/blob";
import { NextResponse } from "next/server";
import { isBlobStorageConfigured } from "@/lib/blob";
import { isAssignmentDeleted } from "@/lib/catalog";
import { getAuthUser } from "@/lib/store";
import { getStoredSubmission } from "@/lib/submissions";

export async function GET(
  request: Request,
  context: { params: Promise<{ submissionId: string }> }
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

  const { submissionId } = await context.params;
  if (!/^sub-[0-9a-f-]{36}$/i.test(submissionId)) {
    return NextResponse.json(
      { success: false, error: { message: "Pengumpulan tidak ditemukan." } },
      { status: 404 }
    );
  }

  try {
    const submission = await getStoredSubmission(submissionId);
    if (!submission) {
      return NextResponse.json(
        { success: false, error: { message: "Pengumpulan tidak ditemukan." } },
        { status: 404 }
      );
    }
    if (await isAssignmentDeleted(submission.assignment_id)) {
      return NextResponse.json(
        { success: false, error: { message: "Pengumpulan tidak ditemukan." } },
        { status: 404 }
      );
    }

    if (
      user.role !== "dosen" &&
      user.role !== "admin" &&
      submission.user_id !== user.id
    ) {
      return NextResponse.json(
        { success: false, error: { message: "Tidak memiliki akses." } },
        { status: 403 }
      );
    }

    const blob = await get(submission.file_blob_path, {
      access: "private",
      useCache: false,
    });
    if (!blob || blob.statusCode !== 200 || !blob.stream) {
      console.error("Berkas pengumpulan tidak ditemukan di Vercel Blob.", {
        submissionId,
        pathname: submission.file_blob_path,
      });
      return NextResponse.json(
        {
          success: false,
          error: { message: "Berkas pengumpulan tidak ditemukan di Blob." },
        },
        { status: 404 }
      );
    }

    const fallbackName = submission.file_name.replace(/[^\x20-\x7e]/g, "_");
    return new NextResponse(blob.stream, {
      headers: {
        "Content-Type": blob.blob.contentType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${fallbackName.replace(/["\\]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(submission.file_name)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Gagal mengambil berkas pengumpulan dari Vercel Blob.", error);
    return NextResponse.json(
      {
        success: false,
        error: { message: "Gagal mengambil berkas pengumpulan dari Blob." },
      },
      { status: 500 }
    );
  }
}
