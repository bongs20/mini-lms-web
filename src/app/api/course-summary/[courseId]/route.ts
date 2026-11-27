import { NextResponse } from "next/server";
import { getAuthUser, getStore } from "@/lib/store";

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

  const { courseId } = await context.params;
  const store = getStore();
  const course = store.courses.find((c) => c.id === courseId);

  if (!course) {
    return NextResponse.json(
      { success: false, error: { message: "Mata kuliah tidak ditemukan." } },
      { status: 404 }
    );
  }

  const assignments = store.assignments.filter((a) => a.course_id === courseId);
  return NextResponse.json({
    success: true,
    data: { course, assignments },
  });
}
