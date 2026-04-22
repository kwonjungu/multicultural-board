# StoryCubes (이야기 주사위) 구현 플랜

## 요약
StoryCubes는 두 명의 플레이어 A/B가 각자의 모어로 한 문장씩 이어가며 공동의 그림 이야기를 완성하는 비경쟁형 창작 게임. 게임 시작 시 `STORY_SYMBOLS`(24+)에서 `pickN(9)`으로 9개 타일을 3×3 그리드로 공개. 플레이어는 턴제로 번갈아 남은 타일 중 하나를 골라 자신의 언어 한 문장 + 선택적 상대 언어 번역 입력. 9개 소진 시 갤러리 화면으로 전환. 각 플레이어는 게임당 skip 1회, reroll 1회. 모드 "free" / "theme".

기존 컨벤션(`"use client"`, `{langA, langB}` props, `BeeMascot`, 인라인 스타일, `LangMap`/`pickN`/`tr`) 준수. `STORY_SYMBOLS`는 SpotIt 13 + VOCAB 추가 + 추상 몇 개 합해 24+. `useReducer` 로 8개 액션 관리.

## 1. 타입

```ts
export interface StorySymbol {
  id: number; key: string; emoji: string; image: string;
  label: LangMap; group: "object" | "nature" | "people" | "action" | "abstract";
}

export type StoryMode = "free" | "theme";
export type Player = "A" | "B";

export interface PickedEntry {
  order: number; by: Player; symbolId: number;
  sentence: string; sentenceLang: string;
  translation?: string; translationLang?: string;
  createdAt: number;
}

export interface GameState {
  mode: StoryMode;
  theme?: LangMap;
  tiles: StorySymbol[];
  available: number[];
  entries: PickedEntry[];
  turn: Player;
  selectedSymbolId: number | null;
  draftSentence: string;
  draftTranslation: string;
  skipsLeft: Record<Player, number>;
  rerollsLeft: Record<Player, number>;
  phase: "SELECT" | "COMPOSE" | "GALLERY";
}

export type Action =
  | { type: "SELECT_TILE"; symbolId: number }
  | { type: "EDIT_SENTENCE"; value: string }
  | { type: "EDIT_TRANSLATION"; value: string }
  | { type: "COMMIT" }
  | { type: "SKIP" }
  | { type: "REROLL" }
  | { type: "CANCEL_SELECT" }
  | { type: "RESTART" };
```

## 2. STORY_SYMBOLS 28개 (id 0~27)
SpotIt 13개(0~12) + VOCAB 재활용(13~15) + 신규 추상/자연 12개(16~27).

목록: apple, banana, cat, dog, book, water, school, house, sun, moon, rice, tea, bee, friend, family, thanks, journey, star, door, letter, secret, gift, music, dream, rain, bridge, heart, question.

각 항목 LangMap 15개 언어(ko/en/vi/zh/ja 필수, 나머지 en 폴백 허용).

## 3. 상태머신

```
INIT → SELECT → COMPOSE → COMMIT → (avail===0 ? GALLERY : SELECT)
                    ↑                      ↓
                  CANCEL                  SKIP/REROLL → SELECT (turn flip)
RESTART → INIT
```

가드: `COMMIT` 은 `draftSentence.trim()` 있을 때만. `SKIP`/`REROLL` 은 카운터>0.

## 4. UI 레이아웃

- 상단: 턴 배지(A=파랑/B=분홍), `n/9` ProgressBar, skip/reroll 버튼
- 중앙: 3×3 타일 그리드. 사용됨은 opacity 0.35 + order 배지. 선택은 녹색 테두리.
- 하단(COMPOSE): textarea 2줄 (내 언어/상대 언어), 취소/확정 버튼. IME 조합중 키 단축키 비활성.
- 커밋 시 TTS 재생(`/api/tts`).

## 5. Gallery 화면
- 헤더: BeeMascot cheer + "🎉 우리의 이야기"
- 액자 카드 세로 스택(9개). 이미지 60×60 + 문장 영역. by 플레이어 색 세로 바.
- 푸터: 다시쓰기 / 저장(알림만)

## 구현 순서
1. gameData.ts 에 StorySymbol 타입 + STORY_SYMBOLS 배열 추가
2. components/games/StoryCubes.tsx (단일 파일 ≤450줄)
3. GameRoom.tsx GAMES 배열 등록

## 제약
- TS strict, any 금지
- 입력 120자 제한
- 모든 버튼 aria-label
- 이미지 onError 이모지 폴백
- `npm run build` 통과
