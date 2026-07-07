"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import {
  DICTATION_CHAPTERS,
  DICTATION_CHEERS,
  DICTATION_ERROR_NOTE_CHEER,
  type DictationChapter,
} from "@/lib/dictationSheets";

const PURPLE = "#8B5CF6";
const PURPLE_DARK = "#6D28D9";
const TRACE_GRAY = "#C4C4C4";

interface Props {
  onClose: () => void;
}

/**
 * 받아쓰기/글씨 연습 학습지 (교사 전용) — 테마별 15챕터 + 오답노트.
 * 원본 docx 레이아웃 재현: 표(번호|단어|따라 쓰기 4칸), 13/12개 페이지 분할.
 *
 * 인쇄: @media print 에서 오버레이를 absolute 로 문서 최상단에 붙인다 —
 * static 으로 풀면 숨겨진(공간은 차지하는) 앱 콘텐츠 뒤로 밀려 빈 페이지가
 * 앞에 붙는 문제가 있었음 (VocabWriteSheet 와 동일 수정).
 */
export default function DictationSheetModal({ onClose }: Props) {
  // null = 선택 화면, "note" = 오답노트, 숫자 = 챕터
  const [selected, setSelected] = useState<DictationChapter | "note" | null>(null);

  // portal 로 body 직속 렌더 — 숨겨진 앱 화면의 높이 때문에 학습지 앞뒤로
  // 빈 페이지가 인쇄되는 문제를 원천 차단 (VocabWriteSheet 와 동일 패턴).
  return createPortal(
    <div
      className="dict-overlay"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1400,
        background: "rgba(15,10,40,0.55)",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        fontFamily: "'Pretendard Variable', 'Pretendard', 'Noto Sans KR', sans-serif",
      }}
    >
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          html, body { background: #fff !important; height: auto !important; overflow: visible !important; }
          /* 오버레이는 portal 로 body 직속 — 나머지 앱 화면은 통째로 제거해
             앞뒤 빈 페이지 없이 학습지만 출력된다. */
          body > *:not(.dict-overlay) { display: none !important; }
          .dict-overlay {
            position: static !important;
            inset: auto !important;
            background: #fff !important;
            overflow: visible !important;
          }
          .no-print { display: none !important; }
          .dict-sheet {
            box-shadow: none !important;
            margin: 0 !important;
            max-width: none !important;
            width: 100% !important;
            border-radius: 0 !important;
            padding: 0 !important;
          }
          .dict-page { page-break-after: always; }
          .dict-page:last-child { page-break-after: auto; }
          .dict-row, .dict-table { break-inside: avoid; page-break-inside: avoid; }
          .dict-trace {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* 화면 헤더 (인쇄 시 숨김) */}
      <div
        className="no-print"
        style={{
          position: "sticky", top: 0, zIndex: 2,
          display: "flex", alignItems: "center", gap: 10,
          padding: "12px 16px",
          background: `linear-gradient(135deg, ${PURPLE}, ${PURPLE_DARK})`,
          boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
        }}
      >
        {selected !== null && (
          <button
            onClick={() => setSelected(null)}
            aria-label="테마 목록으로"
            style={{
              background: "rgba(255,255,255,0.22)", color: "#fff", border: "none",
              borderRadius: 12, padding: "10px 14px", fontSize: 14, fontWeight: 900,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >← 목록</button>
        )}
        <div style={{ flex: 1, minWidth: 0, color: "#fff" }}>
          <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: -0.3 }}>
            ✏️ 받아쓰기 학습지
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.92, marginTop: 2 }}>
            {selected === null
              ? `테마 ${DICTATION_CHAPTERS.length}개 + 오답노트 · 교사 전용 인쇄 자료`
              : selected === "note"
                ? "받아쓰기 오답노트 · 틀린 단어 다시 쓰기"
                : `챕터 ${selected.id} · ${selected.theme} · 단어 25개`}
          </div>
        </div>
        {selected !== null && (
          <button
            onClick={() => window.print()}
            style={{
              background: "#fff", color: PURPLE_DARK, border: "none",
              borderRadius: 12, padding: "10px 16px", fontSize: 14, fontWeight: 900,
              cursor: "pointer", fontFamily: "inherit",
              boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
            }}
          >🖨 인쇄하기</button>
        )}
        <button
          onClick={onClose}
          aria-label="닫기"
          style={{
            background: "rgba(255,255,255,0.22)", color: "#fff", border: "none",
            borderRadius: 12, padding: "10px 14px", fontSize: 14, fontWeight: 900,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >✕ 닫기</button>
      </div>

      {selected === null ? (
        /* ── 테마 선택 화면 ── */
        <div className="no-print" style={{ maxWidth: 800, margin: "20px auto 40px", padding: "0 16px" }}>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10,
          }}>
            {DICTATION_CHAPTERS.map((ch) => (
              <button
                key={ch.id}
                onClick={() => setSelected(ch)}
                style={{
                  background: "#fff", border: `2px solid ${PURPLE}33`, borderRadius: 16,
                  padding: "14px 16px", cursor: "pointer", textAlign: "left",
                  fontFamily: "inherit", display: "flex", alignItems: "center", gap: 12,
                  boxShadow: "0 4px 12px rgba(109,40,217,0.10)",
                }}
              >
                <span style={{ fontSize: 28, flexShrink: 0 }}>{ch.emoji}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 12, fontWeight: 800, color: PURPLE_DARK }}>
                    챕터 {ch.id}
                  </span>
                  <span style={{ display: "block", fontSize: 15, fontWeight: 900, color: "#1F2937" }}>
                    {ch.theme}
                  </span>
                </span>
              </button>
            ))}
            <button
              onClick={() => setSelected("note")}
              style={{
                background: "#FFF7ED", border: "2px solid #FDBA7466", borderRadius: 16,
                padding: "14px 16px", cursor: "pointer", textAlign: "left",
                fontFamily: "inherit", display: "flex", alignItems: "center", gap: 12,
                boxShadow: "0 4px 12px rgba(194,65,12,0.10)",
              }}
            >
              <span style={{ fontSize: 28, flexShrink: 0 }}>📝</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#C2410C" }}>
                  복습용
                </span>
                <span style={{ display: "block", fontSize: 15, fontWeight: 900, color: "#1F2937" }}>
                  오답노트 (빈칸)
                </span>
              </span>
            </button>
          </div>
        </div>
      ) : (
        /* ── 인쇄되는 학습지 ── */
        <div
          className="dict-sheet"
          style={{
            maxWidth: 800, margin: "20px auto 40px",
            background: "#fff", color: "#111827", borderRadius: 12,
            boxShadow: "0 14px 40px rgba(0,0,0,0.3)",
            padding: "28px 32px 36px",
          }}
        >
          {selected === "note" ? (
            <ErrorNotePage />
          ) : (
            <>
              <ChapterPage chapter={selected} from={0} to={13} first />
              <ChapterPage chapter={selected} from={13} to={25} />
            </>
          )}
        </div>
      )}
    </div>,
    document.body,
  );
}

/** 표 헤더 + 단어 행 — docx 표 구성(번호|단어|1~4번째 따라 쓰기) 재현 */
function SheetTable({ rows, blank }: {
  rows: Array<{ no: number; word: string }>;
  /** true = 오답노트(단어 칸도 빈칸) */
  blank?: boolean;
}) {
  const cellBase: React.CSSProperties = {
    border: "1.5px solid #374151",
    padding: 0,
    height: 46,
    textAlign: "center",
    verticalAlign: "middle",
  };
  return (
    <table className="dict-table" style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
      <thead>
        <tr>
          <th style={{ ...cellBase, width: "8%", height: 34, fontSize: 12, fontWeight: 900, background: "#F3F4F6" }}>번호</th>
          <th style={{ ...cellBase, width: "18%", height: 34, fontSize: 12, fontWeight: 900, background: "#F3F4F6" }}>
            {blank ? "연습할 단어" : "단어"}
          </th>
          {[1, 2, 3, 4].map((n) => (
            <th key={n} style={{ ...cellBase, height: 34, fontSize: 12, fontWeight: 900, background: "#F3F4F6" }}>
              {n}번째<br />{blank ? "바르게 쓰기" : "따라 쓰기"}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.no} className="dict-row">
            <td style={{ ...cellBase, fontSize: 14, fontWeight: 800 }}>{r.no}</td>
            <td style={{ ...cellBase, fontSize: 20, fontWeight: 900, letterSpacing: 2 }}>
              {blank ? "" : r.word}
            </td>
            {/* 1번째 칸 — 회색 트레이싱 가이드 (오답노트는 전부 빈칸) */}
            <td className="dict-trace" style={{ ...cellBase, fontSize: 20, fontWeight: 800, color: TRACE_GRAY, letterSpacing: 2 }}>
              {blank ? "" : r.word}
            </td>
            <td style={cellBase} />
            <td style={cellBase} />
            <td style={cellBase} />
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SheetTitle({ subtitle, nameLine }: { subtitle: string; nameLine: string }) {
  return (
    <>
      <div style={{ fontSize: 12, fontWeight: 800, color: "#6B7280", letterSpacing: 0.5 }}>
        1학년 국어 ㆍ 받아쓰기 / 글씨 연습
      </div>
      <div style={{
        fontSize: 22, fontWeight: 900, letterSpacing: -0.4, margin: "4px 0 2px",
        borderBottom: "3px solid #111827", paddingBottom: 8,
      }}>
        {subtitle}
      </div>
      <div style={{
        display: "flex", justifyContent: "flex-end", fontSize: 13, fontWeight: 700,
        margin: "10px 0 6px",
      }}>
        {nameLine}
      </div>
    </>
  );
}

function ChapterPage({ chapter, from, to, first }: {
  chapter: DictationChapter; from: number; to: number; first?: boolean;
}) {
  const rows = chapter.words.slice(from, to).map((word, i) => ({ no: from + i + 1, word }));
  const cheer = DICTATION_CHEERS[(chapter.id - 1) % DICTATION_CHEERS.length];
  return (
    <div className="dict-page" style={{ marginBottom: first ? 28 : 0 }}>
      {first ? (
        <>
          <SheetTitle
            subtitle={`[학습지] 받침이 있는 단어 따라 쓰기 — 챕터 ${chapter.id} ㆍ ${chapter.theme}`}
            nameLine="1학년  (        )반  (        )번    이름 : ________________"
          />
          <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", margin: "0 0 10px" }}>
            🖍 회색 글자를 따라 쓰고, 빈칸에 세 번 더 바르고 예쁘게 써 보세요.
          </div>
        </>
      ) : (
        <div style={{ fontSize: 13, fontWeight: 800, color: "#374151", margin: "0 0 10px" }}>
          [학습지] 받침이 있는 단어 따라 쓰기 ㆍ 챕터 {chapter.id} ㆍ {chapter.theme} ㆍ {from + 1}번 ~ {to}번
        </div>
      )}
      <SheetTable rows={rows} />
      {first ? (
        <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", marginTop: 8 }}>
          ✏ 다음 장에 계속! ({to + 1}번 ~ {chapter.words.length}번)
        </div>
      ) : (
        <div style={{ textAlign: "center", fontSize: 12, fontWeight: 800, color: "#92400E", marginTop: 12 }}>
          🌟 {cheer} 🌟
        </div>
      )}
    </div>
  );
}

function ErrorNotePage() {
  const rows = Array.from({ length: 12 }, (_, i) => ({ no: i + 1, word: "" }));
  return (
    <div className="dict-page">
      <SheetTitle
        subtitle="[학습지] 받아쓰기 오답노트 — 틀린 단어 다시 쓰기 연습"
        nameLine="날짜 : (      )월 (      )일    1학년 (      )반 (      )번    이름 : ______________"
      />
      <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", margin: "0 0 10px" }}>
        🖍 받아쓰기에서 틀린 단어를 &lsquo;연습할 단어&rsquo; 칸에 바르게 쓰고, 옆 칸에 네 번 더 연습해 보세요.
      </div>
      <SheetTable rows={rows} blank />
      <div style={{ textAlign: "center", fontSize: 12, fontWeight: 800, color: "#92400E", marginTop: 12 }}>
        🌟 {DICTATION_ERROR_NOTE_CHEER} 🌟
      </div>
    </div>
  );
}
