// 그림책(Storybook) → PPTX 내보내기.
//
// pptxgenjs 는 ~수백 KB 라 **동적 import** 로만 불러온다(three.js 와 동일 정책 —
// 메인 /[roomCode] 번들에 싣지 않는다). 슬라이드 구성:
//   - 표지 1장: 전면 일러스트(또는 단색+이모지) + 제목
//   - 본문 N장: 상단 일러스트 + 하단 텍스트(주 언어 + 한국어 보조)
//
// 이미지는 직접 fetch → dataURL 로 변환해 넣는다. 실패하면 이모지 텍스트로 폴백.

import type { Storybook, StorybookIllustration } from "@/lib/types";

// 4:3 레이아웃 (인치). 그림책 일러스트가 4:3 이라 맞춘다.
const PAGE_W = 10;
const PAGE_H = 7.5;

function pick(map: Record<string, string> | undefined, lang: string): string {
  if (!map) return "";
  return map[lang] || map.ko || map.en || Object.values(map)[0] || "";
}

// 주 언어 + (다르면) 한국어 보조. 한국어 사용자는 보조 없음.
function bilingual(
  map: Record<string, string> | undefined,
  lang: string,
): { primary: string; secondary: string | null } {
  if (!map) return { primary: "", secondary: null };
  if (lang === "ko") return { primary: map.ko || Object.values(map)[0] || "", secondary: null };
  const primary = map[lang] || "";
  const ko = map.ko || "";
  if (!primary && !ko) return { primary: Object.values(map)[0] || "", secondary: null };
  if (!primary) return { primary: ko, secondary: null };
  if (!ko || ko === primary) return { primary, secondary: null };
  return { primary, secondary: ko };
}

// CSS gradient 문자열에서 첫 hex 색을 뽑아 단색 배경으로 근사. 없으면 허니톤.
function solidFromGradient(bgGradient: string | undefined): string {
  if (bgGradient) {
    const m = bgGradient.match(/#([0-9a-fA-F]{6})/);
    if (m) return m[1].toUpperCase();
  }
  return "FEF3C7";
}

// 외부(파이어베이스 스토리지 등) 절대 URL 은 CORS 에 막히므로 서버 프록시를 경유한다.
// 같은-오리진 상대경로(/storybooks/...)와 data: URL 은 그대로 fetch.
function fetchableUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) {
    const sameOrigin = typeof window !== "undefined" && url.startsWith(window.location.origin);
    if (!sameOrigin) return `/api/img-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}

// 이미지 URL → dataURL. 실패 시 null (이모지 폴백).
async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(fetchableUrl(url));
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * 그림책을 PPTX 로 만들어 브라우저 다운로드를 트리거한다.
 * @param book 전체 Storybook (loadBook 결과)
 * @param lang 교사 화면 언어 — 주 텍스트 언어
 */
export async function exportStorybookToPptx(book: Storybook, lang: string): Promise<void> {
  const PptxGen = (await import("pptxgenjs")).default;
  const pptx = new PptxGen();
  pptx.layout = "LAYOUT_4x3";
  pptx.author = book.authorName || "AI탐험대";
  pptx.title = pick(book.title, lang);

  // ── 표지 ──
  await addCoverSlide(pptx, book, lang);

  // ── 본문 ──
  const pages = [...book.pages].sort((a, b) => a.idx - b.idx);
  for (const page of pages) {
    await addPageSlide(pptx, page.illustration, page.text, lang, `${page.idx} / ${pages.length}`);
  }

  const safeTitle = (pick(book.title, lang) || "storybook").replace(/[\\/:*?"<>|]/g, "_").slice(0, 60);
  await pptx.writeFile({ fileName: `${safeTitle}.pptx` });
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function addCoverSlide(pptx: any, book: Storybook, lang: string): Promise<void> {
  const slide = pptx.addSlide();
  const bg = solidFromGradient(book.cover.bgGradient);
  slide.background = { color: bg };

  const dataUrl = book.cover.imageUrl ? await toDataUrl(book.cover.imageUrl) : null;
  if (dataUrl) {
    // 전면 커버 이미지
    slide.addImage({ data: dataUrl, x: 0, y: 0, w: PAGE_W, h: PAGE_H, sizing: { type: "cover", w: PAGE_W, h: PAGE_H } });
  } else {
    slide.addText(book.cover.emoji || "📖", {
      x: 0, y: 1.2, w: PAGE_W, h: 3.6, align: "center", valign: "middle", fontSize: 160,
    });
  }

  // 제목 — 하단 반투명 띠 위
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: PAGE_H - 2.0, w: PAGE_W, h: 2.0,
    fill: { color: "000000", transparency: 55 }, line: { type: "none" },
  });
  slide.addText(pick(book.title, lang), {
    x: 0.5, y: PAGE_H - 1.9, w: PAGE_W - 1.0, h: 1.7, align: "center", valign: "middle",
    fontSize: 40, bold: true, color: "FFFFFF", fontFace: "Noto Sans KR",
  });
}

async function addPageSlide(
  pptx: any,
  illustration: StorybookIllustration,
  textMap: Record<string, string>,
  lang: string,
  pageLabel: string,
): Promise<void> {
  const slide = pptx.addSlide();
  slide.background = { color: "FFFFFF" };

  const illoH = 4.7;          // 상단 일러스트 영역 높이
  const bg = solidFromGradient(illustration.bgGradient);

  // 일러스트 영역 배경
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: PAGE_W, h: illoH, fill: { color: bg }, line: { type: "none" },
  });

  const dataUrl = illustration.imageUrl ? await toDataUrl(illustration.imageUrl) : null;
  if (dataUrl) {
    slide.addImage({ data: dataUrl, x: 0, y: 0, w: PAGE_W, h: illoH, sizing: { type: "cover", w: PAGE_W, h: illoH } });
  } else {
    slide.addText(illustration.emoji || "🐝", {
      x: 0, y: 0, w: PAGE_W, h: illoH, align: "center", valign: "middle", fontSize: 130,
    });
  }

  // 페이지 번호 배지
  slide.addText(pageLabel, {
    x: PAGE_W - 1.7, y: 0.2, w: 1.5, h: 0.45, align: "center", valign: "middle",
    fontSize: 12, bold: true, color: "B45309", fill: { color: "FFFBEB" },
    line: { color: "FDE68A", width: 1 }, rectRadius: 0.2,
  });

  // 텍스트 영역
  const { primary, secondary } = bilingual(textMap, lang);
  const textBlocks: any[] = [
    { text: primary, options: { fontSize: 24, bold: true, color: "1F2937", breakLine: true } },
  ];
  if (secondary) {
    textBlocks.push({ text: `🇰🇷 ${secondary}`, options: { fontSize: 18, color: "B45309", breakLine: true, paraSpaceBefore: 8 } });
  }
  slide.addText(textBlocks, {
    x: 0.6, y: illoH + 0.2, w: PAGE_W - 1.2, h: PAGE_H - illoH - 0.4,
    align: "left", valign: "top", fontFace: "Noto Sans KR", lineSpacingMultiple: 1.3,
  });
}
