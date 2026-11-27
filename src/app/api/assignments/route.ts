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

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("course_id");

  const store = getStore();
  const assignments = courseId
    ? store.assignments.filter((a) => a.course_id === courseId)
    : store.assignments;

  return NextResponse.json({
    success: true,
    data: { assignments },
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
        error: { message: "Hanya dosen atau admin yang dapat membuat tugas." },
      },
      { status: 403 }
    );
  }

  try {
    const body = (await request.json()) as {
      course_id?: string;
      title?: string;
      description?: string;
      due_date?: string;
    };
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

    const store = getStore();
    const assignment = {
      id: `asg-${crypto.randomUUID().slice(0, 8)}`,
      course_id: courseId,
      title,
      description: body.description?.trim() || "",
      due_date: body.due_date || undefined,
    };
    store.assignments.push(assignment);

    return NextResponse.json(
      { success: true, data: { assignment } },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: { message: "Data tugas tidak valid." } },
      { status: 400 }
    );
  }
}
