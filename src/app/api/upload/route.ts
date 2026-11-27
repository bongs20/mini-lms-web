import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const assignmentId = (formData.get("assignment_id") as string) || "tugas";

    if (!file) {
      return NextResponse.json(
        { success: false, error: { message: "Berkas tidak ditemukan." } },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Gunakan /tmp agar kompatibel dengan Vercel Serverless Functions
    const uploadDir = path.join("/tmp", "mini-lms-uploads", assignmentId);
    await mkdir(uploadDir, { recursive: true });

    const cleanOriginalName = file.name
      .replace(/[/\\]/g, "_")
      .replace(/\.\.+/g, ".")
      .replace(/[\x00-\x1f\x7f]/g, "");
    const safeName = `${Date.now()}-${cleanOriginalName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const filePath = path.join(uploadDir, safeName);
    await writeFile(filePath, buffer);

    return NextResponse.json({
      success: true,
      data: {
        file_name: cleanOriginalName,
        file_path: `/uploads/${assignmentId}/${safeName}`,
        size: file.size,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: {
          message:
            err instanceof Error ? err.message : "Gagal mengunggah berkas.",
        },
      },
      { status: 500 }
    );
  }
}
