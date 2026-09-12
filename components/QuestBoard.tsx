"use client";

// 📋 오늘의 심부름 (일일 퀘스트) 보드 — 꿀벌 마을 탭 최상단 카드.
// docs/일일퀘스트-설계.md §5 + 추가설계 X04/X05. 엔진은 lib/quests.ts.
//
// 이 파일이 책임지는 것 세 가지:
//  1) dayKey 를 **한 곳에서 정하고** 목록 계산·구독·수령에 같은 값을 넘긴다.
//     (종전엔 목록은 마운트 시점의 todayKey(), 구독은 구독 시작 시점의
//      todayKey() 로 각각 계산해 자정을 넘기면 서로 다른 날을 봤다.)
//  2) 자정이 지나면 '새로운 하루' 를 알리고 목록과 구독을 함께 바꾼다.
//     어제 못 받은 보상은 **어제 dayKey 로** 계속 받을 수 있다.
//  3) 끊긴 지급(pending)을 화면에 드러내고 재처리한다 — 낙관적 표시로
//     '받았어요' 라고 해 놓고 실제로는 안 들어온 상태를 만들지 않는다.
//
// UI 문구는 한국어 하드코딩 (마을 정책과 동일 — 신규 i18n 키 금지).
// 색·글자·조작 크기는 전부 공통 토큰(--ux-*)만 쓴다. px 고정 금지.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ScopedStyle from "./ui/child/ScopedStyle";
import {
  BONUS_HONEY,
  BONUS_XP,
  QUEST_BOARD_TITLE,
  bonusClaimState,
  claimBonusReward,
  claimQuestReward,
  classroomTimeZone,
  dailyQuestsFor,
  pendingRewards,
  questClaimState,
  questDone,
  questProgress,
  recoverDayRewards,
  subscribeClassroomTimeZone,
  subscribeTodayQuests,
  type ClaimOutcome,
  type DailyQuestState,
  type QuestDef,
  type QuestEventType,
} from "@/lib/quests";
import { dayKeyAt, msUntilNextDay } from "@/lib/classroomDay";

interface Props {
  roomCode: string;
  myClientId: string;
  onToast: (msg: string, tone: "success" | "error") => void;
  /** 미완료 심부름 클릭 → 그 활동을 할 수 있는 화면으로 이동 (BeeVillage 가 라우팅) */
  onGoTo?: (event: QuestEventType) => void;
  /** 교실 시간대 강제 지정 (fixture·테스트용). 없으면 방 설정을 구독한다. */
  timeZone?: string;
}

/** 자정을 넘겨 남은 '어제' 몫. 어제 상태 스냅샷을 그대로 들고 있는다. */
interface CarryOver {
  dayKey: string;
  quests: QuestDef[];
  state: DailyQuestState;
}

const BOARD_CSS = `
.qb-root{ display:flex; flex-direction:column; gap:var(--ux-space-3); }
.qb-card-panel{
  background:var(--ux-surface); border-radius:var(--ux-radius-panel);
  border:2px solid var(--ux-primary-border); padding:var(--ux-space-4);
  box-shadow:0 4px 14px rgba(137,83,0,.10);
}
.qb-head{ display:flex; align-items:baseline; gap:var(--ux-space-3); flex-wrap:wrap; }
.qb-note{ margin-top:var(--ux-space-1); }
/* 넓은 화면에서 심부름이 한눈에 들어오게 2~3열. 세로로 늘린 휴대폰 금지. */
.qb-grid{
  display:grid; gap:var(--ux-space-3); margin-top:var(--ux-space-4);
  grid-template-columns:repeat(auto-fit, minmax(15.5rem, 1fr));
  align-items:stretch;
}
.qb-cell{
  display:flex; flex-direction:column; gap:var(--ux-space-2);
  background:var(--ux-surface-sunk); border:2px solid var(--ux-primary-border);
  border-radius:var(--ux-radius-surface); padding:var(--ux-space-3);
  text-align:left; font-family:inherit; color:var(--ux-ink);
}
.qb-cell[data-done="yes"]{ border-color:var(--ux-selected-border); background:var(--ux-surface); }
/* 전역 [data-ux-role="control"] 을 덮을 땐 속성까지 건다 (디자인 원칙 4). */
button.qb-cell[data-ux-role="control"]{
  width:100%; cursor:pointer; padding:var(--ux-space-3); align-items:stretch;
}
.qb-cell-top{ display:flex; align-items:flex-start; gap:var(--ux-space-2); }
.qb-emoji{ font-size:1.6em; line-height:1; flex:0 0 auto; }
.qb-cell-foot{ display:flex; align-items:center; justify-content:space-between; gap:var(--ux-space-2); flex-wrap:wrap; margin-top:auto; }
.qb-btn[data-ux-role="action"]{
  background:var(--ux-primary-fill); color:var(--ux-primary-ink);
  border:2px solid var(--ux-primary-border); font-weight:800; font-family:inherit;
  width:100%; word-break:keep-all;
}
.qb-btn[aria-disabled="true"]{ opacity:.72; cursor:progress; }
.qb-btn-retry[data-ux-role="action"]{ background:var(--ux-surface); color:var(--ux-ink); }
.qb-go{ flex:0 0 auto; font-weight:800; color:var(--ux-primary-ink);
  background:var(--ux-primary-fill); border:2px solid var(--ux-primary-border);
  border-radius:999px; padding:var(--ux-space-1) var(--ux-space-3); }
.qb-banner{
  display:flex; align-items:center; gap:var(--ux-space-2); flex-wrap:wrap;
  background:var(--ux-surface); border:2px dashed var(--ux-primary-border);
  border-radius:var(--ux-radius-surface); padding:var(--ux-space-3);
}
.qb-pending{ border-color:var(--ux-error); }
.qb-bonus{ margin-top:var(--ux-space-3); }
.qb-bonus-btn[data-ux-role="action"]{ width:100%; }
.qb-done-mark{ font-weight:800; color:var(--ux-ink-soft); }
@media (min-width: 1024px){
  .qb-bonus-btn[data-ux-role="action"]{ width:auto; min-width:16rem; }
  .qb-bonus{ display:flex; justify-content:center; }
}
`;

// ── 표시 전용 (fixture·스냅샷이 그대로 쓴다 — Firebase 를 모른다) ──────────
export interface QuestBoardViewProps {
  title?: string;
  quests: QuestDef[];
  state: DailyQuestState;
  /** 지금 지급 요청이 날아가 있는 항목 (questId 또는 "bonus") */
  busy: Record<string, true>;
  /** 자정을 넘겨 목록을 바꿨다 */
  dayChanged?: boolean;
  carryOver?: CarryOver | null;
  onClaim: (q: QuestDef) => void;
  onBonus: () => void;
  onGoTo?: (event: QuestEventType) => void;
  onCarryOverClaim?: (q: QuestDef) => void;
  onCarryOverBonus?: () => void;
  onDismissDayChange?: () => void;
}

export function QuestBoardView({
  title = QUEST_BOARD_TITLE,
  quests,
  state,
  busy,
  dayChanged = false,
  carryOver = null,
  onClaim,
  onBonus,
  onGoTo,
  onCarryOverClaim,
  onCarryOverBonus,
  onDismissDayChange,
}: QuestBoardViewProps) {
  const doneCount = quests.filter((q) => questDone(q, state)).length;
  const allDone = quests.length > 0 && doneCount === quests.length;
  const bonusState = bonusClaimState(state);
  const bonusBusy = busy["bonus"] === true;

  const carryItems = carryOver
    ? carryOver.quests.filter(
        (q) => questDone(q, carryOver.state) && questClaimState(q, carryOver.state) !== "applied",
      )
    : [];
  const carryBonus =
    !!carryOver &&
    carryOver.quests.length > 0 &&
    carryOver.quests.every((q) => questDone(q, carryOver.state)) &&
    bonusClaimState(carryOver.state) !== "applied";

  return (
    <div data-ux-root className="qb-root">
      <ScopedStyle css={BOARD_CSS} />

      {dayChanged && (
        <div className="qb-banner" role="status">
          <span aria-hidden>🌅</span>
          <span data-ux-role="body">새로운 하루가 시작됐어요 — 오늘의 심부름을 가져왔어요.</span>
          {onDismissDayChange && (
            <button type="button" data-ux-role="control" onClick={onDismissDayChange}>
              알겠어요
            </button>
          )}
        </div>
      )}

      <div className="qb-card-panel">
        <div className="qb-head">
          <h2 data-ux-role="title" style={{ fontSize: "var(--ux-font-body-emphasis)" }}>
            📋 {title}
          </h2>
          <span data-ux-role="label">
            {doneCount}/{quests.length} 완료
          </span>
        </div>
        <p data-ux-role="secondary" className="qb-note">
          심부름을 마치면 🍯 꿀을 받아요 — 매일 새 심부름이 와요!
        </p>

        <div className="qb-grid">
          {quests.map((q) => {
            const done = questDone(q, state);
            const claim = questClaimState(q, state);
            const progress = questProgress(q, state);
            const inFlight = busy[q.id] === true;
            const goable = !done && !!onGoTo;

            const body = (
              <>
                <div className="qb-cell-top">
                  <span className="qb-emoji" aria-hidden>
                    {q.emoji}
                  </span>
                  <span data-ux-role="body-emphasis" style={{ flex: 1, minWidth: 0 }}>
                    {q.label}
                  </span>
                </div>
                <span data-ux-role="secondary">
                  {done ? "✅ 완료!" : `진행 ${progress}/${q.target}`} · 보상 {q.reward}🍯
                </span>
              </>
            );

            // 미완료 칸은 칸 전체가 이동 버튼. 완료 칸은 안에 '받기' 버튼이
            // 들어가므로 div 로 둔다 (중첩 버튼 금지).
            if (goable) {
              return (
                <button
                  key={q.id}
                  type="button"
                  data-ux-role="control"
                  className="qb-cell"
                  data-done="no"
                  aria-label={`${q.label} 하러 가기`}
                  onClick={() => onGoTo!(q.event)}
                >
                  {body}
                  <span className="qb-cell-foot">
                    <span className="qb-go">하러 가기 →</span>
                  </span>
                </button>
              );
            }

            return (
              <div key={q.id} className="qb-cell" data-done={done ? "yes" : "no"}>
                {body}
                <div className="qb-cell-foot">
                  {!done && <span data-ux-role="secondary">아직 하는 중이에요</span>}
                  {done && claim === "applied" && (
                    <span className="qb-done-mark" data-ux-role="label">
                      ✅ 받았어요
                    </span>
                  )}
                  {done && claim === "pending" && (
                    <>
                      <span data-ux-role="secondary">아직 다 못 받았어요</span>
                      <button
                        type="button"
                        data-ux-role="action"
                        className="qb-btn qb-btn-retry"
                        aria-disabled={inFlight || undefined}
                        aria-describedby={inFlight ? `qb-why-${q.id}` : undefined}
                        onClick={() => !inFlight && onClaim(q)}
                      >
                        🔁 다시 받기 (+{q.reward}🍯)
                      </button>
                      {inFlight && (
                        <span id={`qb-why-${q.id}`} data-ux-role="secondary">
                          지금 다시 보내는 중이에요
                        </span>
                      )}
                    </>
                  )}
                  {done && claim === "none" && (
                    <>
                      <button
                        type="button"
                        data-ux-role="action"
                        className="qb-btn"
                        aria-disabled={inFlight || undefined}
                        aria-describedby={inFlight ? `qb-why-${q.id}` : undefined}
                        onClick={() => !inFlight && onClaim(q)}
                      >
                        🍯 받기 (+{q.reward})
                      </button>
                      {inFlight && (
                        <span id={`qb-why-${q.id}`} data-ux-role="secondary">
                          보내는 중이에요
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="qb-bonus">
          {bonusState === "applied" ? (
            <p data-ux-role="body">🌟 황금 이슬까지 다 받았어요 — 내일 또 만나요!</p>
          ) : allDone ? (
            <button
              type="button"
              data-ux-role="action"
              className="qb-btn qb-bonus-btn"
              aria-disabled={bonusBusy || undefined}
              aria-describedby={bonusBusy ? "qb-why-bonus" : undefined}
              onClick={() => !bonusBusy && onBonus()}
            >
              {bonusState === "pending" ? "🔁 황금 이슬 다시 받기" : "🌟 황금 이슬 받기"} (+{BONUS_HONEY}🍯 · XP{" "}
              {BONUS_XP})
            </button>
          ) : (
            <p data-ux-role="secondary">
              {quests.length}개를 모두 마치면 🌟 황금 이슬 +{BONUS_HONEY}🍯 을 받아요
            </p>
          )}
          {bonusBusy && (
            <span id="qb-why-bonus" data-ux-role="secondary">
              보내는 중이에요
            </span>
          )}
        </div>
      </div>

      {/* 어제 것 — 자정을 넘겨도 보상은 완료한 날에 귀속된다. */}
      {carryOver && (carryItems.length > 0 || carryBonus) && (
        <div className="qb-card-panel qb-pending">
          <h3 data-ux-role="body-emphasis">🎁 어제({carryOver.dayKey}) 못 받은 보상이 있어요</h3>
          <div className="qb-grid">
            {carryItems.map((q) => {
              const inFlight = busy[`prev:${q.id}`] === true;
              return (
                <div key={`prev-${q.id}`} className="qb-cell" data-done="yes">
                  <div className="qb-cell-top">
                    <span className="qb-emoji" aria-hidden>
                      {q.emoji}
                    </span>
                    <span data-ux-role="body-emphasis">{q.label}</span>
                  </div>
                  <div className="qb-cell-foot">
                    <button
                      type="button"
                      data-ux-role="action"
                      className="qb-btn"
                      aria-disabled={inFlight || undefined}
                      onClick={() => !inFlight && onCarryOverClaim?.(q)}
                    >
                      🍯 어제 것 받기 (+{q.reward})
                    </button>
                  </div>
                </div>
              );
            })}
            {carryBonus && (
              <div className="qb-cell" data-done="yes">
                <div className="qb-cell-top">
                  <span className="qb-emoji" aria-hidden>
                    🌟
                  </span>
                  <span data-ux-role="body-emphasis">어제의 황금 이슬</span>
                </div>
                <div className="qb-cell-foot">
                  <button
                    type="button"
                    data-ux-role="action"
                    className="qb-btn"
                    aria-disabled={busy["prev:bonus"] === true || undefined}
                    onClick={() => busy["prev:bonus"] !== true && onCarryOverBonus?.()}
                  >
                    🌟 어제 것 받기 (+{BONUS_HONEY}🍯)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 컨테이너 ─────────────────────────────────────────────────────────────
export default function QuestBoard({ roomCode, myClientId, onToast, onGoTo, timeZone }: Props) {
  const [tz, setTz] = useState<string>(() => timeZone || classroomTimeZone(roomCode));
  const [dayKey, setDayKey] = useState<string>(() =>
    dayKeyAt(Date.now(), timeZone || classroomTimeZone(roomCode)),
  );
  const [state, setState] = useState<DailyQuestState>({});
  const [busy, setBusy] = useState<Record<string, true>>({});
  const [dayChanged, setDayChanged] = useState(false);
  const [carryOver, setCarryOver] = useState<CarryOver | null>(null);

  // 최신 값을 타이머/이벤트 콜백에서 읽기 위한 ref (stale closure 방지).
  const dayKeyRef = useRef(dayKey);
  dayKeyRef.current = dayKey;
  const stateRef = useRef(state);
  stateRef.current = state;
  /** 자동 재처리를 마운트당 항목별로 제한 (무한 재시도 루프 방지). */
  const recoverTriedRef = useRef<Record<string, number>>({});

  // 방 설정의 교실 시간대 구독 (prop 이 있으면 그쪽이 우선).
  useEffect(() => {
    if (timeZone || !roomCode) return;
    const unsub = subscribeClassroomTimeZone(roomCode, setTz);
    return () => unsub();
  }, [roomCode, timeZone]);

  useEffect(() => {
    if (timeZone) setTz(timeZone);
  }, [timeZone]);

  const quests = useMemo(() => dailyQuestsFor(dayKey, myClientId), [dayKey, myClientId]);

  // ── 날짜 경계 감시 ──
  // 자정 타이머 + 탭 복귀(visibility/focus) 둘 다 본다. 절전으로 타이머가
  // 늦게 깨어나도 복귀 시점에 바로잡힌다.
  const evaluateDay = useCallback(() => {
    const next = dayKeyAt(Date.now(), tz);
    if (next === dayKeyRef.current) return;
    const prevKey = dayKeyRef.current;
    const prevState = stateRef.current;
    const prevQuests = dailyQuestsFor(prevKey, myClientId);
    const leftover =
      pendingRewards(prevQuests, prevState).length > 0 ||
      prevQuests.some((q) => questDone(q, prevState) && questClaimState(q, prevState) !== "applied") ||
      (prevQuests.length > 0 &&
        prevQuests.every((q) => questDone(q, prevState)) &&
        bonusClaimState(prevState) !== "applied");
    setCarryOver(leftover ? { dayKey: prevKey, quests: prevQuests, state: prevState } : null);
    setState({});
    setBusy({});
    recoverTriedRef.current = {};
    setDayKey(next);
    setDayChanged(true);
  }, [tz, myClientId]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const arm = () => {
      if (timer) clearTimeout(timer);
      // 경계 직후로 1초 여유 — 시계 오차로 같은 날이 다시 나오는 것을 막는다.
      timer = setTimeout(() => {
        evaluateDay();
        arm();
      }, msUntilNextDay(Date.now(), tz) + 1000);
    };
    arm();
    const onWake = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      evaluateDay();
      arm();
    };
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", onWake);
    if (typeof window !== "undefined") window.addEventListener("focus", onWake);
    return () => {
      if (timer) clearTimeout(timer);
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onWake);
      if (typeof window !== "undefined") window.removeEventListener("focus", onWake);
    };
  }, [tz, evaluateDay]);

  // ── 구독 — 목록과 **같은 dayKey** 로 ──
  useEffect(() => {
    if (!roomCode || !myClientId) return;
    const unsub = subscribeTodayQuests(roomCode, myClientId, setState, dayKey);
    return () => unsub();
  }, [roomCode, myClientId, dayKey]);

  // ── 끊긴 지급 자동 재처리 ──
  // 서버 worker 가 없으므로 화면이 열릴 때/상태가 바뀔 때 학생 client 가 민다.
  useEffect(() => {
    if (!roomCode || !myClientId) return;
    const stuck = pendingRewards(quests, state);
    if (stuck.length === 0) return;
    const targets = stuck.filter((e) => (recoverTriedRef.current[e.eventKey] ?? 0) < 2);
    if (targets.length === 0) return;
    for (const e of targets) {
      recoverTriedRef.current[e.eventKey] = (recoverTriedRef.current[e.eventKey] ?? 0) + 1;
    }
    let alive = true;
    recoverDayRewards(roomCode, myClientId, dayKey, quests, state)
      .then((results) => {
        if (!alive) return;
        const paid = results.reduce((n, r) => n + r.honeyPaid, 0);
        if (paid > 0) onToast(`🍯 못 받았던 보상 +${paid} 을(를) 받았어요!`, "success");
      })
      .catch((err) => {
        console.error("recoverDayRewards failed", err);
      });
    return () => {
      alive = false;
    };
  }, [roomCode, myClientId, dayKey, quests, state, onToast]);

  const mark = (key: string, on: boolean) =>
    setBusy((p) => {
      if (on) return { ...p, [key]: true as const };
      const n = { ...p };
      delete n[key];
      return n;
    });

  const report = (key: string, label: string, res: ClaimOutcome) => {
    mark(key, false);
    if (res.status === "paid" && res.honey > 0) {
      onToast(`🍯 +${res.honey} 받았어요! (${label})`, "success");
    } else if (res.status === "pending") {
      onToast("보상을 다 못 받았어요. '다시 받기' 를 눌러 주세요.", "error");
    }
  };

  const handleClaim = (q: QuestDef, key = q.id, forDay = dayKey, src = state) => {
    if (busy[key]) return;
    mark(key, true);
    claimQuestReward(roomCode, myClientId, q, src, forDay)
      .then((res) => report(key, q.label, res))
      .catch((err) => {
        console.error("claimQuestReward failed", err);
        mark(key, false);
        onToast("문제가 생겼어요. 다시 시도해 주세요.", "error");
      });
  };

  const handleBonus = (key = "bonus", forDay = dayKey, src = state, qs = quests) => {
    if (busy[key]) return;
    mark(key, true);
    claimBonusReward(roomCode, myClientId, qs, src, forDay)
      .then((res) => {
        mark(key, false);
        if (res.status === "paid" && res.honey > 0) {
          onToast(`🌟 황금 이슬 +${res.honey}🍯 — 심부름 올클리어!`, "success");
        } else if (res.status === "pending") {
          onToast("황금 이슬을 다 못 받았어요. 다시 눌러 주세요.", "error");
        }
      })
      .catch((err) => {
        console.error("claimBonusReward failed", err);
        mark(key, false);
        onToast("문제가 생겼어요. 다시 시도해 주세요.", "error");
      });
  };

  return (
    <QuestBoardView
      quests={quests}
      state={state}
      busy={busy}
      dayChanged={dayChanged}
      carryOver={carryOver}
      onClaim={(q) => handleClaim(q)}
      onBonus={() => handleBonus()}
      onGoTo={onGoTo}
      onDismissDayChange={() => setDayChanged(false)}
      onCarryOverClaim={(q) => carryOver && handleClaim(q, `prev:${q.id}`, carryOver.dayKey, carryOver.state)}
      onCarryOverBonus={() =>
        carryOver && handleBonus("prev:bonus", carryOver.dayKey, carryOver.state, carryOver.quests)
      }
    />
  );
}
