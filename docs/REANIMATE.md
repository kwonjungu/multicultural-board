# 다음 세션 재개 지시문 (REANIMATE)

토큰 리셋 후 **이 문서 전체를 새 세션에 복붙** 하면 메인 Claude가 이어서 진행합니다.

## 현재 브랜치 & 최근 푸시
- 브랜치: `claude/add-communication-games-oQvl4`
- 마지막 푸시: (수시로 업데이트 — `git log --oneline -5` 확인)

## 지금까지 완료된 일 (재실행 금지)
- BeeWorldMarble 보드게임 전체 구현 (10+ 파일, `lib/marble*.ts`, `components/games/BeeWorldMarble/`)
- SpotIt 인원 2~6 + 난이도 3단계 확장
- HalliGalli 2~5인 + 효과음 + 정답 색 수정 + PlayerPanel flex 고정
- CountryGuess 100국 + 3단계 난이도
- DrawGuess 15라운드 + placeholder 정답노출 버그 수정 + 15장 AI 이미지
- EmotionQuiz 15상황 + 카드 사진 15장
- TwentyQuestions 출제자 랜드마크 PNG
- Stage×Hat 자연 합성본 20장 (classic 전용)
- HomeHub bee-celebrate 중복 제거
- 스킨 재채색 25장, DrawGuess 15장, Emotion 15장, Marble P0 16장 배치 생성
- 다수의 PNG 배경 자동 정리 (scripts/clean-bg.mjs)
- CLAUDE.md 에 실수/함정 기록

## 해결 못하고 남긴 알려진 문제 (우선순위 1)

### P1. 스킨+모자 조합에서 모자 "붕 뜸" + 스킨 배경 노출
- 현상: 예) sky 스킨 + party 모자 → 모자 위로 튕겨 올라감, skin PNG 배경 흰 직사각형
- 원인:
  1. stage×hat 합성본은 classic 전용 (20장). skin≠classic 이면 런타임 오버레이 폴백
  2. skin 재채색본 일부에 흰 배경 잔존 (clean-bg.mjs 에서 잡지 못함)
- 해결안 A (근본): 스킨 5색 × 5스테이지 × 4모자 = 100장 추가 합성 배치
- 해결안 B (타협): `scripts/clean-bg.mjs` 더 공격적으로 + PraiseHive 에서 skin+hat 조합 시 모자 숨기기 (또는 "모자는 classic 스킨에서만" 룰 안내)
- 해결안 C (최선): skin 5색 × 5스테이지 × 4모자 = 100장 Gemini edit 배치 (1회, ~$2)

### P2. SpotDiff 게임 코드와 이미지 미연결
- 이미지 10쌍 + 차이점 데이터는 `scripts/generate_spotdiff.py SCENES` 에 있음
- SpotDifference.tsx 는 여전히 이모지 기반 (이미지/좌표 통합 필요)
- TODO: ImageDiffScene 컴포넌트 작성 — 좌/우 이미지 + 차이점 체크리스트

### P3. generate_all.py PLAN 에 DrawGuess `book.png` 실패 1장 재생성 미완료

## 대기 중인 신규 게임 (사용자가 요청, 오케스트레이션 필요)
각 게임별로 docs/_plan.md + 3~4 에이전트:

1. **StoryCubes** (`components/games/StoryCubes.tsx` 단일, ~450줄)
   - 9개 이미지 타일 → 교대로 한 문장씩 이야기 이어가기
   - STORY_SYMBOLS 24+ (VOCAB + SpotIt 심볼 재활용)
   - 에이전트: Planner (Plan) → Implementer → QualityGate
   - 자세한 스펙: 이전 대화 이력 검색 `StoryCubes`

2. **BeeTreasureHunt** (`components/games/BeeTreasureHunt.tsx`, ~500줄)
   - 6×6 격자 숨바꼭질, Hider 5칸 선택 → Seeker 힌트 듣고 찾기
   - 배경 3장 필요: park/market/school (나노바나나 프롬프트 이력에 있음)
   - 에이전트: Planner → Implementer → QualityGate

3. **HoneyYut 윷놀이** (`components/games/HoneyYut/` 폴더, 7파일)
   - 전통 29점 말판 + 도/개/걸/윷/모/백도 + 지름길 분기
   - 팀 A=skin-classic, 팀 B=skin-sky
   - 에이전트: Planner → Implementer → RuleAuditor → QualityGate

4. **BeeCafe 협동 요리** (`components/games/BeeCafe/` 폴더, 9파일)
   - 손님/셰프 역할 + 재료 선택 + 조리 순서 드래그
   - 메뉴 12, 재료 20, 단계 15
   - 에이전트: Planner → Implementer → CultureAuditor → QualityGate
   - 선택 이미지: 메뉴 12 + 재료 20 = 32장 (emoji 폴백 OK)

## 오케스트레이션 방법
각 게임마다:
```
1. Agent(Plan, Planner 프롬프트) — 동기, docs/<game>-plan.md 저장
2. Agent(general-purpose, Implementer) — 동기, Plan 읽고 구현
3. Agent(general-purpose, Auditor) — 병렬/동기, Edit 권한
4. Agent(general-purpose, QualityGate) — 최종 빌드 + 커밋 + 푸시
```
메인 Claude는 **코드 직접 작성 금지**, 조율만.

## 세션 재개 시 바로 할 일 체크리스트
- [ ] `git pull` 로 원격 최신 동기화
- [ ] `npm run build` 로 현재 상태 확인
- [ ] `node scripts/sim-cosmetics.mjs` 로 200 조합 검증
- [ ] P1 스킨+모자 버그: skin 100장 합성 배치 or 코드 완화
- [ ] StoryCubes 에이전트 오케스트레이션 시작
- [ ] Treasure, Yut, Cafe 순차 진행
- [ ] 마지막: Culture Audit + Balance + Quality Gate 재점검

## 배치 API 현황
- `scripts/generate_all.py` PLAN 80+ 항목
- `scripts/generate_batch.py` — 일반 텍스트 배치
- `scripts/generate_spotdiff.py` — image-to-image edit
- `scripts/generate_skins.py` — skin 재채색
- `scripts/generate_marble_p0.py` — 마블 P0
- `scripts/generate_stage_hats.py` — stage×hat 합성
- `api.txt` 에 Gemini API 키 저장 (gitignored)
- Batch submit → poll → collect 3단계 패턴

## 주의사항 (CLAUDE.md 핵심)
- `git config` 임의 수정 금지 (사용자에게 확인)
- `anchors.json` 손대지 말 것
- `Math.round` 금지 영역(clip-path) 주의
- Windows 경로는 `fileURLToPath(import.meta.url)` 사용
- Firebase subscribe 는 seed-once draft 패턴
- clip-path 타일링 fractional px 사용

---

> 이 문서를 새 세션에 복붙하면 메인 Claude 가 "P1 → StoryCubes → Treasure → Yut → Cafe" 순서로 자동 진행합니다.
