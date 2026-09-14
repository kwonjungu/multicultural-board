"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import StorybookRoom, { type StorybookFixture } from "@/components/StorybookRoom";
import BookStudy, { type BookStudyFixture } from "@/components/BookStudy";
import type { BookListEntry } from "@/lib/storybook";
import type {
  UserConfig,
  Storybook,
  StorybookSession,
  SessionMeta,
  SessionResponse,
} from "@/lib/types";

/**
 * 그림책 교실 · 그림책 공부 시각 검수용 fixture — 개발·테스트 전용.
 *
 * G0 격리(HARNESS §2): StorybookRoom · BookStudy 는 `fixture` prop 이 주어지면
 * Firebase 를 구독하지도 쓰지도 않고 /api/* 도 부르지 않는다. 여기의 이름·
 * 본문·채팅은 전부 지어낸 것이며 운영 방(1111)의 세션·답변을 복제하지 않았다.
 *
 * 고정 입력(HARNESS §2): 시각 2026-09-11T00:00:00Z, 방 9999,
 * 학생 이름 '학생 A/B/C', 교사 이름 '테스트 교사'.
 */

/** 고정 시계 — timestamp 가 캡처마다 흔들리지 않게 한다. */
const T0 = Date.parse("2026-09-11T00:00:00Z");
const ROOM_CODE = "9999";
const TEACHER_NAME = "테스트 교사";
const STUDENT_NAME = "학생 A";

export type StorybookView = "shelf" | "read" | "question" | "study";
export type StorybookRole = "student" | "teacher";

const BOOK: Storybook = {
  id: "fx-book-1",
  title: { ko: "붕붕이의 궁금 여행", vi: "Chuyến Đi Tò Mò Của Bung Bung", en: "Bungbung's Curious Trip" },
  cover: {
    emoji: "🐝🌍✨",
    bgGradient: "linear-gradient(135deg, #FDE68A, #F59E0B)",
  },
  authorName: TEACHER_NAME,
  createdAt: T0,
  pages: [
    {
      idx: 1,
      text: {
        ko: "붕붕이는 오늘 처음 보는 길을 걸었어요. 마음이 콩닥콩닥 뛰었어요.",
        vi: "Hôm nay Bung Bung đi trên con đường lạ. Trái tim đập thình thịch.",
        en: "Today Bungbung walked down a road it had never seen before.",
      },
      illustration: { emoji: "🐝🛤️", bgGradient: "linear-gradient(135deg, #FEF3C7, #FDE68A)" },
      characterIds: ["fx-char-bee"],
    },
    {
      idx: 2,
      text: {
        ko: "그런데 저 멀리서 누군가 손을 흔들었어요. 새로운 친구였어요!",
        vi: "Nhưng từ xa có ai đó vẫy tay. Đó là một người bạn mới!",
        en: "But far away, someone waved. It was a new friend!",
      },
      illustration: { emoji: "🐝🤝🐞", bgGradient: "linear-gradient(135deg, #DBEAFE, #93C5FD)" },
      characterIds: ["fx-char-bee", "fx-char-bug"],
    },
  ],
  characters: [
    {
      id: "fx-char-bee",
      name: { ko: "붕붕이", vi: "Bung Bung", en: "Bungbung" },
      avatarEmoji: "🐝",
      personality: "호기심 많고 씩씩함",
      speechStyle: "짧고 밝은 문장",
      bookContext: "궁금한 걸 못 참는 꿀벌",
    },
    {
      id: "fx-char-bug",
      name: { ko: "콩콩이", vi: "Kong Kong", en: "Kongkong" },
      avatarEmoji: "🐞",
      personality: "수줍지만 다정함",
      speechStyle: "느긋한 문장",
      bookContext: "숲에서 만난 무당벌레 친구",
    },
  ],
  questions: [
    {
      id: "fx-q-intro",
      tier: "intro",
      text: {
        ko: "표지를 보고, 붕붕이는 지금 어떤 기분일까요?",
        vi: "Nhìn vào bìa sách, Bung Bung đang cảm thấy thế nào?",
        en: "Looking at the cover, how do you think Bungbung feels?",
      },
    },
    {
      id: "fx-q-check-1",
      tier: "check",
      pageIdx: 1,
      text: {
        ko: "붕붕이의 마음이 콩닥콩닥 뛴 이유는 무엇일까요?",
        vi: "Vì sao trái tim Bung Bung đập thình thịch?",
        en: "Why do you think Bungbung's heart was pounding?",
      },
    },
  ],
  visible: true,
  wordQuizEnabled: false,
  chatEnabled: false,
};

/** shelf 뷰(교사 책장 · 학생 자유 도서관)에 보일 목록 — BOOK 과 같은 id 를
 * 써서 학생이 열면 fixture 책이 그대로 열리게 한다(StorybookRoom 내부 배선). */
const GENERATED_BOOKS: BookListEntry[] = [
  {
    id: BOOK.id,
    titleKo: BOOK.title.ko,
    coverEmoji: BOOK.cover.emoji,
    source: "generated",
    createdAt: T0 - 86400_000,
    authorName: TEACHER_NAME,
    visible: true,
    wordQuizEnabled: false,
    hasVocab: false,
    chatEnabled: false,
  },
  {
    id: "fx-book-2",
    titleKo: "숲 속 작은 발자국",
    coverEmoji: "🦉🌲",
    source: "generated",
    createdAt: T0 - 2 * 86400_000,
    authorName: TEACHER_NAME,
    visible: true,
    wordQuizEnabled: true,
    hasVocab: true,
    chatEnabled: true,
  },
];

function sessionFor(view: StorybookView): StorybookSession | null {
  if (view === "shelf" || view === "study") return null;
  return {
    bookId: BOOK.id,
    phase: "during",
    currentPage: 1,
    currentQuestionId: view === "question" ? "fx-q-check-1" : null,
    activeCharacterId: null,
    teacherClientId: "fx-teacher-client",
    startedAt: T0,
    wordQuizEnabled: false,
    allowReviewChat: false,
    autoReading: false,
  };
}

function storybookFixtureFor(view: StorybookView): StorybookFixture {
  return {
    session: sessionFor(view),
    book: BOOK,
    generatedBooks: GENERATED_BOOKS,
  };
}

const BOOK_STUDY_SESSION: SessionMeta = {
  id: "bookStudy",
  title: "이 장면에서 붕붕이는 어떤 기분일까요?",
  titleTranslations: {
    ko: "이 장면에서 붕붕이는 어떤 기분일까요?",
    vi: "Trong cảnh này, Bung Bung cảm thấy thế nào?",
  },
  bodyText: "그림을 보고 자유롭게 이야기해봐요.",
  bodyTextTranslations: {
    ko: "그림을 보고 자유롭게 이야기해봐요.",
    vi: "Hãy nhìn tranh và chia sẻ suy nghĩ của em.",
  },
  startedAt: T0,
  status: "active",
  teacherClientId: "fx-teacher-client",
  teacherLang: "ko",
  teacherName: TEACHER_NAME,
  targetLangs: ["ko", "vi"],
};

const BOOK_STUDY_RESPONSES: SessionResponse[] = [
  {
    id: "fx-r1",
    authorName: "학생 B",
    authorLang: "ko",
    authorClientId: "fx-student-b",
    text: "기뻐 보여요! 새 친구를 만나서 신났을 것 같아요.",
    timestamp: T0 - 5 * 60_000,
  },
  {
    id: "fx-r2",
    authorName: "학생 C",
    authorLang: "vi",
    authorClientId: "fx-student-c",
    text: "Bung Bung có vẻ hơi lo lắng vì con đường lạ.",
    translations: { ko: "붕붕이는 낯선 길이라 조금 걱정되는 것 같아요." },
    timestamp: T0 - 2 * 60_000,
  },
];

const BOOK_STUDY_FIXTURE: BookStudyFixture = {
  session: BOOK_STUDY_SESSION,
  responses: BOOK_STUDY_RESPONSES,
};

/** 검수용 뷰 전환 칩 — 제품 화면 밖 개발 크롬. */
function DevSwitcher({
  view, role, lang,
}: { view: StorybookView; role: StorybookRole; lang: string }) {
  const linkFor = (patch: Partial<{ view: StorybookView; role: StorybookRole; lang: string }>) => {
    const q = new URLSearchParams({
      view: patch.view ?? view,
      role: patch.role ?? role,
      lang: patch.lang ?? lang,
    });
    return `/ux-fixture/storybook?${q.toString()}`;
  };
  const chip = (active: boolean): React.CSSProperties => ({
    display: "inline-block", padding: "3px 9px", borderRadius: 999,
    fontSize: 11, fontWeight: 800, textDecoration: "none",
    marginRight: 4, marginBottom: 4,
    background: active ? "#1F2937" : "#fff",
    color: active ? "#fff" : "#1F2937",
    border: "1.5px solid #1F2937",
  });
  return (
    <div
      data-fixture-chrome
      style={{
        /* 왼쪽 위에 두면 제품의 뒤로 버튼(읽기 화면의 유일한 조작)을 정확히 덮는다 —
           감사 도구가 "손가락이 닿는 제품 버튼이 첫 화면에 없다" 고 적고, 실제로
           탭도 타임아웃 났다. 검수 껍데기가 검수 대상을 가리면 안 되므로 오른쪽으로
           옮긴다. 이 화면의 제품 조작은 전부 왼쪽에 있다(실측: 첫 화면 조작 1개). */
        position: "fixed", top: 8, right: 8, zIndex: 9999,
        maxWidth: "70vw",
        background: "rgba(255,255,255,0.95)", padding: "6px 8px",
        borderRadius: 10, boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
        font: "12px/1.4 system-ui, sans-serif",
      }}
    >
      <div style={{ marginBottom: 3 }}>
        {(["shelf", "read", "question", "study"] as StorybookView[]).map((v) => (
          <a key={v} href={linkFor({ view: v })} style={chip(v === view)}>{v}</a>
        ))}
      </div>
      <div style={{ marginBottom: 3 }}>
        {(["student", "teacher"] as StorybookRole[]).map((r) => (
          <a key={r} href={linkFor({ role: r })} style={chip(r === role)}>{r}</a>
        ))}
      </div>
      <div>
        {["ko", "vi"].map((l) => (
          <a key={l} href={linkFor({ lang: l })} style={chip(l === lang)}>{l}</a>
        ))}
      </div>
    </div>
  );
}

export default function StorybookFixtureScreen({
  view, role, lang,
}: {
  view: StorybookView;
  role: StorybookRole;
  lang: string;
}) {
  const [blocked, setBlocked] = useState<string[]>([]);
  const blockedRef = useRef<string[]>([]);

  // 네트워크 차단: fixture 는 어떤 원격 호출도 하지 않는다. /api/* 는 canned
  // 응답으로 막고, 새는 경로가 있으면 화면에 드러낸다.
  useEffect(() => {
    const real = window.fetch.bind(window);
    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const path = url.startsWith("http") ? new URL(url).pathname : url;
      if (path.startsWith("/_next") || path.startsWith("/__next")) return real(input as RequestInfo, init);
      if (path.startsWith("/api/")) {
        blockedRef.current = Array.from(new Set([...blockedRef.current, path]));
        setBlocked(blockedRef.current);
        return new Response(JSON.stringify({ error: "fixture" }), {
          status: 503, headers: { "content-type": "application/json" },
        });
      }
      return real(input as RequestInfo, init);
    }) as typeof window.fetch;
    return () => { window.fetch = real; };
  }, []);

  const isTeacher = role === "teacher";
  const user: UserConfig = useMemo(
    () => ({ myLang: lang, myName: isTeacher ? TEACHER_NAME : STUDENT_NAME, isTeacher, teacherLangs: ["ko", "vi"] }),
    [lang, isTeacher]
  );

  const roomStudyFixture = useMemo(() => storybookFixtureFor(view), [view]);

  return (
    <>
      {view === "study" ? (
        <BookStudy
          key={`study-${role}-${lang}`}
          roomCode={ROOM_CODE}
          isTeacher={isTeacher}
          myClientId="fx-viewer-client"
          myName={user.myName}
          myLang={lang}
          roomLangs={["ko", "vi"]}
          onBack={() => { /* fixture: 돌아갈 상위 화면이 없다 */ }}
          fixture={BOOK_STUDY_FIXTURE}
        />
      ) : (
        <StorybookRoom
          key={`${view}-${role}-${lang}`}
          user={user}
          roomCode={ROOM_CODE}
          myClientId="fx-viewer-client"
          onBack={() => { /* fixture: 돌아갈 상위 화면이 없다 */ }}
          fixture={roomStudyFixture}
        />
      )}

      <DevSwitcher view={view} role={role} lang={lang} />

      {blocked.length > 0 && (
        <pre
          data-fixture-leak
          data-fixture-chrome
          style={{
            position: "fixed", left: 8, bottom: 8, zIndex: 9999, margin: 0,
            padding: "6px 10px", borderRadius: 8, background: "#B3261E", color: "#fff",
            font: "12px/1.4 monospace", maxWidth: "60vw",
          }}
        >
          fixture 가 가로챈 원격 호출: {blocked.join(", ")}
        </pre>
      )}
    </>
  );
}
