# BeeWorldMarble (꿀벌 월드 마블) 구현 플랜

> Planner 에이전트 산출물. Implementer 는 이 문서를 그대로 구현한다.

## 0. 배치 개요
- 파일 루트: `components/games/BeeWorldMarble/`
- `GameRoom.tsx` 에 `import` + `GAMES[]` 한 줄 추가 (id "marble")
- Props 계약: `{ langA: string; langB: string }` (기존 게임 규약)
- 기존 에셋만 사용: `public/landmarks/*.png` 15국, `public/marble/tiles/*.png` 7종,
  `public/marble/buildings/*.png` 3티어, `GREETINGS`, `COUNTRIES`, `EMOTIONS`, `mascot/bee-*.png`

## 1. GameState / Action 타입

```ts
export type PlayerId = "A" | "B" | "C" | "D";
export type Lang = string;

export interface PlayerState {
  id: PlayerId;
  lang: Lang;
  pos: number;          // 0..29
  cash: number;         // starts at 1500
  owned: number[];      // tile idx list
  inJail: 0 | 1 | 2 | 3;
  inSpace: 0 | 1 | 2;
  laps: number;
  skipNext: boolean;
}

export type Phase =
  | { kind: "intro" }
  | { kind: "rolling"; who: PlayerId }
  | { kind: "moving"; who: PlayerId; from: number; to: number; step: number }
  | { kind: "landed"; who: PlayerId; tile: number }
  | { kind: "quiz"; who: PlayerId; tile: number; questionId: string }
  | { kind: "chance"; who: PlayerId; cardId: string }
  | { kind: "buyPrompt"; who: PlayerId; tile: number }
  | { kind: "tollPaid"; who: PlayerId; tile: number; amount: number }
  | { kind: "festival"; who: PlayerId }
  | { kind: "gameover"; winner: PlayerId | null };

export interface GameState {
  players: Record<PlayerId, PlayerState>;
  playerIds: PlayerId[];          // 순서 (2~4명)
  turn: PlayerId;
  phase: Phase;
  diceA: number; diceB: number; isDouble: boolean;
  doubleStreak: number;
  festivalPot: number;
  log: { ts: number; text: string }[];
  round: number;
}

export type Action =
  | { type: "start"; players: { id: PlayerId; lang: Lang }[] }
  | { type: "rollDice" }
  | { type: "rollResult"; a: number; b: number }
  | { type: "advance" }
  | { type: "arrive" }
  | { type: "answerQuiz"; correct: boolean }
  | { type: "resolveChance"; cardId: string }
  | { type: "buyYes" } | { type: "buyNo" }
  | { type: "endTurn" }
  | { type: "payTax"; amount: number }
  | { type: "releaseJail"; via: "dice" | "pay" }
  | { type: "restart" };
```

## 2. 30 타일 테이블 (TS 리터럴)

```ts
export type TileType = "start" | "city" | "chance" | "key" | "tax" | "festival" | "jail" | "space";
export type ColorGroup =
  | "eastAsia" | "southeastA" | "southeastB" | "southAsia"
  | "centralAsia" | "westAsia" | "europe" | "americas";

export interface Tile {
  idx: number;
  type: TileType;
  country?: string;
  color?: ColorGroup;
  price?: number;
  tollBase?: number;
  landmark?: { ko: string; en: string; vi: string; zh: string; ja: string };
}

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
    landmark: { ko: "울란바토르 초원", en: "Steppe of Ulaanbaatar", vi: "Thảo nguyên Mông Cổ", zh: "乌兰巴托草原", ja: "ウランバートル草原" } },
  { idx: 6, type: "jail" },
  { idx: 7, type: "city", country: "VN", color: "southeastA", price: 230, tollBase: 46,
    landmark: { ko: "하롱베이", en: "Ha Long Bay", vi: "Vịnh Hạ Long", zh: "下龙湾", ja: "ハロン湾" } },
  { idx: 8, type: "city", country: "TH", color: "southeastA", price: 240, tollBase: 48,
    landmark: { ko: "방콕 왕궁", en: "Grand Palace", vi: "Cung điện Bangkok", zh: "曼谷大皇宫", ja: "バンコク王宮" } },
  { idx: 9, type: "key" },
  { idx: 10, type: "city", country: "PH", color: "southeastA", price: 220, tollBase: 44,
    landmark: { ko: "마닐라 해변", en: "Manila Beach", vi: "Bãi biển Manila", zh: "马尼拉海滩", ja: "マニラビーチ" } },
  { idx: 11, type: "city", country: "ID", color: "southeastB", price: 240, tollBase: 48,
    landmark: { ko: "발리 해변", en: "Bali Beach", vi: "Biển Bali", zh: "巴厘岛海滩", ja: "バリ島ビーチ" } },
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
    landmark: { ko: "몽골 초원 하이킹", en: "Mongolian Steppe Hike", vi: "Trekking thảo nguyên", zh: "蒙古草原徒步", ja: "モンゴル草原ハイキング" } },
  { idx: 20, type: "space" },
  { idx: 21, type: "city", country: "SA", color: "westAsia", price: 250, tollBase: 50,
    landmark: { ko: "사막 오아시스", en: "Desert Oasis", vi: "Ốc đảo sa mạc", zh: "沙漠绿洲", ja: "砂漠のオアシス" } },
  { idx: 22, type: "city", country: "RU", color: "westAsia", price: 240, tollBase: 48,
    landmark: { ko: "붉은 광장", en: "Red Square", vi: "Quảng trường Đỏ", zh: "红场", ja: "赤の広場" } },
  { idx: 23, type: "key" },
  { idx: 24, type: "city", country: "RU", color: "europe", price: 270, tollBase: 54,
    landmark: { ko: "상트페테르부르크", en: "Saint Petersburg", vi: "Saint Petersburg", zh: "圣彼得堡", ja: "サンクトペテルブルク" } },
  { idx: 25, type: "city", country: "US", color: "americas", price: 290, tollBase: 58,
    landmark: { ko: "자유의 여신상", en: "Statue of Liberty", vi: "Tượng Nữ thần Tự do", zh: "自由女神像", ja: "自由の女神" } },
  { idx: 26, type: "city", country: "US", color: "americas", price: 280, tollBase: 56,
    landmark: { ko: "그랜드 캐니언", en: "Grand Canyon", vi: "Grand Canyon", zh: "大峡谷", ja: "グランドキャニオン" } },
  { idx: 27, type: "chance" },
  { idx: 28, type: "city", country: "PH", color: "southeastB", price: 240, tollBase: 48,
    landmark: { ko: "세부 해변", en: "Cebu Beach", vi: "Biển Cebu", zh: "宿务海滩", ja: "セブビーチ" } },
  { idx: 29, type: "city", country: "ID", color: "southeastB", price: 250, tollBase: 50,
    landmark: { ko: "자카르타", en: "Jakarta", vi: "Jakarta", zh: "雅加达", ja: "ジャカルタ" } },
];
```

집계:
- start 1, city 22, chance 3, key 2, tax 1, festival 1, jail 1, space 1 = 32 → chance 27 제거해서 chance 2 로 맞추고 idx 27 → city (추가). Implementer 자율 조정 허용.
- price 220~290 범위 (±13%).

## 3. 20 찬스 카드

```ts
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
  title: Record<string, string>;
  body: Record<string, string>;
  effect: ChanceEffect;
}
```

20장 (id c01~c20):
1. 서울 김장축제 초대 → 시작으로
2. 도쿄 하나비 → idx 2
3. 만리장성 하이킹 → idx 4
4. 쌀국수 나눔 → +100
5. 송끄란 물축제 → toFestival
6. 바틱 선물 → +80
7. 하리라야 인사 → +60
8. 홀리 축제 → skipNext
9. 나담 초원달리기 → +3칸
10. 시누로그 거리공연 → idx 10
11. 사마르칸트 시장 → +70
12. 카자흐 초원 캠핑 → +2칸
13. 튀르키예 풍선 여행 → idx 21
14. 대추야자 선물 → +50
15. 파리 피크닉 → idx 24
16. 로마 분수 동전 → -40
17. 독일 크리스마스 쿠키 → +90
18. 삼바 퍼레이드 → -2칸 (뒤로 즐기며)
19. 뉴욕 초대 → 시작
20. 문화 퀴즈 보상 → quiz(120)

모두 ko/en/vi/zh/ja 5언어 LangMap 필수. "어느 나라 우월" 함의 없음, "함께 축하" 톤.

## 4. 문화 퀴즈 생성 (의사코드)

```
function makeQuiz(tile, viewerLang, friendLang):
  kind = pickWeighted([country-flag: 0.5, greeting: 0.3, emotion: 0.2])
  switch kind:
    country-flag: tile.country의 flag 맞추기, wrongs 3개 같은 color group
    greeting:     country의 lang으로 된 인사말 맞추기
    emotion:      EMOTIONS 중 하나, 이모지 4지선다
  return { prompt, choices, answerIdx, timeoutSec: 20 }
```

## 5. 파일별 exports / props 계약

```
components/games/BeeWorldMarble/
  index.tsx            export default function({ langA, langB })
  Board.tsx            export function Board({ state, onTileClick? })
  Tile.tsx             export function Tile({ tile, owners, occupants, viewerLang, highlight? })
  DicePanel.tsx        export function DicePanel({ a, b, rolling, canRoll, onRoll })
  ActionPanel.tsx      export function ActionPanel({ state, viewerLang, friendLang, dispatch })
  QuizCard.tsx         export function QuizCard({ tileIdx, langA, langB, onAnswer })
  ChanceCard.tsx       export function ChanceCard({ card, langA, langB, onDone })
  PlayerHud.tsx        export function PlayerHud({ players, turn, viewerLang })
  LogTicker.tsx        export function LogTicker({ log })
  CharacterSetup.tsx   export function CharacterSetup({ langA, langB, onDone })

lib/marbleData.ts      TILES, CHANCES, 타입
lib/marbleReducer.ts   initialState, reducer (순수, 테스트 가능)
```

## 6. 구현 순서 DAG

```
1. lib/marbleData.ts (TILES, CHANCES, 타입)
       ▼
2. lib/marbleReducer.ts (reducer, initialState)
       ▼
3. Tile.tsx + Board.tsx (시각)
       ▼
4. DicePanel + PlayerHud
       ▼
5. QuizCard + ChanceCard
       ▼
6. ActionPanel (phase dispatch hub)
       ▼
7. LogTicker, CharacterSetup
       ▼
8. index.tsx (useReducer + 이동 애니)
       ▼
9. GameRoom.tsx 등록
```

## 체크리스트

- [ ] TILES.length === 30, 타입별 집계 정확
- [ ] 도시 price 220~290
- [ ] 3 doubles → 무인도
- [ ] 파산 판정 cash<0 & 매각 불가 → gameover
- [ ] 시작 통과 +200, 0 통과 시 laps++
- [ ] tr() 로 viewerLang 우선, friendLang sub 병기
- [ ] 모든 <img> onError 이모지 폴백
- [ ] 모든 버튼 aria-label
- [ ] `npm run build` 통과
- [ ] 2~4인 지원 (playerIds 배열 길이 기반)
