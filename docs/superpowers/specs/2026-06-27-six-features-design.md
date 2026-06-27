# 다문화 보드 — 6대 기능 개선 설계서

작성일: 2026-06-27 · 대상: `multicultural-board` (Next.js + Firebase RTDB) · 상태: 분석/설계 (미구현)

> 본 문서는 **분석·설계만** 한다. 실제 구현은 별도 implementation plan 으로 분리한다.
> 모든 신규 모듈은 보고서 4키워드(**포용성 · 깊이 있는 학습 · 학생주도 · 디지털소양**)에 매핑한다.

---

## 0. 현재 구조 (코드 확인 결과)

- 방 = `app/[roomCode]/page.tsx`. 허브 뷰(`HubView`): `board`(소통창=PadletBoard) · `storybook`(그림책=StorybookRoom) · `games` · `vocab` · `dashboard`(PraiseHive) · `interpreter`(통역).
- **전역 오버레이 패턴**: `overlays` 블록(page.tsx:186~221)에 `TutorChat`(꿀비, 우하단)이 들어가 **모든 뷰에서 상주**. Toast·StickerGiveModal·CosmeticPicker 동거.
- **통역**: `InterpreterDrawer`는 드로어 오버레이지만 **허브 화면에서만** 열림(`hubView==="hub"` 분기, page.tsx:240). HomeHub 타일(`HomeHub.tsx:37`, id `"interpreter"`)에서 진입.
- **Firebase 스키마(발췌)**: `rooms/{room}/cards`(소통창), `rooms/{room}/storybook/...`(그림책 세션·응답·챗·알림), `rooms/{room}/sessions/{id}`(의견나누기). 모두 클라이언트 쓰기.
- **재사용 자산**: `DrawingCanvas.tsx` — 색/굵기/지우개 캔버스, PNG dataURL 을 `onDone(dataUrl)`로 방출. 6번에 직접 재사용.

---

## 1. 그림책 답변 영속화 — 친구들의 예전 답변 보기

**결정**: 범위 = **같은 방**, 노출 시점 = **자유 읽기(StudentFreeLibrary→FreeReader)** 때만. 수업 진행은 현행 유지.

### 문제 (코드 근거)
- `lib/storybook.ts:208` `endSession()` → `remove(rooms/{room}/storybook)`. **세션 종료 시 응답 전체 삭제.**
- 응답 경로: `rooms/{room}/storybook/responses/{questionId}/{clientId}` — 세션·방 단위, **bookId 로 안 묶임**. 다른 책으로 세션을 새로 열면 키가 충돌하지 않지만, 세션 종료와 함께 사라짐.

### 설계
1. **영속 저장소 신설** (세션 subtree 와 분리, `endSession` 의 wipe 영향 밖):
   ```
   rooms/{room}/bookAnswers/{bookId}/{questionId}/{clientId} = {
     studentName, studentLang, text, timestamp
   }
   ```
2. `submitResponse()`(storybook.ts:258)에 **이중 쓰기 추가** — 기존 세션 경로 + 영속 경로. 세션 경로는 라이브 수업 동작 유지, 영속 경로는 누적 보관. (fire-and-forget, CLAUDE.md "표시용 쓰기는 await 금지" 가드 준수.)
3. **읽기 노출**: `StorybookFreeReader`(StorybookRoom.tsx:838)의 각 페이지/질문에, 해당 `bookId+questionId` 의 친구 답변을 `subscribeBookAnswers(room, bookId, qid)` 로 읽어 **읽기 전용 카드 목록**으로 표시. 번역은 기존 `/api/storybook-translate` 온디맨드 재사용(QuestionCard 의 `ensureTranslation` 로직 공유).
4. **자기 답변 식별**: `clientId` 로 "내 답변" 배지. 중복 제출은 같은 `clientId` 키 덮어쓰기(현행과 동일).
5. **정리 정책**: bookAnswers 는 누적 → 방 삭제(RoomManagePanel) 시 함께 제거. (TTL 은 후순위.)

**4키워드**: 깊이 있는 학습(또래 답변 비교) · 학생주도(스스로 다시 읽기) · 포용성(다국어 번역 노출).

---

## 2. 의견 공유 — 다수 응답 가시성

**결정**: **둘 다** — (A) 실시간 집계 표시 + (B) 공개 화면 겹침 해결.

### 문제 (코드 근거, `DiscussionSession.tsx`)
- 공개 화면 `FruitTree`(752~): 과일을 `%` 절대배치, `ringCount = n≤8?1 : n≤18?2 : 3`, `ringRadii=[34,44,52]`. **n>18 에서 과일 겹침·이름표(maxWidth 120) 잘림·과일 축소.**
- 활성 세션 중 학생 뷰(392~)는 **본인 제출만 확인**, 타인 응답 비공개("선생님이 종료하면 모두 볼 수 있어요"). 교사만 제출 현황 카운트를 봄.

### 설계
**(A) 실시간 집계** — 활성 세션 동안:
- 학생/교사 공통 헤더에 `접속 N · 제출 M · 제출률` 라이브 카운터(교사 패널의 StatBox 로직을 학생 화면에도 노출, 익명 카운트만).
- 제출 직후 학생 화면에 "친구들 N명이 생각을 나눴어요" 실시간 증가 표시(텍스트 비공개 유지 — 종료 전 사고 보호). 옵션: 교사 토글로 "실시간 공개" 허용 시 텍스트도 스트리밍.

**(B) 공개 화면 스케일** — `FruitTree` 재설계:
- 고정 뷰포트 절대배치 → **반응형 레이아웃**으로. 인원 구간별 전략:
  - `n ≤ 12`: 현행 과일나무(감성 유지).
  - `n > 12`: 과일을 나무 캔버스에 **충돌 회피 배치**(링 수 동적 + 최소 간격 보장) 하거나, **스크롤 가능한 과수원(여러 그루)** 으로 확장. 이름표 항상 가독.
  - 토글로 **그리드 갤러리 뷰**(기존 미사용 `ResponseCard` 그리드 활용) 제공 → 교사가 "나무/격자" 전환.
- 과일 크기 하한 상향, 겹침 시 z-index/간격 자동 조정.

**4키워드**: 학생주도(전원 참여 가시화) · 포용성(누구 응답도 안 묻힘).

---

## 3. 의견나누기 배경 나무 — 이미지 에셋 + 프롬프트

### 문제
- 나무가 **인라인 SVG**(DiscussionSession.tsx:772~829) — 투박. 이미지 에셋으로 교체 희망.

### 설계
- `public/discussion/tree-bg.webp` (또는 png) 신설. `FruitTree` 의 `<svg>` 배경을 `<img>`/CSS background 로 교체, 과일 절대배치 좌표계는 이미지 기준 `%` 로 유지.
- 과일이 얹힐 **수관 영역(빈 가지)** 을 비워 둔 구도로 생성 → 2번의 배치 좌표와 정합.
- 해상도 16:9(1600×800↑), 톤은 앱의 꿀색/협곡 배경(`/landing/game-canyon.webp`)과 조화.

### 생성 프롬프트 (확정안)
```
A warm, storybook-style flat 2D vector illustration of one large friendly tree
centered on a wide landscape canvas. Broad rounded canopy with OPEN EMPTY SPACE
and bare branch tips ready for hanging fruit (do NOT draw any fruit). Honey-gold
and amber palette to match a children's bee-themed learning app. Pastel sky
gradient: light sky-blue at top fading to soft cream. Gentle morning light, soft
rolling green grass ground, one tiny cute cartoon honeybee flying near the canopy.
Clean simple shapes, generous negative space inside the canopy, no text, no
watermark. 16:9 landscape, 1600x800.

Negative: photorealistic, dark, cluttered, scary, text, watermark, fruit on tree,
people, busy background.
```
> 산출 후 좌측·우측 보조 수풀(현 SVG의 곁가지)을 살릴지, 단일 그루로 갈지는 1차 시안 보고 결정.

**4키워드**: 포용성(따뜻한 정서적 환경).

---

## 4. 그림책 쓰기 = 소통창 쓰기 동일 엔진

**결정**: 공통 엔진은 **글 + 음성(STT) + 그림 모두 유지**.

### 문제 (3곳 분산)
| 위치 | 입력 | 번역 | 비고 |
|---|---|---|---|
| 그림책 `QuestionCard`(StorybookRoom.tsx:1455~, ~1300줄) | text/STT/그림 자체 구현 | `/api/storybook-translate` | 가장 복잡, 버그 표면 큼 |
| 의견 `DiscussionSession`(112~) | textarea | `/api/translate` | 단순 |
| 소통창 `PadletCard`/`PadletBoard`(987, 365·437) | textarea(+) | `/api/translate` | 카드 작성 본체 |
→ 입력/제출/번역/오류처리가 제각각이라 "오류가 갈린다".

### 설계
- **`components/ResponseComposer.tsx` 신설** — 단일 입력 컴포넌트:
  - 모드: `text` · `voice`(STT, `/api/stt`) · `draw`(`DrawingCanvas` 재사용).
  - props: `value/onChange`, `onSubmit(payload)`, `mode 허용목록`, `lang`, `placeholder`, `busy`.
  - 번역 파이프라인 일원화: 기본 `/api/translate`(소통창·의견과 동일). 그림책의 `/api/storybook-translate` 차이는 어댑터로 흡수하거나 한쪽으로 수렴(차이 분석 후 결정 — TODO 아님, 구현 plan 에서 확정).
  - 오류·로딩·낙관적 제출 UX 공통화(CLAUDE.md subscribe/낙관적 쓰기 가드 반영).
- **적용**: 그림책 `QuestionCard`, `DiscussionSession`, `PadletCard` 가 `ResponseComposer` 를 사용하도록 교체. 각 화면 고유(과일/카드/그림책 UI)는 래퍼로 유지, **입력 코어만 공유**.
- **리스크**: QuestionCard 가 거대(1300줄)·STT·그림·튜토리얼 인트로·번역 캐시 결합 → 점진 추출(먼저 입력 코어만 분리, 화면 로직은 잔류).

**4키워드**: 디지털소양(안정적 도구) · 깊이 있는 학습(표현 일관성).

---

## 5. 통역 — 섹션 제거 → 좌측 전역 아이콘

**결정**: HomeHub 타일에서 제거, **모든 뷰 좌측 플로팅 아이콘**으로 상주(꿀비 우하단의 대칭).

### 설계
- `HubView` 에서 `"interpreter"` 제거(HomeHub.tsx:11·37 타일 삭제) → 그 슬롯은 6번(whiteboard)이 대체.
- `InterpreterDrawer` 를 `overlays` 블록(page.tsx:186)으로 이동 → 전 뷰 노출. `TutorChat` 처럼 `hidden` prop(게임룸 등 충돌 화면) 지원.
- **좌하단/좌측** 플로팅 트리거 버튼 신설(통역 아이콘). 꿀비(우하단)와 좌우 대칭으로 겹침 방지.
- 현 `onSelect("interpreter")→setInterpreterOpen` 경로 제거, 플로팅 버튼이 `setInterpreterOpen` 직접 호출.

**4키워드**: 포용성(상시 통역 접근) · 디지털소양.

---

## 6. 빈 섹션 → 실시간 화이트보드 (클래스툴형)

**결정**: **모니터링 + 프롬프트** — 교사는 갤러리 관찰·확대·저장 + 공통 주제/배경을 학생 캔버스에 내려줌. (하이러닝식 라이브 미러링 아님.)

### 설계
- **신규 허브 뷰** `whiteboard` (통역이 비운 타일 자리). page.tsx 에 분기 추가, HomeHub 타일 신설.
- **학생**: `DrawingCanvas` 재사용 캔버스. 그리는 동안 **스로틀(예 1.5~2s) PNG 스냅샷**을 업로드.
  - 저장: 우선 `rooms/{room}/whiteboard/{clientId} = { name, dataUrl, updatedAt }` (RTDB). dataURL 이 크면(>수십 KB) Storage 업로드 + URL 저장으로 전환(그림책 이미지 패턴 참조).
  - 교사가 내려준 **프롬프트/배경**(`rooms/{room}/whiteboard/_meta = { prompt, bgImageUrl }`)을 캔버스 상단/배경에 표시.
- **교사**: `subscribeWhiteboard(room)` 로 전 학생 스냅샷 구독 → **갤러리 그리드**(이름+썸네일), 탭 시 확대 모달. 프롬프트/배경 설정 패널. 캔버스 비우기/저장(PNG 묶음) 옵션.
- **성능**: 스냅샷 스로틀 + diff 없는 프레임 스킵. 학생 수 많을 때 RTDB 대역 고려해 Storage 경로 우선 검토.
- **개입 범위**: 교사는 보기/저장/프롬프트만. 학생 캔버스 직접 그리기(피드백)는 범위 외(후속 확장 여지로 기록).

**검색 근거**: 클래스툴 = 그림 응답 취합·갤러리·결과 저장형([ctool.co.kr](https://ctool.co.kr/class/customerCenter/introduce)). 하이러닝 = 화면 실시간 미러링·교사 필기 전달형([hi.goe.go.kr](https://hi.goe.go.kr/)) — 본 설계는 전자 채택.

**4키워드**: 학생주도(자유 표현) · 디지털소양 · 깊이 있는 학습(시각적 사고).

---

## 7. 데이터 모델 변경 요약 (신규 노드)

```
rooms/{room}/
  ├─ bookAnswers/{bookId}/{questionId}/{clientId}   # 1번 — 영속 답변
  └─ whiteboard/
       ├─ _meta = { prompt, bgImageUrl }            # 6번 — 교사 프롬프트/배경
       └─ {clientId} = { name, dataUrl|imageUrl, updatedAt }
public/discussion/tree-bg.webp                        # 3번 — 나무 배경 에셋
components/ResponseComposer.tsx                        # 4번 — 공통 입력 엔진
components/Whiteboard*.tsx                             # 6번 — 학생/교사 화이트보드
```
- Firebase 보안 규칙: 신규 노드도 `rooms/{}` 클라이언트 쓰기 허용 범위에 포함되는지 배포 전 점검(CLAUDE.md 가드).

---

## 8. 의존성 · 권장 단계 (참고)

- **독립·저위험 먼저**: 3번(에셋 교체) → 5번(통역 전역화) → 1번(영속화) → 2번(가시성) → 4번(공통 엔진, 4는 1·2의 입력부와 함께 가면 시너지) → 6번(화이트보드, 최대 규모).
- 4번과 1·2번은 입력/표시를 공유하므로 **4번 ResponseComposer 를 먼저 추출**하면 1·2 구현이 가벼워짐 — 단 QuestionCard 추출 리스크가 커서, 1번(저장 경로)만 선반영 후 4번을 점진 진행하는 것도 가능.

## 9. 미해결/구현 plan 에서 확정할 것

- 4번: `/api/storybook-translate` ↔ `/api/translate` 수렴 여부(두 API 차이 코드 비교 필요).
- 6번: 스냅샷 저장 매체(RTDB dataURL vs Storage URL) — 학급 규모로 결정.
- 2번: 공개 화면 "나무 확장 vs 그리드 토글" 기본값.
