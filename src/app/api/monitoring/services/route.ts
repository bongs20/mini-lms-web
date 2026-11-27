import { NextResponse } from "next/server";
import { getAuthUser, getServiceHealthList } from "@/lib/store";

export async function GET(request: Request) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: { message: "Tidak terautentikasi." } },
      { status: 401 }
    );
  }

  return NextResponse.json({
    success: true,
    data: { services: getServiceHealthList() },
  });
}
