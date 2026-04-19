// BeeWorldMarble — board, tiles, and chance card data.
// 30-tile loop, pure data; the reducer consumes this to drive gameplay.

import type { LangMap } from "./gameData";

export type TileType =
  | "start"
  | "city"
  | "chance"
  | "key"
  | "tax"
  | "festival"
  | "jail"
  | "space";

export type ColorGroup =
  | "eastAsia"
  | "southeastA"
  | "southeastB"
  | "southAsia"
  | "centralAsia"
  | "westAsia"
  | "europe"
  | "americas";

export interface Tile {
  idx: number;
  type: TileType;
  country?: string; // ISO code aligned with COUNTRIES
  color?: ColorGroup;
  price?: number;
  tollBase?: number;
  landmark?: LangMap;
  /**
   * Optional city-specific artwork (e.g. "/cities/usa-liberty.png").
   * When present, Tile prefers it over the generic country landmark;
   * if the file is missing at runtime the <img onError> path falls
   * back to the country landmark and then to an emoji.
   */
  image?: string;
}

// Landmark image per country code — only 15 files exist in /public/landmarks.
// Anything missing falls back to an emoji in <Tile>.
export const COUNTRY_LANDMARK_IMG: Record<string, string> = {
  KR: "/landmarks/korea.png",
  JP: "/landmarks/japan.png",
  CN: "/landmarks/china.png",
  MN: "/landmarks/mongolia.png",
  VN: "/landmarks/vietnam.png",
  TH: "/landmarks/thailand.png",
  PH: "/landmarks/philippines.png",
  ID: "/landmarks/indonesia.png",
  KH: "/landmarks/cambodia.png",
  IN: "/landmarks/india.png",
  MM: "/landmarks/myanmar.png",
  UZ: "/landmarks/uzbekistan.png",
  SA: "/landmarks/saudi.png",
  RU: "/landmarks/russia.png",
  US: "/landmarks/usa.png",
};

export const COLOR_GROUP_BG: Record<ColorGroup, string> = {
  eastAsia:    "#FCA5A5",
  southeastA:  "#FDBA74",
  southeastB:  "#FCD34D",
  southAsia:   "#A7F3D0",
  centralAsia: "#93C5FD",
  westAsia:    "#C4B5FD",
  europe:      "#F9A8D4",
  americas:    "#FDE68A",
};

// 30 tiles. Planner's literal is copied verbatim; per §2 note, the 3rd chance
// at idx 27 is dropped and replaced with a second US city so chance count is 2.
export const TILES: Tile[] = [
  { idx: 0, type: "start" },
  { idx: 1, type: "city", country: "KR", color: "eastAsia", price: 240, tollBase: 48,
    landmark: { ko: "서울 남산타워", en: "Seoul N Tower", vi: "Tháp Namsan", zh: "首尔南山塔", ja: "ソウルNタワー" } },
  { idx: 2, type: "city", country: "JP", color: "eastAsia", price: 260, tollBase: 52,
    landmark: { ko: "도쿄 스카이트리", en: "Tokyo Skytree", vi: "Tháp Tokyo", zh: "东京晴空塔", ja: "東京スカイツリー" } },
  { idx: 3, type: "chance" },
  { idx: 4, type: "city", country: "CN", color: "eastAsia", price: 250, tollBase: 50,
    landmark: { ko: "만리장성", en: "Great Wall", vi: "Vạn Lý Trường Thành", zh: "长城", ja: "万里の長城" } },
  { idx: 5, type: "city", country: "MN", color: "eastAsia", price: 220, tollBase: 44,
    landmark: { ko: "울란바토르 초원", en: "Steppe of Ulaanbaatar", vi: "Thảo nguyên Mông Cổ", zh: "乌兰巴托草原", ja: "ウランバートル草原" },
    image: "/cities/mn-ulaanbaatar.png" },
  { idx: 6, type: "jail" },
  { idx: 7, type: "city", country: "VN", color: "southeastA", price: 230, tollBase: 46,
    landmark: { ko: "하롱베이", en: "Ha Long Bay", vi: "Vịnh Hạ Long", zh: "下龙湾", ja: "ハロン湾" } },
  { idx: 8, type: "city", country: "TH", color: "southeastA", price: 240, tollBase: 48,
    landmark: { ko: "방콕 왕궁", en: "Grand Palace", vi: "Cung điện Bangkok", zh: "曼谷大皇宫", ja: "バンコク王宮" } },
  { idx: 9, type: "key" },
  { idx: 10, type: "city", country: "PH", color: "southeastA", price: 220, tollBase: 44,
    landmark: { ko: "마닐라 해변", en: "Manila Beach", vi: "Bãi biển Manila", zh: "马尼拉海滩", ja: "マニラビーチ" },
    image: "/cities/ph-manila.png" },
  { idx: 11, type: "city", country: "ID", color: "southeastB", price: 240, tollBase: 48,
    landmark: { ko: "발리 해변", en: "Bali Beach", vi: "Biển Bali", zh: "巴厘岛海滩", ja: "バリ島ビーチ" },
    image: "/cities/id-bali.png" },
  { idx: 12, type: "city", country: "KH", color: "southeastB", price: 220, tollBase: 44,
    landmark: { ko: "앙코르와트", en: "Angkor Wat", vi: "Angkor Wat", zh: "吴哥窟", ja: "アンコール・ワット" } },
  { idx: 13, type: "tax" },
  { idx: 14, type: "city", country: "IN", color: "southAsia", price: 260, tollBase: 52,
    landmark: { ko: "타지마할", en: "Taj Mahal", vi: "Lăng Taj Mahal", zh: "泰姬陵", ja: "タージ・マハル" } },
  { idx: 15, type: "festival" },
  { idx: 16, type: "city", country: "MM", color: "southAsia", price: 220, tollBase: 44,
    landmark: { ko: "쉐다곤 파고다", en: "Shwedagon Pagoda", vi: "Shwedagon", zh: "仰光大金塔", ja: "シュエダゴン・パゴダ" } },
  { idx: 17, type: "city", country: "UZ", color: "centralAsia", price: 230, tollBase: 46,
    landmark: { ko: "사마르칸트 광장", en: "Samarkand Square", vi: "Quảng trường Samarkand", zh: "撒马尔罕", ja: "サマルカンド広場" } },
  { idx: 18, type: "chance" },
  { idx: 19, type: "city", country: "MN", color: "centralAsia", price: 240, tollBase: 48,
    landmark: { ko: "몽골 초원 하이킹", en: "Mongolian Steppe Hike", vi: "Trekking thảo nguyên", zh: "蒙古草原徒步", ja: "モンゴル草原ハイキング" },
    image: "/cities/mn-steppe.png" },
  { idx: 20, type: "space" },
  { idx: 21, type: "city", country: "SA", color: "westAsia", price: 250, tollBase: 50,
    landmark: { ko: "사막 오아시스", en: "Desert Oasis", vi: "Ốc đảo sa mạc", zh: "沙漠绿洲", ja: "砂漠のオアシス" } },
  { idx: 22, type: "city", country: "RU", color: "westAsia", price: 240, tollBase: 48,
    landmark: { ko: "붉은 광장", en: "Red Square", vi: "Quảng trường Đỏ", zh: "红场", ja: "赤の広場" },
    image: "/cities/ru-red-square.png" },
  { idx: 23, type: "key" },
  { idx: 24, type: "city", country: "RU", color: "europe", price: 270, tollBase: 54,
    landmark: { ko: "상트페테르부르크", en: "Saint Petersburg", vi: "Saint Petersburg", zh: "圣彼得堡", ja: "サンクトペテルブルク" },
    image: "/cities/ru-petersburg.png" },
  { idx: 25, type: "city", country: "US", color: "americas", price: 290, tollBase: 58,
    landmark: { ko: "자유의 여신상", en: "Statue of Liberty", vi: "Tượng Nữ thần Tự do", zh: "自由女神像", ja: "自由の女神" },
    image: "/cities/usa-liberty.png" },
  { idx: 26, type: "city", country: "US", color: "americas", price: 280, tollBase: 56,
    landmark: { ko: "그랜드 캐니언", en: "Grand Canyon", vi: "Grand Canyon", zh: "大峡谷", ja: "グランドキャニオン" },
    image: "/cities/usa-grand-canyon.png" },
  // Originally chance — swapped to city per planner §2 note (keep chance count = 2).
  { idx: 27, type: "city", country: "US", color: "americas", price: 260, tollBase: 52,
    landmark: { ko: "샌프란시스코 금문교", en: "Golden Gate Bridge", vi: "Cầu Golden Gate", zh: "金门大桥", ja: "ゴールデンゲート橋" },
    image: "/cities/usa-golden-gate.png" },
  { idx: 28, type: "city", country: "PH", color: "southeastB", price: 240, tollBase: 48,
    landmark: { ko: "세부 해변", en: "Cebu Beach", vi: "Biển Cebu", zh: "宿务海滩", ja: "セブビーチ" },
    image: "/cities/ph-cebu.png" },
  { idx: 29, type: "city", country: "ID", color: "southeastB", price: 250, tollBase: 50,
    landmark: { ko: "자카르타", en: "Jakarta", vi: "Jakarta", zh: "雅加达", ja: "ジャカルタ" },
    image: "/cities/id-jakarta.png" },
];

export const BOARD_SIZE = TILES.length; // 30
export const START_INDEX = 0;
export const JAIL_INDEX = 6;
export const FESTIVAL_INDEX = 15;
export const SPACE_INDEX = 20;

// ──────────────────────────────────────────────────────────────
// Chance cards
// ──────────────────────────────────────────────────────────────

export type ChanceEffect =
  | { kind: "move"; to: number }
  | { kind: "moveRel"; by: number }
  | { kind: "gain"; amount: number }
  | { kind: "lose"; amount: number }
  | { kind: "toJail" }
  | { kind: "toFestival" }
  | { kind: "skipNext" }
  | { kind: "quiz"; reward: number };

export interface ChanceCard {
  id: string;
  title: LangMap;
  body: LangMap;
  effect: ChanceEffect;
}

export const CHANCES: ChanceCard[] = [
  {
    id: "c01",
    title: { ko: "서울 김장축제 초대", en: "Seoul Kimjang Festival", vi: "Lễ hội Kimjang Seoul", zh: "首尔泡菜节", ja: "ソウル キムジャン祭り" },
    body:  { ko: "시작 칸으로 이동해 함께 김치를 담가요.", en: "Go to Start and share kimchi together.", vi: "Về ô Start và cùng làm kim chi.", zh: "返回起点，一起做泡菜。", ja: "スタートに戻ってキムチを作ろう。" },
    effect: { kind: "move", to: 0 },
  },
  {
    id: "c02",
    title: { ko: "도쿄 불꽃축제", en: "Tokyo Hanabi", vi: "Lễ hội pháo hoa Tokyo", zh: "东京烟花节", ja: "東京 花火大会" },
    body:  { ko: "도쿄 스카이트리로 이동!", en: "Move to Tokyo Skytree!", vi: "Đến Tháp Tokyo!", zh: "前往东京晴空塔!", ja: "東京スカイツリーへ移動!" },
    effect: { kind: "move", to: 2 },
  },
  {
    id: "c03",
    title: { ko: "만리장성 하이킹", en: "Great Wall Hike", vi: "Leo Vạn Lý Trường Thành", zh: "长城徒步", ja: "万里の長城ハイキング" },
    body:  { ko: "만리장성 칸으로 이동해 함께 걸어요.", en: "Move to the Great Wall and walk together.", vi: "Đến ô Vạn Lý Trường Thành.", zh: "前往长城，一起行走。", ja: "万里の長城へ移動してみんなで歩こう。" },
    effect: { kind: "move", to: 4 },
  },
  {
    id: "c04",
    title: { ko: "쌀국수 나눔", en: "Sharing Pho", vi: "Chia sẻ phở", zh: "分享越南粉", ja: "フォーのおすそ分け" },
    body:  { ko: "친구가 쌀국수를 나눠줬어요. +100", en: "A friend shared pho. +100", vi: "Bạn mời phở. +100", zh: "朋友请你吃越南粉。+100", ja: "友達がフォーをごちそう。+100" },
    effect: { kind: "gain", amount: 100 },
  },
  {
    id: "c05",
    title: { ko: "송끄란 물축제", en: "Songkran Festival", vi: "Lễ hội Songkran", zh: "宋干节", ja: "ソンクラーン水祭り" },
    body:  { ko: "축제장으로 이동해요!", en: "Go to the Festival tile!", vi: "Đến ô Lễ hội!", zh: "前往庆典方块!", ja: "フェスティバルのマスへ!" },
    effect: { kind: "toFestival" },
  },
  {
    id: "c06",
    title: { ko: "바틱 선물", en: "Batik Gift", vi: "Quà Batik", zh: "巴迪礼物", ja: "バティックのプレゼント" },
    body:  { ko: "인도네시아 친구가 바틱을 선물했어요. +80", en: "An Indonesian friend gifted batik. +80", vi: "Bạn Indonesia tặng vải Batik. +80", zh: "印尼朋友送你巴迪布。+80", ja: "インドネシアの友達からバティック。+80" },
    effect: { kind: "gain", amount: 80 },
  },
  {
    id: "c07",
    title: { ko: "하리라야 인사", en: "Hari Raya Greeting", vi: "Lời chúc Hari Raya", zh: "开斋节问候", ja: "ハリラヤのあいさつ" },
    body:  { ko: "말레이시아 친구에게 축하 인사를 받았어요. +60", en: "A Malay friend greeted you. +60", vi: "Bạn Malaysia gửi lời chúc. +60", zh: "马来朋友的祝福。+60", ja: "マレーシアの友達から祝福。+60" },
    effect: { kind: "gain", amount: 60 },
  },
  {
    id: "c08",
    title: { ko: "홀리 축제 물감놀이", en: "Holi Color Festival", vi: "Lễ hội Holi", zh: "洒红节", ja: "ホーリー祭" },
    body:  { ko: "물감 묻혀 한 턴 쉬어요!", en: "Colors everywhere — skip next turn!", vi: "Vui quá, bỏ lượt tiếp theo!", zh: "玩得太尽兴，下回合暂停!", ja: "楽しすぎて次の番はお休み!" },
    effect: { kind: "skipNext" },
  },
  {
    id: "c09",
    title: { ko: "나담 초원 달리기", en: "Naadam Steppe Run", vi: "Chạy thảo nguyên Naadam", zh: "那达慕草原赛跑", ja: "ナーダム草原ラン" },
    body:  { ko: "몽골 초원을 함께 달려요. +3칸 전진", en: "Dash across the steppe. +3 tiles", vi: "Tiến thêm 3 ô.", zh: "前进3格。", ja: "3マス進む。" },
    effect: { kind: "moveRel", by: 3 },
  },
  {
    id: "c10",
    title: { ko: "시누로그 거리 공연", en: "Sinulog Street Parade", vi: "Diễu hành Sinulog", zh: "圣婴节游行", ja: "シヌログ パレード" },
    body:  { ko: "마닐라 해변 칸으로!", en: "Move to Manila Beach!", vi: "Đến Bãi biển Manila!", zh: "前往马尼拉海滩!", ja: "マニラビーチへ!" },
    effect: { kind: "move", to: 10 },
  },
  {
    id: "c11",
    title: { ko: "사마르칸트 시장", en: "Samarkand Market", vi: "Chợ Samarkand", zh: "撒马尔罕市场", ja: "サマルカンド市場" },
    body:  { ko: "가게에서 선물을 받았어요. +70", en: "You got a market gift. +70", vi: "Được tặng quà chợ. +70", zh: "收到市场礼物。+70", ja: "市場のおまけ。+70" },
    effect: { kind: "gain", amount: 70 },
  },
  {
    id: "c12",
    title: { ko: "카자흐 초원 캠핑", en: "Kazakh Steppe Camp", vi: "Cắm trại thảo nguyên Kazakh", zh: "哈萨克草原露营", ja: "カザフ草原キャンプ" },
    body:  { ko: "2칸 전진해 별을 봐요.", en: "Move +2 tiles to stargaze.", vi: "Tiến 2 ô ngắm sao.", zh: "前进2格看星星。", ja: "2マス進んで星を眺めよう。" },
    effect: { kind: "moveRel", by: 2 },
  },
  {
    id: "c13",
    title: { ko: "튀르키예 열기구 여행", en: "Türkiye Balloon Ride", vi: "Khinh khí cầu Thổ Nhĩ Kỳ", zh: "土耳其热气球", ja: "トルコ 気球旅" },
    body:  { ko: "사막 오아시스(서아시아)로 이동!", en: "Move to the Desert Oasis!", vi: "Đến Ốc đảo sa mạc!", zh: "前往沙漠绿洲!", ja: "砂漠のオアシスへ!" },
    effect: { kind: "move", to: 21 },
  },
  {
    id: "c14",
    title: { ko: "대추야자 선물", en: "Date Fruit Gift", vi: "Quà chà là", zh: "椰枣礼物", ja: "デーツの贈り物" },
    body:  { ko: "사우디 친구가 대추야자를 나눠줬어요. +50", en: "A Saudi friend shared dates. +50", vi: "Bạn Ả-rập tặng chà là. +50", zh: "沙特朋友送椰枣。+50", ja: "サウジの友達からデーツ。+50" },
    effect: { kind: "gain", amount: 50 },
  },
  {
    id: "c15",
    title: { ko: "파리 피크닉", en: "Paris Picnic", vi: "Picnic Paris", zh: "巴黎野餐", ja: "パリ ピクニック" },
    body:  { ko: "상트페테르부르크(유럽) 칸으로!", en: "Move to the European tile!", vi: "Đến ô châu Âu!", zh: "前往欧洲方块!", ja: "ヨーロッパのマスへ!" },
    effect: { kind: "move", to: 24 },
  },
  {
    id: "c16",
    title: { ko: "로마 분수 동전", en: "Rome Fountain Coin", vi: "Đồng xu đài phun Roma", zh: "罗马许愿池", ja: "ローマの噴水コイン" },
    body:  { ko: "소원을 빌며 동전을 던졌어요. -40", en: "You tossed a wish coin. -40", vi: "Thả xu ước nguyện. -40", zh: "抛币许愿。-40", ja: "願いを込めてコイン。-40" },
    effect: { kind: "lose", amount: 40 },
  },
  {
    id: "c17",
    title: { ko: "독일 크리스마스 쿠키", en: "German Christmas Cookies", vi: "Bánh Noel Đức", zh: "德国圣诞饼干", ja: "ドイツのクリスマスクッキー" },
    body:  { ko: "구운 쿠키를 팔아요. +90", en: "You sold homemade cookies. +90", vi: "Bán bánh nướng. +90", zh: "卖手工饼干。+90", ja: "手作りクッキーを販売。+90" },
    effect: { kind: "gain", amount: 90 },
  },
  {
    id: "c18",
    title: { ko: "삼바 퍼레이드", en: "Samba Parade", vi: "Diễu hành Samba", zh: "桑巴游行", ja: "サンバ パレード" },
    body:  { ko: "뒷걸음으로 리듬을! -2칸", en: "Dance backwards. -2 tiles", vi: "Lùi 2 ô theo điệu nhảy.", zh: "后退2格跳舞。", ja: "リズムで2マス戻る。" },
    effect: { kind: "moveRel", by: -2 },
  },
  {
    id: "c19",
    title: { ko: "뉴욕 초대장", en: "New York Invitation", vi: "Lời mời New York", zh: "纽约邀请", ja: "ニューヨーク招待" },
    body:  { ko: "시작 칸으로 돌아가요.", en: "Return to Start.", vi: "Quay về ô Start.", zh: "返回起点。", ja: "スタートに戻る。" },
    effect: { kind: "move", to: 0 },
  },
  {
    id: "c20",
    title: { ko: "문화 퀴즈 보상", en: "Culture Quiz Bonus", vi: "Thưởng câu đố văn hóa", zh: "文化问答奖励", ja: "文化クイズ ボーナス" },
    body:  { ko: "문제를 맞히면 +120!", en: "Answer correctly for +120!", vi: "Trả lời đúng +120!", zh: "答对+120!", ja: "正解で +120!" },
    effect: { kind: "quiz", reward: 120 },
  },
];

// ──────────────────────────────────────────────────────────────
// Board ring layout helpers.
// 30 tiles around the outer ring of an 8-row × 9-col grid:
//   top:    row 0, cols 0..8     → idx 0..8   (9 cells)
//   right:  col 8, rows 1..7     → idx 9..15  (7 cells)
//   bottom: row 7, cols 7..0     → idx 16..23 (8 cells)
//   left:   col 0, rows 6..1     → idx 24..29 (6 cells)
// 9 + 7 + 8 + 6 = 30 ✓
// ──────────────────────────────────────────────────────────────
export interface TileCoord {
  row: number;
  col: number;
}

export const GRID_COLS = 9;
export const GRID_ROWS = 8;

export function tileCoord(idx: number): TileCoord {
  if (idx <= 8)  return { row: 0, col: idx };
  if (idx <= 15) return { row: idx - 8, col: 8 };
  if (idx <= 23) return { row: 7, col: 7 - (idx - 16) };
  return { row: 6 - (idx - 24), col: 0 };
}

// Sanity count — must equal 30; exported for runtime assert in dev.
export const TILE_COUNT_OK = TILES.length === 30;
