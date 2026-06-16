"use client";

// 정렬·캡션·드래그 리사이즈·alt 를 모두 지원하는 이미지 확장.
// 기존 PostEditor 의 인라인 AlignedImage 를 대체한다.
//
// 핵심 제약: 저장되는 renderHTML 출력 구조는 기존과 동일해야 한다.
//   figure.image-figure[data-align][style] > img[data-align][data-caption]( + figcaption.image-caption)
// 읽기 페이지(Lightbox)가 이 구조에 의존하므로 바꾸지 않는다.
// 너비(width)만 새 속성으로 추가하며, figure 가 너비를 갖고 img 는 항상 100% 로 채운다
// (px·% 어느 쪽이든 한 곳에서만 너비를 정해 이중 적용 버그를 막는다).

import Image from "@tiptap/extension-image";
import { mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { useRef, useState } from "react";

// 정렬값에 따른 figure margin (기존 규칙 유지)
function marginFor(align: string) {
  return align === "center" ? "1rem auto" : align === "right" ? "1rem 0 1rem auto" : "1rem auto 1rem 0";
}

// 편집 화면 전용 NodeView: 이미지 + 드래그 핸들 + 드래그 중 크기 배지 + 캡션 미리보기
function ImageView({ node, updateAttributes, selected }: NodeViewProps) {
  const { src, alt, caption, textAlign, width } = node.attrs as {
    src: string;
    alt: string | null;
    caption: string;
    textAlign: string;
    width: string | null;
  };
  const align = textAlign === "center" || textAlign === "right" ? textAlign : "left";
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dragLabel, setDragLabel] = useState<string | null>(null);

  function onResizeStart(event: React.PointerEvent) {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const img = wrapperRef.current?.querySelector("img");
    const startWidth = img?.getBoundingClientRect().width ?? 0;
    // 컨테이너(본문 폭) 기준 최대값
    const containerWidth =
      wrapperRef.current?.parentElement?.getBoundingClientRect().width ?? startWidth;
    // 오른쪽 정렬이면 핸들을 왼쪽 아래에 두므로 드래그 방향을 반대로 해석
    const dir = align === "right" ? -1 : 1;

    function onMove(moveEvent: PointerEvent) {
      const delta = (moveEvent.clientX - startX) * dir;
      const next = Math.max(80, Math.min(startWidth + delta, containerWidth));
      const px = `${Math.round(next)}px`;
      setDragLabel(`${Math.round((next / containerWidth) * 100)}% · ${px}`);
      updateAttributes({ width: px });
    }

    function onUp() {
      setDragLabel(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <NodeViewWrapper
      ref={wrapperRef}
      className={`image-node${selected ? " is-selected" : ""}`}
      style={{ display: "table", position: "relative", margin: marginFor(align), width: width ?? undefined, maxWidth: "100%" }}
      data-align={align}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt ?? ""}
        draggable={false}
        // 너비 지정 시에만 100%로 채우고, 원본일 땐 auto로 본래 크기를 유지한다
        style={{ width: width ? "100%" : "auto", maxWidth: "100%", display: "block" }}
      />
      {dragLabel && <span className="image-size-badge">{dragLabel}</span>}
      {/* 정렬에 따라 핸들 위치를 바꿔 잘림을 줄인다 */}
      <span
        className={`image-resize-handle ${align === "right" ? "is-left" : "is-right"}`}
        onPointerDown={onResizeStart}
        contentEditable={false}
        aria-hidden="true"
      />
      {caption ? <figcaption className="image-caption">{caption}</figcaption> : null}
    </NodeViewWrapper>
  );
}

export const AlignedResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      textAlign: {
        default: "left",
        parseHTML: (element) =>
          element.getAttribute("data-align") || element.closest("figure")?.getAttribute("data-align") || "left",
        renderHTML: () => ({})
      },
      caption: {
        default: "",
        parseHTML: (element) =>
          element.getAttribute("data-caption") ||
          element.closest("figure")?.querySelector("figcaption")?.textContent ||
          "",
        renderHTML: () => ({})
      },
      width: {
        default: null,
        // figure 또는 img 의 width 속성/스타일에서 복원 (px 또는 %)
        parseHTML: (element) => {
          const figure = element.closest("figure");
          const figureWidth = figure?.style?.width;
          if (figureWidth) return figureWidth;
          const attr = element.getAttribute("width");
          if (attr) return /^\d+$/.test(attr) ? `${attr}px` : attr;
          const styleWidth = (element as HTMLElement).style?.width;
          // img 의 width:100% 는 figure 폭을 채우는 값이므로 실제 너비로 보지 않는다
          return styleWidth && styleWidth !== "100%" ? styleWidth : null;
        },
        renderHTML: () => ({})
      }
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },

  renderHTML({ HTMLAttributes, node }) {
    const align = node.attrs.textAlign === "center" || node.attrs.textAlign === "right" ? node.attrs.textAlign : "left";
    const caption = (node.attrs.caption as string) ?? "";
    const width = (node.attrs.width as string | null) ?? null;
    const margin = marginFor(align);

    const imgAttrs = { ...HTMLAttributes };
    delete imgAttrs.textAlign;
    delete imgAttrs.caption;
    delete imgAttrs.width;

    // 너비는 figure 가 갖고, 지정 시에만 img 가 figure 를 100% 채운다 (px·% 모두 일관).
    // 원본(width 없음)이면 img 는 본래 크기를 유지해 figure 가 그에 맞춰진다.
    const imgStyle = width ? "width:100%;max-width:100%;display:block;" : "max-width:100%;display:block;";
    const img = [
      "img",
      mergeAttributes(imgAttrs, {
        "data-align": align,
        "data-caption": caption,
        style: imgStyle
      })
    ];
    const figureWidth = width ? `width:${width};` : "";
    const figureAttrs = {
      "data-align": align,
      class: "image-figure",
      style: `display:table;margin:${margin};max-width:100%;${figureWidth}`
    };

    if (!caption) {
      return ["figure", figureAttrs, img];
    }
    return ["figure", figureAttrs, img, ["figcaption", { class: "image-caption" }, caption]];
  }
});
