"use client";
import { useState } from "react";
import { EXPRESS_EMOTIONS, EMOTION_MOOD, type EmotionId } from "@/lib/emotions";
import MoodArt from "./ui/child/MoodArt";

interface Props {
  lang: string;
  onPick: (emotionId: EmotionId, intensity: 1 | 2 | 3) => void | Promise<void>;
  // true 면 강도 선택을 생략(원탭) — 그림책 응답 탭처럼 빠른 입력에 사용.
  quick?: boolean;
  busy?: boolean;
}

/**
 * 감정 카드 20장.
 *
 * 예전에는 카드마다 자기 색(`hue`)으로 배경을 칠하고 이모지를 얹었다. 열두 장이
 * 노랑·파랑·빨강·분홍·보라·초록으로 제각각이라 화면이 알록달록해지고, 정작
 * 무엇을 고르는지보다 색이 먼저 눈에 들어왔다(사용자 지적: "레이아웃 개선하고
 * 깔끔하게").
 *
 * 바꾼 규칙:
 *  - 면은 전부 같은 표면 토큰. 감정별 색은 **왼쪽 가는 띠 하나**로만 남긴다.
 *  - 이모지 대신 **꿀벌 감정 그림**(lib/beeMoods)을 쓴다. 소통창 공감·동화책
 *    반응이 이미 같은 꿀벌을 쓰므로 아이가 같은 얼굴을 여러 화면에서 만난다.
 *  - 열 수는 폭이 정한다(auto-fit). 3열 고정이면 좁은 화면에서 글자가 찌그러진다.
 *
 * 라벨은 그대로 15개 언어를 쓴다 — 꿀벌 무드 목록은 한국어·영어만 있어서,
 * 여기서 무드로 갈아타면 다국어 라벨을 잃는다. 그림만 빌려 온다.
 *
 * 2026-09: 12장 → 20장. 꿀벌 그림 20종에 감정을 1:1로 다 붙인 결과다.
 * 늘어난 것은 개수뿐이고 색·면·그림 규칙은 위 그대로다. 개수 때문에 바꾼 것은
 * 격자 최소 트랙 하나(104 → 96px)뿐 — 아래 주석 참고.
 */
export default function EmotionCardDeck({ lang, onPick, quick = false, busy = false }: Props) {
  const [pending, setPending] = useState<EmotionId | null>(null);

  async function handlePick(id: EmotionId, intensity: 1 | 2 | 3) {
    setPending(id);
    try {
      await onPick(id, intensity);
    } finally {
      setPending(null);
    }
  }

  return (
    <div>
      <div
        style={{
          display: "grid",
          // 104 → 96. 카드가 12장에서 20장으로 늘면서 390px 폭이 2열 10줄(974px)이
          // 돼 덱 하나가 화면보다 길어졌다. 96 이면 390px 가 3열(680px), 820px 가
          // 7열(287px)로 떨어진다. 1366px 는 7열 그대로 — 넓은 화면은 건드리지 않는다.
          // 이보다 더 줄이면(92) 1366px 가 8열로 갈라져 넓은 화면 배치가 바뀐다.
          gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))",
          gap: "var(--ux-space-2)",
        }}
      >
        {EXPRESS_EMOTIONS.map((e) => {
          const label = e.label[lang] ?? e.label.en ?? e.label.ko ?? e.id;
          const isPending = pending === e.id;
          const disabled = busy || pending !== null;
          return (
            <button
              key={e.id}
              data-ux-role="control"
              onClick={() => handlePick(e.id, quick ? 2 : 2)}
              disabled={disabled}
              aria-label={label}
              style={{
                position: "relative",
                overflow: "hidden",
                padding: "var(--ux-space-3) var(--ux-space-2)",
                borderRadius: 16,
                border: isPending
                  ? "3px solid var(--ux-selected-border)"
                  : "2px solid var(--ux-primary-border)",
                background: "var(--ux-surface)",
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: busy && !isPending ? 0.55 : 1,
                transition: "transform .12s, box-shadow .12s",
                boxShadow: isPending
                  ? "0 6px 16px rgba(137,83,0,.24)"
                  : "0 2px 6px rgba(137,83,0,.10)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                fontFamily: "inherit",
              }}
              onMouseDown={(ev) => { if (!disabled) ev.currentTarget.style.transform = "scale(0.96)"; }}
              onMouseUp={(ev) => (ev.currentTarget.style.transform = "scale(1)")}
              onMouseLeave={(ev) => (ev.currentTarget.style.transform = "scale(1)")}
            >
              {/* 감정별 색은 이 가는 띠 하나로만. 면을 칠하지 않는다. */}
              <span
                aria-hidden
                style={{
                  position: "absolute", left: 0, top: 0, bottom: 0, width: 5,
                  background: e.hue,
                }}
              />
              <MoodArt id={EMOTION_MOOD[e.id]} size={40} />
              <span
                data-ux-role="secondary"
                style={{
                  fontWeight: 800,
                  color: "var(--ux-ink)",
                  lineHeight: "var(--ux-lh-tight)",
                  textAlign: "center",
                  wordBreak: "keep-all",
                  // keep-all 은 낱말 안에서 못 자른다. 카드가 96px 트랙으로 좁아지자
                  // 띄어쓰기 없는 긴 낱말(fil "Nagpapasalamat")이 카드 밖으로 4px
                  // 삐져나가 overflow:hidden 에 잘렸다. anywhere 는 **들어가지 않을
                  // 때만** 끼어들므로 짧은 한국어 라벨은 그대로 한 줄이다.
                  overflowWrap: "anywhere",
                }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
      {!quick && (
        <p
          data-ux-role="secondary"
          style={{ marginTop: "var(--ux-space-2)", color: "var(--ux-ink-soft)", textAlign: "center" }}
        >
          카드를 눌러 지금 내 감정을 친구에게 보여주세요
        </p>
      )}
    </div>
  );
}
