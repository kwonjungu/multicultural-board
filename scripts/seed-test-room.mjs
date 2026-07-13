// 테스트 방 시딩/정리 — 꾸미기 검증용 (프로덕션 방 오염 방지를 위해 전용 방 사용)
// 사용법: node scripts/seed-test-room.mjs 9998 26   # roster+스티커 26개 시딩
//         node scripts/seed-test-room.mjs 9998 clean # 방 통째로 삭제
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, remove } from "firebase/database";

const room = process.argv[2] ?? "9998";
const arg = process.argv[3] ?? "26";
const NAME = "테스트꿀벌";

const app = initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
});
const db = getDatabase(app);

if (arg === "clean") {
  await remove(ref(db, `rooms/${room}`));
  console.log(`rooms/${room} 삭제 완료`);
  process.exit(0);
}

const n = Math.max(0, parseInt(arg, 10) || 0);
await set(ref(db, `rooms/${room}/config`), {
  rosterMode: true,
  roster: [NAME],
});
const TYPES = ["helpful", "brave", "creative", "cooperative", "persistent", "curious"];
const stickers = {};
for (let i = 0; i < n; i++) {
  stickers[`seed${String(i).padStart(3, "0")}`] = {
    id: `seed${String(i).padStart(3, "0")}`,
    type: TYPES[i % TYPES.length],
    fromTeacherName: "시딩",
    fromTeacherId: "seed",
    timestamp: Date.now() - (n - i) * 60000,
    source: "teacher",
  };
}
await set(ref(db, `rooms/${room}/stickers/individual/${NAME}`), stickers);
console.log(`rooms/${room}: roster=[${NAME}], 스티커 ${n}개 시딩 완료`);
process.exit(0);
