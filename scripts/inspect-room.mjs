// 방 데이터 읽기 전용 검사 — 화이트보드/그림책 오류 진단용 (쓰기 없음)
// 사용법: node scripts/inspect-room.mjs 1111
import { initializeApp } from "firebase/app";
import { getDatabase, ref, get } from "firebase/database";

const room = process.argv[2] ?? "1111";
const app = initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
});
const db = getDatabase(app);

async function peek(path, summarize) {
  try {
    const snap = await get(ref(db, path));
    const v = snap.val();
    if (v === null) { console.log(`${path}: (없음)`); return; }
    console.log(`${path}: ${summarize ? summarize(v) : JSON.stringify(v).slice(0, 600)}`);
  } catch (err) {
    console.log(`${path}: !! 읽기 실패 — ${err.message}`);
  }
}

await peek(`rooms/${room}/whiteboard/meta`);
await peek(`rooms/${room}/whiteboard`, (v) => {
  const boards = v.boards ? Object.keys(v.boards).length : 0;
  const sizes = v.boards ? Object.values(v.boards).map((b) => (b?.dataUrl || "").length) : [];
  return `meta=${JSON.stringify(v.meta)} boards=${boards}개 dataUrl길이=[${sizes.join(",")}]`;
});
await peek(`rooms/${room}/storybook/session`);
await peek(`rooms/${room}/storybook`, (v) => `keys=${Object.keys(v).join(",")}`);
await peek(`rooms/${room}/config`, (v) => `keys=${Object.keys(v).join(",")} rosterMode=${v.rosterMode} roster=${Array.isArray(v.roster) ? v.roster.length + "명" : typeof v.roster} teacherPin=${v.teacherPin ? "설정됨" : "기본"}`);
await peek(`rooms/${room}/quests`, (v) => `학생 ${Object.keys(v).length}명: ${Object.keys(v).slice(0, 5).join(",")}`);

// 그림책 세션이 가리키는 책이 실제로 존재하는지
try {
  const s = (await get(ref(db, `rooms/${room}/storybook/session`))).val();
  if (s?.bookId) {
    const stat = ["curious-worlds", "seasons-beauty"].includes(s.bookId)
      ? "정적 책"
      : (await get(ref(db, `generated_books/${s.bookId}`))).exists() ? "존재" : "❌ 삭제됨(세션이 유령 책을 가리킴)";
    console.log(`세션 bookId=${s.bookId} → ${stat} / phase=${s.phase} autoReading=${s.autoReading}`);
  }
} catch (err) { console.log("book check 실패: " + err.message); }

// generated_books 전수 무결성 — pages/characters 배열 여부
try {
  const books = (await get(ref(db, "generated_books"))).val() || {};
  for (const [id, b] of Object.entries(books)) {
    const probs = [];
    if (!Array.isArray(b.pages)) probs.push("pages가 배열 아님:" + typeof b.pages);
    if (!Array.isArray(b.characters)) probs.push("characters가 배열 아님:" + typeof b.characters);
    if (!Array.isArray(b.questions)) probs.push("questions가 배열 아님:" + typeof b.questions);
    if (b.vocab && !Array.isArray(b.vocab)) probs.push("vocab이 배열 아님:" + typeof b.vocab);
    if (!b.title?.ko) probs.push("title.ko 없음");
    if (!b.cover) probs.push("cover 없음");
    console.log(`책 ${id} "${b.title?.ko ?? "?"}": ${probs.length ? "⚠ " + probs.join(" / ") : "OK"} (pages=${Array.isArray(b.pages) ? b.pages.length : "?"}, visible=${b.visible ?? false})`);
  }
} catch (err) { console.log("books scan 실패: " + err.message); }
process.exit(0);
