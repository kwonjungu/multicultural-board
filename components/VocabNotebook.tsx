"use client";

import { useMemo } from "react";
import { VOCAB_WORDS, VocabWord } from "@/lib/vocabWords";
import { ProgressMap, wordDoneCount } from "@/lib/vocabProgress";
import { t, tFmt } from "@/lib/i18n";

/**
 * 단어장 — U07 정리에서 이 파일만 빠져 하드코딩이 남아 있었다(사용자 지적:
 * "단어장 레이아웃이 되게 다르고"). VocabCard·VocabHub 가 이미 쓰는 규칙을
 * 그대로 가져온다. 세 화면이 따로 놀지 않게 하는 것이 목적이다.
 *
 *  - 보라(--c-vocab)는 "단어 배우기" 의 정체성 색이지만 면을 통째로 칠하지
 *    않는다. 예전에는 완주/학습중 줄이 통째로 금색·보라 그라디언트였다.
 *    이제 면은 공통 표면 토큰 하나로 통일하고, 상태 구분은 **왼쪽 가는 띠
 *    하나**로만 남긴다(EmotionCardDeck 과 같은 결).
 *  - 하드코딩 px 글자 크기(11/12/13/14/15) → var(--ux-font-*) 계단.
 *    11px 는 태블릿에서 아이가 못 읽는다.
 *  - 굵기 900 → 800, 800 → 700.
 */
const ACCENT = "var(--c-vocab)";
const PURPLE = ACCENT;                           /* 옛 이름 유지 — 호출부가 많다 */
const PURPLE_DARK = "var(--ux-ink)";             /* 글자는 잉크색 */
const PURPLE_LIGHT = "var(--ux-surface-sunk)";   /* 살짝 가라앉은 면 */
const INK_SOFT = "var(--ux-ink-soft)";
const BORDER = "var(--ux-primary-border)";

/** `${ACCENT}33` 같은 hex 알파 이어붙이기는 var() 에서 깨진다. */
const accentAlpha = (pct: number) => `color-mix(in srgb, ${ACCENT} ${pct}%, transparent)`;

/** 완주는 꿀색, 학습 중은 정체성 보라 — 띠 한 줄에만 쓴다. */
const TONE_STRIP: Record<"gold" | "purple", string> = {
  gold: "var(--ux-primary-fill)",
  purple: ACCENT,
};

interface Props {
  progress: ProgressMap;
  stickersEarned: number;       // vocab 보상으로 얻은 스티커 수
  onOpenWord: (w: VocabWord) => void;
  lang: string;
}

export default function VocabNotebook({ progress, stickersEarned, onOpenWord, lang }: Props) {
  const { mastered, inProgress, unstudied } = useMemo(() => {
    const mastered: VocabWord[] = [];
    const inProgress: VocabWord[] = [];
    const unstudied: VocabWord[] = [];
    for (const w of VOCAB_WORDS) {
      const done = wordDoneCount(progress, w.id);
      if (done >= 3) mastered.push(w);
      else if (done > 0) inProgress.push(w);
      else unstudied.push(w);
    }
    // 최근 학습 순 정렬 (mastered / inProgress)
    const byRecent = (a: VocabWord, b: VocabWord) =>
      (progress[b.id]?.lastStudied ?? 0) - (progress[a.id]?.lastStudied ?? 0);
    mastered.sort(byRecent);
    inProgress.sort(byRecent);
    return { mastered, inProgress, unstudied };
  }, [progress]);

  const total = VOCAB_WORDS.length;
  const doneCount = mastered.length;
  const pct = Math.round((doneCount / total) * 100);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      {/* 학습 현황 바 */}
      <div style={{
        background: "var(--ux-surface)", borderRadius: "var(--ux-radius-surface)",
        border: `2px solid ${BORDER}`,
        padding: "var(--ux-space-4)", marginBottom: "var(--ux-space-3)",
        boxShadow: "0 6px 16px rgba(137,83,0,.12)",
      }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          gap: "var(--ux-space-3)", marginBottom: "var(--ux-space-2)",
        }}>
          <div style={{ fontSize: "var(--ux-font-label)", fontWeight: 800, color: PURPLE_DARK }}>
            {tFmt("vocabProgress", lang, { done: doneCount, total })}
          </div>
          {/* 스티커 수 — 예전에는 금색 그라디언트 알약이었다. 면은 가라앉은
              표면 하나로 두고 테두리로만 구분한다. */}
          <div style={{
            background: PURPLE_LIGHT, border: `1.5px solid ${BORDER}`,
            color: "var(--ux-primary-ink)",
            fontSize: "var(--ux-font-secondary)", fontWeight: 700,
            padding: "4px 10px", borderRadius: "var(--ux-radius-pill)",
            whiteSpace: "nowrap",
          }}>{tFmt("vocabStickersEarned", lang, { n: stickersEarned })}</div>
        </div>
        <div style={{
          width: "100%", height: 14, borderRadius: "var(--ux-radius-pill)",
          background: PURPLE_LIGHT, overflow: "hidden",
          border: `1px solid ${accentAlpha(20)}`,
        }}>
          <div style={{
            width: `${pct}%`, height: "100%",
            background: ACCENT,
            transition: "width var(--ux-motion-state) var(--ux-motion-ease)",
          }} />
        </div>
        <div style={{
          fontSize: "var(--ux-font-secondary)", fontWeight: 700,
          color: INK_SOFT, textAlign: "right", marginTop: 4,
        }}>
          {pct}%
        </div>
      </div>

      {/* Mastered */}
      {mastered.length > 0 && (
        <Section title={t("vocabSectionMastered", lang)}>
          {mastered.map((w) => <NotebookRow key={w.id} w={w} progress={progress} onOpen={onOpenWord} tone="gold" />)}
        </Section>
      )}

      {/* In progress */}
      {inProgress.length > 0 && (
        <Section title={t("vocabSectionInProgress", lang)}>
          {inProgress.map((w) => <NotebookRow key={w.id} w={w} progress={progress} onOpen={onOpenWord} tone="purple" />)}
        </Section>
      )}

      {/* Unstudied — 간단 칩 */}
      {unstudied.length > 0 && (
        <Section title={`${t("vocabSectionUnstudied", lang)} (${unstudied.length})`}>
          {/* U07/U09: 아직 안 배운 단어 칩이 95개쯤 깔린다. 예전에는 높이 29px 라
              태블릿에서 손가락으로 옆 칩을 누르기 쉬웠다. control 토큰으로
              최소 크기(터치 48px / 마우스 44px)를 걸고, 오터치 방지 간격도 준다. */}
          <div style={{
            display: "flex", flexWrap: "wrap", gap: "var(--ux-space-2)",
          }}>
            {unstudied.map((w) => (
              <button
                key={w.id}
                onClick={() => onOpenWord(w)}
                data-ux-role="control"
                style={{
                  background: "var(--ux-surface)",
                  border: `1.5px solid ${BORDER}`,
                  borderRadius: "var(--ux-radius-pill)",
                  fontWeight: 700, color: PURPLE_DARK,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >{w.ko}</button>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

/**
 * 구역 제목. 예전에는 구역마다 제목 색이 달랐다(금/보라/회색). 제목이 셋 다
 * 다른 색이면 무엇이 중요한지 알 수 없어 색은 잉크 하나로 통일하고, 구역은
 * 줄의 왼쪽 띠로 구분한다.
 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "var(--ux-space-4)" }}>
      <div style={{
        fontSize: "var(--ux-font-label)", fontWeight: 800, color: INK_SOFT,
        letterSpacing: -0.2, padding: "0 4px var(--ux-space-2)",
      }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--ux-space-2)" }}>
        {children}
      </div>
    </div>
  );
}

function NotebookRow({
  w, progress, onOpen, tone,
}: {
  w: VocabWord; progress: ProgressMap; onOpen: (w: VocabWord) => void;
  tone: "gold" | "purple";
}) {
  const done = wordDoneCount(progress, w.id);
  const p = progress[w.id];
  const listenCount = p?.listenCount ?? 0;
  const dateStr = p?.lastStudied ? formatDate(p.lastStudied) : "";
  const strip = TONE_STRIP[tone];
  return (
    <button
      onClick={() => onOpen(w)}
      data-ux-role="control"
      style={{
        position: "relative", overflow: "hidden",
        background: "var(--ux-surface)",
        border: `2px solid ${BORDER}`,
        borderRadius: "var(--ux-radius-surface)",
        padding: "var(--ux-space-2) var(--ux-space-4) var(--ux-space-2) var(--ux-space-6)",
        display: "flex", alignItems: "center", gap: "var(--ux-space-3)",
        cursor: "pointer", fontFamily: "inherit", textAlign: "left",
        boxShadow: "0 4px 10px rgba(137,83,0,.10)",
      }}
    >
      {/* 완주/학습중 구분은 이 가는 띠 하나로만. 면을 칠하지 않는다. */}
      <span
        aria-hidden
        style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: 6,
          background: strip,
        }}
      />
      <img
        src={`/vocab-images/icons/${w.id}.png`}
        alt=""
        aria-hidden="true"
        style={{
          width: "var(--ux-control-min)", height: "var(--ux-control-min)", objectFit: "contain",
          background: PURPLE_LIGHT,
          borderRadius: 10, padding: 3, flexShrink: 0,
        }}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
      <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <div style={{ fontSize: "var(--ux-font-body)", fontWeight: 800, color: PURPLE_DARK }}>{w.ko}</div>
        <div style={{
          fontSize: "var(--ux-font-secondary)", fontWeight: 700,
          color: INK_SOFT, marginTop: 2,
        }}>
          {w.subcategory} · 👂 {listenCount} · 예문 {done}/3 {dateStr && `· ${dateStr}`}
        </div>
      </div>
      <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{
            width: 8, height: 8, borderRadius: "50%",
            background: i < done ? strip : "var(--ux-surface-sunk)",
            border: i < done ? "none" : `1px solid ${BORDER}`,
          }} />
        ))}
      </div>
    </button>
  );
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
  if (sameDay) {
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  }
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
