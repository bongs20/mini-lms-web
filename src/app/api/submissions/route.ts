import crypto from "crypto";
import { NextResponse } from "next/server";
import { getAuthUser, getStore } from "@/lib/store";

export async function POST(request: Request) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: { message: "Tidak terautentikasi." } },
      { status: 401 }
    );
  }

  try {
    const body = (await request.json()) as {
      assignment_id?: string;
      file_name?: string;
      file_path?: string;
    };

    const assignmentId = body.assignment_id?.trim();
    const fileName = body.file_name?.trim();
    const filePath = body.file_path?.trim();

    if (!assignmentId || !fileName || !filePath) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "assignment_id, file_name, dan file_path wajib diisi." },
        },
        { status: 400 }
      );
    }

    const store = getStore();
    const submission = {
      id: `sub-${crypto.randomUUID().slice(0, 8)}`,
      assignment_id: assignmentId,
      user_id: user.id,
      file_name: fileName,
      file_path: filePath,
      submitted_at: new Date().toISOString(),
    };
    store.submissions.push(submission);

    store.notifications.unshift({
      id: `ntf-${crypto.randomUUID().slice(0, 8)}`,
      user_id: user.id,
      message: `Pengumpulan tugas "${fileName}" berhasil dicatat.`,
      read: false,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json(
      { success: true, data: { submission } },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: { message: "Data pengumpulan tidak valid." } },
      { status: 400 }
    );
  }
}
