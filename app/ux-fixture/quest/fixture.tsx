"use client";

import { QuestBoardView } from "@/components/QuestBoard";
import { BONUS_HONEY, BONUS_XP, dailyQuestsFor, type DailyQuestState } from "@/lib/quests";
import { createEntry } from "@/lib/rewardLedger";

/**
 * 고정 입력만 쓴다. 실명·운영 방(1111)·실제 명렬표는 절대 넣지 않는다(HARNESS §2).
 * 날짜도 고정이라 스크린샷이 날마다 달라지지 않는다.
 */
const FAKE_LEARNER = "학생 07";
const DAY = "2026-09-11";
const PREV_DAY = "2026-09-10";
const NOW = 1_763_000_000_000;

const quests = dailyQuestsFor(DAY, FAKE_LEARNER);
const prevQuests = dailyQuestsFor(PREV_DAY, FAKE_LEARNER);

const applied = (questId: string, amount: number, xpAmount = 0) => ({
  ...createEntry({ learnerId: FAKE_LEARNER, questId, dayKey: DAY, amount, xpAmount, now: NOW }),
  status: "applied" as const,
  honey: "applied" as const,
  xp: "applied" as const,
});

/** 지급이 끊겨 pending 으로 남은 항목 — '다시 받기' 가 보여야 한다. */
const stuck = (questId: string, amount: number) => ({
  ...createEntry({ learnerId: FAKE_LEARNER, questId, dayKey: DAY, amount, now: NOW }),
  attempts: 1,
  lastError: "fixture: injected",
});

function stateFor(scenario: string): DailyQuestState {
  const events: DailyQuestState["events"] = {};
  if (scenario === "mixed" || scenario === "busy") {
    events[quests[0].event] = quests[0].target;
    events[quests[1].event] = quests[1].target;
    return {
      events,
      claimed: { [quests[1].id]: stuck(quests[1].id, quests[1].reward) },
    };
  }
  for (const q of quests) events[q.event] = q.target;
  if (scenario === "alldone") {
    return { events, claimed: { [quests[0].id]: applied(quests[0].id, quests[0].reward) } };
  }
  return { events }; // rollover 의 '오늘' 은 아직 아무것도 안 한 상태
}

export default function QuestFixture({ scenario }: { scenario: "mixed" | "alldone" | "rollover" | "busy" }) {
  const rollover = scenario === "rollover";
  const prevState: DailyQuestState = {
    events: Object.fromEntries(prevQuests.map((q) => [q.event, q.target])),
    claimed: { [prevQuests[0].id]: applied(prevQuests[0].id, prevQuests[0].reward) },
  };

  return (
    <div style={{ background: "var(--ux-bg)", minHeight: "100dvh", padding: "var(--ux-space-4)" }}>
      <QuestBoardView
        quests={rollover ? dailyQuestsFor("2026-09-11", FAKE_LEARNER) : quests}
        state={rollover ? { events: {} } : stateFor(scenario)}
        busy={scenario === "busy" ? { [quests[0].id]: true, bonus: true } : {}}
        dayChanged={rollover}
        carryOver={rollover ? { dayKey: PREV_DAY, quests: prevQuests, state: prevState } : null}
        onClaim={(q) => console.log("[fixture] claim", q.id)}
        onBonus={() => console.log("[fixture] bonus", BONUS_HONEY, BONUS_XP)}
        onGoTo={(e) => console.log("[fixture] goTo", e)}
        onCarryOverClaim={(q) => console.log("[fixture] carryOver claim", q.id)}
        onCarryOverBonus={() => console.log("[fixture] carryOver bonus")}
        onDismissDayChange={() => console.log("[fixture] dismiss")}
      />
    </div>
  );
}
