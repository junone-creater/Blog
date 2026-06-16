import { Prisma } from "@prisma/client";
import { slugify } from "@/lib/slug";
import { postInputSchema } from "@/lib/validation";
import type { z } from "zod";

type PostInput = z.infer<typeof postInputSchema>;

type PostScalarData = Pick<
  Prisma.PostCreateInput,
  | "title"
  | "subtitle"
  | "slug"
  | "contentJson"
  | "contentHtml"
  | "excerpt"
  | "coverImageUrl"
  | "status"
  | "visibility"
  | "seoTitle"
  | "seoDescription"
  | "scheduledAt"
  | "publishedAt"
>;

type PostScalarOptions = {
  slug: string;
  scheduledAt: Date | null;
  publishedAt: Date | null;
};

export function buildPostScalarData(input: PostInput, options: PostScalarOptions): PostScalarData {
  return {
    title: input.title,
    subtitle: input.subtitle || null,
    slug: options.slug,
    contentJson: JSON.stringify(input.contentJson),
    contentHtml: input.contentHtml,
    excerpt: input.excerpt || null,
    coverImageUrl: input.coverImageUrl || null,
    status: input.status,
    visibility: input.visibility,
    seoTitle: input.seoTitle || null,
    seoDescription: input.seoDescription || null,
    scheduledAt: options.scheduledAt,
    publishedAt: options.publishedAt
  };
}

function categoryConnectOrCreate(categoryName: string) {
  const slug = slugify(categoryName);

  return {
    where: { slug },
    create: {
      name: categoryName,
      slug
    }
  };
}

export function buildPostCategory(categoryName: string | null | undefined): Prisma.PostCreateInput["category"] {
  return categoryName
    ? {
        connectOrCreate: categoryConnectOrCreate(categoryName)
      }
    : undefined;
}

export function buildCategoryUpsertArgs(
  categoryName: string
): Pick<Prisma.CategoryUpsertArgs, "where" | "update" | "create"> {
  const connectOrCreate = categoryConnectOrCreate(categoryName);

  return {
    where: connectOrCreate.where,
    update: { name: categoryName },
    create: connectOrCreate.create
  };
}

export function buildPostTags(tagNames: string[]): Prisma.PostCreateInput["tags"] {
  return {
    create: tagNames.map((name) => {
      const slug = slugify(name);

      return {
        tag: {
          connectOrCreate: {
            where: { slug },
            create: {
              name,
              slug
            }
          }
        }
      };
    })
  };
}
