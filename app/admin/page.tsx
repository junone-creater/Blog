import Link from "next/link";
import { FilePenLine, Plus, Search } from "lucide-react";
import { buttonClassName } from "@/components/Button";
import { SearchBox } from "@/components/SearchBox";
import { Shell } from "@/components/Shell";
import { getAllPosts } from "@/lib/posts";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit"
});

export default async function AdminPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const posts = await getAllPosts(q);

  return (
    <Shell>
      <main className="mx-auto max-w-7xl px-5 py-8">
        <div className="flex flex-col gap-4 border-b border-[#e5ded2] pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-rust">Admin dashboard</p>
            <h1 className="mt-2 text-3xl font-black text-ink">글 관리</h1>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <SearchBox placeholder="관리 글 검색" />
            <Link href="/admin/write" className={buttonClassName("primary", "w-full sm:w-auto")}>
              <Plus className="h-4 w-4" />
              새 글
            </Link>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-md border border-[#e1d7c8] bg-white shadow-soft">
          <div className="grid grid-cols-[1fr_150px_130px_170px_80px] gap-4 border-b border-[#e8e0d5] bg-[#f4f0e9] px-4 py-3 text-xs font-black uppercase tracking-wide text-[#6b6258]">
            <span>제목</span>
            <span>상태</span>
            <span>공개 여부</span>
            <span>수정일</span>
            <span>관리</span>
          </div>
          {posts.length > 0 ? (
            posts.map((post) => (
              <div key={post.id} className="grid grid-cols-[1fr_150px_130px_170px_80px] gap-4 border-b border-[#eee7dc] px-4 py-4 text-sm last:border-b-0">
                <div className="min-w-0">
                  <p className="truncate font-bold text-ink">{post.title}</p>
                  <p className="mt-1 truncate text-xs text-[#7d7469]">/{post.slug}</p>
                </div>
                <span className="font-semibold text-[#53606d]">{post.status}</span>
                <span className="font-semibold text-[#53606d]">{post.visibility}</span>
                <span className="text-[#53606d]">{dateFormatter.format(post.updatedAt)}</span>
                <Link href={`/admin/edit/${post.id}`} className="inline-flex items-center gap-1 font-bold text-moss hover:text-rust">
                  <FilePenLine className="h-4 w-4" />
                  수정
                </Link>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center text-[#53606d]">
              <Search className="h-8 w-8" />
              <p>글이 없습니다.</p>
            </div>
          )}
        </div>
      </main>
    </Shell>
  );
}
