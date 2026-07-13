"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { ref, onValue } from "firebase/database";
import { getClientDb } from "@/lib/firebase-client";
import { LANGUAGES } from "@/lib/constants";
import SetupScreen from "@/components/SetupScreen";
import PadletBoard from "@/components/PadletBoard";
import HomeHub, { HubView } from "@/components/HomeHub";
import GameRoom from "@/components/GameRoom";
import InterpreterFab from "@/components/InterpreterFab";
import PraiseHive from "@/components/PraiseHive";
import VocabHub from "@/components/VocabHub";
import StorybookRoom from "@/components/StorybookRoom";
import WhiteboardRoom from "@/components/WhiteboardRoom";
import StickerGiveModal from "@/components/StickerGiveModal";
import CosmeticPicker from "@/components/CosmeticPicker";
import Toast from "@/components/Toast";
import TutorChat from "@/components/TutorChat";
import { TutorialProvider } from "@/components/tutorial/TutorialProvider";
import HubTutorialBootstrap from "@/components/tutorial/HubTutorialBootstrap";
import SectionCaption from "@/components/tutorial/SectionCaption";
import { subscribeStudentStickers } from "@/lib/stickers";
import { subscribeSession } from "@/lib/storybook";
import { subscribeWhiteboardMeta } from "@/lib/whiteboard";
import { UserConfig, RoomConfig } from "@/lib/types";
import { useBackLayer } from "@/lib/backStack";
import { TutorialBus } from "@/lib/tutorial/bus";
import { t } from "@/lib/i18n";

const ALL_LANGS = Object.keys(LANGUAGES);

/** 교사 전용 칭찬 바로가기 — 꿀벌집 PNG(/praise/hive-button.png)가 있으면 그걸,
 *  없으면 기존 🍯 원형 버튼으로 폴백. (에셋은 별도 생성해 public/praise/ 에 배치) */
function HiveButton({ onClick }: { onClick: () => void }) {
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <button
      onClick={onClick}
      aria-label="칭찬 스티커 주기"
      title="칭찬 스티커 주기"
      style={{
        position: "fixed", bottom: 228, right: 18, zIndex: 300,
        width: 64, height: 64, padding: 0, cursor: "pointer",
        ...(imgFailed
          ? {
              borderRadius: "50%",
              border: "3px solid #FDE68A",
              background: "linear-gradient(135deg, #F59E0B, #D97706)",
              boxShadow: "0 8px 20px rgba(180,83,9,0.4)",
              fontSize: 30,
              display: "flex", alignItems: "center", justifyContent: "center",
            }
          : { border: "none", background: "transparent" }),
      }}
    >
      {imgFailed ? (
        "🍯"
      ) : (
        <img
          src="/praise/hive-button.png"
          alt=""
          aria-hidden="true"
          onError={() => setImgFailed(true)}
          style={{
            width: "100%", height: "100%", objectFit: "contain",
            filter: "drop-shadow(0 8px 20px rgba(180,83,9,0.4))",
          }}
        />
      )}
    </button>
  );
}

export default function RoomPage() {
  const params = useParams();
  const roomCode = params.roomCode as string;
  const setupKey = `setup:${roomCode}`;
  const [user, setUserState] = useState<UserConfig | null>(null);
  const [roomLangs, setRoomLangs] = useState<string[]>(ALL_LANGS);
  const [roomConfig, setRoomConfig] = useState<RoomConfig>({ languages: ALL_LANGS });
  const [langsLoaded, setLangsLoaded] = useState(false);
  const [hubView, setHubView] = useState<HubView | "hub">("hub");

  // 튜토리얼 "섹션 직접 진입" (설계서 항목 11) — TutorialHost 의 navigate
  // 스텝이 발행하는 전환 이벤트를 받아 hubView 를 바꾼다.
  useEffect(() => {
    return TutorialBus.on("tutorial-navigate", (to) => {
      if (typeof to !== "string") return;
      setHubView(to as HubView | "hub");
    });
  }, []);

  // 📢 교사 "모두 부르기" — 소통창의 버튼이 rooms/{room}/summon 에 ts 를 쓰면
  // 학생들이 뭘 하고 있든 "그 시점에 1회"만 소통창으로 끌려온다.
  // 이후엔 자유 — 계속 강제가 아님. 새로고침으로 재소환되지 않게 신선도 20초.
  const summonHandledRef = useRef(0);
  useEffect(() => {
    if (!user || user.isTeacher) return;
    const db = getClientDb();
    const r = ref(db, `rooms/${roomCode}/summon`);
    const unsub = onValue(r, (snap) => {
      const val = snap.val() as { target?: string; ts?: number } | null;
      if (!val?.ts) return;
      if (val.ts <= summonHandledRef.current) return;      // 이미 처리한 신호
      if (Date.now() - val.ts > 20_000) {                  // 오래된 신호(새 입장/새로고침)
        summonHandledRef.current = val.ts;
        return;
      }
      summonHandledRef.current = val.ts;
      // 그림책 수업 강제 동기화가 우선
      if (storybookActiveRef.current) return;
      setHubView((val.target as HubView | "hub") || "board");
    });
    return () => unsub();
  }, [roomCode, user]);

  // 💭 의견 나누기 세션이 "켜지는 순간" 학생을 소통창으로 1회 데려온다
  // (DiscussionSession 오버레이는 소통창 안에서 activeSession 구독으로 자동 표시).
  // 첫 fire(입장 시 이미 진행 중)는 기록만 — '켜지는 순간'에만 반응.
  const prevDiscussionRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!user || user.isTeacher) return;
    const db = getClientDb();
    const r = ref(db, `rooms/${roomCode}/activeSession`);
    const unsub = onValue(r, (snap) => {
      const id = (snap.val() as string | null) ?? null;
      const prev = prevDiscussionRef.current;
      prevDiscussionRef.current = id;
      if (prev === undefined) return;          // 첫 fire — 기준선만 기록
      if (prev === null && id) {               // 없음 → 생김 = 켜지는 순간
        if (storybookActiveRef.current) return;
        setHubView("board");
      }
    });
    return () => unsub();
  }, [roomCode, user]);
  const [giveModalFor, setGiveModalFor] = useState<{ clientId: string; name: string } | null>(null);
  const [cosmeticsOpen, setCosmeticsOpen] = useState(false);
  const [myStickerCount, setMyStickerCount] = useState(0);
  const [toast, setToast] = useState<{ msg: string; tone: "success" | "error" } | null>(null);

  // 내 스티커 개수 구독 (CosmeticPicker에 전달용)
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeStudentStickers(roomCode, user.myName, (list) => {
      setMyStickerCount(list.length);
    });
    return () => unsub();
  }, [roomCode, user]);

  // 그림책 수업 세션 활성 상태. 학생은 계속 강제 동기화, 교사도 수업 중 이탈 방지용.
  const [storybookActive, setStorybookActive] = useState(false);
  // popstate 핸들러(마운트 1회 바인딩)가 최신값을 읽도록 ref 로 보관.
  const storybookActiveRef = useRef(false);
  const isStudentRef = useRef(false);
  useEffect(() => { isStudentRef.current = !!user && !user.isTeacher; }, [user]);
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeSession(roomCode, (session) => {
      const active = !!session && session.phase !== "done";
      setStorybookActive(active);
      storybookActiveRef.current = active;
      if (active && !user.isTeacher) {
        // 학생은 세션 활성 동안 항상 그림책 화면으로 강제 동기화
        setHubView("storybook");
      }
    });
    return () => unsub();
  }, [roomCode, user]);

  // [#6] 화이트보드 활성화 시 학생 화면 자동 따라오기 (그림책 세션과 동일 패턴).
  //   단, 그림책 수업이 활성이면 그쪽이 우선이라 화이트보드로 끌어가지 않는다.
  useEffect(() => {
    if (!user || user.isTeacher) return;
    const unsub = subscribeWhiteboardMeta(roomCode, (meta) => {
      if (meta.active && !storybookActiveRef.current) {
        setHubView("whiteboard");
      }
    });
    return () => unsub();
  }, [roomCode, user]);

  // 재방문 시 저장된 설정으로 바로 보드 입장
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(setupKey);
      if (saved) {
        const parsed = JSON.parse(saved) as UserConfig;
        if (parsed && parsed.myLang && parsed.myName) {
          setUserState(parsed);
        }
      }
    } catch {/* ignore */}
  }, [setupKey]);

  function setUser(next: UserConfig | null) {
    setUserState(next);
    if (typeof window === "undefined") return;
    if (next) {
      try { localStorage.setItem(setupKey, JSON.stringify(next)); } catch {}
    } else {
      try { localStorage.removeItem(setupKey); } catch {}
    }
  }

  const [myClientId] = useState(() => {
    if (typeof window === "undefined") return "";
    let id = localStorage.getItem("clientId") || "";
    if (!id) { id = crypto.randomUUID(); localStorage.setItem("clientId", id); }
    return id;
  });

  // #1 브라우저/기기 뒤로 가기 → 홈 허브 복귀 (사이트 이탈 방지)
  // 서브뷰에 있는 동안 백스택 레이어 1개를 유지한다. 어느 서브뷰든 뒤로 가기
  // 한 번이면 허브로 돌아오고, 허브에서의 뒤로 가기만 사이트를 이탈한다.
  // (각 섹션 내부의 더 깊은 단계는 그 컴포넌트가 자체 useBackLayer 로 쌓아,
  //  중앙 백스택이 가장 안쪽 레이어부터 차례로 닫는다.)
  useBackLayer(hubView !== "hub", () => {
    // 그림책 수업 중인 학생은 허브로 빠지면 강제 동기화 의도가 깨진다 → 머무른다.
    if (storybookActiveRef.current && isStudentRef.current) return false;
    setHubView("hub");
  });

  const validCode = /^\d{4}$/.test(roomCode);

  useEffect(() => {
    if (!validCode) { setLangsLoaded(true); return; }
    const db = getClientDb();
    const configRef = ref(db, `rooms/${roomCode}/config`);
    const unsub = onValue(configRef, (snap) => {
      const val = snap.val() as RoomConfig | null;
      if (val) {
        // Firebase may return numeric-keyed objects instead of arrays — normalize
        if (val.roster && !Array.isArray(val.roster)) {
          val.roster = Object.values(val.roster as unknown as Record<string, string>);
        }
        if (val.languages && !Array.isArray(val.languages)) {
          val.languages = Object.values(val.languages as unknown as Record<string, string>);
        }
        setRoomConfig(val);
        if (Array.isArray(val.languages) && val.languages.length > 0) {
          setRoomLangs(val.languages);
        }
      }
      setLangsLoaded(true);
    }, () => setLangsLoaded(true));
    return () => unsub();
  }, [roomCode, validCode]);

  if (!validCode) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0d0b26, #1e1b4b)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        fontFamily: "'Pretendard Variable', 'Pretendard', 'Noto Sans KR', sans-serif", color: "#fff", gap: 16,
      }}>
        <div style={{ fontSize: 48 }}>⚠️</div>
        <p style={{ fontSize: 18, fontWeight: 700 }}>잘못된 방 번호입니다</p>
        <a href="/" style={{ color: "#7C7AFF", fontSize: 14 }}>← 돌아가기</a>
      </div>
    );
  }

  // Brief loading while fetching room language config
  if (!langsLoaded) {
    return (
      <div style={{
        minHeight: "100vh", background: "linear-gradient(135deg, #0d0b26, #1e1b4b)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          border: "3px solid rgba(255,255,255,0.15)", borderTopColor: "#7C7AFF",
          animation: "spin 0.8s linear infinite",
        }} />
      </div>
    );
  }

  if (!user) {
    return (
      <SetupScreen
        onDone={(u) => { setUser(u); setHubView("hub"); }}
        roomCode={roomCode}
        availableLangs={roomLangs}
        roomConfig={roomConfig}
      />
    );
  }

  // Shared overlays — available on every hub view so 칭찬/꾸미기/토스트 가 한 곳에서 제어됨
  const overlays = (
    <>
      <StickerGiveModal
        roomCode={roomCode}
        teacherName={user.myName}
        teacherClientId={myClientId}
        targetStudent={giveModalFor}
        lang={user.myLang}
        onClose={() => setGiveModalFor(null)}
      />
      <CosmeticPicker
        open={cosmeticsOpen}
        roomCode={roomCode}
        myClientId={user.myName}
        stickerCount={myStickerCount}
        lang={user.myLang}
        onClose={() => setCosmeticsOpen(false)}
        onSaved={() => setToast({ msg: t("cosmeticSaved", user.myLang), tone: "success" })}
        onSaveError={(m) =>
          setToast({ msg: m || t("cosmeticSaveError", user.myLang), tone: "error" })
        }
      />
      <Toast
        message={toast?.msg ?? null}
        tone={toast?.tone}
        onDismiss={() => setToast(null)}
      />
      {/* 앱 전역 AI 튜터 — 게임룸에서는 숨김 (게임 우하단 버튼 가림 방지) */}
      <TutorChat
        roomCode={roomCode}
        myClientId={myClientId}
        user={user}
        hidden={hubView === "games"}
      />
      {/* 앱 전역 실시간 통역 — 튜터 꿀비와 대칭(좌하단). 모든 탭에서 상주. */}
      <InterpreterFab
        viewerLang={user.myLang}
        availableLangs={roomLangs}
        hidden={hubView === "games"}
      />
      {/* 교사 전용 — 칭찬 스티커 주는 화면 바로가기. 번역 위젯(InterpreterFab) 바로 위에 상시 표시.
          /praise/hive-button.png 가 있으면 꿀벌집 UI, 없으면 기존 🍯 원형 버튼으로 폴백. */}
      {user.isTeacher && hubView !== "games" && hubView !== "dashboard" && (
        <HiveButton onClick={() => setHubView("dashboard")} />
      )}
    </>
  );

  // 현재 hubView 의 본문. TutorialProvider 는 아래에서 모든 분기를 공통으로
  // 감싼다 — 허브 분기 안에만 두면 튜토리얼 navigate 스텝(설계서 항목 11)이
  // 소통창 등으로 화면을 전환하는 순간 Provider 가 언마운트되어 설명이 끊긴다.
  const body = (() => {
    if (hubView === "hub") {
      return (
        <>
          <HomeHub
            user={user}
            roomCode={roomCode}
            onSelect={(v) => setHubView(v)}
            onLogout={() => setUser(null)}
            onChangeLang={(l) => setUser({ ...user, myLang: l })}
            availableLangs={roomLangs}
          />
          <HubTutorialBootstrap isTeacher={user.isTeacher} />
        </>
      );
    }

    if (hubView === "games") {
      return (
        <>
          <GameRoom
            myLang={user.myLang}
            onClose={() => setHubView("hub")}
            onChangeMyLang={(l) => setUser({ ...user, myLang: l })}
            roomLangs={roomLangs}
            roomCode={roomCode}
            questClientId={user.isTeacher ? undefined : user.myName}
          />
          <SectionCaption section="games" isTeacher={user.isTeacher} />
        </>
      );
    }

    if (hubView === "vocab") {
      return (
        <>
          <VocabHub
            user={user}
            roomCode={roomCode}
            onBack={() => setHubView("hub")}
          />
          <SectionCaption section="vocab" isTeacher={user.isTeacher} />
        </>
      );
    }

    if (hubView === "whiteboard") {
      return (
        <>
          <WhiteboardRoom
            user={user}
            roomCode={roomCode}
            myClientId={myClientId}
            onBack={() => setHubView("hub")}
          />
          <SectionCaption section="whiteboard" isTeacher={user.isTeacher} />
        </>
      );
    }

    if (hubView === "storybook") {
      return (
        <>
          <StorybookRoom
            user={user}
            roomCode={roomCode}
            myClientId={myClientId}
            onBack={() => setHubView("hub")}
          />
          <SectionCaption section="storybook" isTeacher={user.isTeacher} />
        </>
      );
    }

    if (hubView === "dashboard") {
      return (
        <>
          <PraiseHive
            user={user}
            roomCode={roomCode}
            roomConfig={roomConfig}
            myClientId={user.myName}
            onBack={() => setHubView("hub")}
            onOpenGive={(clientId, name) => setGiveModalFor({ clientId, name })}
            onOpenCosmetics={() => setCosmeticsOpen(true)}
          />
          <SectionCaption section="praise" isTeacher={user.isTeacher} />
        </>
      );
    }

    // 기본: 소통창 — 교사가 카드별 칭찬 버튼으로 스티커 지급
    return (
      <>
        <PadletBoard
          user={user}
          roomCode={roomCode}
          roomLangs={roomLangs}
          onLogout={() => setHubView("hub")}
          roomConfig={roomConfig}
          myClientId={myClientId}
          onPraiseStudent={(clientId, name) => setGiveModalFor({ clientId, name })}
        />
        <SectionCaption section="board" isTeacher={user.isTeacher} />
      </>
    );
  })();

  return (
    <TutorialProvider roomCode={roomCode} userName={user.myName}>
      {body}
      {overlays}
    </TutorialProvider>
  );
}
