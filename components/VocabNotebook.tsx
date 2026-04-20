"use client";

import { useMemo } from "react";
import { VOCAB_WORDS, VocabWord } from "@/lib/vocabWords";
import { ProgressMap, wordDoneCount } from "@/lib/vocabProgress";
import { t, tFmt } from "@/lib/i18n";

const PURPLE = "#8B5CF6";
const PURPLE_DARK = "#6D28D9";
const PURPLE_LIGHT = "#F5F3FF";

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
        background: "#fff", borderRadius: 18,
        border: "2px solid " + PURPLE + "33",
        padding: "16px", marginBottom: 14,
        boxShadow: "0 6px 16px rgba(139, 92, 246, 0.12)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: "#1F2937" }}>
            {tFmt("vocabProgress", lang, { done: doneCount, total })}
          </div>
          <div style={{
            background: "linear-gradient(135deg, #FDE68A, #F59E0B)",
            color: "#78350F", fontSize: 12, fontWeight: 900,
            padding: "4px 10px", borderRadius: 999,
          }}>{tFmt("vocabStickersEarned", lang, { n: stickersEarned })}</div>
        </div>
        <div style={{
          width: "100%", height: 14, borderRadius: 999,
          background: PURPLE_LIGHT, overflow: "hidden",
          border: "1px solid " + PURPLE + "33",
        }}>
          <div style={{
            width: `${pct}%`, height: "100%",
            background: "linear-gradient(90deg, " + PURPLE + ", " + PURPLE_DARK + ")",
            transition: "width 0.4s ease",
          }} />
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textAlign: "right", marginTop: 4 }}>
          {pct}%
        </div>
      </div>

      {/* Mastered */}
      {mastered.length > 0 && (
        <Section title={t("vocabSectionMastered", lang)} tone="gold">
          {mastered.map((w) => <NotebookRow key={w.id} w={w} progress={progress} onOpen={onOpenWord} tone="gold" />)}
        </Section>
      )}

      {/* In progress */}
      {inProgress.length > 0 && (
        <Section title={t("vocabSectionInProgress", lang)} tone="purple">
          {inProgress.map((w) => <NotebookRow key={w.id} w={w} progress={progress} onOpen={onOpenWord} tone="purple" />)}
        </Section>
      )}

      {/* Unstudied — 간단 칩 */}
      {unstudied.length > 0 && (
        <Section title={`${t("vocabSectionUnstudied", lang)} (${unstudied.length})`} tone="gray">
          <div style={{
            display: "flex", flexWrap: "wrap", gap: 6,
          }}>
            {unstudied.map((w) => (
              <button
                key={w.id}
                onClick={() => onOpenWord(w)}
                style={{
                  background: "#fff",
                  border: "1.5px solid #E5E7EB",
                  borderRadius: 999,
                  padding: "6px 12px",
                  fontSize: 13, fontWeight: 800, color: "#4B5563",
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

function Section({ title, tone, children }: { title: string; tone: "gold" | "purple" | "gray"; children: React.ReactNode }) {
  const color = tone === "gold" ? "#B45309" : tone === "purple" ? PURPLE_DARK : "#6B7280";
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 13, fontWeight: 900, color,
        letterSpacing: -0.2, padding: "0 4px 8px",
      }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
  return (
    <button
      onClick={() => onOpen(w)}
      style={{
        background: tone === "gold"
          ? "linear-gradient(145deg, #FEF3C7, #FDE68A)"
          : "linear-gradient(145deg, #fff, " + PURPLE_LIGHT + ")",
        border: tone === "gold" ? "2px solid #F59E0B" : "2px solid " + PURPLE + "66",
        borderRadius: 14,
        padding: "10px 14px",
        display: "flex", alignItems: "center", gap: 12,
        cursor: "pointer", fontFamily: "inherit",
        boxShadow: tone === "gold"
          ? "0 4px 10px rgba(245, 158, 11, 0.2)"
          : "0 4px 10px rgba(139, 92, 246, 0.15)",
      }}
    >
      <img
        src={`/vocab-images/icons/${w.id}.png`}
        alt=""
        aria-hidden="true"
        style={{
          width: 44, height: 44, objectFit: "contain",
          background: "rgba(255,255,255,0.6)",
          borderRadius: 10, padding: 3, flexShrink: 0,
        }}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
      <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <div style={{ fontSize: 15, fontWeight: 900, color: "#1F2937" }}>{w.ko}</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", marginTop: 2 }}>
          {w.subcategory} · 👂 {listenCount} · 예문 {done}/3 {dateStr && `· ${dateStr}`}
        </div>
      </div>
      <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{
            width: 8, height: 8, borderRadius: "50%",
            background: i < done ? (tone === "gold" ? "#F59E0B" : PURPLE) : "#E5E7EB",
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
