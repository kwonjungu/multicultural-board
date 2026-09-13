"use client";

// Development-only visual fixture. Firebase is redirected to an unused local
// emulator and taken offline BEFORE any component mounts or fixture is seeded.
import { useEffect, useState } from "react";
import { getApps, initializeApp } from "firebase/app";
import { connectDatabaseEmulator, goOffline, ref, set } from "firebase/database";
import { getClientDb } from "@/lib/firebase-client";
import { COLUMNS_DEFAULT } from "@/lib/constants";
import { UserConfig } from "@/lib/types";
import HomeHub from "@/components/HomeHub";
import SetupScreen from "@/components/SetupScreen";
import PadletBoard from "@/components/PadletBoard";
import PostModal from "@/components/PostModal";

let initialized = false;
const room = "9876";
const config = { languages: ["ko", "en", "vi", "zh", "fil", "ja", "ar"], roster: ["하늘", "민준", "소라", "지우"], rosterMode: true };

export default function DesignPreview() {
  const [ready, setReady] = useState(false);
  const [view, setView] = useState("home");
  const [user, setUser] = useState<UserConfig>({ myLang: "ko", myName: "하늘", isTeacher: false, teacherLangs: [] });
  useEffect(() => {
    if (!getApps().length) initializeApp({ projectId: "demo-design-review", databaseURL: "https://demo-design-review.firebaseio.com", apiKey: "local-preview", storageBucket: "demo-design-review.appspot.com" });
    const db = getClientDb();
    if (!initialized) {
      connectDatabaseEmulator(db, "127.0.0.1", 9);
      goOffline(db);
      initialized = true;
    }
    const params = new URLSearchParams(location.search);
    const lang = params.get("lang") || "ko";
    setUser({ myLang: lang, myName: params.get("longName") ? "하늘과 함께 이야기하는 친구" : "하늘", isTeacher: params.get("teacher") === "1", teacherLangs: config.languages });
    setView(params.get("view") || "home");
    const columns = Object.fromEntries(COLUMNS_DEFAULT.map((c, order) => [c.id, { title: c.title, color: c.color, order }]));
    const cards = {
      sample1: { colId: COLUMNS_DEFAULT[0].id, cardType: "text", authorLang: "ko", authorName: "소라", isTeacher: false, originalText: "안녕! 나는 그림 그리기를 좋아해. 함께 그림을 그릴 친구가 있을까?", translations: { en: "Hello! I like drawing. Would you like to draw with me?", vi: "Chào bạn! Mình thích vẽ. Bạn có muốn vẽ cùng mình không?" }, paletteIdx: 0, timestamp: Date.now() - 120000, flagged: false },
      sample2: { colId: COLUMNS_DEFAULT[1].id, cardType: "text", authorLang: "vi", authorName: "민준", isTeacher: false, originalText: "Hôm nay mình chơi cùng bạn ở sân trường.", translations: { ko: "오늘 운동장에서 친구와 함께 놀았어요.", en: "Today I played with a friend in the schoolyard." }, paletteIdx: 1, timestamp: Date.now() - 60000, flagged: false },
    };
    // Offline cache only: promises intentionally remain pending, never sent.
    void set(ref(db, `rooms/${room}`), { columns, config, cards });
    setReady(true);
  }, []);
  if (!ready) return <p>로컬 미리보기 준비 중</p>;
  if (view === "setup") return <SetupScreen roomCode={room} availableLangs={config.languages} roomConfig={config} onDone={(u) => { setUser(u); setView("home"); }} />;
  if (view === "board") return <PadletBoard user={user} roomCode={room} roomLangs={config.languages} roomConfig={config} myClientId="preview-only" onLogout={() => setView("home")} />;
  return <>
    <HomeHub user={user} roomCode={room} availableLangs={config.languages} onChangeLang={(myLang) => setUser((u) => ({ ...u, myLang }))} onLogout={() => setView("setup")} onSelect={(v) => setView(v === "board" ? "board" : "home")} />
    {view === "post" && <PostModal colId={COLUMNS_DEFAULT[0].id} colTitle={COLUMNS_DEFAULT[0].title} colColor={COLUMNS_DEFAULT[0].color} user={user} roomCode={room} posting={false} onClose={() => setView("home")} onPost={() => setView("board")} />}
  </>;
}
