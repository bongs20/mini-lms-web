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
  const userId = searchParams.get("user_id") || user.id;

  const store = getStore();
  const notifications = store.notifications.filter((n) => n.user_id === userId);

  return NextResponse.json({
    success: true,
    data: { notifications },
  });
}
