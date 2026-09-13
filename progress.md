# 진행 기록 — 꿀벌소통창 아동 UI 개선 (설계 패키지 20260913)

설계 패키지: `C:\Users\권준구\Desktop\꿀벌소통창_Opus_실행설계_20260913`
우선 문서: `04_아동서비스_디자인검수와기기최적화.md`

---

## 작업 환경 (T00에서 확정)

```
작업 경로       C:\Users\권준구\multicultural-board-childux-20260913   (git worktree)
작업 브랜치     feat/child-ux-20260913
기준 커밋       601a8f079014946ff02fe49089fd449e86fbec1e  (= origin/main, 2026-09-12)
본체 저장소     C:\Users\권준구\multicultural-board                     (main, c2d4bf6, 손대지 않음)
개발 서버       http://localhost:3111
```

**저장소 정리 경위.** 설계서의 baseline SHA `601a8f0` 은 본체 저장소에 없었다 —
마지막 fetch 가 2026-07-14 였고 로컬 main 은 13커밋 뒤처져 있었다(앞선 커밋 0개).
`git fetch` 후 `origin/main` 이 정확히 `601a8f0` 임을 확인하고, 본체 작업트리의
미커밋 변경 5건(`package-lock.json` 수정, `app/design-preview/`,
`scripts/design-review.mjs`, `scripts/seed-board.mjs`, `scripts/board-seed-1234.json`)
을 보존하기 위해 **별도 worktree/브랜치로 격리**했다. 조사용 shallow 클론
`C:\Users\권준구\ui-audit-multicultural-20260913` 은 커밋 1개·node_modules 없음이라
작업 경로로 쓰지 않았다.

**적용되는 지침.** `CLAUDE.md`(저장소 루트). AGENTS.md 없음.
가드레일 중 이번 작업에 직접 걸리는 것:
- 방 1111 은 실제 명렬표 방 — 운영 데이터 금지. 검증은 fixture 로만.
- Gemini 는 Flash 계열만, 이미지 배치 생성은 사용자 승인 웨이브만.

---

## 검증 환경 — 되는 것 / 막힌 것

| 항목 | 상태 |
|---|---|
| `npm ci` | ✅ exit 0 |
| 개발 서버 `next dev -p 3111` | ✅ Ready |
| Playwright + 시스템 Chrome | ✅ `chromium.launch({channel:"chrome"})` 동작 |
| 기존 검사 스크립트 8종 | ✅ 트리에 존재 (`scripts/test-*.mjs`) |
| `.env` 실제 키 | ❌ `.env.example` 만 존재 → Firebase/Groq/Gemini 연동 검증 **blocked** |
| 이미지 생성 도구 | ❌ 이 세션에 없음 → 동물 8종·공감 5종 PNG 생성 **blocked** |
| 실기기(태블릿·크롬북) | ❌ viewport 시뮬레이션만. 04 §8 U09 요구대로 **명시적으로 구분해 기록** |

Firebase 는 `lib/firebase-client.ts` 가 지연 초기화(`getClientDb()` 호출 시점)라
fixture 경로는 키 없이도 렌더된다 — 이것이 검증을 진행할 수 있는 이유다.

---

## T00 — 현황 확정 (진행 중)

### 완료
- 작업 경로·브랜치·HEAD·미커밋 변경 확정 (위 표)
- 화면 inventory 1차: `app/` 라우트 33개(API 22 + 페이지 11), `components/*.tsx` 52개 31,506줄
- **fixture 공백 발견**: board/character/entry/game/hub/post/quest/recorder/roster 9종은 있으나
  **vocab·storybook·praise·draw/whiteboard 는 fixture 가 없어** 04 §2 검수표의 해당 영역을
  화면으로 확인할 수 없었다. U07(단어 배우기)이 최우선인데 fixture 가 없는 것이 최대 공백이었다.
- **단어 fixture 신설** — `components/VocabHub.tsx` 에 `fixture` 주입구 추가
  (PadletBoard 의 기존 `BoardFixture` 패턴을 그대로 따름) + `app/ux-fixture/vocab/`.
  `?state=new|progress|rich&lang=..&role=..` 조합. 주입 시 Firebase 구독·localStorage 진도
  쓰기·보상 지급·`/api/*` 호출이 전부 꺼지고, 새는 원격 호출은 화면 하단에 붉게 드러낸다.
  3개 상태 모두 HTTP 200 확인.
- baseline 측정 스크립트 신설 `scripts/audit/shot-baseline.mjs` — 04 §4 기기 매트릭스
  (768×1024 / 820×1180 / 1024×768 / 1366×768 / 1440×900 / 800×900 분할 / 390×844 보조폰)
  × 기본·큰 글씨. 재는 것: 첫 화면 콘텐츠, 가로 overflow, 조작 bounding box,
  글자 잘림, 역할별 computed font-size, `data-ux-root` 중첩.

### 다음 정확한 작업
1. baseline 실행 결과(`reports/audit-20260913/baseline/measurements.json`) 판독
2. 단어 fixture 를 baseline 스크립트 SCREENS 에 추가하고 재측정
3. `design-audit.md` · `responsive-plan.md` 작성 (04 §3 양식, 화면/부분 단위)

### 변경하지 않은 데이터 계약
- `ProgressMap` / `LearnerState` / `ExpressionEntry` 스키마 — 읽기만 함
- `lib/childUx/tokens.json` — 아직 미변경 (밀도 개정은 T01)
- 게시글 `timestamp` 필드 — 미변경 (U04 는 *표시* 제거이지 필드 제거가 아님)

---

## 검증 명령과 실제 결과

| 명령 | 결과 |
|---|---|
| `git fetch origin --prune` | ✅ `c2d4bf6..601a8f0 main` |
| `git worktree add -b feat/child-ux-20260913 … 601a8f0` | ✅ |
| `npm ci` | ✅ exit 0 |
| `npx next dev -p 3111` | ✅ Ready in 10.7s |
| `curl /ux-fixture/vocab?state={new,progress,rich}` | ✅ 200 / 200 / 200 |
| `node scripts/audit/shot-baseline.mjs` | ⏳ 실행 중 |
| `npx tsc --noEmit --incremental false` | ⏳ 실행 중 |

---

## 롤백

브랜치 `feat/child-ux-20260913` 전체를 버리면 `601a8f0` 상태로 돌아간다.
본체 저장소 `C:\Users\권준구\multicultural-board` 는 이 작업으로 **한 글자도 바뀌지 않았다**
(worktree 는 `.git/worktrees/` 에 메타데이터만 추가). worktree 제거는
`git worktree remove C:/Users/권준구/multicultural-board-childux-20260913`.
