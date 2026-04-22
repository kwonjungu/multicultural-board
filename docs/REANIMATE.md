# 다음 세션 재개 지시문 (REANIMATE)

**토큰 리셋 후 이 문서 전체를 새 세션에 복붙** 하면 메인 Claude가 이어 진행합니다.

- 브랜치: `claude/add-communication-games-oQvl4`
- 프로젝트 루트: `C:\Users\권준구\OneDrive\Desktop\multiculture\`
- 마지막 푸시: `c598afa..66a6404` (2026-04-19 ~23:XX KST)

## ✅ 완료 (재실행 금지)
- BeeWorldMarble (마블) 전체 구현 + UI 반응형 + 효과음 9종 + 3D 주사위 + 도시별 랜드마크 11장
- SpotIt 2~6인 × 난이도 3단계
- HalliGalli 2~5인 + 효과음 + 정답색
- CountryGuess 100국 × 3단계
- DrawGuess 15라운드 (AI 이미지 15장)
- EmotionQuiz 15상황 (AI 이미지 15장)
- TwentyQuestions 랜드마크 PNG
- Stage×Hat 자연 합성본 20장 (classic 전용)
- StoryCubes 게임 (28 심볼, 실제 이미지 12장)
- BeeTreasureHunt 게임 (6x6 숨바꼭질, 2라운드)
- HoneyYut 윷놀이 게임 (29노드, 지름길, 문화카드)
- BeeCafe 협동 요리 (12메뉴, Pointer 드래그)
- 마블 시작 버튼 버그 수정
- HomeHub 중복 이미지, hat-ribbon→party 대체
- sim-cosmetics 200 조합 검증
- 3개 게임 Planner 문서

## 🔄 자동 실행 중 (세션 종료 후에도 진행)
- 배치 `batches/h91jv13oibzo26904agijbuja0uwlajn56qd` — Treasure 배경 3 + 게임 아이콘 4 + 마블 중앙 로고 1 = 8장 생성
- 완료시 자동으로 `public/` 이동 + 커밋 + 푸시 (bash bg task `brtxwu4f7`)

## ⚠ 남은 알려진 P1 문제

### P1. 스킨+모자 조합 "떠있음" + 배경 잔존
- 현재: classic 스킨만 합성본 20장. skin≠classic + hat 이면 런타임 오버레이 폴백 → 떠있음
- 해결안: skin 5색 × 5스테이지 × 4모자 = 100장 Gemini edit 배치 (~$2, 15분)
- 스크립트: 기존 `scripts/generate_stage_hats.py` 참고해 `generate_skin_hats.py` 작성

### P2. SpotDifference 이미지↔코드 미연결
- 이미지 10쌍(`public/spot-diff/*_{a,b}.png`) + 차이점 데이터(`scripts/generate_spotdiff.py SCENES`) 있음
- `components/games/SpotDifference.tsx` 는 이모지 기반 유지
- TODO: 이미지 + 클릭 체크리스트 UI로 리팩터

### P3. DrawGuess book.png 1장 실패
- 재생성 필요 (`python scripts/generate_all.py game-assets`)

## 🎯 우선순위별 재개 순서

1. **P1 스킨+모자 합성**: 스크립트 작성 → 배치 100장 → `public/stickers/skin-hats/` → 렌더 로직에서 classic 아닐 때도 합성본 사용
2. **TreasureHunt 배경 3장**: 배치 완료 대기 (백그라운드에서 자동 적용)
3. **SpotDifference 리팩터**: 이미지+hit-area 체크리스트 UI
4. **Yut 시뮬 500판 검증** (Agent C Rule Auditor 역할): 도개걸윷모 확률 ±2% 이내
5. **Cafe 레시피 Culture Audit**: 12메뉴 정통성 검토 에이전트
6. **마블 Balance Audit**: 500판 시뮬레이터 + 균형 조정
7. **도시별 이미지 11장 Tile.tsx 연결 검증**: 이미 완료됐지만 시각 확인

## 🔧 주요 스크립트
- `scripts/generate_batch.py` — 일반 텍스트→이미지 배치 (submit/status/collect/run)
- `scripts/generate_spotdiff.py` — image-to-image edit
- `scripts/generate_skins.py` — 스킨 재채색
- `scripts/generate_stage_hats.py` — 스테이지×모자 합성
- `scripts/generate_city_landmarks.py` — 도시별 개별
- `scripts/generate_new_assets.py` — Treasure/게임아이콘/보드 (최신)
- `scripts/sim-cosmetics.mjs` — 200 조합 검증
- `scripts/clean-bg.mjs` — 배경 자동 정리
- `api.txt` (gitignored) — Gemini API 키

## 🗂 파일 구조 (핵심)
```
components/games/
  BeeWorldMarble/  — 10 파일 + marbleSfx.ts (2,300+줄)
  HoneyYut/        — 6 파일 + yutSfx.ts (1,100+줄)
  BeeCafe/         — 10 파일 (1,900+줄)
  BeeTreasureHunt.tsx (497줄 단일)
  StoryCubes.tsx (436줄 단일)
  SpotIt.tsx, HalliGalli.tsx, ...  (기존 14개)
lib/
  marbleData.ts, marbleReducer.ts, marbleEffects.ts, marbleTypes.ts
  yutData.ts, yutLogic.ts, yutTypes.ts
  gameData.ts (STORY_SYMBOLS, TreasureScene, VOCAB, COUNTRIES, EMOTIONS, ...)
  stage.ts (stageImageWithSkin, stageImageWithHat)
docs/
  REANIMATE.md (이 문서)
  planner.md, story-plan.md, marble-review/*
public/
  landmarks/ 15국 + cities/ 11 도시별
  stickers/ (기본) + skins/ (25 재채색) + stage-hats/ (20 합성)
  spotit/ 13 · halligalli/ 4 · marble/ (타일 7 + 건물 3)
  spot-diff/ 20 · story/ 12 · emotions/ 15 · game-assets/draw/ 15
  treasure/ (배치 대기 3) · game-icons/ 15+ · interpreter/ 3
```

## 💡 CLAUDE.md 핵심 원칙 (반드시 준수)
- `git config` 임의 수정 금지
- `anchors.json` 손대지 말 것
- clip-path 타일링 fractional px (Math.round 금지)
- Windows 경로: `fileURLToPath(import.meta.url)`
- Firebase subscribe: seed-once draft 패턴
- JSON meta key 포함 시 `as unknown as Record<...>` 두 단계 cast
- 에이전트 호출 시 파일 충돌 방지 — 각 에이전트에게 담당 폴더 명시

## 🤖 에이전트 오케스트레이션 템플릿
```
1. Agent(Plan, Planner) — 동기, docs/*.md 저장
2. Agent(general-purpose, Implementer) — 동기, Plan 읽고 구현
3. 병렬: Agent(Culture Auditor) + Agent(Balance/Rule Auditor)
4. Agent(general-purpose, QualityGate) — 빌드 + 커밋 + 푸시
메인은 직접 코드 작성 금지, 조율만.
```

## 📋 새 세션에서 바로 실행할 일
```bash
git pull
npm install
npm run build
node scripts/sim-cosmetics.mjs  # 200 검증
ls public/treasure/  # 배치 배경 3장 도착했는지
```

그 다음 **P1 스킨+모자 100장 합성 배치**부터 시작 — 사용자가 스크린샷으로 지적한 가장 눈에 띄는 이슈.
