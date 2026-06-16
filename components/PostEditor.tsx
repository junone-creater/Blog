"use client";

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  CheckSquare,
  Code,
  Info,
  Eye,
  FileCode,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  Save,
  Send,
  Strikethrough,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Table,
  Trash2,
  Underline as UnderlineIcon,
  Undo2,
  Youtube as YoutubeIcon
} from "lucide-react";
import { useEditor, EditorContent, BubbleMenu, type Editor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import TableExtension from "@tiptap/extension-table";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import { TableRowResizable, TableRowResizing } from "@/components/tableRowResize";
import Youtube from "@tiptap/extension-youtube";
import CharacterCount from "@tiptap/extension-character-count";
import Superscript from "@tiptap/extension-superscript";
import Subscript from "@tiptap/extension-subscript";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Button } from "@/components/Button";
import { SlashCommand } from "@/components/SlashCommand";
import { AlignedResizableImage } from "@/components/editor/AlignedResizableImage";
import { CodeBlockHighlight } from "@/components/editor/CodeBlockHighlight";
import { Callout } from "@/components/editor/Callout";
import { ToggleBlock } from "@/components/editor/ToggleBlock";
import { checklistExtensions } from "@/components/editor/checklist";
import TagInput from "@/components/editor/TagInput";
import CategorySelect from "@/components/editor/CategorySelect";
import CharCountField from "@/components/editor/CharCountField";
import { Field, Panel, Select } from "@/components/editor/EditorFields";
import { htmlToMarkdown, markdownToHtml } from "@/components/editor/sourceMode";
import { buildExcerpt } from "@/lib/excerpt";
import { PostWithRelations } from "@/lib/posts";
import { slugify } from "@/lib/slug";
import { PostStatus, Visibility } from "@/lib/validation";

const emptyContent = {
  type: "doc",
  content: [
    {
      type: "paragraph"
    }
  ]
};

// 기존 TextStyle 마크에 fontSize 속성을 추가 (Color 확장과 같은 textStyle 마크를 공유)
const FontSizeTextStyle = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: (element) => element.style.fontSize || null,
        renderHTML: (attributes) => (attributes.fontSize ? { style: `font-size: ${attributes.fontSize}` } : {})
      }
    };
  }
});

const fontSizePresets = [14, 16, 18, 20, 24, 28, 32, 40];

const tableButtonClass = "rounded border border-[#d7cec0] bg-white px-2 py-1 transition hover:bg-[#f4f0e9]";

type EditorPost = PostWithRelations | null;

type FormState = {
  title: string;
  subtitle: string;
  slug: string;
  excerpt: string;
  coverImageUrl: string;
  status: PostStatus;
  visibility: Visibility;
  categoryName: string;
  tagNames: string[];
  seoTitle: string;
  seoDescription: string;
  scheduledAt: string;
};

function toLocalInput(value?: Date | string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function readStats(editor: Editor) {
  const chars = editor.storage.characterCount?.characters?.() ?? 0;
  // 한국어 기준 분당 약 500자
  const readMin = chars === 0 ? 0 : Math.max(1, Math.round(chars / 500));
  return { chars, readMin };
}

export function PostEditor({ post }: { post?: EditorPost }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  // 슬래시 메뉴에서 호출할 최신 핸들러를 담아두는 ref (확장은 한 번만 생성되므로 stale 방지)
  const slashRef = useRef({ onImage: () => {}, onYoutube: () => {} });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState(false);
  const [htmlMode, setHtmlMode] = useState(false);
  const [htmlDraft, setHtmlDraft] = useState("");
  const [markdownMode, setMarkdownMode] = useState(false);
  const [mdDraft, setMdDraft] = useState("");
  const [stats, setStats] = useState({ chars: 0, readMin: 0 });
  const [fontSizeInput, setFontSizeInput] = useState("");
  const [sizeFocused, setSizeFocused] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);
  const [form, setForm] = useState<FormState>({
    title: post?.title ?? "",
    subtitle: post?.subtitle ?? "",
    slug: post?.slug ?? "",
    excerpt: post?.excerpt ?? "",
    coverImageUrl: post?.coverImageUrl ?? "",
    status: (post?.status as PostStatus | undefined) ?? "DRAFT",
    visibility: (post?.visibility as Visibility | undefined) ?? "PUBLIC",
    categoryName: post?.category?.name ?? "",
    tagNames: post?.tags.map(({ tag }) => tag.name) ?? [],
    seoTitle: post?.seoTitle ?? "",
    seoDescription: post?.seoDescription ?? "",
    scheduledAt: toLocalInput(post?.scheduledAt)
  });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        },
        // 문법 강조 코드블록(CodeBlockHighlight)으로 대체
        codeBlock: false
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true
      }),
      AlignedResizableImage,
      CodeBlockHighlight,
      Callout,
      ...ToggleBlock,
      ...checklistExtensions,
      Placeholder.configure({
        placeholder: "본문을 작성하세요..."
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"]
      }),
      FontSizeTextStyle,
      Color,
      Superscript,
      Subscript,
      Highlight.configure({
        multicolor: true
      }),
      TableExtension.configure({
        resizable: true
      }),
      TableRowResizable,
      TableHeader,
      TableCell,
      TableRowResizing,
      Youtube.configure({
        controls: true,
        nocookie: true
      }),
      CharacterCount,
      SlashCommand.configure({
        onImage: () => slashRef.current.onImage(),
        onYoutube: () => slashRef.current.onYoutube()
      })
    ],
    content: post?.contentJson ? JSON.parse(post.contentJson) : emptyContent,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      setStats(readStats(editor));
    },
    editorProps: {
      attributes: {
        class: "prose-blog max-w-none"
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        const files = Array.from(event.dataTransfer?.files ?? []).filter((file) => file.type.startsWith("image/"));
        if (files.length === 0) return false;
        event.preventDefault();
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? view.state.selection.from;
        void uploadAndInsert(files, pos);
        return true;
      },
      handlePaste: (view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith("image/"));
        if (files.length === 0) return false;
        event.preventDefault();
        void uploadAndInsert(files, view.state.selection.from);
        return true;
      }
    }
  });

  // 최신 editor 인스턴스를 핸들러에서 참조하기 위한 ref (드롭/붙여넣기 핸들러는 생성 시점에 고정됨)
  const editorRef = useRef<Editor | null>(null);
  editorRef.current = editor;

  const autoSaveKey = useMemo(() => `blog-editor-autosave-${post?.id ?? "new"}`, [post?.id]);

  // 최신 form 값을 인터벌에서 읽되, 인터벌 자체는 재생성하지 않도록 ref로 보관
  const formRef = useRef(form);
  formRef.current = form;
  const restoredRef = useRef(false);

  // 첫 로드 시 저장하지 않은 자동 저장본이 있으면 복구 여부를 묻는다
  useEffect(() => {
    if (!editor || restoredRef.current) return;
    restoredRef.current = true;

    const raw = localStorage.getItem(autoSaveKey);
    if (!raw) return;

    try {
      const saved = JSON.parse(raw) as {
        form?: FormState;
        contentJson?: JSONContent;
        savedAt?: string;
      };

      // 마지막 서버 저장 이후 변경분이 아니면(=이미 반영된 자동 저장본) 무시
      if (post?.updatedAt && saved.savedAt && new Date(saved.savedAt) <= new Date(post.updatedAt)) {
        localStorage.removeItem(autoSaveKey);
        return;
      }

      if (!saved.form || !saved.contentJson) return;

      const savedLabel = saved.savedAt ? new Date(saved.savedAt).toLocaleString("ko-KR") : "이전";
      if (!window.confirm(`저장하지 않은 자동 저장본이 있습니다 (${savedLabel}). 복구할까요?`)) {
        localStorage.removeItem(autoSaveKey);
        return;
      }

      // 과거 버전은 tagNames를 콤마 문자열로 저장했으므로 배열로 정규화 (복구 시 .map 크래시 방지)
      const restoredForm: FormState = {
        ...saved.form,
        tagNames: Array.isArray(saved.form.tagNames)
          ? saved.form.tagNames
          : String(saved.form.tagNames ?? "")
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean)
      };
      setForm(restoredForm);
      editor.commands.setContent(saved.contentJson);
      setMessage("자동 저장본을 복구했습니다.");
    } catch {
      localStorage.removeItem(autoSaveKey);
    }
  }, [editor, autoSaveKey, post?.updatedAt]);

  // 에디터 준비/내용 로드 시 글자 수·읽기 시간 초기화
  useEffect(() => {
    if (editor) setStats(readStats(editor));
  }, [editor]);

  // 15초마다 localStorage에 자동 저장 — 인터벌은 editor/key당 한 번만 생성
  useEffect(() => {
    if (!editor) return;

    const timer = window.setInterval(() => {
      localStorage.setItem(
        autoSaveKey,
        JSON.stringify({
          form: formRef.current,
          contentJson: editor.getJSON(),
          savedAt: new Date().toISOString()
        })
      );
      setMessage("자동 저장됨");
    }, 15_000);

    return () => window.clearInterval(timer);
  }, [autoSaveKey, editor]);

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({
      ...current,
      [key]: value
    }));
  }

  async function uploadImage(file: File) {
    const body = new FormData();
    body.append("file", file);
    const response = await fetch("/api/upload", {
      method: "POST",
      body
    });

    if (!response.ok) {
      throw new Error("이미지 업로드 실패");
    }

    const data = (await response.json()) as { url: string };
    return data.url;
  }

  async function uploadAndInsert(files: File[], at?: number) {
    const editor = editorRef.current;
    if (!editor || files.length === 0) return;
    setSaving(true);
    try {
      if (typeof at === "number") {
        editor.chain().focus().setTextSelection(at).run();
      }
      for (const file of files) {
        const url = await uploadImage(file);
        editor.chain().focus().setImage({ src: url }).run();
        if (!formRef.current.coverImageUrl) {
          updateForm("coverImageUrl", url);
        }
      }
      setMessage(files.length > 1 ? `이미지 ${files.length}장을 삽입했습니다.` : "이미지를 삽입했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "이미지 업로드 실패");
    } finally {
      setSaving(false);
    }
  }

  async function onImagePicked(file?: File) {
    if (!file) return;
    await uploadAndInsert([file]);
  }

  function addYoutube() {
    if (!editor) return;
    const url = window.prompt("유튜브 URL을 입력하세요");
    if (!url || url.trim() === "") return;
    editor.chain().focus().setYoutubeVideo({ src: url.trim() }).run();
  }

  // 슬래시 메뉴가 호출할 최신 핸들러를 매 렌더마다 갱신
  slashRef.current = {
    onImage: () => fileRef.current?.click(),
    onYoutube: addYoutube
  };

  // 선택된 이미지의 캡션을 수정 (빈 문자열이면 캡션 제거)
  function setImageCaption(caption: string) {
    if (!editor) return;
    editor.chain().focus().updateAttributes("image", { caption }).run();
  }

  // 현재 커서 위치의 글자 크기(px 숫자만)
  function currentFontSize() {
    const value = editor?.getAttributes("textStyle").fontSize as string | undefined;
    return value ? value.replace("px", "") : "";
  }

  function applyFontSize(raw: string) {
    if (!editor) return;
    const trimmed = raw.trim();
    if (trimmed === "") {
      editor.chain().focus().setMark("textStyle", { fontSize: null }).run();
      return;
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isNaN(parsed) || parsed <= 0) return;
    const clamped = Math.min(Math.max(parsed, 8), 120);
    editor.chain().focus().setMark("textStyle", { fontSize: `${clamped}px` }).run();
  }

  // 현재 활성화된 소스 편집 모드(HTML/마크다운)의 내용을 에디터에 반영하고 모드를 닫는다
  function commitDrafts() {
    if (!editor) return;
    if (htmlMode) {
      editor.commands.setContent(htmlDraft, true);
      setHtmlMode(false);
    }
    if (markdownMode) {
      editor.commands.setContent(markdownToHtml(mdDraft), true);
      setMarkdownMode(false);
    }
  }

  function toggleHtmlMode() {
    if (!editor) return;
    if (htmlMode) {
      commitDrafts();
      return;
    }
    commitDrafts();
    setHtmlDraft(editor.getHTML());
    setPreview(false);
    setHtmlMode(true);
  }

  function toggleMarkdownMode() {
    if (!editor) return;
    if (markdownMode) {
      commitDrafts();
      return;
    }
    commitDrafts();
    setMdDraft(htmlToMarkdown(editor.getHTML()));
    setPreview(false);
    setMarkdownMode(true);
  }

  function togglePreview() {
    commitDrafts();
    setPreview((value) => !value);
  }

  async function savePost(nextStatus?: PostStatus) {
    if (!editor) return;
    // 소스 편집 모드(HTML/마크다운)에서 작업 중이면 먼저 에디터에 반영
    commitDrafts();
    setSaving(true);
    setMessage("");

    const status = nextStatus ?? form.status;
    const payload = {
      ...form,
      status,
      slug: form.slug || slugify(form.title),
      contentJson: editor.getJSON(),
      contentHtml: editor.getHTML(),
      tagNames: form.tagNames.map((tag) => tag.trim()).filter(Boolean)
    };

    const response = await fetch(post ? `/api/posts/${post.id}` : "/api/posts", {
      method: post ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setSaving(false);
      setMessage(data?.error ?? "저장에 실패했습니다.");
      return;
    }

    const data = (await response.json()) as { id: string };
    localStorage.removeItem(autoSaveKey);
    setSaving(false);
    setMessage("저장했습니다.");
    router.push(`/admin/edit/${data.id}`);
    router.refresh();
  }

  async function deletePost() {
    if (!post || !confirm("이 글을 삭제할까요?")) return;
    setSaving(true);
    await fetch(`/api/posts/${post.id}`, {
      method: "DELETE"
    });
    router.push("/admin");
    router.refresh();
  }

  function addLink() {
    if (!editor) return;
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("링크 URL", previous ?? "https://");
    if (url === null) return;
    if (url.trim() === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  function alignContent(textAlign: "left" | "center" | "right") {
    if (!editor) return;

    if (editor.isActive("image")) {
      editor.chain().focus().updateAttributes("image", { textAlign }).run();
      return;
    }

    editor.chain().focus().setTextAlign(textAlign).run();
  }

  function isAlignActive(textAlign: "left" | "center" | "right") {
    if (!editor) return false;

    if (editor.isActive("image")) {
      return editor.getAttributes("image").textAlign === textAlign;
    }

    return editor.isActive({ textAlign });
  }

  function buttonClass(active?: boolean) {
    return clsx(
      "inline-flex h-9 w-9 items-center justify-center rounded-md border text-[#374151] transition",
      active ? "border-moss bg-[#e7efe5] text-moss" : "border-[#d7cec0] bg-white hover:bg-[#f4f0e9]"
    );
  }

  function bubbleBtnClass(active?: boolean) {
    return clsx(
      "inline-flex h-7 min-w-7 items-center justify-center gap-0.5 rounded px-1.5 text-sm text-white/90 transition hover:bg-white/15",
      active && "bg-white/20 text-white"
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void savePost();
  }

  return (
    <form onSubmit={submit} className="min-h-screen bg-paper">
      <div className="sticky top-0 z-20 border-b border-[#e1d7c8] bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-rust">{post ? "Edit post" : "New post"}</p>
            <p className="text-sm font-semibold text-[#53606d]">{message || "변경사항을 저장하거나 발행하세요."}</p>
            <p className="mt-0.5 text-xs text-[#7d7469]">글자 수 {stats.chars.toLocaleString()} · 읽는 시간 약 {stats.readMin}분</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={togglePreview}>
              <Eye className="h-4 w-4" />
              미리보기
            </Button>
            <Button type="button" variant={htmlMode ? "primary" : "secondary"} onClick={toggleHtmlMode}>
              <FileCode className="h-4 w-4" />
              {htmlMode ? "HTML 적용" : "HTML"}
            </Button>
            <Button type="button" variant={markdownMode ? "primary" : "secondary"} onClick={toggleMarkdownMode}>
              <FileCode className="h-4 w-4" />
              {markdownMode ? "MD 적용" : "마크다운"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => void savePost("DRAFT")} disabled={saving}>
              <Save className="h-4 w-4" />
              저장
            </Button>
            <Button type="button" variant="secondary" onClick={() => void savePost("SCHEDULED")} disabled={saving}>
              <CalendarClock className="h-4 w-4" />
              예약
            </Button>
            <Button type="button" variant="primary" onClick={() => void savePost("PUBLISHED")} disabled={saving}>
              <Send className="h-4 w-4" />
              발행
            </Button>
          </div>
        </div>
      </div>

      <main className="mx-auto grid max-w-7xl gap-6 px-5 py-6 lg:grid-cols-[1fr_340px]">
        <section className="min-w-0">
          <div className="space-y-4 rounded-md border border-[#e1d7c8] bg-white p-5 shadow-soft">
            <input
              value={form.title}
              onChange={(event) => {
                updateForm("title", event.target.value);
                if (!post && !form.slug) updateForm("slug", slugify(event.target.value));
              }}
              placeholder="제목"
              className="w-full bg-transparent text-4xl font-black leading-tight outline-none placeholder:text-[#b7aea1]"
            />
            <input
              value={form.subtitle}
              onChange={(event) => updateForm("subtitle", event.target.value)}
              placeholder="부제목"
              className="w-full bg-transparent text-xl text-[#53606d] outline-none placeholder:text-[#b7aea1]"
            />
          </div>

          <div className="mt-4 rounded-md border border-[#e1d7c8] bg-white shadow-soft">
            <div className="flex flex-wrap gap-2 border-b border-[#e8e0d5] bg-[#f4f0e9] p-3">
              <button title="문단" type="button" className={buttonClass(editor?.isActive("paragraph"))} onClick={() => editor?.chain().focus().setParagraph().run()}>
                <Pilcrow className="h-4 w-4" />
              </button>
              <button title="H1" type="button" className={buttonClass(editor?.isActive("heading", { level: 1 }))} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}>
                <Heading1 className="h-4 w-4" />
              </button>
              <button title="H2" type="button" className={buttonClass(editor?.isActive("heading", { level: 2 }))} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
                <Heading2 className="h-4 w-4" />
              </button>
              <button title="H3" type="button" className={buttonClass(editor?.isActive("heading", { level: 3 }))} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}>
                <Heading3 className="h-4 w-4" />
              </button>
              <button title="굵게" type="button" className={buttonClass(editor?.isActive("bold"))} onClick={() => editor?.chain().focus().toggleBold().run()}>
                <Bold className="h-4 w-4" />
              </button>
              <button title="기울임" type="button" className={buttonClass(editor?.isActive("italic"))} onClick={() => editor?.chain().focus().toggleItalic().run()}>
                <Italic className="h-4 w-4" />
              </button>
              <button title="밑줄" type="button" className={buttonClass(editor?.isActive("underline"))} onClick={() => editor?.chain().focus().toggleUnderline().run()}>
                <UnderlineIcon className="h-4 w-4" />
              </button>
              <button title="취소선" type="button" className={buttonClass(editor?.isActive("strike"))} onClick={() => editor?.chain().focus().toggleStrike().run()}>
                <Strikethrough className="h-4 w-4" />
              </button>
              <button title="위 첨자" type="button" className={buttonClass(editor?.isActive("superscript"))} onClick={() => editor?.chain().focus().toggleSuperscript().run()}>
                <SuperscriptIcon className="h-4 w-4" />
              </button>
              <button title="아래 첨자" type="button" className={buttonClass(editor?.isActive("subscript"))} onClick={() => editor?.chain().focus().toggleSubscript().run()}>
                <SubscriptIcon className="h-4 w-4" />
              </button>
              <div className="relative flex items-center" title="글자 크기 (px) — 직접 입력 또는 목록에서 선택">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="px"
                  value={sizeFocused ? fontSizeInput : currentFontSize()}
                  onFocus={() => {
                    setSizeFocused(true);
                    setFontSizeInput(currentFontSize());
                  }}
                  onChange={(event) => setFontSizeInput(event.target.value.replace(/[^0-9]/g, ""))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      applyFontSize(fontSizeInput);
                      setSizeOpen(false);
                    }
                  }}
                  onBlur={() => {
                    applyFontSize(fontSizeInput);
                    setSizeFocused(false);
                    setSizeOpen(false);
                  }}
                  className="h-9 w-12 rounded-l-md border border-r-0 border-[#d7cec0] bg-white px-2 text-xs font-bold text-[#53606d] outline-none focus:border-moss"
                />
                <button
                  type="button"
                  title="크기 목록"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setSizeOpen((value) => !value)}
                  className="inline-flex h-9 w-6 items-center justify-center rounded-r-md border border-[#d7cec0] bg-white text-[#53606d] hover:bg-[#f4f0e9]"
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
                {sizeOpen && (
                  <div className="absolute left-0 top-10 z-30 w-16 overflow-hidden rounded-md border border-[#d7cec0] bg-white shadow-soft">
                    {fontSizePresets.map((size) => (
                      <button
                        key={size}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          applyFontSize(String(size));
                          setSizeOpen(false);
                        }}
                        className="block w-full px-3 py-1.5 text-left text-xs font-bold text-[#53606d] hover:bg-[#f4f0e9]"
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button title="목록" type="button" className={buttonClass(editor?.isActive("bulletList"))} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
                <List className="h-4 w-4" />
              </button>
              <button title="번호 목록" type="button" className={buttonClass(editor?.isActive("orderedList"))} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
                <ListOrdered className="h-4 w-4" />
              </button>
              <button title="인용문" type="button" className={buttonClass(editor?.isActive("blockquote"))} onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
                <Quote className="h-4 w-4" />
              </button>
              <button title="코드 블록" type="button" className={buttonClass(editor?.isActive("codeBlock"))} onClick={() => editor?.chain().focus().toggleCodeBlock().run()}>
                <Code className="h-4 w-4" />
              </button>
              <button title="체크리스트" type="button" className={buttonClass(editor?.isActive("taskList"))} onClick={() => editor?.chain().focus().toggleTaskList().run()}>
                <CheckSquare className="h-4 w-4" />
              </button>
              <button title="콜아웃" type="button" className={buttonClass(editor?.isActive("callout"))} onClick={() => editor?.chain().focus().toggleCallout({ variant: "info" }).run()}>
                <Info className="h-4 w-4" />
              </button>
              <button title="토글(접기)" type="button" className={buttonClass(editor?.isActive("toggleBlock"))} onClick={() => editor?.chain().focus().setToggle().run()}>
                <ChevronRight className="h-4 w-4" />
              </button>
              <button title="구분선" type="button" className={buttonClass()} onClick={() => editor?.chain().focus().setHorizontalRule().run()}>
                <Minus className="h-4 w-4" />
              </button>
              <button title="링크" type="button" className={buttonClass(editor?.isActive("link"))} onClick={addLink}>
                <LinkIcon className="h-4 w-4" />
              </button>
              <button title="이미지" type="button" className={buttonClass()} onClick={() => fileRef.current?.click()}>
                <ImagePlus className="h-4 w-4" />
              </button>
              <button title="표" type="button" className={buttonClass()} onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
                <Table className="h-4 w-4" />
              </button>
              <button title="유튜브" type="button" className={buttonClass()} onClick={addYoutube}>
                <YoutubeIcon className="h-4 w-4" />
              </button>
              <button title="왼쪽 정렬" type="button" className={buttonClass(isAlignActive("left"))} onClick={() => alignContent("left")}>
                <AlignLeft className="h-4 w-4" />
              </button>
              <button title="가운데 정렬" type="button" className={buttonClass(isAlignActive("center"))} onClick={() => alignContent("center")}>
                <AlignCenter className="h-4 w-4" />
              </button>
              <button title="오른쪽 정렬" type="button" className={buttonClass(isAlignActive("right"))} onClick={() => alignContent("right")}>
                <AlignRight className="h-4 w-4" />
              </button>
              <label title="글자색" className="inline-flex h-9 items-center gap-2 rounded-md border border-[#d7cec0] bg-white px-2 text-xs font-bold text-[#53606d]">
                A
                <input type="color" className="h-5 w-6 border-0 bg-transparent p-0" onChange={(event) => editor?.chain().focus().setColor(event.target.value).run()} />
              </label>
              <label title="배경색" className="inline-flex h-9 items-center gap-2 rounded-md border border-[#d7cec0] bg-white px-2 text-xs font-bold text-[#53606d]">
                BG
                <input type="color" className="h-5 w-6 border-0 bg-transparent p-0" onChange={(event) => editor?.chain().focus().toggleHighlight({ color: event.target.value }).run()} />
              </label>
              <button title="실행취소" type="button" className={buttonClass()} onClick={() => editor?.chain().focus().undo().run()}>
                <Undo2 className="h-4 w-4" />
              </button>
              <button title="다시실행" type="button" className={buttonClass()} onClick={() => editor?.chain().focus().redo().run()}>
                <Redo2 className="h-4 w-4" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(event) => void onImagePicked(event.target.files?.[0])} />
            </div>
            {editor?.isActive("table") && !preview && !htmlMode && !markdownMode && (
              <div className="flex flex-wrap items-center gap-1.5 border-b border-[#e8e0d5] bg-[#faf7f1] px-3 py-2 text-xs font-bold text-[#53606d]">
                <span className="mr-1 text-[#7d7469]">표</span>
                <button type="button" className={tableButtonClass} onClick={() => editor?.chain().focus().addRowBefore().run()}>행 위 추가</button>
                <button type="button" className={tableButtonClass} onClick={() => editor?.chain().focus().addRowAfter().run()}>행 아래 추가</button>
                <button type="button" className={tableButtonClass} onClick={() => editor?.chain().focus().addColumnBefore().run()}>열 왼쪽 추가</button>
                <button type="button" className={tableButtonClass} onClick={() => editor?.chain().focus().addColumnAfter().run()}>열 오른쪽 추가</button>
                <span className="mx-1 h-4 w-px bg-[#e1d7c8]" />
                <button type="button" className={tableButtonClass} onClick={() => editor?.chain().focus().deleteRow().run()}>행 삭제</button>
                <button type="button" className={tableButtonClass} onClick={() => editor?.chain().focus().deleteColumn().run()}>열 삭제</button>
                <span className="mx-1 h-4 w-px bg-[#e1d7c8]" />
                <button type="button" className={tableButtonClass} onClick={() => editor?.chain().focus().toggleHeaderRow().run()}>헤더 행</button>
                <button type="button" className={tableButtonClass} onClick={() => editor?.chain().focus().mergeOrSplit().run()}>셀 병합/분할</button>
                <span className="mx-1 h-4 w-px bg-[#e1d7c8]" />
                <button type="button" className={`${tableButtonClass} text-rust hover:bg-[#f6e7e2]`} onClick={() => editor?.chain().focus().deleteTable().run()}>표 삭제</button>
              </div>
            )}
            {editor?.isActive("callout") && !preview && !htmlMode && !markdownMode && (
              <div className="flex flex-wrap items-center gap-1.5 border-b border-[#e8e0d5] bg-[#faf7f1] px-3 py-2 text-xs font-bold text-[#53606d]">
                <span className="mr-1 text-[#7d7469]">콜아웃</span>
                {([
                  ["info", "정보"],
                  ["warn", "주의"],
                  ["success", "성공"],
                  ["danger", "경고"]
                ] as const).map(([variant, label]) => (
                  <button
                    key={variant}
                    type="button"
                    className={clsx(
                      tableButtonClass,
                      editor?.getAttributes("callout").variant === variant && "border-moss bg-[#e7efe5] text-moss"
                    )}
                    onClick={() => editor?.chain().focus().updateAttributes("callout", { variant }).run()}
                  >
                    {label}
                  </button>
                ))}
                <span className="mx-1 h-4 w-px bg-[#e1d7c8]" />
                <button type="button" className={`${tableButtonClass} text-rust hover:bg-[#f6e7e2]`} onClick={() => editor?.chain().focus().toggleCallout().run()}>해제</button>
              </div>
            )}
            <div className="p-5">
              {preview && (
                <div className="prose-blog min-h-[520px]" dangerouslySetInnerHTML={{ __html: editor?.getHTML() ?? "" }} />
              )}
              {htmlMode && (
                <textarea
                  value={htmlDraft}
                  onChange={(event) => setHtmlDraft(event.target.value)}
                  spellCheck={false}
                  className="min-h-[520px] w-full resize-y rounded-md border border-[#d7cec0] bg-[#1e1e1e] p-4 font-mono text-[13px] leading-6 text-[#e6e6e6] outline-none"
                />
              )}
              {markdownMode && (
                <textarea
                  value={mdDraft}
                  onChange={(event) => setMdDraft(event.target.value)}
                  spellCheck={false}
                  className="min-h-[520px] w-full resize-y rounded-md border border-[#d7cec0] bg-[#1e1e1e] p-4 font-mono text-[13px] leading-6 text-[#e6e6e6] outline-none"
                />
              )}
              {/* EditorContent는 언마운트하지 않고 항상 마운트한 채 CSS로만 숨긴다 — ProseMirror가 직접 조작한 DOM을 React가 제거하려다 나는 removeChild 에러 방지 */}
              <div className={clsx((preview || htmlMode || markdownMode) && "hidden")}>
                  <EditorContent editor={editor} />
                  {editor && (
                    <BubbleMenu
                      editor={editor}
                      pluginKey="textBubble"
                      className="bubble-menu"
                      shouldShow={({ editor, state }) => {
                        const { from, to } = state.selection;
                        return (
                          from !== to &&
                          !editor.isActive("image") &&
                          !editor.isActive("codeBlock") &&
                          !preview &&
                          !htmlMode &&
                          !markdownMode
                        );
                      }}
                    >
                      <button type="button" title="굵게" className={bubbleBtnClass(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()}>
                        <Bold className="h-4 w-4" />
                      </button>
                      <button type="button" title="기울임" className={bubbleBtnClass(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()}>
                        <Italic className="h-4 w-4" />
                      </button>
                      <button type="button" title="밑줄" className={bubbleBtnClass(editor.isActive("underline"))} onClick={() => editor.chain().focus().toggleUnderline().run()}>
                        <UnderlineIcon className="h-4 w-4" />
                      </button>
                      <button type="button" title="취소선" className={bubbleBtnClass(editor.isActive("strike"))} onClick={() => editor.chain().focus().toggleStrike().run()}>
                        <Strikethrough className="h-4 w-4" />
                      </button>
                      <span className="bubble-divider" />
                      <button type="button" title="링크" className={bubbleBtnClass(editor.isActive("link"))} onClick={addLink}>
                        <LinkIcon className="h-4 w-4" />
                      </button>
                      <label title="글자색" className={bubbleBtnClass(false)}>
                        A
                        <input type="color" className="ml-0.5 h-4 w-4 cursor-pointer border-0 bg-transparent p-0" onChange={(event) => editor.chain().focus().setColor(event.target.value).run()} />
                      </label>
                      <label title="형광펜" className={bubbleBtnClass(editor.isActive("highlight"))}>
                        <span className="font-black">H</span>
                        <input type="color" className="ml-0.5 h-4 w-4 cursor-pointer border-0 bg-transparent p-0" onChange={(event) => editor.chain().focus().toggleHighlight({ color: event.target.value }).run()} />
                      </label>
                    </BubbleMenu>
                  )}
                  {editor && (
                    <BubbleMenu
                      editor={editor}
                      pluginKey="imageBubble"
                      className="bubble-menu bubble-image"
                      shouldShow={({ editor }) => editor.isActive("image") && !preview && !htmlMode && !markdownMode}
                    >
                      <button type="button" title="왼쪽 정렬" className={bubbleBtnClass(isAlignActive("left"))} onClick={() => alignContent("left")}>
                        <AlignLeft className="h-4 w-4" />
                      </button>
                      <button type="button" title="가운데 정렬" className={bubbleBtnClass(isAlignActive("center"))} onClick={() => alignContent("center")}>
                        <AlignCenter className="h-4 w-4" />
                      </button>
                      <button type="button" title="오른쪽 정렬" className={bubbleBtnClass(isAlignActive("right"))} onClick={() => alignContent("right")}>
                        <AlignRight className="h-4 w-4" />
                      </button>
                      <span className="bubble-divider" />
                      <input
                        type="text"
                        placeholder="캡션(보이는 설명)"
                        value={(editor.getAttributes("image").caption as string) ?? ""}
                        onChange={(event) => setImageCaption(event.target.value)}
                        className="h-7 w-36 rounded border border-[#d7cec0] bg-white px-2 text-xs text-ink outline-none focus:border-moss"
                      />
                      <input
                        type="text"
                        placeholder="alt(대체 텍스트)"
                        value={(editor.getAttributes("image").alt as string) ?? ""}
                        onChange={(event) => editor.chain().focus().updateAttributes("image", { alt: event.target.value }).run()}
                        className="h-7 w-36 rounded border border-[#d7cec0] bg-white px-2 text-xs text-ink outline-none focus:border-moss"
                      />
                      <span className="bubble-divider" />
                      {(["50%", "75%", "100%"] as const).map((w) => (
                        <button
                          key={w}
                          type="button"
                          title={`너비 ${w}`}
                          className={bubbleBtnClass(editor.getAttributes("image").width === w)}
                          onClick={() => editor.chain().focus().updateAttributes("image", { width: w }).run()}
                        >
                          {w}
                        </button>
                      ))}
                      <button
                        type="button"
                        title="원본 크기"
                        className={bubbleBtnClass(!editor.getAttributes("image").width)}
                        onClick={() => editor.chain().focus().updateAttributes("image", { width: null }).run()}
                      >
                        원본
                      </button>
                    </BubbleMenu>
                  )}
              </div>
            </div>
          </div>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Panel title="글 설정">
            <Select label="상태" value={form.status} onChange={(value) => updateForm("status", value as PostStatus)} options={["DRAFT", "PUBLISHED", "SCHEDULED"]} />
            <Select label="공개 여부" value={form.visibility} onChange={(value) => updateForm("visibility", value as Visibility)} options={["PUBLIC", "PRIVATE"]} />
            <Field label="URL slug" value={form.slug} onChange={(value) => updateForm("slug", slugify(value))} />
            <CategorySelect value={form.categoryName} onChange={(value) => updateForm("categoryName", value)} />
            <TagInput
              value={form.tagNames}
              onChange={(tags) => updateForm("tagNames", tags)}
            />
            <Field label="예약 발행일" type="datetime-local" value={form.scheduledAt} onChange={(value) => updateForm("scheduledAt", value)} />
          </Panel>

          <Panel title="대표 이미지">
            {form.coverImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.coverImageUrl} alt="" className="aspect-[16/10] w-full rounded-md object-cover" />
            )}
            <Field label="이미지 URL" value={form.coverImageUrl} onChange={(value) => updateForm("coverImageUrl", value)} />
            <Button type="button" variant="secondary" className="w-full" onClick={() => fileRef.current?.click()}>
              <ImagePlus className="h-4 w-4" />
              업로드
            </Button>
          </Panel>

          <Panel title="SEO">
            <CharCountField label="SEO 제목" value={form.seoTitle} onChange={(value) => updateForm("seoTitle", value)} max={60} placeholder="검색 결과 제목 (권장 60자)" />
            <CharCountField label="SEO 설명" value={form.seoDescription} onChange={(value) => updateForm("seoDescription", value)} max={155} multiline placeholder="검색 결과 설명 (권장 155자)" />
            <div className="space-y-1.5">
              <CharCountField label="요약" value={form.excerpt} onChange={(value) => updateForm("excerpt", value)} max={160} multiline placeholder="목록·공유 카드에 노출될 요약" />
              <Button type="button" variant="secondary" className="w-full" onClick={() => updateForm("excerpt", buildExcerpt(editor?.getText() ?? ""))}>
                본문에서 요약 자동 생성
              </Button>
            </div>
          </Panel>

          {post && (
            <Button type="button" variant="danger" className="w-full" onClick={() => void deletePost()} disabled={saving}>
              <Trash2 className="h-4 w-4" />
              삭제
            </Button>
          )}
        </aside>
      </main>
    </form>
  );
}
