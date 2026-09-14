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
import ScopedStyle from "./ui/child/ScopedStyle";
import MoodArt from "./ui/child/MoodArt";
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
import DictationSheetModal from "./DictationSheetModal";
import TeacherVocabDashboard from "./TeacherVocabDashboard";

/**
 * U07 — 보라는 "단어 배우기" 의 정체성 색이지만 면을 통째로 칠하면 화면이
 * 보라로 덮인다(사용자 지적). 가는 강조에만 남기고 면·글자는 공통 토큰을 쓴다.
 * VocabCard 와 같은 규칙이라 두 화면이 따로 놀지 않는다.
 */
const ACCENT = "var(--c-vocab)";
const PURPLE = ACCENT;                           /* 옛 이름 유지 — 호출부가 많다 */
const PURPLE_DARK = "var(--ux-ink)";
const PURPLE_LIGHT = "var(--ux-surface-sunk)";
const INK_STRONG = "var(--ux-ink)";
const INK_SOFT = "var(--ux-ink-soft)";
const OK_INK = "var(--ok-text)";

/** `accentAlpha(40)` 같은 hex 알파 이어붙이기는 var() 에서 깨진다. */
const accentAlpha = (pct: number) => `color-mix(in srgb, ${ACCENT} ${pct}%, transparent)`;

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

/**
 * 개발용 fixture 주입구 (HARNESS §2 G0). 값이 있으면 이 화면은 Firebase 를
 * 구독하지도, 쓰지도 않고 /api/* 도 부르지 않는다. 운영 방(1111)의 학생 진도·
 * 표현 기록을 fixture 로 복제하지 않는다 — 여기 값은 전부 지어낸 것이다.
 */
export interface VocabFixture {
  progress?: ProgressMap;
  learner?: LearnerState | null;
  expressions?: ExpressionEntry[];
  /** 소통창에서 긁어온 문장. 자동 스캔은 서버 대신 로컬 추출로만 돈다. */
  cardTexts?: string[];
  stickersEarned?: number;
  /**
   * 하위 학습 화면을 바로 열어 검수할 수 있게 하는 초기 상태.
   * 이 화면들은 홈에서 여러 번 눌러야 도달해 캡처가 불안정하다.
   *   detail   = 단어 상세(VocabCard)
   *   notebook = 내 단어장
   *   write    = 쓰기 학습지
   *   quiz     = 문제 풀기(VocabTest)
   *   review   = 표현 복습
   */
  openView?: "detail" | "notebook" | "write" | "quiz" | "review";
  /** openView="detail" 일 때 열 단어. 없으면 첫 단어. */
  openWordId?: string;
}

interface Props {
  user: UserConfig;
  roomCode: string;
  onBack: () => void;
  fixture?: VocabFixture;
}

export default function VocabHub({ user, roomCode, onBack, fixture }: Props) {
  /** fixture 가 주입되면 네트워크 경계를 통째로 끈다. */
  const offline = !!fixture;
  const lang = user.myLang;
  const [progress, setProgress] = useState<ProgressMap>(fixture?.progress ?? {});
  const [activeSub, setActiveSub] = useState<string | "all">("all");
  const [openWord, setOpenWord] = useState<VocabWord | null>(
    fixture?.openView === "detail"
      ? (VOCAB_WORDS.find((w) => w.id === fixture.openWordId) ?? VOCAB_WORDS[0])
      : null,
  );

  // 소통창 카드 텍스트 수집
  const [cardTexts, setCardTexts] = useState<string[]>(fixture?.cardTexts ?? []);
  const [matched, setMatched] = useState<MatchedWord[]>([]);
  const [scanState, setScanState] = useState<"idle" | "scanning" | "error">("idle");
  const scanOnce = useRef(false);

  // 자동 보상 축하 큐
  const [awardQueue, setAwardQueue] = useState<RewardRule[]>([]);
  const [stickersEarned, setStickersEarned] = useState(fixture?.stickersEarned ?? 0);

  // 뷰 모드 (트리 / 그리드 / 단어장) — 듀오링고 스타일 트리가 기본
  const [viewMode, setViewMode] = useState<"tree" | "grid" | "notebook">(
    fixture?.openView === "notebook" ? "notebook" : "tree",
  );

  // 시험
  const [quiz, setQuiz] = useState<QuizItem[] | null>(
    fixture?.openView === "quiz"
      ? buildDailyChallenge(fixture.progress ?? {}, [], 10)
      : null,
  );
  const [lessonContext, setLessonContext] = useState<{ id: string; title: string } | null>(null);
  // 레슨 시작 시트 — 단어 카드 공부(상황 카드) ↔ 시험 선택
  const [lessonSheet, setLessonSheet] = useState<{ lesson: Lesson; unit: Unit } | null>(null);
  const [studyQueue, setStudyQueue] = useState<VocabWord[] | null>(null);
  const [studyIdx, setStudyIdx] = useState(0);
  const [teacherView, setTeacherView] = useState(false);
  const [learner, setLearner] = useState<LearnerState | null>(fixture?.learner ?? null);
  const [now, setNow] = useState(Date.now());
  const [goalToast, setGoalToast] = useState<string | null>(null);
  const goalAdjustedRef = useRef(false);
  const [expressions, setExpressions] = useState<ExpressionEntry[]>(fixture?.expressions ?? []);
  const [reviewOpen, setReviewOpen] = useState(fixture?.openView === "review");
  const [showWriteSheet, setShowWriteSheet] = useState(fixture?.openView === "write");
  const [showDictation, setShowDictation] = useState(false);

  useEffect(() => {
    if (offline) return;
    const unsub = subscribeLearner(roomCode, user.myName, setLearner);
    return unsub;
  }, [offline, roomCode, user.myName]);

  useEffect(() => {
    if (offline) return;
    const unsub = subscribeExpressions(roomCode, user.myName, setExpressions);
    return unsub;
  }, [offline, roomCode, user.myName]);

  // 하트 회복 카운트다운 1초마다
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // 단어카드 진입 시 1회 — 최근 학습 데이터로 데일리 골 자동 조정
  useEffect(() => {
    if (offline) return;
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
  }, [offline, learner, roomCode, user.myName]);

  useEffect(() => {
    if (offline) return;
    setProgress(loadProgress(roomCode, user.myName));
  }, [offline, roomCode, user.myName]);

  // Firebase 진행도 구독 — 원격 변경을 로컬과 머지 (doneSentences 합집합, 최대 lastStudied)
  useEffect(() => {
    if (offline) return;
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
  }, [offline, roomCode, user.myName]);

  // 받은 vocab 스티커 수 (지급 기록 개수)
  useEffect(() => {
    if (offline) return;
    let cancelled = false;
    getAwardedIds(roomCode, user.myName).then((s) => {
      if (!cancelled) setStickersEarned(s.size);
    });
    return () => { cancelled = true; };
  }, [offline, roomCode, user.myName, awardQueue.length]); // 큐 변경 시 새로고침

  // Hub 마운트 시 30일 넘은 녹음 정리 (백그라운드, 1회)
  useEffect(() => {
    if (offline) return;
    cleanupExpiredRecordings(roomCode, user.myName).catch(() => { /* silent */ });
  }, [offline, roomCode, user.myName]);

  // 카드 구독 — originalText + translations.ko 수집
  useEffect(() => {
    if (offline) return;
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
  }, [offline, roomCode]);

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
    // fixture 에서는 서버를 부르지 않는다 — 같은 로컬 추출기로만 채운다.
    if (offline) { setMatched(extractVocabLocal(cardTexts, 12)); setScanState("idle"); return; }
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
    // fixture 에서는 화면 상태만 움직이고 localStorage/Firebase/보상은 건드리지 않는다.
    if (offline) return;
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
  /** 진도가 하나라도 있는가. 첫 학생에게 0 으로 채운 상태 배지를 보이지 않기 위한 판단(U07). */
  const hasAnyProgress = useMemo(
    () => Object.values(progress).some(
      (p) => (p.doneSentences?.length ?? 0) > 0 || (p.listenCount ?? 0) > 0 || (p.testPassed ?? 0) > 0,
    ),
    [progress],
  );

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
        /* 학생 화면과 같은 꿀색 바닥. 선생님 화면만 라벤더면 같은 앱으로 안 보인다. */
        background: "linear-gradient(180deg, var(--ux-bg) 0%, var(--ux-surface-sunk) 100%)",
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
      /* 🐝 꽃밭 풍경 배경.
         예전 오버레이는 라벤더(#FAF5FF→#EDE9FE)라 화면 바닥 전체가 보라였다.
         앱은 꿀색(크림·허니옐로우·코코아)인데 이 화면만 보랏빛으로 떠 보인
         가장 큰 원인이다(사용자 지적: "톤 맞춰"). 전자 도서관(SBL_CSS)과 같이
         크림 막을 덮는다 — 배경이 예뻐도 글을 못 읽으면 소용이 없다. */
      background: "linear-gradient(rgba(255,249,237,0.82), rgba(253,243,224,0.88)), url('/landing/board-meadow.webp') center / cover no-repeat",
      backgroundAttachment: "fixed",
      fontFamily: "'Pretendard Variable', 'Pretendard', 'Noto Sans KR', sans-serif",
      padding: "16px 14px 40px",
      position: "relative",
    }}>
      {/* Header */}
      <div data-tutorial-id="vocab-header" style={{
        maxWidth: 760, margin: "0 auto",
        display: "flex", alignItems: "center", gap: 12,
        background: "#fff", borderRadius: 20, padding: "12px 16px",
        border: "2px solid " + accentAlpha(20),
        boxShadow: "0 8px 24px rgba(137,83,0,.14)",
        marginBottom: 18,
      }}>
        {/* U07/U09: 태블릿 터치 기준을 만족해야 한다. 예전에는 64x32px 라
            손가락으로 누르기 어려웠다. data-ux-role="control" 이 토큰의
            최소 크기(터치 48px / 마우스 44px)를 걸어 준다. */}
        <button
          onClick={onBack}
          aria-label="뒤로"
          data-ux-role="control"
          style={{
            background: PURPLE_LIGHT, border: "none",
            fontWeight: 700, color: PURPLE_DARK,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >{t("vocabBack", lang)}</button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "var(--ux-font-body-emphasis)", fontWeight: 800, color: INK_STRONG, letterSpacing: -0.3 }}>
            📚 {t("hubSectionVocab", lang)}
          </div>
          {/* U07: 아직 아무것도 안 한 학생에게 '0/100 완료' 를 먼저 보여주지
              않는다. 진도가 생기면 그때 나타난다. */}
          {hasAnyProgress && (
            <div data-ux-role="secondary" style={{ marginTop: 2 }}>
              {tFmt("vocabProgress", lang, { done: masteredTotal, total: VOCAB_WORDS.length })}
            </div>
          )}
        </div>

        {isTeacher && (
          <button
            onClick={() => setTeacherView(true)}
            data-ux-role="control"
            style={{
              background: "var(--ux-primary-fill)",
              color: "#fff", border: "none",
              fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
              boxShadow: "0 4px 10px " + accentAlpha(33),
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
              data-ux-role="control"
              style={{
                position: "relative",
                background: dueCount > 0
                  ? "linear-gradient(135deg, #FB923C, #EA580C)"
                  : PURPLE_LIGHT,
                color: dueCount > 0 ? "#fff" : PURPLE_DARK,
                border: "none",
                fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
                boxShadow: dueCount > 0 ? "0 4px 12px rgba(234,88,12,0.45)" : "none",
              }}
            >
              📝 표현
              {dueCount > 0 && (
                <span style={{
                  position: "absolute", top: -6, right: -6,
                  background: "#fff", color: "#EA580C",
                  fontSize: "var(--ux-font-secondary)", fontWeight: 800,
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
          color: INK_STRONG, fontSize: "var(--ux-font-label)", fontWeight: 800,
          padding: "8px 14px", borderRadius: 14,
          boxShadow: "0 4px 10px rgba(245,158,11,0.35)",
        }}>
          🏆 {masteredTotal}
        </div>
      </div>

      {/* HUD: 하트 / 스트릭 / XP.
          U07: 진도가 하나도 없는 첫 학생에게는 그리지 않는다. 0/100·Lv.0 0/50·
          오늘 0/20 XP·연속 0 처럼 0 으로 채운 배지가 학습보다 먼저 나오면
          '내가 아무것도 안 한 화면' 이 첫인상이 된다. */}
      {hasAnyProgress && <LearnerHUD learner={learner} now={now} />}

      {/* 나의 단어 챌린지 — 소통판 단어 + 약점 단어 릴레이.
          U07: 예전에는 낼 문제가 0개여도 화면에서 가장 강한 색(주황→핑크
          그라디언트 + 무한 pulse + 반짝이는 '도전!' 리본)으로 항상 광고했다.
          진도 0 인 학생에게 '소통판 단어 0개 + 약점 단어 0개' 를 권하고,
          눌러도 아무 일이 없었다(q.length > 0 가드 때문에 조용히 무시).
          이제 실제로 낼 문제가 있을 때만 그리고, 강조는 단원 카드보다 낮춘다. */}
      {(() => {
        const boardIds = matched.map((m) => m.wordId);
        // 이 챌린지는 정의상 '내' 단어다 — 소통판에서 걸린 단어 + 내가 틀린
        // 단어. 둘 다 없으면 buildDailyChallenge 가 기본 단어로 채워 문제 수는
        // 0 이 아니지만, 그건 '나의 챌린지' 가 아니라 아무 단어 묶음이다.
        // 첫 학생에게 그걸 권하지 않는다. 출처가 생기면 그때 나타난다.
        const hasOwnSource = boardIds.length > 0 || hasAnyProgress;
        const items = hasOwnSource ? buildDailyChallenge(progress, boardIds, 10) : [];
        if (items.length === 0) return null;
        const startDailyChallenge = () => {
          setLessonContext({ id: "daily-challenge", title: "나의 단어 챌린지" });
          setQuiz(items);
        };
        return (
          <>
          <button
            onClick={startDailyChallenge}
            style={{
              position: "relative",
              maxWidth: 760, width: "100%", margin: "0 auto 14px",
              display: "flex", alignItems: "center", gap: 12, textAlign: "left",
              background: "#fff",
              border: "2px solid var(--ux-primary-border)",
              borderRadius: 16, padding: "12px 16px",
              cursor: "pointer", fontFamily: "inherit",
              boxShadow: "0 4px 12px rgba(137,83,0,0.12)",
              transition: "transform 0.15s",
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
            onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            <div aria-hidden style={{ fontSize: "var(--ux-font-title)", flexShrink: 0 }}>🎧</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div data-ux-role="label" style={{ fontWeight: 700, color: "var(--ux-ink)" }}>
                나의 단어 챌린지
              </div>
              <div data-ux-role="secondary" style={{ marginTop: 2 }}>
                듣고 찾기 {items.length}문제
              </div>
            </div>
            <div style={{
              background: "var(--ux-primary-fill)", color: "var(--ux-primary-ink)",
              border: "2px solid var(--ux-primary-border)",
              fontSize: "var(--ux-font-label)", fontWeight: 700,
              padding: "8px 14px", borderRadius: 12, flexShrink: 0,
            }}>시작 →</div>
          </button>

          {/* 🖨 오프라인 학습지 — 2분화: 단어 쓰기(모두) / 받아쓰기 테마별(교사 전용) */}
          <div style={{
            maxWidth: 760, width: "100%", margin: "0 auto 14px",
            display: "grid",
            gridTemplateColumns: isTeacher ? "1fr 1fr" : "1fr",
            gap: 10,
          }}>
            <button
              onClick={() => setShowWriteSheet(true)}
              style={{
                display: "flex", alignItems: "center", gap: 12, textAlign: "left",
                background: "#fff",
                border: "2px solid " + accentAlpha(27),
                borderRadius: 16, padding: "12px 16px",
                cursor: "pointer", fontFamily: "inherit",
                boxShadow: "0 4px 12px rgba(139, 92, 246, 0.12)",
                transition: "transform 0.15s",
              }}
              onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
              onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
            >
              <div style={{ fontSize: "var(--ux-font-title)", flexShrink: 0 }}>📄</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "var(--ux-font-label)", fontWeight: 800, color: INK_STRONG, letterSpacing: -0.2 }}>
                  쓰기 학습지 만들기
                </div>
                <div style={{ fontSize: "var(--ux-font-secondary)", fontWeight: 700, color: INK_SOFT, marginTop: 2 }}>
                  🖨 핵심 단어를 손으로 따라 쓰는 인쇄용 연습지
                </div>
              </div>
              <div style={{
                background: PURPLE_LIGHT, color: PURPLE_DARK,
                fontSize: "var(--ux-font-secondary)", fontWeight: 800, padding: "8px 14px", borderRadius: 12,
                flexShrink: 0,
              }}>만들기 →</div>
            </button>

            {isTeacher && (
              <button
                onClick={() => setShowDictation(true)}
                style={{
                  display: "flex", alignItems: "center", gap: 12, textAlign: "left",
                  background: "#fff",
                  border: "2px solid #F9731644",
                  borderRadius: 16, padding: "12px 16px",
                  cursor: "pointer", fontFamily: "inherit",
                  boxShadow: "0 4px 12px rgba(249, 115, 22, 0.12)",
                  transition: "transform 0.15s",
                }}
                onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
                onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
              >
                <div style={{ fontSize: "var(--ux-font-title)", flexShrink: 0 }}>✏️</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "var(--ux-font-label)", fontWeight: 800, color: INK_STRONG, letterSpacing: -0.2 }}>
                    받아쓰기 학습지 <span style={{ fontSize: "var(--ux-font-secondary)", fontWeight: 800, color: "#C2410C", background: "#FFF7ED", padding: "2px 6px", borderRadius: 999, verticalAlign: "middle" }}>교사</span>
                  </div>
                  <div style={{ fontSize: "var(--ux-font-secondary)", fontWeight: 700, color: INK_SOFT, marginTop: 2 }}>
                    🖨 테마별 15챕터 + 오답노트 · 받침 단어 따라 쓰기
                  </div>
                </div>
                <div style={{
                  background: "#FFF7ED", color: "#C2410C",
                  fontSize: "var(--ux-font-secondary)", fontWeight: 800, padding: "8px 14px", borderRadius: 12,
                  flexShrink: 0,
                }}>열기 →</div>
              </button>
            )}
          </div>
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

      {/* 오늘의 단어 시험 (U07)
          예전 문제 셋:
           1) <div> 에 onClick 이라 키보드로 갈 수 없었다.
           2) 주황 그라디언트 + 강한 그림자로 단원 카드보다 강조가 셌다.
           3) 배울 단어가 없을 때 '아직 시험 볼 수 없어요 / 먼저 카드를 열어…'
              라는 **잠금 배너**가 첫 화면의 큰 자리를 차지했다. 아이에게 지금
              할 수 없는 일을 먼저 알리는 자리다 — 0개 챌린지와 같은 문제다.
          이제 볼 수 있을 때만 그리고, 챌린지 행과 같은 흰 카드 + 꿀빛 테두리를 쓴다. */}
      {(() => {
        const studied = Object.values(progress).filter((p) => (p.doneSentences?.length ?? 0) > 0).length;
        if (studied < 1) return null;
        return (
          <button
            type="button"
            onClick={() => {
              const fallback = matched.map((m) => m.wordId);
              const q = buildMixedQuiz(progress, Math.min(5, Math.max(3, studied)), fallback);
              if (q.length > 0) setQuiz(q);
            }}
            style={{
              maxWidth: 760, width: "100%", margin: "0 auto 14px",
              background: "#fff",
              border: "2px solid var(--ux-primary-border)",
              borderRadius: 16, padding: "12px 16px",
              display: "flex", alignItems: "center", gap: 12, textAlign: "left",
              cursor: "pointer", fontFamily: "inherit",
              boxShadow: "0 4px 12px rgba(137,83,0,0.12)",
              transition: "transform 0.15s",
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
            onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            <div aria-hidden style={{ fontSize: "var(--ux-font-title)", flexShrink: 0 }}>📝</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div data-ux-role="label" style={{ fontWeight: 700, color: "var(--ux-ink)" }}>
                오늘의 단어 시험
              </div>
              <div data-ux-role="secondary" style={{ marginTop: 2 }}>
                배운 단어 {studied}개 중에서 빈칸 채우기
              </div>
            </div>
            <div style={{
              background: "var(--ux-primary-fill)", color: "var(--ux-primary-ink)",
              border: "2px solid var(--ux-primary-border)",
              fontSize: "var(--ux-font-label)", fontWeight: 700,
              padding: "8px 14px", borderRadius: 12, flexShrink: 0,
            }}>시작 →</div>
          </button>
        );
      })()}

      {/* View mode toggle */}
      <div style={{
        maxWidth: 760, margin: "0 auto 14px",
        display: "flex", gap: 4,
        background: "#fff", padding: 4, borderRadius: 14,
        border: "2px solid " + accentAlpha(13),
      }}>
        {([
          { k: "tree" as const, label: "🌳 단원" },
          { k: "grid" as const, label: t("vocabViewGrid", lang) },
          { k: "notebook" as const, label: t("vocabViewNotebook", lang) },
        ]).map((v) => (
          <button
            key={v.k}
            onClick={() => setViewMode(v.k)}
            data-ux-role="control"
            aria-pressed={viewMode === v.k}
            style={{
              flex: 1,
              background: viewMode === v.k
                ? "var(--ux-primary-fill)"
                : "transparent",
              /* 꿀색 알약(#FFD35C) 위의 흰 글자는 대비가 1.6:1 이라 안 보였다.
                 칠한 면에는 짝이 되는 잉크(--ux-primary-ink)를 쓴다. */
              color: viewMode === v.k ? "var(--ux-primary-ink)" : "var(--ux-ink)",
              border: "none",
              fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
              boxShadow: viewMode === v.k ? "0 6px 14px rgba(137,83,0,.28)" : "none",
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
          <div style={{ fontSize: "var(--ux-font-label)", fontWeight: 800, color: PURPLE_DARK }}>
            {t("vocabFromBoard", lang)}
          </div>
          <button
            onClick={runScan}
            disabled={scanState === "scanning" || cardTexts.length === 0}
            style={{
              background: "transparent", border: "1.5px solid " + accentAlpha(40),
              borderRadius: 999, padding: "4px 10px",
              fontSize: "var(--ux-font-secondary)", fontWeight: 700, color: PURPLE_DARK,
              cursor: scanState === "scanning" ? "default" : "pointer",
              fontFamily: "inherit",
              opacity: cardTexts.length === 0 ? 0.5 : 1,
            }}
          >{scanState === "scanning" ? t("vocabScanning", lang) : t("vocabRefresh", lang)}</button>
        </div>
        {matched.length === 0 ? (
          <div style={{
            background: "#fff", border: "2px dashed " + accentAlpha(27),
            borderRadius: 14, padding: "14px",
            fontSize: "var(--ux-font-secondary)", color: INK_SOFT, fontWeight: 700, textAlign: "center",
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
                    background: "var(--ux-surface-sunk)",
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
                  <div style={{ fontSize: "var(--ux-font-secondary)", fontWeight: 800, color: INK_STRONG }}>{w.ko}</div>
                  <div style={{
                    fontSize: "var(--ux-font-secondary)", fontWeight: 700, color: PURPLE_DARK,
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
                fontSize: "var(--ux-font-label)", fontWeight: 800, color: INK_STRONG, letterSpacing: -0.2,
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
                  fontSize: "var(--ux-font-label)",
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
            /* 남보라 장막이 아니라 코코아 잉크 장막 — 뒤 화면이 보라로 물들지 않는다. */
            background: "rgba(41,37,31,0.55)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 18,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(420px, 100%)",
              background: "var(--ux-surface)", borderRadius: "var(--ux-radius-panel)",
              /* 예전에는 단원 색(초록/주황/하늘)이 그대로 시트 테두리였다.
                 어느 단원에서 열든 같은 시트로 보이게 꿀색 테두리로 통일한다. */
              border: "4px solid var(--ux-primary-border)",
              boxShadow: "0 20px 50px rgba(41,37,31,0.4)",
              padding: "20px 18px", textAlign: "center",
            }}
          >
            <BeeMascot size={84} mood="welcome" />
            <div style={{ fontSize: "var(--ux-font-body)", fontWeight: 800, color: INK_STRONG, margin: "8px 0 2px" }}>
              {lessonSheet.unit.emoji} {lessonSheet.unit.title} · {lessonSheet.lesson.title}
            </div>
            <div style={{ fontSize: "var(--ux-font-secondary)", fontWeight: 700, color: INK_SOFT, marginBottom: 12 }}>
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
                  <span style={{ fontSize: "var(--ux-font-secondary)", fontWeight: 700, color: INK_STRONG }}>{w.ko}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                onClick={() => {
                  const words = wordsForLesson(lessonSheet.lesson.id);
                  if (words.length > 0) { setStudyQueue(words); setStudyIdx(0); }
                }}
                /* 첫째 할 일 = 칠한 꿀색 면. 흰 글자는 꿀색 위에서 안 보여
                   짝 잉크(--ux-primary-ink)를 쓴다. */
                style={{
                  background: "var(--ux-primary-fill)",
                  color: "var(--ux-primary-ink)",
                  border: "2px solid var(--ux-selected-border)", borderRadius: 16,
                  padding: "14px", fontSize: "var(--ux-font-body)", fontWeight: 800, cursor: "pointer",
                  fontFamily: "inherit",
                  boxShadow: "0 6px 16px rgba(137,83,0,.30)",
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
                /* 둘째 할 일. 두 버튼을 다 칠하면 무엇을 먼저 할지 알 수 없다.
                   면은 비우고 정체성 보라는 테두리 한 줄로만 남긴다. */
                style={{
                  background: "var(--ux-surface)",
                  color: INK_STRONG,
                  border: `2px solid ${PURPLE}`, borderRadius: 16,
                  padding: "14px", fontSize: "var(--ux-font-body)", fontWeight: 800, cursor: "pointer",
                  fontFamily: "inherit",
                  boxShadow: "0 4px 12px rgba(137,83,0,.14)",
                }}
              >⚡ 시험 보기 (XP 도전!)</button>
              <button
                onClick={() => setLessonSheet(null)}
                style={{
                  background: "var(--ux-surface-sunk)", color: INK_SOFT, border: "none",
                  borderRadius: 14, padding: "10px", fontSize: "var(--ux-font-secondary)", fontWeight: 700, cursor: "pointer",
                  fontFamily: "inherit",
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
            fontSize: "var(--ux-font-secondary)", fontWeight: 800,
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
          offline={offline}
          fixtureExpressions={expressions}
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

      {/* 받아쓰기 학습지 (교사 전용) — 테마별 15챕터 + 오답노트 */}
      {showDictation && isTeacher && (
        <DictationSheetModal onClose={() => setShowDictation(false)} />
      )}

      {/* Test modal */}
      {quiz && (
        <VocabTest
          offline={offline}
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
            color: INK_STRONG,
            borderRadius: 20, padding: "14px 22px",
            fontSize: "var(--ux-font-label)", fontWeight: 800, letterSpacing: -0.2,
            boxShadow: "0 14px 40px rgba(245, 158, 11, 0.5)",
            display: "flex", alignItems: "center", gap: 10,
            animation: "rewardPop 0.4s ease",
            maxWidth: "90vw",
          }}
        >
          <span style={{ fontSize: "var(--ux-font-title)" }}>🏆</span>
          <div>
            <div style={{ fontSize: "var(--ux-font-secondary)", letterSpacing: 1, opacity: 0.8 }}>스티커 획득</div>
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
            background: "var(--ux-primary-fill)",
            color: "#fff",
            padding: "12px 20px", borderRadius: 999,
            fontSize: "var(--ux-font-label)", fontWeight: 800,
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
          <span style={{ fontSize: "var(--ux-font-body)" }}>❤️</span>
          <span style={{ fontSize: "var(--ux-font-body)", fontWeight: 800, color: "#B91C1C" }}>{hearts}</span>
          <span style={{ fontSize: "var(--ux-font-secondary)", fontWeight: 700, color: INK_SOFT }}>/ {MAX_HEARTS}</span>
        </div>
        {hearts < MAX_HEARTS && heartMs > 0 && (
          <div style={{ fontSize: "var(--ux-font-secondary)", fontWeight: 700, color: INK_SOFT }}>
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
          <span style={{ fontSize: "var(--ux-font-body)" }}>🔥</span>
          <span style={{ fontSize: "var(--ux-font-body)", fontWeight: 800 }}>{streak}</span>
        </div>
        <div style={{ fontSize: "var(--ux-font-secondary)", fontWeight: 700, opacity: 0.85 }}>연속 학습</div>
      </div>

      {/* XP + 데일리 골 */}
      <div style={{
        background: "#fff", borderRadius: 14, padding: "10px 12px",
        border: "2px solid " + accentAlpha(33),
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
          <span style={{ fontSize: "var(--ux-font-secondary)" }}>⚡</span>
          <span style={{ fontSize: "var(--ux-font-secondary)", fontWeight: 800, color: PURPLE_DARK }}>Lv.{level}</span>
          <span style={{ fontSize: "var(--ux-font-secondary)", fontWeight: 700, color: INK_SOFT, marginLeft: "auto" }}>
            {next.current}/{next.needed}
          </span>
        </div>
        <div style={{ height: 6, background: PURPLE_LIGHT, borderRadius: 999, overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: `${Math.round(next.ratio * 100)}%`,
            background: "var(--ux-primary-fill)",
          }} />
        </div>
        <div style={{ fontSize: "var(--ux-font-secondary)", fontWeight: 700, color: INK_SOFT, marginTop: 4 }}>
          🎯 오늘 {today}/{goal} XP
        </div>
      </div>
    </div>
  );
}

/**
 * 레슨 트리 배치 (04 §5 "단어 홈").
 *
 * 예전에는 폭과 무관하게 컨테이너가 520px 로 고정이고 레슨이 세로 1열
 * 지그재그였다. 크롬북 1366px 에서도 한 번에 레슨 1~2개만 보이고 문서 높이가
 * 3500px 를 넘었다 — 폭이 545px 늘어도 콘텐츠는 늘지 않는 "세로로 늘린
 * 휴대폰" 이었다.
 *
 * 지그재그는 순서를 따라가는 단서라 **좁은 화면에서만** 남기고, 폭이 생기면
 * 격자로 편다. 태블릿 세로 3열 / 태블릿 가로·분할 4열 / 크롬북·노트북 4열.
 */
const SKILL_TREE_CSS = `
.vh-tree{ max-width:520px; margin:0 auto; padding:0 4px 30px; }

/* ── 꿀벌 큐레이터 ────────────────────────────────────────────
   단원 목록 맨 위에서 "지금 무엇을 하면 되는지" 를 한 줄로 말해 주는 자리.
   예전에는 색색 막대가 일곱 개 쌓여 있을 뿐 안내가 없었다. */
.vh-curator{
  display:flex; align-items:center; gap:var(--ux-space-3);
  background:var(--ux-surface);
  border:3px solid var(--ux-primary-border);
  border-radius:var(--ux-radius-surface);
  padding:var(--ux-space-3) var(--ux-space-4);
  margin-bottom:var(--ux-space-5);
  box-shadow:0 8px 20px rgba(137,83,0,.14);
}
.vh-curator-bee{ width:64px; height:64px; object-fit:contain; flex:0 0 auto; }
.vh-curator-text{ min-width:0; }
.vh-curator-say{
  margin:0; color:var(--ux-ink); font-weight:700;
  font-size:var(--ux-font-body); line-height:var(--ux-lh-tight);
  word-break:keep-all; overflow-wrap:anywhere;
}
/* <b> 기본값은 'bolder' 라 800짜리 부모 안에서 900으로 계산된다. 계단은
   400/700/800 세 칸만 쓰기로 했으므로 값을 못박는다. */
.vh-curator-say b{ font-weight:800; }
/* 안내 문장은 아이가 실제로 읽고 무엇을 할지 정하는 줄이라 '상태' 크기
   (secondary=13.5px)가 아니라 라벨 크기로 올린다. */
.vh-curator-sub{
  margin:4px 0 0; color:var(--ux-ink-soft); font-weight:700;
  font-size:var(--ux-font-label); line-height:var(--ux-lh-tight);
  word-break:keep-all;
}

/* ── 단원 머리 ────────────────────────────────────────────────
   예전에는 단원마다 자기 색(초록/주황/하늘)으로 면을 통째로 칠해 화면이
   신호등이 됐다(사용자 지적: "UI가 구려 톤 맞춰"). 면은 전부 같은 표면
   토큰으로 두고, 단원 구분은 **꿀벌 얼굴·진행도·테두리**가 맡는다. */
.vh-unit{ margin-bottom:var(--ux-space-6); }
.vh-unithead{
  display:flex; align-items:center; gap:var(--ux-space-3);
  background:var(--ux-surface);
  border:2px solid var(--ux-primary-border);
  border-radius:var(--ux-radius-surface);
  padding:var(--ux-space-3) var(--ux-space-4);
  margin-bottom:var(--ux-space-4);
  box-shadow:0 4px 12px rgba(137,83,0,.10);
}
/* 지금 배울 단원만 테두리를 굵히고 살짝 띄운다 — 색을 더 쓰지 않고 구분한다. */
.vh-unithead.current{
  border-width:4px; border-color:var(--ux-selected-border);
  box-shadow:0 10px 24px rgba(137,83,0,.20);
}
/* 아직 못 여는 단원은 점선. 회색으로 죽이지 않고 "닫혀 있음" 만 알린다. */
.vh-unithead.locked{ border-style:dashed; background:var(--ux-surface-sunk); }
.vh-unitbee{ width:48px; height:48px; object-fit:contain; flex:0 0 auto; }
.vh-unitbody{ flex:1; min-width:0; }
.vh-unitkicker{
  display:flex; align-items:center; gap:6px;
  color:var(--ux-ink-soft); font-weight:700;
  font-size:var(--ux-font-secondary); line-height:var(--ux-lh-tight);
}
.vh-unittitle{
  color:var(--ux-ink); font-weight:800;
  font-size:var(--ux-font-body); line-height:var(--ux-lh-tight);
  word-break:keep-all; overflow-wrap:anywhere;
}
/* 진행도 막대 — 단원을 구분하는 진짜 정보. 색이 아니라 이게 다르다. */
.vh-unitmeter{
  margin-top:6px; height:10px; border-radius:var(--ux-radius-pill);
  background:var(--ux-surface-sunk);
  border:1px solid var(--ux-primary-border);
  overflow:hidden;
}
.vh-unitmeter > i{
  display:block; height:100%; background:var(--ux-primary-fill);
  transition:width var(--ux-motion-state) var(--ux-motion-ease);
}
.vh-unitstat{
  margin-top:4px; color:var(--ux-ink-soft); font-weight:700;
  font-size:var(--ux-font-secondary); line-height:var(--ux-lh-tight);
}
/* "여기부터" 표지 — 큐레이터 꿀벌이 현재 단원을 가리킨다. */
.vh-unitnow{
  display:inline-flex; align-items:center; gap:4px;
  background:var(--ux-primary-fill); color:var(--ux-primary-ink);
  border-radius:var(--ux-radius-pill); padding:2px 10px;
  font-weight:800; font-size:var(--ux-font-secondary);
  line-height:var(--ux-lh-tight); white-space:nowrap;
}

.vh-lessons{ display:grid; grid-template-columns:1fr; gap:18px; justify-items:center; }
@media (max-width:639px){
  .vh-lessons > *:nth-child(odd){ transform:translateX(-40px); }
  .vh-lessons > *:nth-child(even){ transform:translateX(40px); }
}
/* auto-fit + 고정 트랙 + max-width 로 열 수를 정한다. repeat(N, 1fr) 로 하면
   레슨이 1~2개뿐인 단원에서 노드가 첫 칸에 붙어 왼쪽으로 치우친다. */
@media (min-width:640px){
  .vh-tree{ max-width:720px; }
  .vh-lessons{
    grid-template-columns:repeat(auto-fit, 116px);
    justify-content:center; gap:16px 24px;
    max-width:calc(3 * 116px + 2 * 24px); margin:0 auto;
  }
}
@media (min-width:960px){
  .vh-tree{ max-width:920px; }
  .vh-lessons{ max-width:calc(4 * 116px + 3 * 24px); }
}
@media (min-width:1200px){
  .vh-tree{ max-width:1120px; }
}

/* ── 레슨 노드 ────────────────────────────────────────────────
   예전에는 노드마다 단원 색으로 radial-gradient 를 깔아 스무 개가 색색이었다.
   상태는 셋뿐이다: 다 함 / 지금 할 수 있음 / 아직 못 엶. 셋을 꿀색 한 계열의
   **채우기·테두리**로 구분한다. */
.vh-node{
  width:92px; height:92px; border-radius:50%;
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  font-family:inherit; position:relative;
  border:4px solid var(--ux-primary-border);
  background:var(--ux-surface); color:var(--ux-ink);
  transition:transform var(--ux-motion-press) var(--ux-motion-ease);
}
.vh-node.done{
  background:var(--ux-primary-fill); color:var(--ux-primary-ink);
  border-color:var(--ux-selected-border);
  box-shadow:0 8px 16px rgba(137,83,0,.28), inset 0 -4px 0 rgba(56,40,13,.12);
}
.vh-node.open{
  background:var(--ux-surface);
  box-shadow:0 8px 16px rgba(137,83,0,.18), inset 0 -4px 0 rgba(137,83,0,.10);
  cursor:pointer;
}
.vh-node.done{ cursor:pointer; }
.vh-node.locked{
  background:var(--ux-surface-sunk); color:var(--ux-ink-soft);
  border-style:dashed; cursor:not-allowed; box-shadow:none;
}
.vh-nodenum{ font-size:var(--ux-font-title); line-height:1; font-weight:800; }
.vh-nodelabel{ font-size:var(--ux-font-secondary); font-weight:700; margin-top:2px; }
.vh-nodestars{
  position:absolute; bottom:-14px; left:50%; transform:translateX(-50%);
  display:flex; gap:1px;
}
.vh-nodestars > span{ font-size:var(--ux-font-label); }
`;

/**
 * 단원마다 짝이 되는 꿀벌 얼굴(lib/beeMoods 20종 중에서).
 *
 * 단원을 구분하던 일이 색에서 **얼굴**로 옮겨 왔다. 아이는 소통창·감정 카드·
 * 동화책에서 이미 같은 꿀벌들을 만나므로 새로 배울 그림이 아니다.
 * 여기 있는 id 는 전부 public/ui-icons/v1/moods/<id>-128.png 로 실재한다.
 * 모르는 단원 id 가 오면 MoodArt 가 이모지로 내려가므로 렌더는 멈추지 않는다.
 */
const UNIT_BEE: Record<string, string> = {
  greetings: "happy",       // 인사와 만남
  emotions: "loved",        // 내 마음과 감정
  pointers: "curious",      // 이것과 저것
  school: "proud",          // 학교 생활
  verbs: "excited",         // 매일 하는 일
  adjectives: "surprised",  // 어떤 모양일까
  expressions: "hopeful",   // 내 생각 말하기
};

function SkillTreeView({
  learner, onStartLesson,
}: {
  learner: LearnerState | null;
  onStartLesson: (lesson: Lesson, unit: Unit) => void;
}) {
  const units = getUnits();
  /* 단원 잠금은 순서대로다 — 앞 단원을 다 해야 다음이 열린다. 그래서 "아직 다
     못 한 첫 단원" 이 곧 지금 배울 단원이고, 큐레이터 꿀벌이 가리키는 곳이다. */
  const unitDone = units.map((u) => u.lessons.every((l) => !!learner?.lessons?.[l.id]));
  const currentIdx = unitDone.findIndex((d) => !d);
  const currentUnit = currentIdx >= 0 ? units[currentIdx] : null;
  const nextLesson = currentUnit
    ? currentUnit.lessons.find((l) => !learner?.lessons?.[l.id]) ?? null
    : null;

  return (
    <div className="vh-tree">
      <ScopedStyle css={SKILL_TREE_CSS} />

      {/* 꿀벌 큐레이터 — 일곱 단원을 그냥 늘어놓지 않고, 오늘 어디를 하면
          되는지 먼저 말해 준다. 그림은 scripts/gen-scene-bees.mjs 가 만든
          실제 파일이다. */}
      <div className="vh-curator">
        <img
          className="vh-curator-bee"
          src="/ui-icons/v1/scene/bee-writing-256.png"
          alt=""
          aria-hidden="true"
        />
        <div className="vh-curator-text">
          {currentUnit && nextLesson ? (
            <p className="vh-curator-say">
              오늘은 <b>{currentUnit.title}</b>의 레슨 {nextLesson.index}을 해 볼까?
            </p>
          ) : (
            <p className="vh-curator-say">일곱 단원을 모두 마쳤어! 정말 대단해 🎉</p>
          )}
          <p className="vh-curator-sub">
            꿀벌이 단원 {units.length}개를 순서대로 골라 두었어. 위에서부터 하나씩 열려.
          </p>
        </div>
      </div>

      {units.map((unit, ui) => {
        const completedStars = unit.lessons.reduce((acc, l) => acc + (learner?.lessons?.[l.id]?.stars ?? 0), 0);
        const maxStars = unit.lessons.length * 3;
        const completedLessons = unit.lessons.filter((l) => learner?.lessons?.[l.id]).length;
        // 다음 미해결 레슨이 unlocked. 이전 단원의 마지막 레슨이 done 이어야 다음 단원 unlock
        const prevUnitDone = ui === 0 ? true : unitDone[ui - 1];
        const isCurrent = ui === currentIdx;
        const pct = Math.round((completedLessons / Math.max(1, unit.lessons.length)) * 100);
        const headClass = "vh-unithead"
          + (isCurrent ? " current" : "")
          + (prevUnitDone ? "" : " locked");
        return (
          <div key={unit.id} className="vh-unit" style={{
            position: "relative",
            /* 잠긴 단원도 글자는 읽혀야 한다. 예전 0.55 는 대비를 반토막 냈다. */
            opacity: prevUnitDone ? 1 : 0.8,
          }}>
            {/* 단원 머리 — 색이 아니라 꿀벌 얼굴·진행도·테두리로 구분한다. */}
            <div className={headClass}>
              <MoodArt id={UNIT_BEE[unit.id] ?? "calm"} size={48} className="vh-unitbee" />
              <div className="vh-unitbody">
                <div className="vh-unitkicker">
                  <span aria-hidden="true">{unit.emoji}</span>
                  <span>단원 {ui + 1}</span>
                  {isCurrent && <span className="vh-unitnow">🐝 여기부터</span>}
                  {!prevUnitDone && <span>🔒 잠김</span>}
                </div>
                <div className="vh-unittitle">{unit.title}</div>
                <div className="vh-unitmeter" role="presentation">
                  <i style={{ width: `${pct}%` }} />
                </div>
                <div className="vh-unitstat">
                  {completedLessons} / {unit.lessons.length} 레슨 · ⭐ {completedStars}/{maxStars}
                </div>
              </div>
            </div>

            {/* 레슨 노드 — 좁은 화면은 지그재그, 넓어지면 격자 (SKILL_TREE_CSS) */}
            <div className="vh-lessons">
              {unit.lessons.map((lesson, li) => {
                const res = learner?.lessons?.[lesson.id];
                const done = !!res;
                const stars = res?.stars ?? 0;
                // 이전 레슨이 done 이거나 첫 레슨이거나 단원 첫 노드 → unlocked
                const prevLessonDone = li === 0 ? prevUnitDone : !!learner?.lessons?.[unit.lessons[li - 1].id];
                const unlocked = prevLessonDone;
                const state = !unlocked ? "locked" : done ? "done" : "open";
                return (
                  <div key={lesson.id} style={{ display: "flex", justifyContent: "center" }}>
                    <button
                      onClick={() => unlocked && onStartLesson(lesson, unit)}
                      disabled={!unlocked}
                      title={lesson.title}
                      className={`vh-node ${state}`}
                      onMouseDown={(e) => { if (unlocked) e.currentTarget.style.transform = "scale(0.94)"; }}
                      onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                    >
                      <span className="vh-nodenum">
                        {!unlocked ? "🔒" : done ? "✓" : lesson.index}
                      </span>
                      <span className="vh-nodelabel">레슨 {lesson.index}</span>

                      {/* 별 표시 */}
                      {unlocked && (
                        <span className="vh-nodestars">
                          {[1, 2, 3].map((s) => (
                            <span key={s} style={{
                              opacity: s <= stars ? 1 : 0.3,
                              filter: s <= stars ? "drop-shadow(0 2px 3px rgba(137,83,0,.45))" : "none",
                            }}>⭐</span>
                          ))}
                        </span>
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
          ? "var(--ux-primary-fill)"
          : "#fff",
        /* 칠한 꿀색 면 위에는 짝 잉크. 흰 글자는 대비가 안 나온다. */
        color: active ? "var(--ux-primary-ink)" : "var(--ux-ink)",
        border: active ? "none" : "2px solid var(--ux-primary-border)",
        borderRadius: 999,
        padding: "8px 14px",
        fontSize: "var(--ux-font-secondary)", fontWeight: 700,
        cursor: "pointer", fontFamily: "inherit",
        display: "flex", alignItems: "center", gap: 6,
        boxShadow: active ? "0 6px 14px rgba(137,83,0,.28)" : "none",
        whiteSpace: "nowrap",
      }}
    >
      <span>{icon}</span>
      <span>{label}</span>
      <span style={{
        background: active ? "rgba(56,40,13,0.14)" : "var(--ux-surface-sunk)",
        color: active ? "var(--ux-primary-ink)" : "var(--ux-ink-soft)",
        borderRadius: 999, padding: "1px 7px", fontSize: "var(--ux-font-secondary)", fontWeight: 800,
      }}>{count}</span>
    </button>
  );
}
