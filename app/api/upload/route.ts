import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSupabaseAdmin, MEDIA_BUCKET } from "@/lib/supabase";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "파일을 선택하세요." }, { status: 400 });
  }

  if (!allowedTypes.has(file.type)) {
    return NextResponse.json({ error: "이미지 파일만 업로드할 수 있습니다." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const extension = path.extname(file.name) || ".png";
  const objectPath = `${Date.now()}-${crypto.randomUUID()}${extension}`;

  const supabase = getSupabaseAdmin();
  const { error: uploadError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(objectPath, bytes, {
      contentType: file.type,
      upsert: false
    });

  if (uploadError) {
    return NextResponse.json(
      { error: `업로드에 실패했습니다: ${uploadError.message}` },
      { status: 500 }
    );
  }

  const {
    data: { publicUrl }
  } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(objectPath);

  const media = await prisma.media.create({
    data: {
      url: publicUrl,
      filename: file.name,
      mimeType: file.type,
      size: bytes.length
    }
  });

  return NextResponse.json({ ...media, url: publicUrl });
}
