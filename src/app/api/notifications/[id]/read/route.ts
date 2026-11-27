import { NextResponse } from "next/server";
import { getAuthUser, getStore } from "@/lib/store";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: { message: "Tidak terautentikasi." } },
      { status: 401 }
    );
  }

  const { id } = await context.params;
  const store = getStore();
  const notification = store.notifications.find((n) => n.id === id);

  if (!notification) {
    return NextResponse.json(
      { success: false, error: { message: "Notifikasi tidak ditemukan." } },
      { status: 404 }
    );
  }

  notification.read = true;

  return NextResponse.json({
    success: true,
    data: { notification },
  });
}
