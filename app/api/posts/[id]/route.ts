import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildCategoryUpsertArgs, buildPostScalarData, buildPostTags } from "@/lib/post-write";
import { postInclude, uniqueSlug } from "@/lib/posts";
import { postInputSchema } from "@/lib/validation";

export async function GET(
  _request: NextRequest,
  {
    params
  }: {
    params: Promise<{ id: string }>;
  }
) {
  const { id } = await params;
  const post = await prisma.post.findUnique({
    where: { id },
    include: postInclude
  });

  if (!post) {
    return NextResponse.json({ error: "글을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json(post);
}

export async function PUT(
  request: NextRequest,
  {
    params
  }: {
    params: Promise<{ id: string }>;
  }
) {
  const { id } = await params;
  const parsed = postInputSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "입력값을 확인하세요." }, { status: 400 });
  }

  const existing = await prisma.post.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "글을 찾을 수 없습니다." }, { status: 404 });
  }

  const input = parsed.data;
  const slug = await uniqueSlug(input.slug || input.title, id);
  const categoryId = input.categoryName
    ? (await prisma.category.upsert(buildCategoryUpsertArgs(input.categoryName))).id
    : null;
  const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
  const publishedAt =
    input.status === "PUBLISHED" ? existing.publishedAt ?? new Date() : input.status === "SCHEDULED" ? null : existing.publishedAt;

  const post = await prisma.$transaction(async (tx) => {
    await tx.postTag.deleteMany({
      where: {
        postId: id
      }
    });

    return tx.post.update({
      where: { id },
      data: {
        ...buildPostScalarData(input, { slug, scheduledAt, publishedAt }),
        categoryId,
        tags: buildPostTags(input.tagNames)
      },
      include: postInclude
    });
  });

  return NextResponse.json(post);
}

export async function DELETE(
  _request: NextRequest,
  {
    params
  }: {
    params: Promise<{ id: string }>;
  }
) {
  const { id } = await params;
  await prisma.post.delete({
    where: { id }
  });

  return NextResponse.json({ ok: true });
}
