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

  const assignments = store.assignments
    .filter((a) => a.course_id === courseId)
    .map((a) => ({
      ...a,
      submissions: store.submissions.filter(
        (s) =>
          s.assignment_id === a.id &&
          (user.role === "dosen" || user.role === "admin" || s.user_id === user.id)
      ),
    }));
  return NextResponse.json({
    success: true,
    data: { course, assignments },
  });
}
