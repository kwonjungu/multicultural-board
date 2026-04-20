"use client";

import { useEffect, useState } from "react";
import { beePng } from "@/lib/assets";
import type { BeeExpression } from "./BeeGuide";

type CaptionKey = "board" | "games" | "interpreter" | "praise" | "vocab" | "storybook";

interface CaptionVariant {
  title: string;
  body: string[];            // multiple lines for richer content
  tips?: string[];           // optional bullet-style tips
  expression: BeeExpression;
}

interface CaptionMeta {
  key: CaptionKey;
  student: CaptionVariant;
  teacher: CaptionVariant;
}

const CAPTIONS: Record<CaptionKey, CaptionMeta> = {
  board: {
    key: "board",
    student: {
      title: "소통창이야! 🧡",
      body: [
        "너가 한국어로 글을 쓰면 친구들 화면엔 자기 나라말로 바뀌어.",
      ],
      tips: [
        "친구 글에 좋아요 ❤️ 꾹!",
        "선생님 칭찬 스티커도 여기서 받아져~",
      ],
      expression: "cheer",
    },
    teacher: {
      title: "소통창 — 반 게시판",
      body: [
        "학생 글이 반 언어 전체로 자동 번역돼 표시됩니다.",
      ],
      tips: [
        "카드 칭찬 버튼 → 스티커 지급",
        "주제 컬럼 추가 가능",
        "부적절 문구는 ⚠️ 뱃지로 표시",
      ],
      expression: "teacher",
    },
  },
  games: {
    key: "games",
    student: {
      title: "소통의 게임 🎮",
      body: [
        "친구들이랑 같이 놀면서 말을 배워봐!",
      ],
      tips: [
        "국가 맞추기, 그림 그려 맞추기, 단어 타워…",
        "혼자도 되고, 여럿이 해도 돼~",
      ],
      expression: "celebrate",
    },
    teacher: {
      title: "게임 17종",
      body: [
        "아이스브레이킹·어휘 복습·모둠 활동용 게임을 고르세요.",
      ],
      tips: [
        "인원/난이도별 분류",
        "게임마다 사용 언어 선택 가능",
      ],
      expression: "teacher",
    },
  },
  interpreter: {
    key: "interpreter",
    student: {
      title: "실시간 통역 🎙️",
      body: [
        "마이크 누르고 말하면 바로 번역돼!",
      ],
      tips: [
        "선생님 말이 어려울 때 써봐",
        "쓴 글자도 읽어줘 🔊",
      ],
      expression: "think",
    },
    teacher: {
      title: "일대일 통역 도우미",
      body: [
        "수업 중 학생과 즉석 대화가 필요할 때 열어주세요.",
      ],
      tips: [
        "양방향 음성 + 텍스트 번역",
        "방 언어 목록 자동 반영",
      ],
      expression: "think",
    },
  },
  praise: {
    key: "praise",
    student: {
      title: "칭찬 꿀벌집 🍯",
      body: [
        "여긴 반 친구들 벌집! 칭찬 받으면 스티커가 붙어.",
      ],
      tips: [
        "꾸미기로 모자·리본 바꾸기 🎩",
        "친구 벌에도 스티커 선물 가능!",
      ],
      expression: "welcome",
    },
    teacher: {
      title: "학급 칭찬 대시보드",
      body: [
        "반 전체 학생의 칭찬 현황을 한눈에 확인하세요.",
      ],
      tips: [
        "학생 벌 클릭 → 스티커 지급",
        "학생별 누적 개수·히스토리 확인",
      ],
      expression: "teacher",
    },
  },
  vocab: {
    key: "vocab",
    student: {
      title: "단어 카드 📚",
      body: [
        "그림·소리로 새 단어를 배워봐.",
      ],
      tips: [
        "발음 듣기 🔊 + 따라 말하기 🎤",
        "받아쓰기 시험도 도전!",
      ],
      expression: "think",
    },
    teacher: {
      title: "어휘 학습 (400개)",
      body: [
        "학생 진도가 개별 추적되고, 받아쓰기 시험 출제가 가능합니다.",
      ],
      tips: [
        "난이도·주제별 필터",
        "오답 단어 자동 반복 출제",
      ],
      expression: "teacher",
    },
  },
  storybook: {
    key: "storybook",
    student: {
      title: "모둠 그림책 📖",
      body: [
        "우리 모둠이 같이 만드는 그림책이야!",
      ],
      tips: [
        "선생님이 시작하면 자동으로 열려",
        "AI가 이야기 짜는 걸 도와줘 🤖",
      ],
      expression: "celebrate",
    },
    teacher: {
      title: "협업 그림책 세션",
      body: [
        "모둠별로 이야기를 같이 만드는 활동입니다.",
      ],
      tips: [
        "세션 시작 시 학생 화면 자동 이동",
        "AI 보조 + 안전 필터 내장",
      ],
      expression: "teacher",
    },
  },
};

const STORAGE_KEY = "honey.tutorial.caption.seen.v1";

type SeenKey = string;   // `${section}:${role}`

function loadSeen(): Set<SeenKey> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as SeenKey[]);
  } catch {
    return new Set();
  }
}

function saveSeen(set: Set<SeenKey>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch { /* noop */ }
}

interface Props {
  /** Which section this caption is for. Determines content + dedup key. */
  section: CaptionKey;
  /** Teacher vs student content variant. */
  isTeacher?: boolean;
  /** How long before auto-dismiss (ms). Default 11000 (richer content). */
  autoDismissMs?: number;
  /** Optional offset from top-right corner. Default { top: 16, right: 16 }. */
  offset?: { top?: number; right?: number };
}

/**
 * A tiny first-entry hint that floats in the top-right when the user enters a
 * section for the first time. Non-blocking, auto-dismisses, and never reappears
 * for the same section once shown. For secondary tutorials — the main hub
 * uses the full TutorialHost experience.
 */
export default function SectionCaption({
  section,
  isTeacher = false,
  autoDismissMs = 11000,
  offset = {},
}: Props) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const role: "teacher" | "student" = isTeacher ? "teacher" : "student";
  const dedupKey: SeenKey = `${section}:${role}`;

  useEffect(() => {
    const seen = loadSeen();
    if (seen.has(dedupKey)) return;
    const t = window.setTimeout(() => {
      seen.add(dedupKey);
      saveSeen(seen);
      setVisible(true);
    }, 450);
    return () => window.clearTimeout(t);
  }, [dedupKey]);

  useEffect(() => {
    if (!visible) return;
    const t = window.setTimeout(() => dismiss(), autoDismissMs);
    return () => window.clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function dismiss() {
    setLeaving(true);
    window.setTimeout(() => setVisible(false), 260);
  }

  if (!visible) return null;

  const variant = CAPTIONS[section][role];

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        top: offset.top ?? 16,
        right: offset.right ?? 16,
        width: 300,
        background: "rgba(255, 251, 235, 0.97)",
        backdropFilter: "blur(6px)",
        border: "2px solid #FDE68A",
        borderRadius: 18,
        padding: "12px 36px 14px 14px",
        boxShadow: "0 12px 32px rgba(180, 83, 9, 0.24)",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        zIndex: 100,
        fontFamily: "'Noto Sans KR', sans-serif",
        transform: leaving ? "translateX(calc(100% + 40px))" : "translateX(0)",
        opacity: leaving ? 0 : 1,
        transition: "transform 260ms cubic-bezier(0.4, 0, 0.2, 1), opacity 260ms ease",
        animation: leaving ? undefined : "captionSlideIn 420ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
      }}
    >
      <img
        src={beePng(variant.expression)}
        alt=""
        width={44}
        height={44}
        aria-hidden="true"
        style={{
          flexShrink: 0,
          filter: "drop-shadow(0 3px 6px rgba(245,158,11,0.35))",
          animation: "heroBeeFloat 2.6s ease-in-out infinite",
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 900, color: "#92400E",
          letterSpacing: -0.1, marginBottom: 3,
        }}>
          {variant.title}
        </div>
        {variant.body.map((line, i) => (
          <div
            key={`b-${i}`}
            style={{
              fontSize: 12, lineHeight: 1.45, color: "#374151", fontWeight: 600,
              marginBottom: 2,
            }}
          >
            {line}
          </div>
        ))}
        {variant.tips && variant.tips.length > 0 && (
          <ul style={{
            margin: "6px 0 0", padding: 0, listStyle: "none",
            borderTop: "1px dashed #FDE68A", paddingTop: 5,
          }}>
            {variant.tips.map((tip, i) => (
              <li
                key={`t-${i}`}
                style={{
                  fontSize: 11, lineHeight: 1.4, color: "#92400E", fontWeight: 700,
                  display: "flex", alignItems: "flex-start", gap: 4,
                  marginBottom: 1,
                }}
              >
                <span style={{ flexShrink: 0 }}>•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button
        onClick={dismiss}
        aria-label="닫기"
        style={{
          position: "absolute",
          top: 6, right: 6,
          width: 22, height: 22,
          border: "none",
          background: "transparent",
          color: "#92400E",
          fontSize: 14, fontWeight: 900,
          cursor: "pointer",
          borderRadius: 6,
          lineHeight: 1,
        }}
      >
        ✕
      </button>

      {/* progress line — gives a subtle sense of auto-dismiss */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 10, right: 10, bottom: 4,
          height: 2, borderRadius: 2,
          background: "#FDE68A",
          overflow: "hidden",
        }}
      >
        <div style={{
          width: "100%", height: "100%",
          background: "#F59E0B",
          animation: `captionProgress ${autoDismissMs}ms linear both`,
          transformOrigin: "left center",
        }} />
      </div>
    </div>
  );
}
