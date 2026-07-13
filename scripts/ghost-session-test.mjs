// 유령 세션 가설 검증 — 테스트 방 전용 (기본 9998). 실제 방(1111) 사용 금지.
// set|clean 인자: set = 유령 세션 심기, clean = storybook 서브트리 제거
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, remove } from "firebase/database";

const room = process.argv[2] ?? "9998";
if (room === "1111") { console.error("실제 방 금지"); process.exit(1); }
const mode = process.argv[3] ?? "set";

const app = initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
});
const db = getDatabase(app);

if (mode === "clean") {
  await remove(ref(db, `rooms/${room}/storybook`));
  console.log(`rooms/${room}/storybook 제거 완료`);
} else {
  await set(ref(db, `rooms/${room}/storybook`), { session: { autoReading: false } });
  console.log(`rooms/${room}/storybook/session = {autoReading:false} (유령 세션) 설정 완료`);
}
process.exit(0);
