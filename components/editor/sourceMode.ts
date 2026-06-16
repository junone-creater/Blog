import { marked } from "marked";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

// 에디터의 HTML ↔ 마크다운 왕복 변환.
//
// 주의: 커스텀 노드(콜아웃 div.callout / 정렬·캡션 이미지 figure.image-figure /
// 토글 details.toggle-block)는 turndown 의 기본 규칙으로 변환하면 구조·속성이
// 평탄화되어 정보가 소실된다. 따라서 해당 노드는 원본 HTML(outerHTML)을 그대로
// 보존해 통과시킨다. marked 는 블록 레벨 raw HTML 을 그대로 출력하므로,
// markdownToHtml 로 되돌릴 때 구조가 그대로 복원되어 왕복이 보존된다.
//
// 보안(sanitize/XSS) 처리는 여기서 하지 않는다 — 배포 시 별도 처리한다.

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-"
});
turndown.use(gfm);

// 보존 대상 커스텀 노드인지 판별한다.
// 일반 figure/div/details 를 잘못 잡지 않도록 클래스·태그 기준으로 정확히 본다.
function isPreservedNode(node: HTMLElement): boolean {
  if (!node || !node.classList) return false;
  const tag = node.nodeName.toLowerCase();
  if (tag === "div" && node.classList.contains("callout")) return true;
  if (tag === "figure" && node.classList.contains("image-figure")) return true;
  if (tag === "details" && node.classList.contains("toggle-block")) return true;
  return false;
}

// 커스텀 노드는 outerHTML 을 그대로 내보낸다(앞뒤 빈 줄로 블록 HTML 로 인식되게 함).
turndown.addRule("preserveCustomNodes", {
  filter: (node) => isPreservedNode(node),
  replacement: (_content, node) => {
    const html = (node as HTMLElement).outerHTML ?? "";
    return html ? `\n\n${html}\n\n` : "";
  }
});

export function htmlToMarkdown(html: string): string {
  if (!html || typeof html !== "string") return "";
  return turndown.turndown(html);
}

export function markdownToHtml(markdown: string): string {
  if (!markdown || typeof markdown !== "string") return "";
  // breaks:true — 단일 개행을 <br> 로 변환(작성 편의). 커스텀 노드는 위에서
  // raw HTML 로 보존되므로 이 옵션의 영향(<br> 비대칭)을 받지 않는다.
  return marked.parse(markdown, { async: false, gfm: true, breaks: true });
}
