// scripts/seed-board.mjs
// ──────────────────────────────────────────────────────────────────────────
// 소통창(꿀벌 소통창) 가상 샘플 채우기 스크립트
//
//   node scripts/seed-board.mjs            # 방코드 1234 에 채움
//   node scripts/seed-board.mjs 5678       # 방코드 5678 에 채움
//   node scripts/seed-board.mjs 1234 --json-only   # Firebase 쓰지 않고 JSON 만 출력
//
// 방 언어는 한국어(ko)·중국어(zh)·필리핀어(fil) 3개국어로 설정되고,
// 카드/댓글의 작성자(authorLang)와 번역(translations)이 세 언어에 골고루 들어간다.
//
// Firebase 에 직접 쓰려면 프로젝트 루트 .env.local 에 NEXT_PUBLIC_FIREBASE_* 가 있어야 한다.
// (Realtime DB 규칙이 rooms/{} 클라이언트 쓰기를 허용 — CLAUDE.md 참조)
// 자격증명이 없거나 import 가 편하면 --json-only 로 scripts/board-seed-<room>.json 을 만들어
// Firebase 콘솔 → Realtime Database → rooms/<room> 노드에 가져오기 하면 된다.
// ──────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const ROOM = (process.argv[2] && /^\d{4}$/.test(process.argv[2])) ? process.argv[2] : "1234";
const JSON_ONLY = process.argv.includes("--json-only");

// ── .env.local 간단 파서 (dotenv 미사용) ──
function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(ROOT, ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let val = m[2];
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[m[1]]) process.env[m[1]] = val;
    }
  } catch {
    // 파일 없음 — JSON_ONLY 모드면 괜찮다
  }
}
loadEnvLocal();

// ──────────────────────────────────────────────────────────────────────────
// 페르소나 (3개국어 골고루)
// ──────────────────────────────────────────────────────────────────────────
const P = {
  teacher: { name: "권준구 선생님", lang: "ko", cid: "seed_teacher",  teacher: true },
  minjun:  { name: "김민준",        lang: "ko", cid: "seed_minjun" },
  seoyeon: { name: "이서연",        lang: "ko", cid: "seed_seoyeon" },
  wangwei: { name: "왕웨이",        lang: "zh", cid: "seed_wangwei" },
  lina:    { name: "리나",          lang: "zh", cid: "seed_lina" },
  zhanglei:{ name: "장레이",        lang: "zh", cid: "seed_zhanglei" },
  maria:   { name: "마리아",        lang: "fil", cid: "seed_maria" },
  jose:    { name: "호세",          lang: "fil", cid: "seed_jose" },
  andrea:  { name: "안드레아",      lang: "fil", cid: "seed_andrea" },
};

// 오늘 안에서 시간 분산 (학습하기 = filterTodayCards 가 오늘 카드를 집어가도록)
const startOfToday = new Date(); startOfToday.setHours(8, 0, 0, 0);
let tick = 0;
const ts = () => startOfToday.getTime() + (tick++) * 6 * 60 * 1000; // 6분 간격
let pal = 0;
const palette = () => (pal++) % 6;

// card(작성자, 컬럼, {ko, zh, fil}) — originalText 는 작성자 언어 값으로 자동 선택
let cardSeq = 0;
function card(who, colId, tr) {
  const id = `seed_${colId}_${String(++cardSeq).padStart(2, "0")}`;
  return {
    id,
    colId,
    cardType: "text",
    authorLang: who.lang,
    authorName: who.name,
    authorClientId: who.cid,
    isTeacher: !!who.teacher,
    originalText: tr[who.lang],
    translations: { ...tr },
    paletteIdx: palette(),
    timestamp: ts(),
    flagged: false,
    status: "approved",
  };
}

let cmtSeq = 0;
function comment(who, tr) {
  const id = `seed_cmt_${String(++cmtSeq).padStart(2, "0")}`;
  return [id, {
    id,
    authorName: who.name,
    authorLang: who.lang,
    authorClientId: who.cid,
    isTeacher: !!who.teacher,
    text: tr[who.lang],
    translations: { ...tr },
    timestamp: ts(),
    status: "approved",
    flagged: false,
  }];
}

// ──────────────────────────────────────────────────────────────────────────
// 컬럼 (기본 3개 유지)
// ──────────────────────────────────────────────────────────────────────────
const columns = {
  col1: { title: "🙋 자기소개 / Introduce", color: "#F59E0B", order: 0 },
  col2: { title: "💬 오늘의 이야기 / Today", color: "#FB7185", order: 1 },
  col3: { title: "🌟 칭찬해요 / Praise",     color: "#10B981", order: 2 },
};

// ──────────────────────────────────────────────────────────────────────────
// 카드들
// ──────────────────────────────────────────────────────────────────────────
const cardList = [
  // ── col1 자기소개 ──
  card(P.teacher, "col1", {
    ko: "안녕하세요! 저는 권준구 선생님이에요. 우리 반에 온 걸 환영해요 🐝",
    zh: "大家好！我是权俊求老师。欢迎来到我们班 🐝",
    fil: "Kumusta! Ako si Teacher Kwon Jungu. Maligayang pagdating sa aming klase 🐝",
  }),
  card(P.maria, "col1", {
    fil: "Kumusta! Ako si Maria, galing ako sa Pilipinas. Mahilig akong kumanta.",
    ko: "안녕하세요! 저는 필리핀에서 온 마리아예요. 노래 부르는 걸 좋아해요.",
    zh: "你好！我是来自菲律宾的玛利亚。我喜欢唱歌。",
  }),
  card(P.wangwei, "col1", {
    zh: "你好！我叫王伟，来自中国北京。我喜欢踢足球。",
    ko: "안녕하세요! 저는 왕웨이예요. 중국 베이징에서 왔어요. 축구를 좋아해요.",
    fil: "Kumusta! Ako si Wang Wei mula sa Beijing, China. Mahilig akong maglaro ng football.",
  }),
  card(P.minjun, "col1", {
    ko: "내 이름은 김민준이야. 한국에서 태어났어. 친구를 많이 사귀고 싶어!",
    zh: "我叫金敏俊。我在韩国出生。我想交很多朋友！",
    fil: "Ako si Kim Minjun. Ipinanganak ako sa Korea. Gusto kong magkaroon ng maraming kaibigan!",
  }),
  card(P.jose, "col1", {
    fil: "Ako si Jose. May dalawang kapatid ako. Masaya akong makilala kayo!",
    ko: "저는 호세예요. 동생이 두 명 있어요. 만나서 반가워요!",
    zh: "我是何塞。我有两个弟弟妹妹。很高兴认识你们！",
  }),
  card(P.lina, "col1", {
    zh: "我是李娜，今年十岁。我最喜欢画画和看书。",
    ko: "저는 리나예요. 올해 열 살이에요. 그림 그리기와 책 읽기를 가장 좋아해요.",
    fil: "Ako si Li Na, sampung taong gulang. Paborito kong gawin ang pagdrawing at pagbasa ng libro.",
  }),

  // ── col2 오늘의 이야기 ──
  card(P.andrea, "col2", {
    fil: "Kahapon, kumain kami ng adobo sa bahay. Napakasarap!",
    ko: "어제 집에서 아도보를 먹었어요. 정말 맛있었어요!",
    zh: "昨天我们在家吃了菲律宾炖肉（adobo），非常好吃！",
  }),
  card(P.seoyeon, "col2", {
    ko: "오늘 아침에 비가 와서 우산을 쓰고 학교에 왔어요.",
    zh: "今天早上下雨了，我打着雨伞来上学。",
    fil: "Umulan kaninang umaga kaya nagdala ako ng payong papuntang paaralan.",
  }),
  card(P.zhanglei, "col2", {
    zh: "今天我们在课堂上学了韩语数字，很有意思！",
    ko: "오늘 수업 시간에 한국어 숫자를 배웠어요. 정말 재미있었어요!",
    fil: "Ngayon natuto kami ng mga numero sa Korean sa klase. Nakakatuwa!",
  }),
  card(P.maria, "col2", {
    fil: "Miss ko na ang lola ko sa Pilipinas. Tatawagan ko siya mamaya.",
    ko: "필리핀에 계신 할머니가 보고 싶어요. 이따가 전화할 거예요.",
    zh: "我想念在菲律宾的奶奶。我待会儿要给她打电话。",
  }),
  card(P.minjun, "col2", {
    ko: "점심에 떡볶이를 먹었는데 조금 매웠어요. 그래도 맛있었어요!",
    zh: "午饭吃了炒年糕，有点辣，不过还是很好吃！",
    fil: "Tteokbokki ang kinain ko sa tanghalian. Medyo maanghang pero masarap pa rin!",
  }),
  card(P.wangwei, "col2", {
    zh: "周末我和爸爸妈妈一起去了公园，我们放了风筝。",
    ko: "주말에 아빠 엄마랑 같이 공원에 갔어요. 우리는 연을 날렸어요.",
    fil: "Noong weekend, pumunta kami ng tatay at nanay ko sa parke. Nagpalipad kami ng saranggola.",
  }),

  // ── col3 칭찬해요 ──
  card(P.teacher, "col3", {
    ko: "마리아가 오늘 친구를 많이 도와줬어요. 정말 친절해요! 👏",
    zh: "玛利亚今天帮助了很多同学，她真善良！👏",
    fil: "Tinulungan ni Maria ang maraming kaklase ngayon. Napakabait niya! 👏",
  }),
  card(P.jose, "col3", {
    fil: "Salamat Wang Wei sa pagtulong sa akin sa math kanina!",
    ko: "아까 수학 도와줘서 고마워, 왕웨이!",
    zh: "谢谢你王伟，刚才帮我做数学题！",
  }),
  card(P.lina, "col3", {
    zh: "敏俊跑步很快，今天体育课他得了第一名！太棒了！",
    ko: "민준이는 달리기가 정말 빨라요. 오늘 체육 시간에 1등 했어요! 멋져요!",
    fil: "Napakabilis tumakbo ni Minjun. Naging una siya sa PE ngayon! Galing!",
  }),
  card(P.seoyeon, "col3", {
    ko: "안드레아가 그림을 정말 잘 그려요. 우리 반 화가예요! 🎨",
    zh: "安德莉亚画画画得真好，她是我们班的画家！🎨",
    fil: "Ang galing magdrawing ni Andrea. Siya ang pintor ng aming klase! 🎨",
  }),
  card(P.andrea, "col3", {
    fil: "Magaling kumanta si Seoyeon! Parang totoong mang-aawit.",
    ko: "서연이는 노래를 정말 잘 불러요! 진짜 가수 같아요.",
    zh: "瑞妍唱歌唱得真好！就像真正的歌手一样。",
  }),
  card(P.zhanglei, "col3", {
    zh: "谢谢老师每天教我们韩语，我学到了很多！",
    ko: "매일 한국어를 가르쳐 주셔서 감사합니다, 선생님. 정말 많이 배웠어요!",
    fil: "Salamat po Teacher sa pagtuturo ng Korean araw-araw. Marami akong natutunan!",
  }),
];

// ──────────────────────────────────────────────────────────────────────────
// 댓글 (몇 개 카드에 3개국어 대화 붙이기)
// ──────────────────────────────────────────────────────────────────────────
// 마리아 자기소개(seed_col1_02) 에 댓글
cardList[1].comments = Object.fromEntries([
  comment(P.wangwei, {
    zh: "玛利亚你好！我也喜欢唱歌，我们一起唱吧！",
    ko: "마리아 안녕! 나도 노래 좋아해. 같이 부르자!",
    fil: "Kumusta Maria! Mahilig din akong kumanta, magkanta tayo!",
  }),
  comment(P.minjun, {
    ko: "반가워 마리아! 어떤 노래 좋아해?",
    zh: "很高兴认识你，玛利亚！你喜欢什么歌？",
    fil: "Ikinagagalak kong makilala ka, Maria! Anong kanta ang gusto mo?",
  }),
]);

// 왕웨이 자기소개(seed_col1_03) 에 댓글
cardList[2].comments = Object.fromEntries([
  comment(P.jose, {
    fil: "Mahilig din ako sa football! Maglaro tayo sa recess.",
    ko: "나도 축구 좋아해! 쉬는 시간에 같이 하자.",
    zh: "我也喜欢足球！课间一起踢吧。",
  }),
]);

// 선생님 칭찬(seed_col3_01) 에 댓글
cardList[12].comments = Object.fromEntries([
  comment(P.maria, {
    fil: "Salamat po Teacher! 😊",
    ko: "감사합니다, 선생님! 😊",
    zh: "谢谢老师！😊",
  }),
]);

// ──────────────────────────────────────────────────────────────────────────
// 트리 조립
// ──────────────────────────────────────────────────────────────────────────
const cardsNode = {};
for (const c of cardList) cardsNode[c.id] = c;

const roomTree = {
  config: {
    languages: ["ko", "zh", "fil"],
    qrEntry: true,
    approvalMode: false,
    rosterMode: false,
  },
  columns,
  cards: cardsNode,
};

// JSON 파일 출력 (콘솔 import 용)
const jsonPath = resolve(ROOT, `scripts/board-seed-${ROOM}.json`);
writeFileSync(jsonPath, JSON.stringify(roomTree, null, 2), "utf8");
console.log(`📄 콘솔 import용 JSON 작성: ${jsonPath}`);
console.log(`   카드 ${cardList.length}개 · 댓글 ${cmtSeq}개 · 언어 ko/zh/fil`);

if (JSON_ONLY) {
  console.log("✅ --json-only: Firebase 쓰기 생략. 콘솔 rooms/" + ROOM + " 에 가져오기 하세요.");
  process.exit(0);
}

// Firebase 직접 쓰기
if (!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL) {
  console.error("\n⚠ .env.local 에 NEXT_PUBLIC_FIREBASE_* 가 없습니다.");
  console.error("  → 위 JSON 을 Firebase 콘솔에서 rooms/" + ROOM + " 에 가져오거나,");
  console.error("    .env.local 을 채운 뒤 다시 실행하세요.");
  process.exit(1);
}

const { initializeApp } = await import("firebase/app");
const { getDatabase, ref, update } = await import("firebase/database");

const fbApp = initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
});
const db = getDatabase(fbApp);

// 기존 카드/컬럼을 지우지 않고 병합(update). 같은 방을 초기화하려면 콘솔에서 rooms/<room> 삭제 후 실행.
await update(ref(db, `rooms/${ROOM}/config`), roomTree.config);
await update(ref(db, `rooms/${ROOM}/columns`), roomTree.columns);
await update(ref(db, `rooms/${ROOM}/cards`), roomTree.cards);

console.log(`\n✅ Firebase rooms/${ROOM} 에 샘플을 채웠습니다.`);
console.log(`   학생: /${ROOM} 으로 접속 (방 언어 ko/zh/fil)`);
process.exit(0);
