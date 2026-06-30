"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { ref, onValue } from "firebase/database";
import { getClientDb } from "@/lib/firebase-client";
import { VOCAB_WORDS, VocabWord } from "@/lib/vocabWords";
import {
  loadProgress, saveProgress, markSentenceDone, bumpListen, markTestResult,
  wordDoneCount, masteredCount, ProgressMap,
  subscribeProgress, writeWordProgress, mergeProgress,
} from "@/lib/vocabProgress";
import { extractVocabLocal, MatchedWord, wordById } from "@/lib/vocabUtils";
import { checkAndAward, RewardRule, getAwardedIds } from "@/lib/vocabRewards";
import { cleanupExpiredRecordings } from "@/lib/vocabRecordings";
import { buildMixedQuiz, buildLessonQuiz, buildDailyChallenge, type QuizItem } from "@/lib/quizFormats";
import { getUnits, wordsForLesson, type Unit, type Lesson } from "@/lib/lessons";
import BeeMascot from "./BeeMascot";
import {
  subscribeLearner, setDailyGoal, effectiveHearts, msUntilNextHeart, xpToNextLevel, levelFromXp,
  MAX_HEARTS, type LearnerState,
} from "@/lib/lms";
import { fetchStudentAttempts } from "@/lib/vocabAttempts";
import { suggestGoal } from "@/lib/dailyGoal";
import { subscribeExpressions, filterDue, type ExpressionEntry } from "@/lib/expressionLog";
import ExpressionReview from "./ExpressionReview";
import { UserConfig, CardData } from "@/lib/types";
import { useBackLayer } from "@/lib/backStack";
import { t, tFmt } from "@/lib/i18n";
import VocabCard from "./VocabCard";
import VocabNotebook from "./VocabNotebook";
import VocabTest from "./VocabTest";
import VocabWriteSheet from "./VocabWriteSheet";
import TeacherVocabDashboard from "./TeacherVocabDashboard";

const PURPLE = "#8B5CF6";
const PURPLE_DARK = "#6D28D9";
const PURPLE_LIGHT = "#F5F3FF";

const SUBCATEGORIES: string[] = [
  "감정", "지칭어", "의사표현", "학교생활", "일상동사", "일상형용사", "인사",
];

const SUB_ICON: Record<string, string> = {
  "감정": "😊",
  "지칭어": "👉",
  "의사표현": "💬",
  "학교생활": "🏫",
  "일상동사": "🏃",
  "일상형용사": "📏",
  "인사": "👋",
};

interface Props {
  user: UserConfig;
  roomCode: string;
  onBack: () => void;
}

export default function VocabHub({ user, roomCode, onBack }: Props) {
  const lang = user.myLang;
  const [progress, setProgress] = useState<ProgressMap>({});
  const [activeSub, setActiveSub] = useState<string | "all">("all");
  const [openWord, setOpenWord] = useState<VocabWord | null>(null);

  // 소통창 카드 텍스트 수집
  const [cardTexts, setCardTexts] = useState<string[]>([]);
  const [matched, setMatched] = useState<MatchedWord[]>([]);
  const [scanState, setScanState] = useState<"idle" | "scanning" | "error">("idle");
  const scanOnce = useRef(false);

  // 자동 보상 축하 큐
  const [awardQueue, setAwardQueue] = useState<RewardRule[]>([]);
  const [stickersEarned, setStickersEarned] = useState(0);

  // 뷰 모드 (트리 / 그리드 / 단어장) — 듀오링고 스타일 트리가 기본
  const [viewMode, setViewMode] = useState<"tree" | "grid" | "notebook">("tree");

  // 시험
  const [quiz, setQuiz] = useState<QuizItem[] | null>(null);
  const [lessonContext, setLessonContext] = useState<{ id: string; title: string } | null>(null);
  // 레슨 시작 시트 — 단어 카드 공부(상황 카드) ↔ 시험 선택
  const [lessonSheet, setLessonSheet] = useState<{ lesson: Lesson; unit: Unit } | null>(null);
  const [studyQueue, setStudyQueue] = useState<VocabWord[] | null>(null);
  const [studyIdx, setStudyIdx] = useState(0);
  const [teacherView, setTeacherView] = useState(false);
  const [learner, setLearner] = useState<LearnerState | null>(null);
  const [now, setNow] = useState(Date.now());
  const [goalToast, setGoalToast] = useState<string | null>(null);
  const goalAdjustedRef = useRef(false);
  const [expressions, setExpressions] = useState<ExpressionEntry[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [showWriteSheet, setShowWriteSheet] = useState(false);

  useEffect(() => {
    const unsub = subscribeLearner(roomCode, user.myName, setLearner);
    return unsub;
  }, [roomCode, user.myName]);

  useEffect(() => {
    const unsub = subscribeExpressions(roomCode, user.myName, setExpressions);
    return unsub;
  }, [roomCode, user.myName]);

  // 하트 회복 카운트다운 1초마다
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // 단어카드 진입 시 1회 — 최근 학습 데이터로 데일리 골 자동 조정
  useEffect(() => {
    if (!learner) return;
    if (goalAdjustedRef.current) return;
    goalAdjustedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const attempts = await fetchStudentAttempts(roomCode, user.myName);
        if (cancelled) return;
        const sug = suggestGoal(attempts, learner.dailyGoal, learner.streak);
        if (sug.changed) {
          await setDailyGoal(roomCode, user.myName, sug.goal);
          setGoalToast(`🎯 ${sug.reason}`);
          setTimeout(() => setGoalToast(null), 4500);
        }
      } catch (err) {
        console.warn("[VocabHub] 자동 골 조정 실패", err);
      }
    })();
    return () => { cancelled = true; };
  }, [learner, roomCode, user.myName]);

  useEffect(() => {
    setProgress(loadProgress(roomCode, user.myName));
  }, [roomCode, user.myName]);

  // Firebase 진행도 구독 — 원격 변경을 로컬과 머지 (doneSentences 합집합, 최대 lastStudied)
  useEffect(() => {
    const unsub = subscribeProgress(roomCode, user.myName, (remote) => {
      setProgress((local) => {
        const merged = mergeProgress(local, remote);
        // 머지 결과가 로컬과 다르면 localStorage 도 갱신
        if (JSON.stringify(merged) !== JSON.stringify(local)) {
          saveProgress(roomCode, user.myName, merged);
        }
        return merged;
      });
    });
    return () => unsub();
  }, [roomCode, user.myName]);

  // 받은 vocab 스티커 수 (지급 기록 개수)
  useEffect(() => {
    let cancelled = false;
    getAwardedIds(roomCode, user.myName).then((s) => {
      if (!cancelled) setStickersEarned(s.size);
    });
    return () => { cancelled = true; };
  }, [roomCode, user.myName, awardQueue.length]); // 큐 변경 시 새로고침

  // Hub 마운트 시 30일 넘은 녹음 정리 (백그라운드, 1회)
  useEffect(() => {
    cleanupExpiredRecordings(roomCode, user.myName).catch(() => { /* silent */ });
  }, [roomCode, user.myName]);

  // 카드 구독 — originalText + translations.ko 수집
  useEffect(() => {
    const db = getClientDb();
    const cardsRef = ref(db, `rooms/${roomCode}/cards`);
    const unsub = onValue(cardsRef, (snap) => {
      const val = snap.val();
      if (!val || typeof val !== "object") { setCardTexts([]); return; }
      const texts: string[] = [];
      for (const card of Object.values(val as Record<string, CardData>)) {
        if (!card) continue;
        if (typeof card.originalText === "string" && card.originalText.trim()) {
          texts.push(card.originalText);
        }
        const koTrans = card.translations?.ko;
        if (typeof koTrans === "string" && koTrans.trim()) texts.push(koTrans);
      }
      setCardTexts(texts);
    });
    return () => unsub();
  }, [roomCode]);

  // 카드가 처음 들어왔을 때 1회 자동 스캔
  useEffect(() => {
    if (scanOnce.current) return;
    if (cardTexts.length === 0) return;
    scanOnce.current = true;
    runScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardTexts]);

  async function runScan() {
    if (cardTexts.length === 0) { setMatched([]); return; }
    setScanState("scanning");
    try {
      const res = await fetch("/api/vocab-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardTexts, limit: 12 }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as { matched: MatchedWord[] };
      setMatched(json.matched ?? []);
      setScanState("idle");
    } catch {
      // 폴백 — 서버 장애 시 로컬
      setMatched(extractVocabLocal(cardTexts, 12));
      setScanState("error");
    }
  }

  function persist(next: ProgressMap, opts?: { checkRewards?: boolean; touchedWordId?: string }) {
    setProgress(next);
    saveProgress(roomCode, user.myName, next);

    // 변경된 단어만 Firebase 에 싱크 — 낙관적 fire-and-forget
    if (opts?.touchedWordId && next[opts.touchedWordId]) {
      writeWordProgress(roomCode, user.myName, opts.touchedWordId, next[opts.touchedWordId])
        .catch(() => { /* silent */ });
    }

    if (opts?.checkRewards) {
      checkAndAward(roomCode, user.myName, user.myName, next)
        .then((newly) => { if (newly.length > 0) setAwardQueue((q) => [...q, ...newly]); })
        .catch(() => { /* silent */ });
    }
  }

  // 축하 큐 — 각 2.8초씩 순차 표시
  useEffect(() => {
    if (awardQueue.length === 0) return;
    const id = window.setTimeout(() => {
      setAwardQueue((q) => q.slice(1));
    }, 2800);
    return () => window.clearTimeout(id);
  }, [awardQueue]);

  const currentAward = awardQueue[0];

  const filteredWords = useMemo(() => {
    if (activeSub === "all") return VOCAB_WORDS;
    return VOCAB_WORDS.filter((w) => w.subcategory === activeSub);
  }, [activeSub]);

  // 쓰기 학습지 단어 목록 — 소통판 단어(matched) + 학습한 단어(progress) 합집합.
  // id 중복 제거 + undefined 필터 + 최대 12개. 없으면 레벨1 단어 8개로 폴백.
  const worksheetWords = useMemo<VocabWord[]>(() => {
    const ids: string[] = [
      ...matched.map((m) => m.wordId),
      ...Object.entries(progress)
        .filter(([, p]) => (p.doneSentences?.length ?? 0) > 0 || (p.listenCount ?? 0) > 0)
        .map(([id]) => id),
    ];
    const seen = new Set<string>();
    const words: VocabWord[] = [];
    for (const id of ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      const w = wordById(id);
      if (w) words.push(w);
      if (words.length >= 12) break;
    }
    if (words.length === 0) {
      return VOCAB_WORDS.filter((w) => w.level === 1).slice(0, 8);
    }
    return words;
  }, [matched, progress]);

  const masteredTotal = masteredCount(progress);
  const isTeacher = user.isTeacher ?? false;

  // 뒤로 가기: 열려 있는 학습/시험 화면을 한 단계씩 닫는다 (단어공부에서 바로
  // 나가지 않음). 중첩(레슨시트 위 학습/시험)은 중앙 백스택이 안쪽부터 닫는다.
  useBackLayer(isTeacher && teacherView, () => setTeacherView(false));
  useBackLayer(!!lessonSheet, () => setLessonSheet(null));
  useBackLayer(!!studyQueue, () => setStudyQueue(null));
  useBackLayer(!!openWord, () => setOpenWord(null));
  useBackLayer(reviewOpen, () => setReviewOpen(false));
  useBackLayer(!!quiz, () => { setQuiz(null); setLessonContext(null); });

  // 교사가 대시보드 토글 켜면 다른 화면 전체 가리고 대시보드만 렌더
  if (isTeacher && teacherView) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #FAF5FF 0%, #EDE9FE 50%, #DDD6FE 100%)",
        fontFamily: "'Pretendard Variable', 'Pretendard', 'Noto Sans KR', sans-serif",
        padding: "16px 14px 40px",
      }}>
        <TeacherVocabDashboard roomCode={roomCode} onBack={() => setTeacherView(false)} />
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      // 🐝 꽃밭 풍경 배경 (흰 반투명 오버레이로 단어카드 가독성 유지)
      background: "linear-gradient(rgba(250,245,255,0.85), rgba(237,233,254,0.85)), url('/landing/board-meadow.webp') center / cover no-repeat",
      backgroundAttachment: "fixed",
      fontFamily: "'Pretendard Variable', 'Pretendard', 'Noto Sans KR', sans-serif",
      padding: "16px 14px 40px",
      position: "relative",
    }}>
      {/* Header */}
      <div style={{
        maxWidth: 760, margin: "0 auto",
        display: "flex", alignItems: "center", gap: 12,
        background: "#fff", borderRadius: 20, padding: "12px 16px",
        border: "2px solid " + PURPLE + "33",
        boxShadow: "0 8px 24px rgba(109, 40, 217, 0.12)",
        marginBottom: 18,
      }}>
        <button
          onClick={onBack}
          aria-label="뒤로"
          style={{
            background: PURPLE_LIGHT, border: "none", borderRadius: 10,
            padding: "8px 12px", fontSize: 14, fontWeight: 800, color: PURPLE_DARK,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >{t("vocabBack", lang)}</button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#1F2937", letterSpacing: -0.3 }}>
            📚 {t("hubSectionVocab", lang)}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: PURPLE_DARK, marginTop: 2 }}>
            {tFmt("vocabProgress", lang, { done: masteredTotal, total: VOCAB_WORDS.length })}
          </div>
        </div>

        {isTeacher && (
          <button
            onClick={() => setTeacherView(true)}
            style={{
              background: "linear-gradient(135deg, " + PURPLE + ", " + PURPLE_DARK + ")",
              color: "#fff", border: "none", borderRadius: 14,
              padding: "8px 14px", fontSize: 13, fontWeight: 900,
              cursor: "pointer", fontFamily: "inherit",
              boxShadow: "0 4px 10px " + PURPLE + "55",
            }}
          >👨‍🏫 반 전체 보기</button>
        )}

        {!isTeacher && (() => {
          const dueCount = filterDue(expressions).length;
          const hasAny = expressions.length > 0;
          if (!hasAny) return null;
          return (
            <button
              onClick={() => setReviewOpen(true)}
              aria-label="표현 복습"
              style={{
                position: "relative",
                background: dueCount > 0
                  ? "linear-gradient(135deg, #FB923C, #EA580C)"
                  : PURPLE_LIGHT,
                color: dueCount > 0 ? "#fff" : PURPLE_DARK,
                border: "none", borderRadius: 14,
                padding: "8px 12px", fontSize: 13, fontWeight: 900,
                cursor: "pointer", fontFamily: "inherit",
                boxShadow: dueCount > 0 ? "0 4px 12px rgba(234,88,12,0.45)" : "none",
              }}
            >
              📝 표현
              {dueCount > 0 && (
                <span style={{
                  position: "absolute", top: -6, right: -6,
                  background: "#fff", color: "#EA580C",
                  fontSize: 11, fontWeight: 900,
                  minWidth: 20, height: 20, borderRadius: 999,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  padding: "0 5px",
                  border: "2px solid #EA580C",
                  lineHeight: 1,
                }}>{dueCount}</span>
              )}
            </button>
          );
        })()}

        <div style={{
          background: "linear-gradient(135deg, #FDE68A, #F59E0B)",
          color: "#78350F", fontSize: 14, fontWeight: 900,
          padding: "8px 14px", borderRadius: 14,
          boxShadow: "0 4px 10px rgba(245,158,11,0.35)",
        }}>
          🏆 {masteredTotal}
        </div>
      </div>

      {/* HUD: 하트 / 스트릭 / XP */}
      <LearnerHUD learner={learner} now={now} />

      {/* 🔥 나의 단어 일일 챌린지 — 소통판 단어 + 약점 단어 듀오링고식 릴레이 */}
      {(() => {
        const boardCount = matched.length;
        const studiedCount = Object.values(progress).filter(
          (p) => (p.doneSentences?.length ?? 0) > 0,
        ).length;
        const startDailyChallenge = () => {
          const boardIds = matched.map((m) => m.wordId);
          const q = buildDailyChallenge(progress, boardIds, 10);
          if (q.length > 0) {
            setLessonContext({ id: "daily-challenge", title: "🔥 나의 단어 일일 챌린지" });
            setQuiz(q);
          }
        };
        return (
          <>
          <style>{`
            @keyframes dailyChallengePulse {
              0%, 100% { box-shadow: 0 10px 26px rgba(219,39,119,0.35); }
              50% { box-shadow: 0 12px 34px rgba(219,39,119,0.65), 0 0 0 4px rgba(249,115,22,0.30); }
            }
            @keyframes dailyChallengeSparkle {
              0%, 100% { transform: scale(1) rotate(0deg); opacity: 1; }
              50% { transform: scale(1.18) rotate(8deg); opacity: 0.85; }
            }
          `}</style>
          <button
            onClick={startDailyChallenge}
            style={{
              position: "relative",
              maxWidth: 760, width: "100%", margin: "0 auto 14px",
              display: "flex", alignItems: "center", gap: 14, textAlign: "left",
              background: "linear-gradient(135deg, #F97316, #DB2777)",
              border: "none", borderRadius: 20, padding: "14px 18px",
              cursor: "pointer", fontFamily: "inherit",
              animation: "dailyChallengePulse 2.2s ease-in-out infinite",
              transition: "transform 0.15s",
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
            onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            {/* NEW 반짝 뱃지 — 시선 유도 */}
            <span style={{
              position: "absolute", top: -8, right: 14,
              background: "#FACC15", color: "#7C2D12",
              fontSize: 11, fontWeight: 900, letterSpacing: 0.5,
              padding: "3px 9px", borderRadius: 999,
              boxShadow: "0 3px 8px rgba(0,0,0,0.25)",
              animation: "dailyChallengeSparkle 1.4s ease-in-out infinite",
            }}>✨ 도전!</span>
            <div style={{ fontSize: 46, flexShrink: 0 }}>🔥</div>
            <div style={{ flex: 1, minWidth: 0, color: "#fff" }}>
              <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.3 }}>
                오늘의 일일 챌린지 도전하기!
              </div>
              <div style={{
                display: "inline-block", marginTop: 5,
                background: "rgba(255,255,255,0.28)", borderRadius: 999,
                padding: "3px 10px", fontSize: 12, fontWeight: 900,
              }}>
                ⚡ 추가 경험치 획득 가능
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4, opacity: 0.95 }}>
                🎧 듣고 찾기 · 소통판 단어 {boardCount}개 + 약점 단어(틀린 단어) {studiedCount}개
              </div>
            </div>
            <div style={{
              background: "rgba(255,255,255,0.28)", color: "#fff",
              fontSize: 15, fontWeight: 900, padding: "10px 16px", borderRadius: 12,
              flexShrink: 0,
            }}>도전 →</div>
          </button>

          {/* 📄 단어 쓰기 학습지 — 손글씨 연습용 인쇄 시트 (보조 버튼) */}
          <button
            onClick={() => setShowWriteSheet(true)}
            style={{
              maxWidth: 760, width: "100%", margin: "0 auto 14px",
              display: "flex", alignItems: "center", gap: 12, textAlign: "left",
              background: "#fff",
              border: "2px solid " + PURPLE + "44",
              borderRadius: 16, padding: "12px 16px",
              cursor: "pointer", fontFamily: "inherit",
              boxShadow: "0 4px 12px rgba(139, 92, 246, 0.12)",
              transition: "transform 0.15s",
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
            onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            <div style={{ fontSize: 30, flexShrink: 0 }}>📄</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: "#1F2937", letterSpacing: -0.2 }}>
                쓰기 학습지 만들기
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", marginTop: 2 }}>
                🖨 핵심 단어를 손으로 따라 쓰는 인쇄용 연습지
              </div>
            </div>
            <div style={{
              background: PURPLE_LIGHT, color: PURPLE_DARK,
              fontSize: 13, fontWeight: 900, padding: "8px 14px", borderRadius: 12,
              flexShrink: 0,
            }}>만들기 →</div>
          </button>
          </>
        );
      })()}

      {viewMode === "tree" ? (
        <SkillTreeView
          learner={learner}
          onStartLesson={(lesson, unit) => setLessonSheet({ lesson, unit })}
        />
      ) : (
      <>

      {/* Test CTA banner */}
      {(() => {
        const studied = Object.values(progress).filter((p) => (p.doneSentences?.length ?? 0) > 0).length;
        const canTest = studied >= 1;
        return (
          <div
            onClick={() => {
              if (!canTest) return;
              const fallback = matched.map((m) => m.wordId);
              const q = buildMixedQuiz(progress, Math.min(5, Math.max(3, studied)), fallback);
              if (q.length > 0) setQuiz(q);
            }}
            style={{
              maxWidth: 760, margin: "0 auto 14px",
              background: canTest
                ? "linear-gradient(135deg, #FDBA74, #F97316)"
                : "#F3F4F6",
              borderRadius: 20,
              padding: "14px 18px",
              display: "flex", alignItems: "center", gap: 14,
              cursor: canTest ? "pointer" : "default",
              boxShadow: canTest ? "0 10px 26px rgba(249, 115, 22, 0.35)" : "none",
              border: canTest ? "none" : "2px dashed #D1D5DB",
              transition: "transform 0.15s",
            }}
            onMouseDown={(e) => canTest && (e.currentTarget.style.transform = "scale(0.98)")}
            onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            <div style={{ fontSize: 40, flexShrink: 0 }}>{canTest ? "📝" : "🔒"}</div>
            <div style={{ flex: 1, minWidth: 0, color: canTest ? "#fff" : "#6B7280" }}>
              <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: -0.3 }}>
                {canTest ? "오늘의 단어 시험" : "아직 시험 볼 수 없어요"}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2, opacity: 0.95 }}>
                {canTest
                  ? `배운 단어 ${studied}개 중에서 빈칸 채우기 · 말하기 or 입력`
                  : "먼저 카드를 열어 예문을 하나라도 완료해 보세요"}
              </div>
            </div>
            {canTest && (
              <div style={{
                background: "rgba(255,255,255,0.25)",
                color: "#fff", fontSize: 14, fontWeight: 900,
                padding: "8px 14px", borderRadius: 12,
                flexShrink: 0,
              }}>시작 →</div>
            )}
          </div>
        );
      })()}

      {/* View mode toggle */}
      <div style={{
        maxWidth: 760, margin: "0 auto 14px",
        display: "flex", gap: 4,
        background: "#fff", padding: 4, borderRadius: 14,
        border: "2px solid " + PURPLE + "22",
      }}>
        {([
          { k: "tree" as const, label: "🌳 단원" },
          { k: "grid" as const, label: t("vocabViewGrid", lang) },
          { k: "notebook" as const, label: t("vocabViewNotebook", lang) },
        ]).map((v) => (
          <button
            key={v.k}
            onClick={() => setViewMode(v.k)}
            style={{
              flex: 1,
              background: viewMode === v.k
                ? "linear-gradient(135deg, " + PURPLE + ", " + PURPLE_DARK + ")"
                : "transparent",
              color: viewMode === v.k ? "#fff" : "#374151",
              border: "none", borderRadius: 10,
              padding: "10px", fontSize: 14, fontWeight: 900,
              cursor: "pointer", fontFamily: "inherit",
              boxShadow: viewMode === v.k ? "0 6px 14px rgba(139, 92, 246, 0.3)" : "none",
            }}
          >{v.label}</button>
        ))}
      </div>

      {viewMode === "notebook" ? (
        <VocabNotebook
          progress={progress}
          stickersEarned={stickersEarned}
          onOpenWord={setOpenWord}
          lang={lang}
        />
      ) : (
      <>

      {/* Board-matched words */}
      <div style={{ maxWidth: 760, margin: "0 auto 14px" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 8, padding: "0 2px",
        }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: PURPLE_DARK }}>
            {t("vocabFromBoard", lang)}
          </div>
          <button
            onClick={runScan}
            disabled={scanState === "scanning" || cardTexts.length === 0}
            style={{
              background: "transparent", border: "1.5px solid " + PURPLE + "66",
              borderRadius: 999, padding: "4px 10px",
              fontSize: 11, fontWeight: 800, color: PURPLE_DARK,
              cursor: scanState === "scanning" ? "default" : "pointer",
              fontFamily: "inherit",
              opacity: cardTexts.length === 0 ? 0.5 : 1,
            }}
          >{scanState === "scanning" ? t("vocabScanning", lang) : t("vocabRefresh", lang)}</button>
        </div>
        {matched.length === 0 ? (
          <div style={{
            background: "#fff", border: "2px dashed " + PURPLE + "44",
            borderRadius: 14, padding: "14px",
            fontSize: 13, color: "#6B7280", fontWeight: 700, textAlign: "center",
          }}>
            {t("vocabFromBoardNone", lang)}
          </div>
        ) : (
          <div style={{
            display: "flex", gap: 10, overflowX: "auto",
            paddingBottom: 6, WebkitOverflowScrolling: "touch",
          }}>
            {matched.map((m) => {
              const w = wordById(m.wordId);
              if (!w) return null;
              const done = wordDoneCount(progress, w.id);
              return (
                <button
                  key={w.id}
                  onClick={() => setOpenWord(w)}
                  style={{
                    flexShrink: 0, width: 108,
                    background: "linear-gradient(145deg, #fff, " + PURPLE_LIGHT + ")",
                    border: "2.5px solid " + PURPLE,
                    borderRadius: 16, padding: "10px 6px",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                    cursor: "pointer", fontFamily: "inherit",
                    boxShadow: "0 6px 14px rgba(139, 92, 246, 0.2)",
                  }}
                >
                  <img
                    src={`/vocab-images/icons/${w.id}.png`}
                    alt=""
                    aria-hidden="true"
                    style={{
                      width: 56, height: 56, objectFit: "contain",
                      background: "rgba(255,255,255,0.7)", borderRadius: 12, padding: 3,
                    }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#1F2937" }}>{w.ko}</div>
                  <div style={{
                    fontSize: 10, fontWeight: 800, color: PURPLE_DARK,
                    letterSpacing: 1,
                  }}>
                    {"★".repeat(Math.max(1, Math.min(5, m.score)))}
                    <span style={{ color: "#E5E7EB" }}>{"★".repeat(5 - Math.max(1, Math.min(5, m.score)))}</span>
                  </div>
                  <div style={{ display: "flex", gap: 2 }}>
                    {[0, 1, 2].map((i) => (
                      <span key={i} style={{
                        width: 5, height: 5, borderRadius: "50%",
                        background: i < done ? PURPLE : "#D1D5DB",
                      }} />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Subcategory tabs */}
      <div style={{
        maxWidth: 760, margin: "0 auto 16px",
        display: "flex", gap: 6, overflowX: "auto",
        paddingBottom: 4, WebkitOverflowScrolling: "touch",
      }}>
        <CatChip
          active={activeSub === "all"}
          onClick={() => setActiveSub("all")}
          icon="✨"
          label={t("vocabAll", lang)}
          count={VOCAB_WORDS.length}
        />
        {SUBCATEGORIES.map((sub) => {
          const count = VOCAB_WORDS.filter((w) => w.subcategory === sub).length;
          return (
            <CatChip
              key={sub}
              active={activeSub === sub}
              onClick={() => setActiveSub(sub)}
              icon={SUB_ICON[sub] ?? "🏷️"}
              label={t("vocabSub_" + sub, lang)}
              count={count}
            />
          );
        })}
      </div>

      {/* Word grid */}
      <div style={{
        maxWidth: 760, margin: "0 auto",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
        gap: 10,
      }}>
        {filteredWords.map((word) => {
          const done = wordDoneCount(progress, word.id);
          const mastered = done >= 3;
          return (
            <button
              key={word.id}
              onClick={() => setOpenWord(word)}
              aria-label={word.ko}
              style={{
                position: "relative",
                background: mastered
                  ? "linear-gradient(145deg, #FEF3C7, #FDE68A)"
                  : "#fff",
                border: mastered
                  ? "2.5px solid #F59E0B"
                  : done > 0
                  ? "2.5px solid " + PURPLE
                  : "2px solid #E5E7EB",
                borderRadius: 18,
                padding: "10px 8px 10px",
                cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                fontFamily: "inherit",
                boxShadow: mastered
                  ? "0 8px 20px rgba(245, 158, 11, 0.25)"
                  : done > 0
                  ? "0 6px 14px rgba(139, 92, 246, 0.2)"
                  : "0 2px 6px rgba(0,0,0,0.04)",
                transition: "transform 0.15s, box-shadow 0.15s",
                minHeight: 130,
              }}
              onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.96)")}
              onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
            >
              <div style={{
                width: 70, height: 70, borderRadius: 16,
                background: mastered ? "rgba(255,255,255,0.7)" : PURPLE_LIGHT,
                display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden",
                padding: 4,
              }}>
                <img
                  src={`/vocab-images/icons/${word.id}.png`}
                  alt=""
                  aria-hidden="true"
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              </div>
              <div style={{
                fontSize: 14, fontWeight: 900, color: "#1F2937", letterSpacing: -0.2,
                textAlign: "center", lineHeight: 1.1,
              }}>{word.ko}</div>

              {/* 3-dot progress */}
              <div style={{ display: "flex", gap: 3 }}>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: i < done ? (mastered ? "#F59E0B" : PURPLE) : "#D1D5DB",
                    }}
                  />
                ))}
              </div>

              {mastered && (
                <div style={{
                  position: "absolute", top: 6, right: 6,
                  fontSize: 14,
                }}>🏆</div>
              )}
            </button>
          );
        })}
      </div>
      </>
      )}
      </>
      )}

      {/* 레슨 시작 시트 — 단어 카드 공부 / 시험 선택 */}
      {lessonSheet && !studyQueue && !quiz && (
        <div
          onClick={() => setLessonSheet(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 600,
            background: "rgba(15,10,40,0.55)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 18,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(420px, 100%)",
              background: "#fff", borderRadius: 24,
              border: `4px solid ${lessonSheet.unit.color}`,
              boxShadow: "0 20px 50px rgba(0,0,0,0.4)",
              padding: "20px 18px", textAlign: "center",
            }}
          >
            <BeeMascot size={84} mood="welcome" />
            <div style={{ fontSize: 18, fontWeight: 900, color: "#1F2937", margin: "8px 0 2px" }}>
              {lessonSheet.unit.emoji} {lessonSheet.unit.title} · {lessonSheet.lesson.title}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 12 }}>
              이번 레슨에서 배우는 단어
            </div>
            {/* 단어 미리보기 */}
            <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", marginBottom: 16 }}>
              {wordsForLesson(lessonSheet.lesson.id).map((w) => (
                <div key={w.id} style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                  background: PURPLE_LIGHT, borderRadius: 12, padding: "8px 6px", width: 64,
                }}>
                  <img
                    src={`/vocab-images/icons/${w.id}.png`}
                    alt=""
                    aria-hidden="true"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    style={{ width: 36, height: 36, objectFit: "contain" }}
                  />
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#374151" }}>{w.ko}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                onClick={() => {
                  const words = wordsForLesson(lessonSheet.lesson.id);
                  if (words.length > 0) { setStudyQueue(words); setStudyIdx(0); }
                }}
                style={{
                  background: "linear-gradient(135deg, #FBBF24, #F59E0B)",
                  color: "#fff", border: "none", borderRadius: 16,
                  padding: "14px", fontSize: 16, fontWeight: 900, cursor: "pointer",
                  boxShadow: "0 6px 16px rgba(245,158,11,0.4)",
                }}
              >📖 단어 카드 공부 (그림·상황 카드)</button>
              <button
                onClick={() => {
                  const q = buildLessonQuiz(lessonSheet.lesson.id);
                  if (q.length > 0) {
                    setLessonContext({
                      id: lessonSheet.lesson.id,
                      title: `${lessonSheet.unit.emoji} ${lessonSheet.unit.title} · ${lessonSheet.lesson.title}`,
                    });
                    setQuiz(q);
                    setLessonSheet(null);
                  }
                }}
                style={{
                  background: `linear-gradient(135deg, ${PURPLE}, ${PURPLE_DARK})`,
                  color: "#fff", border: "none", borderRadius: 16,
                  padding: "14px", fontSize: 16, fontWeight: 900, cursor: "pointer",
                  boxShadow: `0 6px 16px ${PURPLE}55`,
                }}
              >⚡ 시험 보기 (XP 도전!)</button>
              <button
                onClick={() => setLessonSheet(null)}
                style={{
                  background: "#F3F4F6", color: "#6B7280", border: "none",
                  borderRadius: 14, padding: "10px", fontSize: 13, fontWeight: 800, cursor: "pointer",
                }}
              >닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 레슨 단어 카드 순차 학습 (상황 카드 3장씩) */}
      {studyQueue && studyQueue[studyIdx] && (
        <>
          <VocabCard
            key={studyQueue[studyIdx].id}
            word={studyQueue[studyIdx]}
            lang={lang}
            doneSentences={progress[studyQueue[studyIdx].id]?.doneSentences ?? []}
            onSentenceDone={(idx) => persist(
              markSentenceDone(progress, studyQueue[studyIdx].id, idx),
              { checkRewards: true, touchedWordId: studyQueue[studyIdx].id },
            )}
            onListenBump={() => persist(
              bumpListen(progress, studyQueue[studyIdx].id),
              { touchedWordId: studyQueue[studyIdx].id },
            )}
            onClose={() => {
              if (studyIdx + 1 < studyQueue.length) setStudyIdx((i) => i + 1);
              else setStudyQueue(null); // 끝 — 레슨 시트로 복귀 (시험 보기 유도)
            }}
            roomCode={roomCode}
            clientId={user.myName}
          />
          {/* 진행 배지 — 닫기(✕)가 "다음 단어"로 동작함을 안내 */}
          <div style={{
            position: "fixed", top: 14, left: "50%", transform: "translateX(-50%)",
            zIndex: 1300, pointerEvents: "none",
            background: "#1F2937", color: "#fff",
            borderRadius: 999, padding: "7px 16px",
            fontSize: 13, fontWeight: 900,
            boxShadow: "0 8px 20px rgba(0,0,0,0.35)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            🐝 {studyIdx + 1} / {studyQueue.length}
            <span style={{ fontWeight: 700, color: "#FDE68A" }}>
              {studyIdx + 1 < studyQueue.length ? "✕ 누르면 다음 단어" : "마지막 단어!"}
            </span>
          </div>
        </>
      )}

      {/* Study modal */}
      {openWord && (
        <VocabCard
          word={openWord}
          lang={lang}
          doneSentences={progress[openWord.id]?.doneSentences ?? []}
          onSentenceDone={(idx) => persist(
            markSentenceDone(progress, openWord.id, idx),
            { checkRewards: true, touchedWordId: openWord.id },
          )}
          onListenBump={() => persist(
            bumpListen(progress, openWord.id),
            { touchedWordId: openWord.id },
          )}
          onClose={() => setOpenWord(null)}
          roomCode={roomCode}
          clientId={user.myName}
        />
      )}

      {/* Expression review modal */}
      {reviewOpen && (
        <ExpressionReview
          roomCode={roomCode}
          clientId={user.myName}
          studentName={user.myName}
          studentLang={user.myLang}
          onClose={() => setReviewOpen(false)}
        />
      )}

      {/* 단어 쓰기 학습지 모달 */}
      {showWriteSheet && (
        <VocabWriteSheet
          words={worksheetWords}
          onClose={() => setShowWriteSheet(false)}
          studentName={user.myName}
        />
      )}

      {/* Test modal */}
      {quiz && (
        <VocabTest
          questions={quiz}
          roomCode={roomCode}
          clientId={user.myName}
          studentName={user.myName}
          lessonId={lessonContext?.id}
          lessonTitle={lessonContext?.title}
          onWordResult={(wordId, passed) => {
            persist(markTestResult(progress, wordId, passed), {
              touchedWordId: wordId,
              checkRewards: passed,
            });
          }}
          onClose={() => { setQuiz(null); setLessonContext(null); }}
        />
      )}

      {/* Reward celebration banner */}
      {currentAward && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
            zIndex: 1200,
            background: "linear-gradient(135deg, #FDE68A, #F59E0B)",
            color: "#78350F",
            borderRadius: 20, padding: "14px 22px",
            fontSize: 15, fontWeight: 900, letterSpacing: -0.2,
            boxShadow: "0 14px 40px rgba(245, 158, 11, 0.5)",
            display: "flex", alignItems: "center", gap: 10,
            animation: "rewardPop 0.4s ease",
            maxWidth: "90vw",
          }}
        >
          <span style={{ fontSize: 24 }}>🏆</span>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 1, opacity: 0.8 }}>스티커 획득</div>
            <div>{currentAward.label}</div>
          </div>
        </div>
      )}

      {/* 데일리 골 자동 조정 토스트 */}
      {goalToast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed", top: 20, left: "50%",
            transform: "translateX(-50%)",
            background: "linear-gradient(135deg, " + PURPLE + ", " + PURPLE_DARK + ")",
            color: "#fff",
            padding: "12px 20px", borderRadius: 999,
            fontSize: 14, fontWeight: 900,
            boxShadow: "0 10px 28px rgba(109,40,217,0.45)",
            zIndex: 1500,
            animation: "goalToastIn 0.35s ease",
            maxWidth: "90vw",
            textAlign: "center",
          }}
        >
          {goalToast}
        </div>
      )}

      <style>{`
        @keyframes rewardPop {
          0% { transform: translate(-50%, -80px) scale(0.6); opacity: 0; }
          60% { transform: translate(-50%, 0) scale(1.05); opacity: 1; }
          100% { transform: translate(-50%, 0) scale(1); }
        }
        @keyframes goalToastIn {
          0% { transform: translate(-50%, -40px); opacity: 0; }
          60% { transform: translate(-50%, 4px); opacity: 1; }
          100% { transform: translate(-50%, 0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function LearnerHUD({ learner, now }: { learner: LearnerState | null; now: number }) {
  const xp = learner?.xp ?? 0;
  const level = levelFromXp(xp);
  const next = xpToNextLevel(xp);
  const hearts = learner ? effectiveHearts(learner, now) : MAX_HEARTS;
  const streak = learner?.streak ?? 0;
  const today = (() => {
    if (!learner) return 0;
    const d = new Date();
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return learner.dailyXpDate === k ? learner.dailyXp : 0;
  })();
  const goal = learner?.dailyGoal ?? 50;
  const heartMs = learner ? msUntilNextHeart(learner, now) : 0;
  const heartMin = Math.floor(heartMs / 60000);
  const heartSec = Math.floor((heartMs % 60000) / 1000);

  return (
    <div style={{
      maxWidth: 760, margin: "0 auto 14px",
      display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8,
    }}>
      {/* 하트 */}
      <div style={{
        background: "#fff", borderRadius: 14, padding: "10px 12px",
        border: "2px solid #FCA5A5",
        display: "flex", flexDirection: "column", gap: 2,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 18 }}>❤️</span>
          <span style={{ fontSize: 18, fontWeight: 900, color: "#B91C1C" }}>{hearts}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF" }}>/ {MAX_HEARTS}</span>
        </div>
        {hearts < MAX_HEARTS && heartMs > 0 && (
          <div style={{ fontSize: 10, fontWeight: 700, color: "#6B7280" }}>
            다음 +1: {heartMin}:{String(heartSec).padStart(2, "0")}
          </div>
        )}
      </div>

      {/* 스트릭 */}
      <div style={{
        background: streak > 0
          ? "linear-gradient(135deg, #FB923C, #EA580C)"
          : "#fff",
        color: streak > 0 ? "#fff" : "#374151",
        borderRadius: 14, padding: "10px 12px",
        border: streak > 0 ? "none" : "2px solid #FED7AA",
        display: "flex", flexDirection: "column", gap: 2,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 18 }}>🔥</span>
          <span style={{ fontSize: 18, fontWeight: 900 }}>{streak}</span>
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.85 }}>연속 학습</div>
      </div>

      {/* XP + 데일리 골 */}
      <div style={{
        background: "#fff", borderRadius: 14, padding: "10px 12px",
        border: "2px solid " + PURPLE + "55",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
          <span style={{ fontSize: 13 }}>⚡</span>
          <span style={{ fontSize: 13, fontWeight: 900, color: PURPLE_DARK }}>Lv.{level}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", marginLeft: "auto" }}>
            {next.current}/{next.needed}
          </span>
        </div>
        <div style={{ height: 6, background: PURPLE_LIGHT, borderRadius: 999, overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: `${Math.round(next.ratio * 100)}%`,
            background: "linear-gradient(90deg, " + PURPLE + ", " + PURPLE_DARK + ")",
          }} />
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#6B7280", marginTop: 4 }}>
          🎯 오늘 {today}/{goal} XP
        </div>
      </div>
    </div>
  );
}

function SkillTreeView({
  learner, onStartLesson,
}: {
  learner: LearnerState | null;
  onStartLesson: (lesson: Lesson, unit: Unit) => void;
}) {
  const units = getUnits();
  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "0 4px 30px" }}>
      {units.map((unit, ui) => {
        const completedStars = unit.lessons.reduce((acc, l) => acc + (learner?.lessons?.[l.id]?.stars ?? 0), 0);
        const maxStars = unit.lessons.length * 3;
        const completedLessons = unit.lessons.filter((l) => learner?.lessons?.[l.id]).length;
        // 다음 미해결 레슨이 unlocked. 이전 단원의 마지막 레슨이 done 이어야 다음 단원 unlock
        const prevUnitDone = ui === 0 ? true : units[ui - 1].lessons.every((l) => learner?.lessons?.[l.id]);
        return (
          <div key={unit.id} style={{
            marginBottom: 24, position: "relative",
            opacity: prevUnitDone ? 1 : 0.55,
          }}>
            {/* 단원 헤더 배너 */}
            <div style={{
              background: `linear-gradient(135deg, ${unit.color}, ${unit.color}dd)`,
              color: "#fff", borderRadius: 18, padding: "14px 18px",
              display: "flex", alignItems: "center", gap: 12, marginBottom: 14,
              boxShadow: `0 8px 20px ${unit.color}55`,
            }}>
              <div style={{ fontSize: 32 }}>{unit.emoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.9 }}>단원 {ui + 1}</div>
                <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: -0.3 }}>{unit.title}</div>
                <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.9, marginTop: 2 }}>
                  {completedLessons} / {unit.lessons.length} 레슨 · ⭐ {completedStars}/{maxStars}
                </div>
              </div>
            </div>

            {/* 레슨 노드 — 지그재그 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {unit.lessons.map((lesson, li) => {
                const res = learner?.lessons?.[lesson.id];
                const done = !!res;
                const stars = res?.stars ?? 0;
                // 이전 레슨이 done 이거나 첫 레슨이거나 단원 첫 노드 → unlocked
                const prevLessonDone = li === 0 ? prevUnitDone : !!learner?.lessons?.[unit.lessons[li - 1].id];
                const unlocked = prevLessonDone;
                const offset = li % 2 === 0 ? -40 : 40;
                return (
                  <div key={lesson.id} style={{
                    display: "flex", justifyContent: "center",
                    transform: `translateX(${offset}px)`,
                  }}>
                    <button
                      onClick={() => unlocked && onStartLesson(lesson, unit)}
                      disabled={!unlocked}
                      title={lesson.title}
                      style={{
                        width: 92, height: 92, borderRadius: "50%",
                        border: done ? `4px solid ${unit.color}` : unlocked ? `4px solid ${unit.color}88` : "4px solid #D1D5DB",
                        background: !unlocked
                          ? "#F3F4F6"
                          : done
                            ? `radial-gradient(circle at 35% 30%, ${unit.color}ee, ${unit.color}88)`
                            : `radial-gradient(circle at 35% 30%, #fff, ${unit.color}33)`,
                        color: done ? "#fff" : unlocked ? unit.color : "#9CA3AF",
                        cursor: unlocked ? "pointer" : "not-allowed",
                        fontFamily: "inherit",
                        boxShadow: unlocked ? `0 8px 16px ${unit.color}44, inset 0 -4px 0 rgba(0,0,0,0.12)` : "none",
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                        transition: "transform 0.12s",
                        position: "relative",
                      }}
                      onMouseDown={(e) => { if (unlocked) e.currentTarget.style.transform = "scale(0.94)"; }}
                      onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                    >
                      <div style={{ fontSize: 28, lineHeight: 1 }}>
                        {!unlocked ? "🔒" : done ? "✓" : lesson.index}
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 900, marginTop: 2 }}>레슨 {lesson.index}</div>

                      {/* 별 표시 */}
                      {unlocked && (
                        <div style={{
                          position: "absolute", bottom: -14, left: "50%", transform: "translateX(-50%)",
                          display: "flex", gap: 1,
                        }}>
                          {[1, 2, 3].map((s) => (
                            <span key={s} style={{
                              fontSize: 14,
                              opacity: s <= stars ? 1 : 0.25,
                              filter: s <= stars ? "drop-shadow(0 2px 3px rgba(245,158,11,0.5))" : "none",
                            }}>⭐</span>
                          ))}
                        </div>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CatChip({
  active, onClick, icon, label, count,
}: { active: boolean; onClick: () => void; icon: string; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        background: active
          ? "linear-gradient(135deg, " + PURPLE + ", " + PURPLE_DARK + ")"
          : "#fff",
        color: active ? "#fff" : "#374151",
        border: active ? "none" : "2px solid #E5E7EB",
        borderRadius: 999,
        padding: "8px 14px",
        fontSize: 13, fontWeight: 800,
        cursor: "pointer", fontFamily: "inherit",
        display: "flex", alignItems: "center", gap: 6,
        boxShadow: active ? "0 6px 14px rgba(139, 92, 246, 0.35)" : "none",
        whiteSpace: "nowrap",
      }}
    >
      <span>{icon}</span>
      <span>{label}</span>
      <span style={{
        background: active ? "rgba(255,255,255,0.25)" : "#F3F4F6",
        color: active ? "#fff" : "#6B7280",
        borderRadius: 999, padding: "1px 7px", fontSize: 11, fontWeight: 900,
      }}>{count}</span>
    </button>
  );
}
