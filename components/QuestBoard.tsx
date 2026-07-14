"use client";

// 📋 오늘의 심부름 (일일 퀘스트) 보드 — 꿀벌 마을 탭 최상단 카드.
// docs/일일퀘스트-설계.md §5. 엔진은 lib/quests.ts (계약 — 여기서 수정 금지).
// - 오늘 퀘스트 3개는 결정적 회전(dailyQuestsFor) — 어디서 봐도 같은 조합.
// - 진행 상태는 subscribeTodayQuests 읽기 전용 표시 (draft 시딩 불필요).
// - 수령은 낙관적 UX: 즉시 비활성화 + 토스트 → 실패 시 롤백 + 에러 토스트.
//   (claim 함수는 서버측 가드 트랜잭션이 있어 중복 지급은 없다.)
// UI 문구는 한국어 하드코딩 (마을 정책과 동일 — 신규 i18n 키 금지).

import { useEffect, useMemo, useState } from "react";
import {
  dailyQuestsFor,
  todayKey,
  subscribeTodayQuests,
  questProgress,
  questDone,
  questClaimed,
  claimQuestReward,
  claimBonusReward,
  BONUS_HONEY,
  BONUS_XP,
  type DailyQuestState,
  type QuestDef,
  type QuestEventType,
} from "@/lib/quests";
import { awardXp } from "@/lib/lms";
import { HONEY } from "@/lib/constants";

interface Props {
  roomCode: string;
  myClientId: string;
  onToast: (msg: string, tone: "success" | "error") => void;
  /** 미완료 심부름 클릭 → 그 활동을 할 수 있는 화면으로 이동 (BeeVillage 가 라우팅) */
  onGoTo?: (event: QuestEventType) => void;
}

export default function QuestBoard({ roomCode, myClientId, onToast, onGoTo }: Props) {
  const [state, setState] = useState<DailyQuestState>({});
  // 낙관적 수령 표시 (연타 방지 겸용) — questId 또는 "bonus"
  const [pending, setPending] = useState<Record<string, true>>({});

  const quests = useMemo(
    () => dailyQuestsFor(todayKey(), myClientId),
    [myClientId],
  );

  useEffect(() => {
    if (!roomCode || !myClientId) return;
    const unsub = subscribeTodayQuests(roomCode, myClientId, setState);
    return () => unsub();
  }, [roomCode, myClientId]);

  const allDone = quests.length > 0 && quests.every((q) => questDone(q, state));
  const doneCount = quests.filter((q) => questDone(q, state)).length;
  const bonusTaken = state.bonus === true || pending["bonus"] === true;

  function markPending(key: string) {
    setPending((p) => ({ ...p, [key]: true }));
  }
  function unmarkPending(key: string) {
    setPending((p) => {
      const n = { ...p };
      delete n[key];
      return n;
    });
  }

  function handleClaim(q: QuestDef) {
    if (pending[q.id] || questClaimed(q, state) || !questDone(q, state)) return;
    markPending(q.id); // 즉시 비활성화 — 연타 방지
    onToast(`🍯 +${q.reward} 받았어요! (${q.label})`, "success");
    claimQuestReward(roomCode, myClientId, q, state).catch((err) => {
      console.error("claimQuestReward failed", err);
      unmarkPending(q.id); // 롤백 — 버튼 되살리기
      onToast("문제가 생겼어요. 다시 시도해 주세요.", "error");
    });
    // 성공 시엔 onValue 에코가 claimed 를 채우므로 별도 처리 불필요.
  }

  function handleBonus() {
    if (!allDone || bonusTaken) return;
    markPending("bonus");
    onToast(`🌟 황금 이슬 +${BONUS_HONEY}🍯 — 오늘 심부름 올클리어!`, "success");
    claimBonusReward(roomCode, myClientId, quests, state)
      .then((got) => {
        if (got !== null) {
          // XP 는 실제 지급이 확정된 경우에만 (서버 가드 통과 시)
          awardXp(roomCode, myClientId, BONUS_XP).catch((err) => {
            console.error("bonus awardXp failed", err);
          });
        }
      })
      .catch((err) => {
        console.error("claimBonusReward failed", err);
        unmarkPending("bonus");
        onToast("문제가 생겼어요. 다시 시도해 주세요.", "error");
      });
  }

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 22,
        padding: "16px 14px",
        border: `2px solid ${HONEY.h200}`,
        boxShadow: "0 8px 24px rgba(180,83,9,0.12)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 15, fontWeight: 900, color: HONEY.h800 }}>
          📋 오늘의 심부름
        </div>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: HONEY.h700 }}>
          {doneCount}/{quests.length} 완료
        </div>
      </div>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: HONEY.h700, marginTop: 2 }}>
        심부름을 마치면 🍯 꿀을 받아요 — 매일 새 심부름이 와요!
      </div>

      {/* 퀘스트 3줄 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
        {quests.map((q) => {
          const done = questDone(q, state);
          const claimed = questClaimed(q, state) || pending[q.id] === true;
          const progress = questProgress(q, state);
          // 미완료 심부름은 행 전체가 버튼 — 누르면 그 활동을 하는 화면으로 이동.
          // (완료 행은 내부에 "받기" 버튼이 중첩되므로 div 유지 — 중첩 버튼 방지)
          const clickable = !done && !!onGoTo;
          const rowStyle: React.CSSProperties = {
            display: "flex",
            alignItems: "center",
            gap: 10,
            minHeight: 52,
            padding: "8px 12px",
            borderRadius: 14,
            border: `2px solid ${done ? HONEY.h300 : HONEY.h100}`,
            background: done
              ? `linear-gradient(160deg, ${HONEY.h100}, #fff)`
              : "#FFFDF6",
          };
          const rowInner = (
            <>
              <div style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{q.emoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: 900,
                    color: "#1F2937",
                    letterSpacing: -0.2,
                    textAlign: "left",
                  }}
                >
                  {q.label}
                </div>
                <div style={{ fontSize: 11, fontWeight: 800, color: HONEY.h700, marginTop: 1, textAlign: "left" }}>
                  {done ? "✅ 완료!" : `진행 ${progress}/${q.target}`}
                  {" · "}보상 {q.reward}🍯
                </div>
              </div>
            </>
          );
          if (clickable) {
            return (
              <button
                key={q.id}
                onClick={() => onGoTo!(q.event)}
                aria-label={`${q.label} 하러 가기`}
                style={{
                  ...rowStyle,
                  width: "100%",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {rowInner}
                <div
                  style={{
                    flexShrink: 0,
                    fontSize: 12,
                    fontWeight: 900,
                    color: HONEY.h800,
                    background: `linear-gradient(160deg, ${HONEY.h100}, #fff)`,
                    border: `2px solid ${HONEY.h200}`,
                    borderRadius: 999,
                    padding: "6px 12px",
                  }}
                >
                  하러 가기 →
                </div>
              </button>
            );
          }
          return (
            <div key={q.id} style={rowStyle}>
              {rowInner}
              {done && (
                claimed ? (
                  <div
                    style={{
                      flexShrink: 0,
                      fontSize: 12,
                      fontWeight: 900,
                      color: HONEY.h700,
                      padding: "6px 10px",
                    }}
                  >
                    ✅ 받았어요
                  </div>
                ) : (
                  <button
                    onClick={() => handleClaim(q)}
                    style={{
                      flexShrink: 0,
                      minHeight: 44,
                      padding: "8px 14px",
                      background: `linear-gradient(135deg, ${HONEY.h400}, ${HONEY.h500})`,
                      color: "#fff",
                      border: `2px solid ${HONEY.h500}`,
                      borderRadius: 12,
                      fontSize: 13,
                      fontWeight: 900,
                      cursor: "pointer",
                      boxShadow: "0 4px 12px rgba(245,158,11,0.3)",
                      fontFamily: "inherit",
                      letterSpacing: -0.2,
                    }}
                  >
                    🍯 받기 (+{q.reward})
                  </button>
                )
              )}
            </div>
          );
        })}
      </div>

      {/* 올클리어 보너스 — 🌟 황금 이슬 */}
      <div style={{ marginTop: 10 }}>
        {bonusTaken ? (
          <div
            style={{
              textAlign: "center",
              fontSize: 12.5,
              fontWeight: 900,
              color: HONEY.h700,
              padding: "10px 12px",
              borderRadius: 14,
              background: `linear-gradient(160deg, ${HONEY.h100}, #fff)`,
              border: `2px solid ${HONEY.h300}`,
            }}
          >
            🌟 황금 이슬까지 다 받았어요 — 내일 또 만나요!
          </div>
        ) : allDone ? (
          <button
            onClick={handleBonus}
            style={{
              width: "100%",
              minHeight: 52,
              padding: "10px 20px",
              background: "linear-gradient(135deg, #FBBF24, #F59E0B, #D97706)",
              color: "#fff",
              border: `2px solid ${HONEY.h600}`,
              borderRadius: 14,
              fontSize: 15,
              fontWeight: 900,
              cursor: "pointer",
              boxShadow: "0 6px 18px rgba(217,119,6,0.4)",
              fontFamily: "inherit",
              letterSpacing: -0.2,
            }}
          >
            🌟 황금 이슬 받기 (+{BONUS_HONEY}🍯)
          </button>
        ) : (
          <div style={{ fontSize: 11, fontWeight: 700, color: HONEY.h700, textAlign: "center" }}>
            3개를 모두 마치면 🌟 황금 이슬 +{BONUS_HONEY}🍯 을 받아요
          </div>
        )}
      </div>
    </div>
  );
}
