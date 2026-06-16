import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

export const postInclude = {
  category: true,
  tags: {
    include: {
      tag: true
    }
  }
} satisfies Prisma.PostInclude;

export type PostWithRelations = Prisma.PostGetPayload<{
  include: typeof postInclude;
}>;

export function getPublicPostWhere(now: Date = new Date()): Prisma.PostWhereInput {
  return {
    visibility: "PUBLIC",
    OR: [
      { status: "PUBLISHED" },
      {
        status: "SCHEDULED",
        scheduledAt: {
          lte: now
        }
      }
    ]
  };
}

export async function getPublicPosts(query?: string) {
  const now = new Date();

  return prisma.post.findMany({
    where: {
      AND: [
        getPublicPostWhere(now),
        ...(query
          ? [
              {
                OR: [
                  { title: { contains: query } },
                  { subtitle: { contains: query } },
                  { excerpt: { contains: query } }
                ]
              }
            ]
          : [])
      ]
    },
    include: postInclude,
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }]
  });
}

export async function getAllPosts(query?: string) {
  return prisma.post.findMany({
    where: query
      ? {
          OR: [
            { title: { contains: query } },
            { subtitle: { contains: query } },
            { slug: { contains: query } }
          ]
        }
      : undefined,
    include: postInclude,
    orderBy: {
      updatedAt: "desc"
    }
  });
}

export async function getPublicPostBySlug(slug: string) {
  return prisma.post.findFirst({
    where: {
      slug,
      ...getPublicPostWhere()
    },
    include: postInclude
  });
}

export async function getPostForEditor(id: string) {
  return prisma.post.findUnique({
    where: { id },
    include: postInclude
  });
}

export async function uniqueSlug(base: string, currentPostId?: string) {
  const root = slugify(base);
  let next = root;
  let counter = 2;

  while (true) {
    const existing = await prisma.post.findUnique({ where: { slug: next } });
    if (!existing || existing.id === currentPostId) {
      return next;
    }
    next = `${root}-${counter}`;
    counter += 1;
  }
}
