"use client";

import { createPortal } from "react-dom";
import { VocabWord } from "@/lib/vocabWords";

interface Props {
  words: VocabWord[];
  onClose: () => void;
  studentName?: string;
}

const PURPLE = "#8B5CF6";
const PURPLE_DARK = "#6D28D9";
const GUIDE_GRAY = "#D1D5DB";

// 손글씨 연습 칸 개수 (트레이싱 가이드 1개 + 빈칸 N개)
const PRACTICE_CELLS = 5;

/**
 * 단어 쓰기 연습 학습지 — 인쇄 친화 오버레이.
 * 각 단어를 연한 회색 트레이싱 가이드 1회 + 빈 손글씨 칸 여러 개로 제시한다.
 * 예문은 출력하지 않고 KEY WORD(`word.ko`) 에만 집중한다.
 */
export default function VocabWriteSheet({ words, onClose, studentName }: Props) {
  const handlePrint = () => window.print();

  // portal 로 body 직속 렌더 — 앱 화면(숨겨져도 높이를 차지) 뒤에 빈 페이지가
  // 딸려 인쇄되는 문제를 원천 차단. print CSS 의 body > * 선택자와 한 쌍.
  return createPortal(
    <div
      className="vws-overlay"
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
      {/* 인쇄 전용 CSS — 화면 헤더/버튼/앱 크롬을 숨기고 학습지만 출력 */}
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm; }
          html, body { background: #fff !important; height: auto !important; overflow: visible !important; }
          /* 오버레이는 portal 로 body 직속 — 나머지 앱 화면은 통째로 제거해
             앞뒤 빈 페이지 없이 학습지만 출력된다. */
          body > *:not(.vws-overlay) { display: none !important; }
          .vws-overlay {
            position: static !important;
            inset: auto !important;
            background: #fff !important;
            overflow: visible !important;
          }
          .no-print { display: none !important; }
          .vws-sheet {
            box-shadow: none !important;
            margin: 0 !important;
            max-width: none !important;
            width: 100% !important;
            border-radius: 0 !important;
          }
          .vws-row {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .vws-trace, .vws-cell {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* 화면 헤더 (인쇄 시 숨김) */}
      <div
        className="no-print"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 2,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 16px",
          background: "linear-gradient(135deg, " + PURPLE + ", " + PURPLE_DARK + ")",
          boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
        }}
      >
        <div style={{ flex: 1, minWidth: 0, color: "#fff" }}>
          <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: -0.3 }}>
            📄 단어 쓰기 학습지
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.92, marginTop: 2 }}>
            단어 {words.length}개 · 인쇄해서 손으로 따라 써 보세요
          </div>
        </div>
        <button
          onClick={handlePrint}
          style={{
            background: "#fff",
            color: PURPLE_DARK,
            border: "none",
            borderRadius: 12,
            padding: "10px 16px",
            fontSize: 14,
            fontWeight: 900,
            cursor: "pointer",
            fontFamily: "inherit",
            boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
          }}
        >🖨 인쇄하기</button>
        <button
          onClick={onClose}
          aria-label="닫기"
          style={{
            background: "rgba(255,255,255,0.22)",
            color: "#fff",
            border: "none",
            borderRadius: 12,
            padding: "10px 14px",
            fontSize: 14,
            fontWeight: 900,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >✕ 닫기</button>
      </div>

      {/* 인쇄되는 학습지 */}
      <div
        className="vws-sheet"
        style={{
          maxWidth: 800,
          margin: "20px auto 40px",
          background: "#fff",
          color: "#111827",
          borderRadius: 12,
          boxShadow: "0 14px 40px rgba(0,0,0,0.3)",
          padding: "32px 36px 40px",
        }}
      >
        {/* 학습지 제목 + 이름/날짜 */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 16,
            borderBottom: "3px solid #111827",
            paddingBottom: 12,
            marginBottom: 24,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.5 }}>
            단어 쓰기 연습
          </div>
          <div style={{ display: "flex", gap: 20, fontSize: 14, fontWeight: 700 }}>
            <div>
              이름:&nbsp;
              <span
                style={{
                  display: "inline-block",
                  minWidth: 110,
                  borderBottom: "1.5px solid #111827",
                  textAlign: "center",
                }}
              >{studentName ?? ""}</span>
            </div>
            <div>
              날짜:&nbsp;
              <span
                style={{
                  display: "inline-block",
                  minWidth: 110,
                  borderBottom: "1.5px solid #111827",
                }}
              />
            </div>
          </div>
        </div>

        {/* 단어 행 */}
        {words.map((word, idx) => (
          <div
            key={word.id}
            className="vws-row"
            style={{
              marginBottom: 26,
              paddingBottom: 22,
              borderBottom: idx === words.length - 1 ? "none" : "1px dashed #D1D5DB",
            }}
          >
            {/* 번호 + 안내 */}
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: "#6B7280",
                marginBottom: 8,
              }}
            >
              {idx + 1}. 따라 쓰고, 빈칸에 다시 써 보세요
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                alignItems: "stretch",
              }}
            >
              {/* 트레이싱 가이드 — 연한 회색으로 1회 */}
              <div
                className="vws-trace"
                style={{
                  flexShrink: 0,
                  minWidth: 150,
                  height: 84,
                  border: "2px solid " + GUIDE_GRAY,
                  borderRadius: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 14px",
                  background: "#FAFAFA",
                }}
              >
                <span
                  style={{
                    fontSize: 40,
                    fontWeight: 800,
                    color: GUIDE_GRAY,
                    letterSpacing: 1,
                    whiteSpace: "nowrap",
                  }}
                >{word.ko}</span>
              </div>

              {/* 빈 손글씨 연습 칸 */}
              {Array.from({ length: PRACTICE_CELLS }).map((_, i) => (
                <div
                  key={i}
                  className="vws-cell"
                  style={{
                    flex: "1 1 110px",
                    minWidth: 96,
                    height: 84,
                    border: "1.5px solid #9CA3AF",
                    borderRadius: 10,
                    background: "#fff",
                  }}
                />
              ))}
            </div>
          </div>
        ))}

        {/* 푸터 (인쇄 포함) */}
        <div
          style={{
            marginTop: 8,
            textAlign: "center",
            fontSize: 11,
            fontWeight: 700,
            color: "#9CA3AF",
          }}
        >
          🐝 또박또박 천천히 써 보아요
        </div>
      </div>
    </div>,
    document.body,
  );
}
