import { ref, get, set } from "firebase/database";
import { getClientDb } from "./firebase-client";
import { giveIndividualSticker } from "./stickers";
import type { StickerType } from "./types";
import { ProgressMap } from "./vocabProgress";

export interface VocabStats {
  wordsStudied: number;        // 진행 중(1+예문) + 마스터 합
  mastered: number;            // 3개 예문 모두 완료한 단어 수
  sentencesDone: number;       // 총 예문 완료 횟수 (단어 간 합)
}

export function computeStats(map: ProgressMap): VocabStats {
  let wordsStudied = 0;
  let mastered = 0;
  let sentencesDone = 0;
  for (const p of Object.values(map)) {
    if (p.doneSentences.length > 0) wordsStudied++;
    if (p.doneSentences.length >= 3) mastered++;
    sentencesDone += p.doneSentences.length;
  }
  return { wordsStudied, mastered, sentencesDone };
}

export interface RewardRule {
  id: string;
  type: StickerType;
  check: (s: VocabStats) => boolean;
  label: string;    // 축하 메시지 (한국어)
}

export const REWARD_RULES: RewardRule[] = [
  { id: "first_word",   type: "curious",     check: (s) => s.wordsStudied >= 1,   label: "첫 단어를 배웠어요!" },
  { id: "words_5",      type: "persistent",  check: (s) => s.wordsStudied >= 5,   label: "5개 단어 학습!" },
  { id: "words_10",     type: "persistent",  check: (s) => s.wordsStudied >= 10,  label: "10개 단어 학습!" },
  { id: "words_25",     type: "brave",       check: (s) => s.wordsStudied >= 25,  label: "25개 단어 돌파!" },
  { id: "words_50",     type: "cooperative", check: (s) => s.wordsStudied >= 50,  label: "50개 단어 달성!" },
  { id: "words_100",    type: "creative",    check: (s) => s.wordsStudied >= 100, label: "모든 단어 마스터! 🎉" },

  { id: "mastered_3",   type: "persistent",  check: (s) => s.mastered >= 3,   label: "3개 단어 완주!" },
  { id: "mastered_10",  type: "brave",       check: (s) => s.mastered >= 10,  label: "10개 단어 완주!" },
  { id: "mastered_30",  type: "creative",    check: (s) => s.mastered >= 30,  label: "30개 단어 완주!" },

  { id: "sentences_15", type: "curious",     check: (s) => s.sentencesDone >= 15, label: "15개 예문 완료!" },
  { id: "sentences_50", type: "creative",    check: (s) => s.sentencesDone >= 50, label: "50개 예문 완료!" },
  { id: "sentences_100",type: "cooperative", check: (s) => s.sentencesDone >= 100, label: "100개 예문 달성!" },
];

/** 이미 지급된 보상 ID 목록 조회 */
export async function getAwardedIds(roomCode: string, clientId: string): Promise<Set<string>> {
  try {
    const db = getClientDb();
    const snap = await get(ref(db, `rooms/${roomCode}/vocab/rewards/${clientId}`));
    const val = snap.val();
    if (!val || typeof val !== "object") return new Set();
    return new Set(Object.keys(val).filter((k) => (val as Record<string, unknown>)[k]));
  } catch {
    return new Set();
  }
}

/**
 * 학습 완료 콜백 — 새로 만족된 규칙 중 아직 지급 안 된 것들을 모두 지급한다.
 * - 스티커는 source="mission", missionId="vocab:<ruleId>" 로 기록
 * - 지급 기록은 rooms/{roomCode}/vocab/rewards/{clientId}/{ruleId}=true
 * @returns 새로 지급된 규칙 목록 (축하 UI 에 활용)
 */
export async function checkAndAward(
  roomCode: string,
  clientId: string,
  studentName: string,
  map: ProgressMap,
): Promise<RewardRule[]> {
  const stats = computeStats(map);
  const awarded = await getAwardedIds(roomCode, clientId);
  const newly: RewardRule[] = [];

  for (const rule of REWARD_RULES) {
    if (awarded.has(rule.id)) continue;
    if (!rule.check(stats)) continue;
    try {
      await giveIndividualSticker(
        roomCode,
        clientId,
        rule.type,
        studentName,        // teacherName slot: 학생 자신 (자동 지급 표기)
        "vocab-bot",         // teacherClientId: 시스템 식별자
        { source: "mission", missionId: `vocab:${rule.id}` },
      );
      // 지급 기록
      const db = getClientDb();
      await set(ref(db, `rooms/${roomCode}/vocab/rewards/${clientId}/${rule.id}`), true);
      newly.push(rule);
    } catch (err) {
      console.warn("[vocabRewards] 지급 실패", rule.id, err);
    }
  }

  return newly;
}
