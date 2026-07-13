# CLAUDE.md — 작업 시 주의사항

> 2026-07-13 라운드: 꿀벌 마을 V1(코스메틱 40종·개수 기반 UNLOCK_AT·로열 마일스톤
> 20/25/30·held/acc 슬롯) + V2(칭찬판 별도 탭 게임 BeeVillage — 꿀 재화·상점·물주기).
> 총괄 기획 docs/꿀벌마을-마스터플랜.md. 테스트는 seed-test-room.mjs 로 별도 방에서만
> (방 1111 은 실제 명렬표 방). 커밋 c1d0ccb·bfb71d0 — 미푸시.

이 프로젝트에서 반복되면 안 되는 실수들. 같은 함정에 다시 빠지지 말 것.

---

## 📌 현재 작업 컨텍스트 (2026-06-01 기준)

> **📋 자기 정리 규칙 — 이 섹션을 깔끔하게 유지하는 법**
>
> 1. **세션 시작 시점에 먼저 정리한다.** 아래 "이번 라운드 산출물" 의 ✅ 항목
>    중에서, 영구 가드레일·데이터 모델로 흡수해야 할 내용은 해당 섹션으로 옮기고
>    여기서는 삭제한다. 단순 결과 보고에 불과한 줄(예: "X 컴포넌트 만듦") 은
>    바로 삭제. 남기는 줄은 **다음 세션이 알아야 하는 의도/제약** 뿐.
> 2. **"다음 작업 큐" 의 항목이 시작되면** ⏳ 로 표시. **완료되면** 즉시
>    이 큐에서 제거하고 산출물에서 영구 가드레일 후보를 발굴 → 적절한 섹션으로 이동.
> 3. **이 컨텍스트 섹션은 누적되지 않아야 한다.** 라운드가 끝나도 남는 정보는
>    "🛡 새 가드레일" 또는 "🧠 핵심 데이터 모델" 같은 영구 섹션에만 둔다.
> 4. **프로젝트 배경 / 마감 / 4키워드** 는 보고서가 제출(2026-07-31)될 때까지 유지.
>    이후엔 통째로 삭제.

### 프로젝트 배경 (보고서 제출 시까지 유지)
- **백암초** 황의순 + 권준구 교사 **연구대회** 프로그램. 다문화 학생 지원 SPA.
- 배포: `a-iroom.vercel.app` (별도 AIroom 저장소) — 이 저장소(multicultural-board)는
  통합 LMS / 그림책 / 게임화 모듈을 같은 Vercel 프로젝트에서 호스팅.
- **황의순 보고서 초안 마감 2026-06-15**, 최종 제출 2026-07-31.
- 보고서 4키워드: **포용성 · 깊이 있는 학습 · 학생주도 · 디지털소양**.
  모든 신규 모듈은 이 4개에 매핑 가능해야 의미가 있다.

### 다음 작업 큐 (사용자 지정 순서)
완료되면 줄 자체를 지운다. ⏳ 는 현재 진행 중.

- **#5 분야별 보상 확장** — 1.5일. 소통/그림책/감정/게임/표현 5분야 트로피.
  *#1 표현 복습 완료로 5번째 분야의 호출 지점 확보됨.*
- **#7 약점 단어 자동 복습 레슨** — 1일. attempts 로그 기반 약점 선정.
- **#8 교사용 EmotionFeed** — 반나절. `subscribeEmotionsRecent` 활용.
- **#9 PraiseHive ↔ LMS Level 연동** — 반나절. 벌 진화를 Lv 에 매핑.

### 이번 라운드 산출물 (다음 세션 시작 시 정리할 줄)
> 이 블록은 **임시 메모**다. ✅ 항목은 영구 섹션(🛡 가드레일 / 🧠 데이터 모델)
> 으로 흡수되면 즉시 삭제. 줄 끝에 ⤴ 표시는 "흡수 완료" → 다음 차례에 정리 대상.
>
> - ✅ 챗 API SSE 스트리밍 전환 (storybook-chat + 신규 tutor-chat) ⤴
> - ✅ 앱 전역 AI 튜터 "꿀비" 위젯 (`components/TutorChat.tsx`, 모든 허브 화면 우하단)
> - ✅ 게임 효과음 AudioContext 누수 수정 → `lib/gameSfx.ts` 싱글턴 ⤴
> - ✅ #15 게임 20개 전수 QA 완료 — 버그 15건 수정 (윷 소프트락·마블 턴스킵·
>   스팟잇 판정 등). 2026-07-07 재점검: 마블 승리조건(15라운드 캡+총자산 승부)·
>   GREETINGS 6개·이야기주사위 그림 전부 해소 확인. 남은 디자인 판단: 윷 골인
>   정확도착제 1건뿐.
> - ✅ 다문화 지구본 `components/MulticulturalGlobe.tsx` — 소통창 헤더 🌍.
>   three.js 는 next/dynamic 지연 로드 유지할 것 (~600KB).
> - ✅ #2 유튜브 자막 자동 번역 — `/api/youtube-transcript` + `lib/youtubeTranscript.ts`
>   + PadletCard 토글 UI(원어/뷰어언어/다른언어 더보기 + 읽어주기) + 결과는
>   `rooms/{}/cards/{}/transcript` 에 캐시. **핵심 제약**: YouTube 가 timedtext 에
>   PoToken 을 강제해 서버측 자동 추출이 거의 항상 빈 응답(200 len=0) → 자동은
>   best-effort 로만 두고, **교사 붙여넣기 폴백**(manualText)을 메인 경로로 추가함.
>   교사가 스크립트 붙여넣으면 방 언어 전체로 번역해 모든 학생에게 공유. 가드레일 참조.
> - ✅ #3 그림책 PPT 출력 — `lib/storybookPptx.ts`(`exportStorybookToPptx`) +
>   TeacherSetup 책 목록에 "📊 PPT" 버튼. 표지 1장 + 페이지 N장(상단 일러스트/
>   하단 주언어+한국어). pptxgenjs 는 동적 import(메인 번들 보호). 가드레일 참조.
> - ✅ 나의 단어 일일 챌린지 — `buildDailyChallenge()`(quizFormats.ts) + VocabHub 상단
>   카드. **약점 단어(priority) + 소통판 단어(matched) 블렌드**, 듣고 찾기/그림 중심
>   (listening·mc4-image·mc4) 듀오링고식 릴레이. 단어카드 학습은 그대로 유지하고 그 옆에
>   추가. VocabTest 재사용(lessonId="daily-challenge"로 결과 stars 기록, 스킬트리 무영향).
>   #7(약점 단어 자동 복습)의 핵심 선정 로직을 챌린지 형태로 선반영함.
> - ✅ (2026-07-07 라운드, feat/storybook-round-2026-07) 그림책 **캐릭터 통일성 3중 잠금**:
>   (a) 텍스트 에이전트가 캐릭터별 canonical 외형 `designEn` 생성 → 코드가 모든 표지·페이지
>   프롬프트에 기계 주입, (b) **캐릭터 초상 선생성 → referenceUrls 로 Nano Banana 참조 전달**
>   (개당 1.5MB 캡, 최대 3장), (c) `verifyCharacterMatch` 비전 자기검증 + 불일치 1회 재생성.
>   미리보기 "🎨 캐릭터 기준 전체 다시 그리기" 버튼. 기존 책(designEn 없음)은 참조 없이 우아한 퇴화.
> - ✅ `lib/ttsMulti.ts` `speak()` 가 이제 **재생 완료까지 대기** (Web Speech 경로도 end/error
>   await — 자동 읽기의 기반, 기존 .finally 호출부는 오히려 정확해짐). 교사 자동 읽기:
>   `session.autoReading` 플래그 + DuringPhase 루프(ko 더빙, 완주 후 1.5s 간격 자동 넘김).
> - ✅ 일본어 후리가나 — `/api/furigana`(Groq, **원문 복원 검증 실패 시 폐기**) + RTDB
>   `furigana_cache/{hash}` 영구 캐시. 순수 로직은 `lib/furiganaCore.ts` 분리 (node --test 가
>   JSX 파싱 불가 — React 부분은 furigana.tsx).
> - ✅ 그림책 챗봇 답변 언어 — `langGuard.resolveReplyLang(text, lang)`: 학생이 **실제로 쓴**
>   언어 따름 (한글 2자+ & 비율 0.7+ & 라틴<한글일 때만 ko). `replyForSafety` 는 모국어 유지.
> - ✅ 단어 퀴즈 예문(`vocab.example` + 본문 문장 폴백, 어간 1글자 과매칭 가드), 자유 읽기
>   끝내기→책장 버튼, 소통창 글추가 버튼 컬럼 상단 이동(+`addBelowHint` 15개 언어 "위" 로 수정),
>   튜터 꿀비 visualViewport 대응(키보드 인셋만큼 패널 상승).

---

## 🛡 가드레일 (반복하지 말아야 할 함정)

- **🔒 Gemini 비용 하드캡 (사용자 지시, 절대 규칙).** 기본은 **2.5 flash 계열**
  (`gemini-2.5-flash`, `-flash-lite`, `-flash-image`=나노바나나 1). 필요할 때만
  3.0 허용. **3.1+·Pro 등 그 위 고가 모델 금지.** 이미지 대량 생성은 반드시
  `batchGenerateContent`(배치 API, 50% 할인)로. lib/gemini.ts 의
  `assertAllowedGeminiModel` 이 런타임에서 차단 — 새 모델 상수는 반드시 이 함수를 거칠 것.
  스크립트(scripts/gen-*.mjs)에 모델을 하드코딩할 때도 이 규칙 적용.

- **문서 번역(XML)의 공용 유틸은 `lib/xmlI18n.ts` 만 사용.** (1) decodeXml 은
  `&amp;` 를 반드시 마지막에 풀어야 한다 — 먼저 풀면 이중 이스케이프가 깨져
  재조립 XML 이 손상된다. (2) 번역 전에 mergePptxRuns / mergeHwpxRuns 로
  "서식 동일 + 사이 공백뿐" 인접 run 을 합쳐야 문장 단위 번역이 된다 (조각
  번역이 품질 저하의 최대 원인이었음). (3) 한컴 기본 폰트명은 **함초롬바탕**
  (함초롱 아님 — 오타면 교체 무효). 대상 언어별 폰트는 pptxFontForLang /
  hwpxFontForLang 맵으로만 정한다 (태국어·아랍어 등에 한국어 폰트 강제 금지).

- **활동지 사진 번역은 OCR 과 번역을 분리한다.** 비전 모델(Gemini 2.5 Flash
  우선 → Groq scout 폴백)에는 블록+좌표 추출만 시키고, 번역은
  `lib/segment-translate.ts` (LibreTranslate→Groq 품질검증) 파이프라인으로.
  비전 한 방에 OCR+좌표+번역을 다 시키면 셋 다 망가진다. 좌표는
  `sanitizeOcrBlocks` 로 반드시 검증(0~1 클램프, % 변환, 픽셀 응답 폐기).

- **Groq 배치 번역 응답의 개수가 요청과 다르면 그 응답은 통째로 폐기하고
  다음 모델로.** 억지로 인덱스를 맞추면 엉뚱한 문장이 엉뚱한 자리에 들어간다
  (`parseTranslationResponse` 가 null 반환하는 이유).

- **Web Audio 효과음은 `lib/gameSfx.ts` 의 공유 싱글턴 컨텍스트만 사용.**
  "톤마다 `new AudioContext()`" 패턴은 컨텍스트를 닫지 않아 누적되고,
  브라우저가 탭당 개수를 제한해 장시간 플레이 시 소리가 통째로 멈춘다.
  오실레이터는 한 컨텍스트 안에서 얼마든지 겹쳐 재생된다.

- **챗 LLM 응답은 SSE 스트리밍이 기본.** 서버는 `lib/groq-stream.ts`
  (`streamChatResponse` — 키/모델 폴백 + 증분 안전검사 + finalize 후처리),
  클라이언트는 `lib/chatStreamClient.ts` (`readChatStream`). Groq 클라이언트는
  `maxRetries: 0` — SDK 자체 재시도가 429 Retry-After(수십 초)를 기다리는 게
  챗봇 체감 지연의 최대 원인이었다. 폴백은 `withGroqKeyFallback` 으로만.

- **Firebase 로컬 쓰기는 즉시 onValue 로 에코된다.** 챗처럼 "쓰고 나서 다음
  작업" 흐름에서 `await appendChatTurn(...)` 으로 서버 ack 를 기다리면 그만큼
  다음 단계(LLM fetch)가 늦어진다. 표시용이면 await 없이 fire-and-forget.

- **매칭 퀴즈 셔플은 단일 `useState + useEffect` 로 통일한다.**
  `useState` 초기화 1회 + `useRef` 갱신 병용 패턴은 채점이 stale 값을 보게 됨.
  표시되는 순서와 채점 비교에 쓰이는 순서가 같아야 한다 (`components/VocabTest.tsx`).

- **핫시팅 응답은 반드시 질문으로 끝나야 한다.** 시스템 프롬프트만으로는 불충분.
  `enforceQuestionEnding(reply, lang)` 후처리가 답이 `?` 로 끝나는지 검사하고
  아니면 학생 언어에 맞는 fallback 후속 질문을 부착한다 (15개 언어 매핑).
  새 캐릭터/책 추가해도 이 가드는 유지.

- **일일 1회 보상은 `runTransaction` 으로 원자화.** `get` + `set` 분리하면
  동시 탭 시 중복 지급된다. 참고: `awardEmotionStickerOncePerDay()`.

- **XP / 하트 / 스트릭 갱신은 모두 `runTransaction`.** 동시 요청 안전.
  단, 트랜잭션 콜백 내부에서 외부 변수에 캡처(`let leveledUp = ...`)할 때는
  React StrictMode double-invoke 로 두 번 실행될 수 있음 — 결과는 항상
  `result.snapshot.val()` 로 다시 읽어 사용.

- **세션 종료 시 XP 일괄 적립.** 매 정답마다 Firebase 쓰기 금지.
  `VocabTest` 와 `ExpressionReview` 둘 다 세션 끝에 `awardXp(total)` 1회만 호출.

- **데일리골 자동 조정은 VocabHub 마운트당 1회.** `useRef(goalAdjustedRef)` 로
  중복 호출 가드. 하향 조정은 한 번에 1단계만 (200→100→50). 급락 금지.

- **표현 추출은 `writeLang !== user.myLang` 일 때만.** 학생이 모국어로 쓴 카드는
  학습 대상이 아님 (대부분 한국어 카드만 추출됨). 텍스트 길이 ≥ 5 도 강제.

- **PadletBoard 학생 액션 직후의 백그라운드 작업은 try/catch 로 격리.**
  카드 작성 성공이 표현 추출/감정 카운트 실패로 인해 미끄러지면 안 됨.

- **YouTube 자막 서버측 자동 추출은 신뢰하지 말 것 (PoToken 차단).** watch 페이지에서
  captionTracks 목록(`languageCode`/`baseUrl`)은 잘 나오지만, 그 baseUrl 의 timedtext
  (`&fmt=json3/srv3/srv1`, as-is 전부)는 현재 **200 + 본문 0바이트**로 돌아온다. InnerTube
  ANDROID(키 만료 400)·`get_transcript`(failedPrecondition)·CONSENT 쿠키 모두 우회 실패 —
  교육용/음악 영상 무관하게 동일. 헤드리스 브라우저로 PoToken 을 만들거나 외부 transcript
  API 를 붙이지 않는 한 자동 추출은 안 된다. 그래서 `/api/youtube-transcript` 는 실패를
  구조화된 `available:false` 로 반환(24h 네거티브 캐시)하고, **교사 붙여넣기(manualText)**가
  실질적 데이터 소스다. 다음에 "자동이 왜 안 되냐"로 다시 파헤치지 말 것.

- **pptxgenjs(그림책 PPT 출력)는 반드시 동적 import + 클라이언트 전용.** 정적
  import 하면 ~수백 KB 가 메인 `/[roomCode]` 번들에 박힌다 → `lib/storybookPptx.ts`
  안에서 `(await import("pptxgenjs")).default` 로만 로드. 또한 pptxgenjs 는
  `node:fs`/`node:https` 를 참조해 클라이언트 빌드가 `UnhandledSchemeError` 로 깨지므로
  `next.config.js` 에 `!isServer` 분기로 (1) `node:` prefix 제거 플러그인 +
  (2) `resolve.fallback { fs/https/http: false }` 를 넣어둠. 이 webpack 블록 건드리지 말 것.
  또한 그림책 이미지는 **Firebase Storage URL**(`firebasestorage.googleapis.com`)이라
  브라우저에서 직접 fetch 하면 버킷 CORS 미설정 시 막혀 PPT 에 사진이 빠진다 →
  `lib/storybookPptx.ts` 의 `toDataUrl` 은 외부 절대 URL 을 `/api/img-proxy` (서버
  프록시, 호스트 화이트리스트)로 우회해 dataURL 로 변환한다. 같은-오리진/상대경로는 직접.

---

## 🧠 핵심 데이터 모델 (자주 참조)

### Firebase 노드 스키마
```
rooms/{roomCode}/
  ├─ cards/{cardId}                        — PadletBoard 카드 (기존)
  ├─ stickers/individual/{clientId}/{id}   — 칭찬 스티커 (기존)
  ├─ stickers/cosmetics/{clientId}         — 코스메틱 (기존)
  ├─ storybook/...                         — 그림책 세션/응답/챗/알림 (기존)
  ├─ vocab/
  │  ├─ progress/{clientId}/{wordId}       — WordProgress (기존)
  │  ├─ recordings/{clientId}/{id}         — 음성 녹음 (기존, 30일 TTL)
  │  ├─ rewards/{clientId}/{ruleId}        — 지급 기록 (기존)
  │  └─ attempts/{clientId}/{attemptId}    — VocabAttempt raw log
  ├─ lms/{clientId}                        — LearnerState
  ├─ emotions/{clientId}/{pushId}          — EmotionEntry
  │  └─ _lastAward/{clientId} = "YYYY-MM-DD"
  └─ expressions/{clientId}/{exprId}       — ExpressionEntry (SRS)
```
**모두 클라이언트 쓰기.** README 는 옛 정보. Firebase 콘솔 규칙이 `rooms/{}` 전체에
클라이언트 쓰기를 허용해야 함 (배포 시 점검 필수).

### `LearnerState` (`lib/lms.ts`)
```
{ xp, hearts, heartsLastLost, streak, streakLastDate,
  dailyXp, dailyXpDate, dailyGoal,
  lessons: { [lessonId]: { stars, bestAccuracy, completedAt, attempts } } }
```
- 레벨 공식: `xpForLevel(n) = 50·n·(n+1)/2`. 누적 트라이앵글.
- 하트 회복: 30분 = 1개. `effectiveHearts(state, now)` 가 회복 시각을 자동 적용해
  계산. 상태에 박힌 `hearts` 만 보고 판단 금지.

### `VocabAttempt` (`lib/vocabAttempts.ts`)
한 문제 = 한 로그. `format`, `wordId`, `correct`, `attempts`, `durationMs`,
`pickedWordId` (선택지 클릭 시 어떤 distractor 골랐는지) 저장. 교사 대시보드의
모든 통계가 여기서 나옴.

### `ExpressionEntry` (`lib/expressionLog.ts`)
Leitner 박스 1~5 + `nextDueAt`. `filterDue(list)` 가 지금 복습 대상 추출.
**중복 방지**: `pushExpressionDedup()` 가 같은 텍스트는 한 번만 저장.

---

## 에셋 / 좌표

- **PNG 좌표를 눈으로 측정할 때는 반드시 트림된 이미지에서 측정한다.**
  원본 PNG마다 투명 여백이 제각각이라 untrimmed 이미지에서 측정한 % 좌표는
  이미지별로 모두 어긋난다. 새 캐릭터/코스메틱 추가 시:
  1. `node scripts/trim-stickers.mjs` 먼저 실행해 투명 여백 제거
  2. 트림된 이미지에서 head center / head top 측정
  3. `public/stickers/anchors.json` 에 항목 추가
  4. 코드는 수정 불필요 — 런타임에 JSON 을 읽는다

- **`trim-stickers.mjs` 는 멱등(idempotent) 이지만 재실행할 때 이미 트림된
  이미지에도 sharp 가 6px 패딩을 한 번 더 얹을 수 있다.** 변경점이 없으면
  diff 가 0 인지 확인 후 커밋.

- **모자/트로피/펫 좌표는 하드코딩하지 말고 `anchors.json` + 픽셀 계산으로
  도출한다.** 예전에 inline `CHAR_ANCHOR` 객체로 박았다가 에셋 추가마다 코드를
  수정해야 했음.

- **모자는 합성본이 1순위, anchors 오버레이는 최후 폴백.** 캐릭터 합성 렌더는
  `components/CharacterComposite.tsx` 한 곳에만 둔다 (PraiseHive·CosmeticPicker
  공유 — 미리보기와 실제 화면이 어긋났던 원인이 각자 렌더였음). 여왕벌 왕관
  3종(crown-rose/sapphire/honey) 합성본은 Gemini 가 아니라
  `scripts/gen-queen-crown-composites.mjs` (sharp 로컬 합성)로 생성 — 배경이
  안 구워지므로 clean-bg 불필요. 왕관을 키우거나 자리를 바꿀 땐 이 스크립트의
  CROWNS 좌표만 수정 후 재실행 (상단 잘림 제약 주석 참조). Gemini 합성본은
  내용 불량일 수 있음 — 신규 생성 시 눈으로 검수 (stage-5-queen-crown.png 에
  왕관이 통째로 빠져 있던 사례).

## CSS / 기하 계산

- **clip-path 타일링(육각형 등) 에서는 `Math.round` / `Math.floor` 금지.**
  CSS 는 fractional px 를 그대로 받으므로 `HEX_H = W * 2 / Math.sqrt(3)` 을
  반올림 없이 사용. 반올림하면 행이 0.5~1px 씩 겹치거나 벌어진다.

- **flush 타일링 체크리스트 (pointy-top hex):**
  ```
  HEX_W = N                       // 원하는 폭
  HEX_H = HEX_W * 2 / √3          // 높이는 자동
  행 간 overlap = HEX_H / 4       // marginTop: -overlap
  홀수 행 shift = HEX_W / 2       // marginLeft
  ```
  셀 내부에 "테두리용 중첩 div" 를 넣으면 시각적 틈이 생기니 단일 clip-path 셀
  + solid background 로 유지.

## Next.js / TypeScript 잔꾀

- **`import data from "./x.json"` 에 meta 키(`_doc` 같은 문자열) 가 섞여 있으면
  `Record<string, SomeObject>` 로 직접 cast 가 안 된다.** `as unknown as
  Record<...>` 로 두 단계 캐스트하거나, meta 키를 `__meta__` 같은 nested
  object 로 분리할 것.

- **`@/public/...` import 는 tsconfig paths (`@/* → ./*`) 와 resolveJsonModule
  설정 덕에 동작한다.** JSON 직접 import 가능.

## Node 스크립트 (Windows)

- **`new URL("..", import.meta.url).pathname` 은 Windows 에서 한글 경로를
  `%EA%B6%8C...` 처럼 URL 인코딩된 상태로 리턴한다 → `ENOENT`.**
  항상 `fileURLToPath(import.meta.url)` + `dirname()` 조합 사용:
  ```js
  import { fileURLToPath } from "node:url";
  import { dirname, resolve } from "node:path";
  const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  ```

## Git / 쉘

- **현재 쉘의 CWD 가 삭제 대상 폴더일 때 `rm -rf <폴더>` 는 "Device or resource
  busy" 로 실패한다 (Windows).** 해결: 형제 폴더에 clone → 원본 내용만 `rm -rf
  *` → mv → 형제 폴더 제거.

- **`git config user.email/name` 을 임의로 설정하지 않는다.** 전역/로컬
  identity 가 없을 땐 사용자에게 먼저 확인받기. 이 원칙은 `CLAUDE.md` 보다도
  강하다.

- **커밋 전 `git status` 로 `public/` 대량 변경을 확인.** `trim-stickers.mjs`
  실행 후에는 42개 PNG 가 전부 modified 로 나오니, 의도한 변경인지 재확인.

## 빌드 검증

- `npm run build` 는 타입 체크 + 13개 페이지 prerender 까지 포함. PraiseHive /
  BeeMascot / SetupScreen 수정 후엔 반드시 통과시키고 푸시.
- 에셋(PNG) 만 변경했어도 type import 가 깨졌을 수 있으니 빌드 생략하지 말 것.

## Firebase 실시간 구독 (subscribe 패턴)

- **Firebase `onValue` 는 한 번에 두 번 이상 발화할 수 있다.** 캐시값 → 서버값
  왕복, 또는 자기 자신의 낙관적 쓰기가 에코로 되돌아오는 경우가 대표적. 콜백
  안에서 `setDraft(remote)` 같은 코드를 그대로 쓰면 사용자가 고른 값이 subs
  재발화 때 원래값으로 덮어써진다.
- **구독은 "첫 fire 에만 draft 시딩" 패턴을 고수.** 모달/화면이 열릴 때마다
  `useRef(false)` 플래그를 리셋해 1회 시딩, 이후엔 `current`(읽기 전용 상태)만
  갱신하고 사용자 편집 상태는 건드리지 말 것. CosmeticPicker 가 이 패턴.
- **쓰기는 낙관적으로.** 저장 버튼 → `onClose()` 즉시 + `onSaved()` 토스트
  먼저 → `setCosmetics(...).catch(err => onSaveError(err))` 백그라운드. `await`
  로 모달을 붙잡아두면 체감 지연이 커지고, Firebase 가 에코 재발화하며 UI 상태
  가 튈 수 있다.
- 토스트 컴포넌트는 `components/Toast.tsx` 재사용. tone `success` / `error`.

## 배경 제거 파이프라인 (scripts/clean-bg.mjs)

- **이전 실수:** `isNearBlack(r<40 && g<40 && b<40)` 같은 **predicate-only** 스트립
  은 이미지 안쪽의 까만 외곽선까지 통째로 날린다 (예: 번데기 몸통 검은 줄무늬).
- **현재 올바른 방식:** 가장자리에서 **flood-fill seed** 를 잡고, "같은 종류
  (light / dark) 의 인접 픽셀만 지우기"로 경계를 존중한다. 뿌리부터 닿을 수
  있는 배경만 지우기 때문에 **내부 본체 검은 선은 보존**된다.
- **다중 패스.** 체커 패턴처럼 한 겹을 지우면 안쪽 링이 새 가장자리가 되는
  경우가 있어서 `MAX_PASSES=6` 번까지 수렴할 때까지 반복.
- **에지 샘플링은 많이.** 한 변에 16 샘플 위치 × 4 방향으로 가장 바깥 불투명
  픽셀을 seed 로 등록. 본체가 특정 위치에서 edge 에 닿아도 다른 샘플로 우회.
- **dark seed 는 현재 비활성.** 까만 배경을 flood 로 지우면 본체 외곽선까지
  따라가는 사고가 잦아서, 특정 파일에 대해서만 별도 스크립트(`strip-bg.mjs`)
  로 수동 처리.
- `public/patterns/` 는 스크립트 대상에서 제외 — 타일링 배경이므로 내용 자체
  가 "배경".

## Next.js 외부 이미지

- 표준 `<img src="...">` 는 도메인 제한 없이 사용 가능. `next/image` 는 도메인
  허용 목록(`next.config.js → images.remotePatterns`) 필요.
- `flagcdn.com`, `flagpedia.net` 등은 오픈 라이선스 국기 CDN. srcset `w320`/`w640`
  세트로 HiDPI 대응.
