"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { ref, onValue } from "firebase/database";
import { getClientDb } from "@/lib/firebase-client";
import { LANGUAGES } from "@/lib/constants";
import SetupScreen from "@/components/SetupScreen";
import PadletBoard from "@/components/PadletBoard";
import HomeHub, { HubView } from "@/components/HomeHub";
import GameRoom from "@/components/GameRoom";
import InterpreterDrawer from "@/components/InterpreterDrawer";
import PraiseHive from "@/components/PraiseHive";
import VocabHub from "@/components/VocabHub";
import StorybookRoom from "@/components/StorybookRoom";
import BookStudy from "@/components/BookStudy";
import StickerGiveModal from "@/components/StickerGiveModal";
import CosmeticPicker from "@/components/CosmeticPicker";
import Toast from "@/components/Toast";
import { TutorialProvider } from "@/components/tutorial/TutorialProvider";
import HubTutorialBootstrap from "@/components/tutorial/HubTutorialBootstrap";
import SectionCaption from "@/components/tutorial/SectionCaption";
import { subscribeStudentStickers } from "@/lib/stickers";
import { subscribeSession } from "@/lib/storybook";
import { UserConfig, RoomConfig } from "@/lib/types";
import { t } from "@/lib/i18n";

const ALL_LANGS = Object.keys(LANGUAGES);

export default function RoomPage() {
  const params = useParams();
  const roomCode = params.roomCode as string;
  const setupKey = `setup:${roomCode}`;
  const [user, setUserState] = useState<UserConfig | null>(null);
  const [roomLangs, setRoomLangs] = useState<string[]>(ALL_LANGS);
  const [roomConfig, setRoomConfig] = useState<RoomConfig>({ languages: ALL_LANGS });
  const [langsLoaded, setLangsLoaded] = useState(false);
  const [hubView, setHubView] = useState<HubView | "hub">("hub");
  const [interpreterOpen, setInterpreterOpen] = useState(false);
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
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeSession(roomCode, (session) => {
      const active = !!session && session.phase !== "done";
      setStorybookActive(active);
      if (active && !user.isTeacher) {
        // 학생은 세션 활성 동안 항상 그림책 화면으로 강제 동기화
        setHubView("storybook");
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
        fontFamily: "'Noto Sans KR', sans-serif", color: "#fff", gap: 16,
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
    </>
  );

  // 허브 메인 화면
  if (hubView === "hub") {
    return (
      <TutorialProvider roomCode={roomCode} userName={user.myName}>
        <HomeHub
          user={user}
          roomCode={roomCode}
          onSelect={(v) => {
            if (v === "interpreter") setInterpreterOpen(true);
            else setHubView(v);
          }}
          onLogout={() => setUser(null)}
        />
        <HubTutorialBootstrap isTeacher={user.isTeacher} />
        {/* Interpreter은 drawer 오버레이, hub 위에서 직접 열림 */}
        <InterpreterDrawer
          open={interpreterOpen}
          onClose={() => setInterpreterOpen(false)}
          viewerLang={user.myLang}
          availableLangs={roomLangs}
        />
        {interpreterOpen && <SectionCaption section="interpreter" isTeacher={user.isTeacher} />}
        {overlays}
      </TutorialProvider>
    );
  }

  if (hubView === "games") {
    return (
      <>
        <GameRoom myLang={user.myLang} onClose={() => setHubView("hub")} />
        <SectionCaption section="games" isTeacher={user.isTeacher} />
        {overlays}
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
        {overlays}
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
        {overlays}
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
        {overlays}
      </>
    );
  }

  if (hubView === "bookStudy") {
    return (
      <>
        <BookStudy
          roomCode={roomCode}
          isTeacher={user.isTeacher}
          myClientId={myClientId}
          myName={user.myName}
          myLang={user.myLang}
          roomLangs={roomLangs}
          onBack={() => setHubView("hub")}
        />
        {overlays}
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
      {overlays}
    </>
  );
}
