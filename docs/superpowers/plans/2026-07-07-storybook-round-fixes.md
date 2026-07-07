# 그림책·챗봇·소통창 수정 라운드 구현 계획 (2026-07-07)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 그림책 모듈의 8개 사용자 요구를 구현한다 — ① 주인공 캐릭터 통일성 강력 고정(캐릭터 선생성 → 참조 이미지 조건부 생성 + 자기검증), ② 자유 읽기 끝내기 버튼, ③ 단어 퀴즈 예문, ⑤ 일본어 후리가나, ⑥ 튜터 꿀비 태블릿 짤림, ⑦ 교사 자동 읽기(더빙+자동 넘김), ⑧ 소통창 글추가 버튼 상단 이동, ⑬ 그림책 챗봇 언어 감지.

**제외:** ④ 필리피노 수정(사용자가 X 처리), ⑨~⑫(상세 요구 미확정 — 다음 라운드).

**Architecture:** 캐릭터 통일성은 3중 잠금으로 해결한다 — (a) 텍스트 에이전트가 캐릭터별 **canonical 외형 서술(designEn)** 을 생성해 모든 페이지 프롬프트에 기계적으로 주입, (b) 캐릭터 초상화를 **먼저** 생성한 뒤 표지·페이지 생성 시 **참조 이미지로 Nano Banana 에 전달**(이미지 조건부 생성), (c) 생성된 페이지를 Gemini 비전으로 **참조와 동일 캐릭터인지 자기검증** 후 불일치 시 1회 자동 재생성. 나머지 항목은 기존 컴포넌트의 국소 수정.

**Tech Stack:** Next.js 14 (app router) · Firebase RTDB/Storage · Gemini 2.5 Flash Image(Nano Banana) REST · Groq(OpenAI SDK) · Web Speech API + /api/tts

## Global Constraints (CLAUDE.md 가드레일 요약 — 모든 태스크에 적용)

- 작업 브랜치: `feat/storybook-round-2026-07` (main 에서 분기). 태스크마다 커밋.
- 커밋 전 `npm run build` 통과 필수 (타입체크 + 13페이지 prerender 포함).
- 순수 lib 테스트는 `node --experimental-strip-types --test lib/<파일>.test.ts` 로 실행. import 는 `./types.ts` 처럼 확장자 포함.
- 챗 LLM 응답은 SSE 스트리밍(`lib/groq-stream.ts` / `lib/chatStreamClient.ts`)만. 외국어 혼입 차단은 `lib/langGuard.ts` 단일 소스.
- Firebase 표시용 부가 쓰기는 fire-and-forget (`.catch(() => {})`), 핵심 쓰기만 await.
- Groq 배치 응답 개수가 요청과 다르면 통째로 폐기 후 다음 모델 폴백 (억지 인덱스 매칭 금지).
- 퀴즈 셔플은 "표시 순서 = 채점 순서" 단일 배열 유지 (`buildStorybookQuiz` 기존 규칙).
- `git config user.email/name` 임의 설정 금지.
- 학생 노출 문자열은 15개 언어 지원이 원칙 — 규모가 작으면 `TutorChat.tsx` 의 `L_TITLE` 같은 컴포넌트-로컬 테이블 허용, 교사 전용 UI 는 한국어 하드코딩 허용(기존 관례).

## 파일 구조 (생성/수정 총괄)

| 파일 | 작업 |
|---|---|
| `lib/gemini.ts` | 수정 — generateImage 참조 이미지 지원 + 캐릭터 일치 검증 함수 |
| `app/api/storybook-agent/image/route.ts` | 수정 — referenceUrls 수신·전달, 자기검증 재시도 |
| `app/api/storybook-agent/text/route.ts` | 수정 — designEn·characterIds·exampleKo 스키마 |
| `components/StorybookCreator.tsx` | 수정 — 2단계 생성 파이프라인 + 참조 재생성 |
| `lib/types.ts` | 수정 — designEn, characterIds, example, autoReading |
| `components/StorybookRoom.tsx` | 수정 — 끝내기 버튼, 자동 읽기, 후리가나 표시 |
| `lib/storybookQuiz.ts` + `.test.ts` | 수정 — 예문 필드 + 본문 폴백 |
| `components/StorybookWordQuiz.tsx` | 수정 — 예문 표시 |
| `app/api/furigana/route.ts` | **생성** — 일본어 후리가나 세그먼트 API |
| `lib/furigana.ts` + `.test.ts` | **생성** — 검증·캐시·React 훅 |
| `lib/ttsMulti.ts` | 수정 — speak 완주 대기 |
| `lib/storybook.ts` | 수정 — setAutoReading |
| `components/TutorChat.tsx` | 수정 — visualViewport 대응 |
| `components/PadletBoard.tsx` | 수정 — 글추가 버튼 상단 이동 |
| `lib/langGuard.ts` + `.test.ts` | 수정 — 답변 언어 결정 함수 |
| `app/api/storybook-chat/route.ts` | 수정 — 답변 언어 감지 적용 |

---

## Task 1: `generateImage` 참조 이미지 지원 (항목 1 기반)

**Files:**
- Modify: `lib/gemini.ts` (GenerateImageOptions ~361행, generateImageOnce ~310행, generateImage ~379행)

**Interfaces:**
- Produces: `generateImage(prompt, opts)` 의 `opts.referenceImages?: Array<{ base64: string; mimeType: string }>` — 참조 이미지를 Nano Banana 요청 parts 앞부분에 inlineData 로 첨부. Task 2 가 사용.

- [ ] **Step 1: GenerateImageOptions 에 referenceImages 추가**

`lib/gemini.ts` 의 `GenerateImageOptions` 인터페이스에 필드 추가:

```ts
export interface GenerateImageOptions {
  /** 호출당 상한. Nano Banana 는 보통 10~30s. 기본 35s. */
  attemptTimeoutMs?: number;
  /** 재시도 포함 총 시도 횟수. 기본 3 (원 시도 + 재시도 2회). */
  maxAttempts?: number;
  /**
   * [캐릭터 통일성] 프롬프트 앞에 첨부할 참조 이미지 (캐릭터 초상 등).
   * Nano Banana 는 이미지+텍스트 혼합 입력을 지원 — 참조가 있으면
   * "이 캐릭터 그대로 새 장면을 그려라" 방식의 조건부 생성이 된다.
   */
  referenceImages?: Array<{ base64: string; mimeType: string }>;
}
```

(기존 필드명이 다르면 기존 것을 유지하고 `referenceImages` 만 추가.)

- [ ] **Step 2: generateImageOnce 가 참조 parts 를 앞에 첨부**

`generateImageOnce(prompt, key, timeoutMs)` 시그니처를 `generateImageOnce(prompt, key, timeoutMs, referenceImages?)` 로 바꾸고 body 조립부(~315행)를 다음으로 교체:

```ts
  const refParts = (referenceImages ?? []).map((r) => ({
    inlineData: { data: r.base64, mimeType: r.mimeType },
  }));
  const body = {
    contents: [{ role: "user", parts: [...refParts, { text: prompt }] }],
    generationConfig: { responseModalities: ["IMAGE"] },
  };
```

- [ ] **Step 3: generateImage 재시도 루프에서 전달**

`generateImage` 내부의 호출부(~400행)를 수정:

```ts
      return await generateImageOnce(prompt, key, Math.min(attemptTimeoutMs, remaining), opts.referenceImages);
```

- [ ] **Step 4: 빌드 확인** — Run: `npm run build` → Expected: PASS (기존 호출부는 opts 미전달이라 무영향).

- [ ] **Step 5: Commit** — `git add lib/gemini.ts && git commit -m "feat(storybook): Nano Banana 참조 이미지(캐릭터) 조건부 생성 지원"`

---

## Task 2: 이미지 API 가 referenceUrls 를 받아 전달 (항목 1)

**Files:**
- Modify: `app/api/storybook-agent/image/route.ts`
- Modify: `lib/storybookImageClient.ts` (StorybookImageRequest)

**Interfaces:**
- Consumes: Task 1 의 `generateImage(prompt, { referenceImages })`.
- Produces: `POST /api/storybook-agent/image` body 에 `referenceUrls?: string[]` (최대 3개, Firebase Storage URL). Task 3·5 가 사용. 캐시 키에 referenceUrls 포함.

- [ ] **Step 1: 요청 인터페이스 확장**

route.ts 의 `ImageAgentRequest` 에 추가:

```ts
  /** [캐릭터 통일성] 캐릭터 초상 URL — 서버가 내려받아 참조 이미지로 첨부 (최대 3) */
  referenceUrls?: string[];
```

`lib/storybookImageClient.ts` 의 `StorybookImageRequest` 에도 동일 필드 추가.

- [ ] **Step 2: 캐시 키에 참조 포함**

```ts
function cacheKey(bookId: string, target: string, prompt: string, refs: string[]): string {
  return createHash("sha1").update(`${bookId}|${target}|${prompt}|${refs.join(",")}`).digest("hex");
}
```

POST 핸들러의 키 생성부를 `const refs = (body.referenceUrls ?? []).slice(0, 3); const key = cacheKey(body.bookId, target, body.prompt, refs);` 로 교체.

- [ ] **Step 3: 참조 이미지 다운로드 헬퍼 추가** (generateAndUpload 위에)

```ts
/** 참조 URL(자체 Firebase Storage)을 내려받아 base64 로. 실패한 것은 조용히 제외. */
async function fetchReferenceImages(
  urls: string[],
): Promise<Array<{ base64: string; mimeType: string }>> {
  const out: Array<{ base64: string; mimeType: string }> = [];
  for (const u of urls.slice(0, 3)) {
    try {
      const res = await fetch(u);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0 || buf.length > 4 * 1024 * 1024) continue; // 4MB 가드
      out.push({ base64: buf.toString("base64"), mimeType: res.headers.get("content-type") || "image/png" });
    } catch { /* skip */ }
  }
  return out;
}
```

- [ ] **Step 4: generateAndUpload 에서 참조 첨부 + 프롬프트 강제 문구**

`generateAndUpload` 의 프롬프트 조립부를 다음으로 교체:

```ts
  const baseStyleGuard = "Soft watercolor children's picture book illustration. Warm, gentle palette. Cute cartoon characters. No scary, violent, or photorealistic imagery. No text in the image.";
  const portraitGuard = hasChar
    ? " The character alone on a clean solid pastel-cream background. No scene, no other characters, no props, no text, just the character centered."
    : "";
  const refs = await fetchReferenceImages(body.referenceUrls ?? []);
  // 참조가 있으면 "첨부된 캐릭터를 그대로" 를 최상단에 강제 — 문장 중간에 넣으면 무시됨.
  const refGuard = refs.length > 0
    ? "CHARACTER REFERENCE (STRICT): The attached image(s) show the exact character design(s) of this book. Redraw the SAME character(s) — identical species, body shape, colors, face, and clothing/accessories — placed into the scene described below. Do NOT invent a different-looking character.\n\n"
    : "";
  const fullPrompt = `${refGuard}${body.prompt}\n\nStyle: ${baseStyleGuard}${portraitGuard}`;

  const img = await generateImage(fullPrompt, { referenceImages: refs });
```

- [ ] **Step 5: 빌드 확인** — Run: `npm run build` → Expected: PASS.

- [ ] **Step 6: Commit** — `git commit -am "feat(storybook): 이미지 생성 API referenceUrls — 캐릭터 초상 조건부 생성"`

---

## Task 3: 캐릭터 일치 자기검증 + 자동 재생성 (항목 1 — "강력 고정" 핵심)

**Files:**
- Modify: `lib/gemini.ts` (검증 함수 추가)
- Modify: `app/api/storybook-agent/image/route.ts` (generateAndUpload 에 검증 루프)

**Interfaces:**
- Consumes: Task 1·2.
- Produces: `verifyCharacterMatch(refImage, genImage): Promise<boolean>` — 참조 캐릭터와 생성 이미지 속 캐릭터가 같은 디자인인지 Gemini 비전으로 판정. route 는 참조가 있을 때 생성→검증→불일치 시 1회 재생성.

- [ ] **Step 1: lib/gemini.ts 에 검증 함수 추가** (generateImage 아래)

```ts
/**
 * [캐릭터 통일성] 생성 이미지 속 캐릭터가 참조 캐릭터와 같은 디자인인지 판정.
 * 실패(네트워크/파싱)는 true 반환 — 검증 불가로 이미지를 버리지 않는다 (보수적).
 */
export async function verifyCharacterMatch(
  ref: { base64: string; mimeType: string },
  gen: { base64: string; mimeType: string },
): Promise<boolean> {
  const keys = getGeminiApiKeys();
  if (keys.length === 0) return true;
  const url = `${GEMINI_REST_BASE}/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(keys[0])}`;
  const body = {
    contents: [{
      role: "user",
      parts: [
        { inlineData: { data: ref.base64, mimeType: ref.mimeType } },
        { inlineData: { data: gen.base64, mimeType: gen.mimeType } },
        { text: "Image 1 is the reference character design of a children's picture book. Does Image 2 depict the SAME character (same species, colors, face, clothing/accessories — pose and scene may differ)? Answer with exactly one word: YES or NO." },
      ],
    }],
  };
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return true;
    const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = (data?.candidates?.[0]?.content?.parts ?? []).map((p) => p.text || "").join(" ");
    return !/\bNO\b/i.test(text.trim());
  } catch {
    return true;
  }
}
```

주의: `GEMINI_REST_BASE` 상수가 이미 있으니 그대로 사용 (route 로 URL 만들 때 백슬래시 오타가 기존 코드 314행에 있으면 건드리지 말 것 — 동작 중인 코드).

- [ ] **Step 2: route 의 generateAndUpload 에 검증 루프**

Task 2 Step 4 에서 만든 생성부를 다음으로 교체 (페이지/표지에 참조가 있을 때만, 최대 1회 재생성):

```ts
  let img = await generateImage(fullPrompt, { referenceImages: refs });

  // [강력 고정] 참조 기반 페이지·표지는 캐릭터 일치를 비전으로 자기검증.
  // 불일치면 1회만 다시 그린다 (그 이상은 예산 초과 — 60s maxDuration).
  if (!hasChar && refs.length > 0) {
    const ok = await verifyCharacterMatch(refs[0], { base64: img.base64, mimeType: img.mimeType || "image/png" });
    if (!ok) {
      console.warn("character mismatch — regenerating once", body.bookId, target);
      try {
        img = await generateImage(fullPrompt, { referenceImages: refs, maxAttempts: 1 });
      } catch { /* 재생성 실패 시 원본 유지 */ }
    }
  }
```

import 에 `verifyCharacterMatch` 추가. (`target` 변수는 POST 핸들러 스코프 — generateAndUpload 에는 없으므로 로그는 `body.pageIdx` 로 대체: `console.warn("character mismatch — regenerating once", body.bookId, body.pageIdx);`)

- [ ] **Step 3: 빌드 확인** — Run: `npm run build` → Expected: PASS.

- [ ] **Step 4: Commit** — `git commit -am "feat(storybook): 캐릭터 일치 비전 자기검증 + 불일치 시 1회 자동 재생성"`

---

## Task 4: 텍스트 에이전트 — canonical 캐릭터 외형(designEn)·장면 등장 캐릭터(characterIds)·어휘 예문(exampleKo) (항목 1+3)

**Files:**
- Modify: `app/api/storybook-agent/text/route.ts` (스키마 ~117행, 규칙 ~163행, 번역 프롬프트 ~199행, 응답 머지부)
- Modify: `lib/types.ts` (`StorybookCharacter`, `StorybookPage`, `StorybookVocabWord`)
- Modify: `components/StorybookCreator.tsx` (`TextAgentBook` 인터페이스 ~60행, `agentToStorybook` ~100행)

**Interfaces:**
- Produces:
  - `StorybookCharacter.designEn?: string` — 영어 1문장 canonical 외형 서술 (종·몸 색·얼굴·시그니처 의상/소품).
  - `StorybookPage.characterIds?: string[]` — 이 장면에 등장하는 캐릭터 id 목록.
  - `StorybookVocabWord.example?: Record<string, string>` — 낱말이 실제로 나오는 책 문장 (언어별).
  - Task 5(파이프라인)와 Task 7(퀴즈)이 소비.

- [ ] **Step 1: lib/types.ts 필드 추가**

```ts
export interface StorybookCharacter {
  // ...기존 필드 유지...
  /** [캐릭터 통일성] canonical 외형 서술 (영어 1문장) — 모든 이미지 프롬프트에 주입 */
  designEn?: string;
}

export interface StorybookPage {
  // ...기존 필드 유지...
  /** [캐릭터 통일성] 이 장면에 등장하는 캐릭터 id — 참조 이미지 선택에 사용 */
  characterIds?: string[];
}

export interface StorybookVocabWord {
  // ...기존 필드 유지...
  /** [퀴즈 예문] 낱말이 실제로 쓰인 책 문장 (lang -> 문장) */
  example?: Record<string, string>;
}
```

- [ ] **Step 2: 드래프트 시스템 프롬프트 스키마 확장** (`buildDraftSystemPrompt`)

characters 항목에 추가:

```
      "designEn": string (English, ONE canonical appearance sentence: species/kind, body colors, face features, and ONE signature clothing item or accessory. Example: "A small round honeybee with a golden-yellow fuzzy body, brown stripes, big sparkly black eyes, tiny white wings, wearing a red neck scarf." Every page prompt MUST describe this character using EXACTLY these traits.),
```

pages 항목에 추가:

```
      "characterIds": [string] (ids of the characters VISIBLY present in this scene's illustration; use [] if none),
```

vocab 항목에 추가:

```
      "exampleKo": string (ONE short sentence copied or minimally shortened from the page texts where this word appears — the word must appear in the sentence in its inflected form; max 40 Korean characters),
```

Rules 섹션에 추가:

```
- Every page imagePrompt that shows a character MUST repeat that character's designEn traits verbatim (colors, features, signature item). Never introduce alternative looks.
- avatarImagePrompt must be a FULL-BODY character sheet: front view, standing, neutral pose, whole body visible, clean solid pastel background — it will be used as the visual reference for all other images.
```

- [ ] **Step 3: 언어별 번역 프롬프트에 example 추가** (`buildPerLangTranslatePrompt`)

Input JSON 설명의 vocab 를 `vocab[{id,lemmaKo,glossKo,distractorsKo,exampleKo}]` 로, Output 의 vocab 항목을 다음으로 교체:

```
  "vocab": { "<id>": { "word": string, "gloss": string, "distractors": [string, string, string], "example": string } }
```

Rules 에 한 줄 추가: `- "example" = exampleKo translated naturally; keep it ONE short sentence containing the translated word.`

- [ ] **Step 4: route 의 타입·머지 로직 반영**

`TextAgentRequest/Response` 쪽 인터페이스( route 내부, ~61행 vocab 등)와 번역 머지 코드에서 `designEn`, `characterIds`, `exampleKo`/`example` 를 통과시킨다. 머지 시 vocabWords 각 항목에 `example: { ko: v.exampleKo, [lang]: translated.example }` 형태로 조립 (기존 gloss/distractors 머지 코드와 같은 위치·같은 패턴).

- [ ] **Step 5: StorybookCreator 의 TextAgentBook·agentToStorybook 반영**

`TextAgentBook.characters` 에 `designEn?: string`, `pages` 에 `characterIds?: string[]`, `vocab`(있다면 route 가 만든 vocabWords 수신부)에 `example` 통과. `agentToStorybook` 매핑에 추가:

```ts
  // characters 매핑에:
  designEn: c.designEn,
  // pages 매핑에:
  characterIds: p.characterIds,
```

(vocabWords 는 route 가 이미 `StorybookVocabWord` 동형으로 만들어 내려보냄 — example 필드가 그대로 실려온다.)

- [ ] **Step 6: 빌드 확인** — Run: `npm run build` → Expected: PASS.

- [ ] **Step 7: Commit** — `git commit -am "feat(storybook): designEn·characterIds·어휘 예문(exampleKo) 생성 스키마"`

---

## Task 5: StorybookCreator 2단계 파이프라인 — 캐릭터 먼저, 그 다음 참조로 표지·페이지 (항목 1)

**Files:**
- Modify: `components/StorybookCreator.tsx` (handleGenerate ~166-360행, onRegenerateImage ~403행, BookPreview ~1178행)

**Interfaces:**
- Consumes: Task 2 의 `referenceUrls`, Task 4 의 `designEn`/`characterIds`.
- Produces: 사용자 요구 "캐릭터 먼저, 이후 그거 사용" 그대로의 생성 순서 + 미리보기의 "🎨 캐릭터 기준 전체 다시 그리기".

- [ ] **Step 1: 이미지 풀 실행을 재사용 함수로 추출**

기존 worker 풀 코드(~304-345행, `failures`/`POOL`/`MAX_ATTEMPTS`/`cursor`/`worker`)를 `runPool` 로 감싼다 (`runOne` 은 그대로 클로저 사용):

```ts
      const failures: ImgTask[] = [];
      const POOL = 3;
      const MAX_ATTEMPTS = 3;
      async function runPool(tasks: ImgTask[]) {
        let cursor = 0;
        const worker = async () => {
          while (cursor < tasks.length) {
            const i = cursor++;
            const task = tasks[i];
            let attempt = 0;
            let lastErr: unknown = null;
            while (attempt < MAX_ATTEMPTS) {
              try { await runOne(task); lastErr = null; break; }
              catch (err) {
                lastErr = err;
                attempt++;
                if ((err as { retryable?: boolean })?.retryable === false) break;
                if (attempt < MAX_ATTEMPTS) {
                  const delay = 800 * Math.pow(2, attempt - 1) + Math.random() * 400;
                  await new Promise((r) => setTimeout(r, delay));
                }
              }
            }
            if (lastErr) { console.warn("image gen gave up after retries", task, lastErr); failures.push(task); }
            setProgress((p) => ({
              ...p,
              imageDoneCount: p.imageDoneCount + 1,
              message: `🎨 이미지를 그리고 있어요… (${p.imageDoneCount + 1}/${p.imageTotal})`,
            }));
          }
        };
        await Promise.all(Array.from({ length: Math.min(POOL, tasks.length) }, () => worker()));
      }
```

- [ ] **Step 2: 캐릭터 URL 수집 + 참조/외형 헬퍼**

`runOne` 의 char 분기(~286행)에서 로컬 맵에도 기록하도록 `charUrls` 를 추가:

```ts
      const charUrls: Record<string, string> = {};   // Phase A 결과 — Phase B 참조용
      // runOne 의 char 분기 첫 줄에 추가:
      //   charUrls[task.characterId] = data.url;
```

그리고 헬퍼 2개 (handleGenerate 내부, tasks 정의 자리에):

```ts
      // 장면 캐릭터 id → 참조 URL (없으면 전체 캐릭터, 최대 3)
      const refsFor = (ids?: string[]): string[] => {
        const pool = ids && ids.length > 0 ? ids : storybook.characters.map((c) => c.id);
        return pool.map((id) => charUrls[id]).filter(Boolean).slice(0, 3);
      };
      // canonical 외형 서술을 프롬프트에 기계 주입 (LLM 재량에 맡기지 않음)
      const designFor = (ids?: string[]): string => {
        const pool = ids && ids.length > 0
          ? storybook.characters.filter((c) => ids.includes(c.id))
          : storybook.characters;
        const lines = pool.map((c) => c.designEn).filter(Boolean);
        return lines.length > 0 ? `\n\nCharacter design (must match exactly): ${lines.join(" / ")}` : "";
      };
```

- [ ] **Step 3: 단일 tasks 배열을 2단계로 분리**

기존 `const tasks: ImgTask[] = [...]`(226-244행) 와 마지막 `await Promise.all(...)` 실행부를 다음으로 교체. `ImgTask` 의 page/cover 항목에 `referenceUrls?: string[]` 필드를 추가하고, `runOne` 의 reqBody 조립에 `if (task.kind !== "char" && task.referenceUrls?.length) reqBody.referenceUrls = task.referenceUrls;` 를 추가한다:

```ts
      // ── Phase A: 등장인물 초상(캐릭터 시트) 먼저 ──
      const charTasks: ImgTask[] = storybook.characters
        .filter((c) => c.avatarImagePrompt)
        .map((c) => ({ kind: "char" as const, characterId: c.id, prompt: c.avatarImagePrompt! }));
      setProgress((p) => ({ ...p, message: "🧸 등장인물을 먼저 그리고 있어요…" }));
      await runPool(charTasks);

      // ── Phase B: 표지 + 페이지 — 캐릭터 초상을 참조로 전달 ──
      const sceneTasks: ImgTask[] = [
        {
          kind: "cover" as const,
          prompt: (textData.book.coverImagePrompt
            || `Book cover illustration: "${storybook.title?.ko}". Cute cartoon, soft watercolor, warm palette.`) + designFor(),
          referenceUrls: refsFor(),
        },
        ...storybook.pages.map((p) => ({
          kind: "page" as const,
          idx: p.idx,
          prompt: (p.imagePrompt || `A children's book illustration of: ${p.illustration.emoji}`) + designFor(p.characterIds),
          referenceUrls: refsFor(p.characterIds),
        })),
      ];
      setProgress((p) => ({ ...p, message: "🎨 표지와 페이지를 캐릭터에 맞춰 그리고 있어요…" }));
      await runPool(sceneTasks);
```

(캐릭터 이미지가 전부 실패하면 `refsFor` 가 빈 배열을 돌려 참조 없이 진행 — 기존 동작으로 자연 퇴화.)

- [ ] **Step 4: 미리보기 "다시 그리기" 도 참조 전달**

`onRegenerateImage` 핸들러(~403행)에서 `requestStorybookImage` body 에 현재 book 상태의 캐릭터 초상을 참조로 추가:

```ts
              const refs = (pageIdx === 0
                ? book.characters
                : book.characters.filter((c) => {
                    const pg = book.pages.find((p) => p.idx === pageIdx);
                    return !pg?.characterIds?.length || pg.characterIds.includes(c.id);
                  })
              ).map((c) => c.avatarUrl).filter(Boolean).slice(0, 3) as string[];
              // requestStorybookImage 호출 body 에: referenceUrls: refs, force: true (기존 force 유지)
```

- [ ] **Step 5: 미리보기에 "🎨 캐릭터 기준 전체 다시 그리기" 버튼**

`BookPreview`(~1178행) 헤더 영역(책 정보 요약 ~1368행 근처)에 교사 버튼 추가. 캐릭터를 수정/재생성한 뒤 표지+모든 페이지를 참조 기반으로 순차 재생성한다:

```tsx
  const [redrawing, setRedrawing] = useState<string | null>(null);
  async function redrawAllWithCharacters() {
    if (redrawing) return;
    if (!window.confirm("표지와 모든 페이지를 현재 캐릭터 그림 기준으로 다시 그릴까요? (수 분 소요)")) return;
    const targets = [0, ...book.pages.map((p) => p.idx)];
    for (const idx of targets) {
      setRedrawing(`${targets.indexOf(idx) + 1}/${targets.length} 그리는 중…`);
      const prompt = idx === 0
        ? (book.cover.imagePrompt || "")
        : (book.pages.find((p) => p.idx === idx)?.imagePrompt || "");
      try { await onRegenerateImage(idx, prompt); } catch (err) { console.warn("redraw failed", idx, err); }
    }
    setRedrawing(null);
  }
```

버튼 JSX (기존 버튼들과 같은 스타일 계열):

```tsx
  <button onClick={redrawAllWithCharacters} disabled={!!redrawing}
    style={{ padding: "10px 14px", borderRadius: 12, border: "2px solid #FDE68A",
             background: redrawing ? "#F3F4F6" : "#fff", color: "#92400E",
             fontWeight: 900, fontSize: 13, cursor: redrawing ? "wait" : "pointer", fontFamily: "inherit" }}>
    🎨 {redrawing || "캐릭터 기준 전체 다시 그리기"}
  </button>
```

- [ ] **Step 6: 수동 검증** — `npm run dev` → 교사로 그림책 생성 → 진행 메시지가 "등장인물 먼저 → 표지·페이지" 순서인지, 완성된 표지/페이지의 주인공이 캐릭터 초상과 동일 디자인인지 육안 확인.

- [ ] **Step 7: 빌드 + Commit** — `npm run build` PASS 후 `git commit -am "feat(storybook): 2단계 생성 — 캐릭터 선생성 후 참조 기반 표지·페이지 (통일성 강력 고정)"`

---

## Task 6: 자유 읽기 마지막 페이지 "끝내기 → 책장" 버튼 (항목 2)

**Files:**
- Modify: `components/StorybookRoom.tsx` — `StorybookFreeReader` nav 버튼 (~1056-1065행)

- [ ] **Step 1: 비활성 "끝!" 버튼을 책장 복귀 버튼으로 교체**

```tsx
          {page >= total ? (
            <button
              onClick={onBack}
              style={{
                flex: 2, padding: "14px 16px", borderRadius: 14,
                background: "linear-gradient(135deg, #10B981, #059669)",
                border: "none", color: "#fff", fontWeight: 900, fontSize: 15,
                cursor: "pointer", boxShadow: "0 4px 12px rgba(16,185,129,0.3)",
              }}
            >📚 다 읽었어요! 책장으로</button>
          ) : (
            <button
              onClick={() => setPage((p) => Math.min(total, p + 1))}
              style={{
                flex: 2, padding: "14px 16px", borderRadius: 14,
                background: "linear-gradient(135deg, #F59E0B, #D97706)",
                border: "none", color: "#fff", fontWeight: 900, fontSize: 15,
                cursor: "pointer",
              }}
            >{onCover ? "읽기 시작 ▶" : "다음 ▶"}</button>
          )}
```

(참고: `onBack` 은 `StudentFreeLibrary` 의 `setOpenBook(null)` — 책장(도서관 목록)으로 돌아간다. `useBackLayer` 뒤로가기와 동일 동작.)

- [ ] **Step 2: 수동 검증** — 자유 읽기로 마지막 페이지까지 넘긴 뒤 초록 버튼 클릭 → 책 목록으로 복귀 확인.

- [ ] **Step 3: 빌드 + Commit** — `npm run build` PASS 후 `git commit -am "feat(storybook): 자유 읽기 끝내기 버튼 — 책장 복귀"`

---

## Task 7: 단어 퀴즈에 예문 표시 (항목 3)

**Files:**
- Modify: `lib/storybookQuiz.ts`, `lib/storybookQuiz.test.ts`
- Modify: `components/StorybookWordQuiz.tsx`

**Interfaces:**
- Consumes: Task 4 의 `StorybookVocabWord.example`, `Storybook.pages`.
- Produces: `SbQuizItem.example?: string`; `buildStorybookQuiz(vocab, viewerLang, pages?)` — 세 번째 인자 추가(선택). 기존 호출부는 무수정 동작.

- [ ] **Step 1: 실패 테스트 작성** — `lib/storybookQuiz.test.ts` 에 추가:

```ts
test("example 필드가 있으면 문항에 예문이 실린다", () => {
  const withEx = SAMPLE.map((w) => ({ ...w, example: { ko: `우리는 ${w.lemma}를 보았어요.` } }));
  const quiz = buildStorybookQuiz(withEx, "ko");
  assert.ok(quiz.every((q) => q.example && q.example.includes("보았어요")));
});

test("example 이 없으면 페이지 본문에서 낱말이 든 문장을 찾는다", () => {
  const pages = [{
    idx: 1,
    text: { ko: "아침이 밝았어요. 붕붕이는 꿀을 모았어요. 참 신났어요." },
    illustration: { emoji: "🐝", bgGradient: "" },
  }];
  const quiz = buildStorybookQuiz(SAMPLE, "ko", pages as never);
  const q1 = quiz.find((q) => q.wordId === "w1"); // 꿀
  assert.ok(q1?.example?.includes("꿀"));
});

test("본문에도 낱말이 없으면 example 은 비운다 (undefined)", () => {
  const quiz = buildStorybookQuiz(SAMPLE, "ko", [] as never);
  assert.ok(quiz.every((q) => q.example === undefined));
});
```

- [ ] **Step 2: 실패 확인** — Run: `node --experimental-strip-types --test lib/storybookQuiz.test.ts` → Expected: 새 테스트 3건 FAIL (example 미구현).

- [ ] **Step 3: buildStorybookQuiz 구현**

`lib/storybookQuiz.ts` 수정 — import 에 `StorybookPage` 추가, `SbQuizItem` 에 `example?: string;` 추가, 예문 탐색 헬퍼:

```ts
// 문장 분리 — lookbehind 미사용 (구형 iOS Safari 호환). 구두점 포함 문장 목록.
function splitSentences(text: string): string[] {
  const out: string[] = [];
  const re = /[^.!?。！？\n]+[.!?。！？]?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const s = m[0].trim();
    if (s) out.push(s);
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return out;
}

/** 예문 결정: 책 데이터(example) → 페이지 본문에서 낱말 포함 문장 → 어간(기본형-다) 매칭 → 없음 */
function exampleFor(
  w: StorybookVocabWord,
  viewerLang: string,
  pages: StorybookPage[] | undefined,
): string | undefined {
  const stored = pick(w.example, viewerLang);
  if (stored) return stored;
  const page = pages?.find((p) => p.idx === w.pageIdx);
  const text = page?.text?.[viewerLang] || page?.text?.ko || "";
  if (!text) return undefined;
  const wordForm = pick(w.word, viewerLang) || w.lemma;
  const sentences = splitSentences(text);
  const hit = sentences.find((s) => s.includes(wordForm));
  if (hit) return hit;
  // ko 활용형 대응: 기본형에서 "-다" 를 뗀 어간으로 재시도 (모으다 → 모으/모았)
  const stem = w.lemma.endsWith("다") && w.lemma.length >= 3 ? w.lemma.slice(0, -1) : "";
  if (stem) {
    const stemHit = sentences.find((s) => s.includes(stem) || s.includes(stem.slice(0, -1)));
    if (stemHit) return stemHit;
  }
  return undefined;
}
```

`buildStorybookQuiz` 시그니처와 out.push 수정:

```ts
export function buildStorybookQuiz(
  vocab: StorybookVocabWord[] | undefined,
  viewerLang: string,
  pages?: StorybookPage[],
): SbQuizItem[] {
```

```ts
    out.push({
      id: `sbq_${w.id}_${Math.random().toString(36).slice(2, 7)}`,
      wordId: w.id,
      promptLang: viewerLang,
      question: questionFor(wordLabel, viewerLang),
      example: exampleFor(w, viewerLang, pages),
      choices,
    });
```

- [ ] **Step 4: 테스트 통과 확인** — Run: `node --experimental-strip-types --test lib/storybookQuiz.test.ts` → Expected: 전체 PASS.

- [ ] **Step 5: 퀴즈 UI 에 예문 표시**

`components/StorybookWordQuiz.tsx` — quiz 생성에 pages 전달, question 아래 예문 블록:

```ts
  const quiz = useMemo<SbQuizItem[]>(
    () => buildStorybookQuiz(book.vocab, viewerLang, book.pages),
    [book.vocab, book.pages, viewerLang],
  );
```

question div (~106-111행) 바로 아래:

```tsx
      {item.example && (
        <div style={{
          fontSize: 14, fontWeight: 700, color: "#6D28D9", lineHeight: 1.5,
          textAlign: "center", marginBottom: 14, padding: "10px 12px",
          background: "#FAF5FF", border: "1.5px dashed #DDD6FE", borderRadius: 12,
        }}>
          📖 {item.example}
        </div>
      )}
```

- [ ] **Step 6: 빌드 + Commit** — `npm run build` PASS 후 `git add -A && git commit -m "feat(storybook): 단어 퀴즈 예문 — 책 예문 필드 + 본문 문장 폴백"`

---

## Task 8: 일본어 후리가나 (항목 5)

**Files:**
- Create: `app/api/furigana/route.ts`
- Create: `lib/furigana.ts`, `lib/furigana.test.ts`
- Modify: `components/StorybookRoom.tsx` (`BilingualText` ~2132행, `CoverCard` ~1842행)

**Interfaces:**
- Produces:
  - `POST /api/furigana` body `{ texts: string[] }` → `{ ok: true, ruby: (RubySeg[] | null)[] }`, `RubySeg = { t: string; r?: string }` (t=표기, r=히라가나 읽기; 한자 없는 세그먼트는 r 없음).
  - `lib/furigana.ts`: `validateRuby(original, segs): boolean`(순수, 테스트 대상), `useFurigana(text: string | null, enabled: boolean): RubySeg[] | null`(훅 — RTDB `furigana_cache/{hash}` 캐시), `<RubyText segs={..} fallback={..} />`.
- 설계 근거: kuromoji 사전(~18MB)을 서버리스에 싣는 대신 LLM 변환 + **원문 복원 검증**(세그먼트 t 연결 == 원문. 불일치 시 폐기 — Groq 개수 불일치 폐기 가드레일과 동일 사상) + RTDB 캐시(책 텍스트는 불변이라 1회 변환 후 재사용).

- [ ] **Step 1: 검증 함수 실패 테스트** — `lib/furigana.test.ts` 생성:

```ts
// 실행: node --experimental-strip-types --test lib/furigana.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateRuby, type RubySeg } from "./furigana.ts";

test("세그먼트 연결이 원문과 같으면 유효", () => {
  const segs: RubySeg[] = [{ t: "山", r: "やま" }, { t: "に のぼる" }];
  assert.equal(validateRuby("山に のぼる", segs), true);
});

test("원문과 다르면 무효 (LLM 이 글자를 바꾼 경우)", () => {
  const segs: RubySeg[] = [{ t: "川", r: "かわ" }, { t: "に のぼる" }];
  assert.equal(validateRuby("山に のぼる", segs), false);
});

test("공백 차이는 허용 (정규화 비교)", () => {
  const segs: RubySeg[] = [{ t: "山", r: "やま" }, { t: "にのぼる" }];
  assert.equal(validateRuby("山に のぼる", segs), true);
});
```

- [ ] **Step 2: 실패 확인** — Run: `node --experimental-strip-types --test lib/furigana.test.ts` → Expected: FAIL (모듈 없음).

- [ ] **Step 3: lib/furigana.ts 작성**

```ts
"use client";

// [항목 5] 일본어 후리가나 — 서버(/api/furigana, LLM)가 만든 세그먼트를
// 원문 복원 검증 후 <ruby> 로 렌더. 변환 결과는 RTDB furigana_cache/{hash} 에
// 영구 캐시 (책 텍스트는 불변). 검증 실패·API 실패 시 평문 폴백.

import React, { useEffect, useState } from "react";
import { ref, get, set } from "firebase/database";
import { getClientDb } from "./firebase-client";

export interface RubySeg { t: string; r?: string }

/** 세그먼트 t 연결이 원문과 일치하는지 (공백 정규화 비교). 순수 함수 — 테스트 대상. */
export function validateRuby(original: string, segs: RubySeg[]): boolean {
  const norm = (s: string) => s.replace(/\s+/g, "");
  return norm(segs.map((s) => s.t).join("")) === norm(original);
}

// djb2 — RTDB 키용 짧은 해시 (충돌 시 캐시 미스일 뿐 오동작 없음: 값 검증 재수행)
function hashText(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${(h >>> 0).toString(36)}_${s.length}`;
}

async function fetchFurigana(text: string): Promise<RubySeg[] | null> {
  const db = getClientDb();
  const key = hashText(text);
  const cacheRef = ref(db, `furigana_cache/${key}`);
  try {
    const snap = await get(cacheRef);
    const cached = snap.val() as RubySeg[] | null;
    if (cached && validateRuby(text, cached)) return cached;
  } catch { /* 캐시 실패는 무시 */ }
  try {
    const res = await fetch("/api/furigana", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts: [text] }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { ok: boolean; ruby?: (RubySeg[] | null)[] };
    const segs = data.ok ? data.ruby?.[0] ?? null : null;
    if (segs && validateRuby(text, segs)) {
      set(cacheRef, segs).catch(() => {}); // 표시용 부가 쓰기 — fire-and-forget
      return segs;
    }
  } catch { /* 폴백 */ }
  return null;
}

/** ja 텍스트의 후리가나 세그먼트. 로딩 중/실패/비활성은 null (평문 표시). */
export function useFurigana(text: string | null, enabled: boolean): RubySeg[] | null {
  const [segs, setSegs] = useState<RubySeg[] | null>(null);
  useEffect(() => {
    setSegs(null);
    if (!enabled || !text || !/[一-鿿]/.test(text)) return; // 한자 없으면 불필요
    let cancel = false;
    fetchFurigana(text).then((r) => { if (!cancel) setSegs(r); });
    return () => { cancel = true; };
  }, [text, enabled]);
  return segs;
}

/** ruby 렌더 — segs 없으면 fallback 평문. */
export function RubyText({ segs, fallback }: { segs: RubySeg[] | null; fallback: string }) {
  if (!segs) return <>{fallback}</>;
  return (
    <>
      {segs.map((s, i) =>
        s.r ? (
          <ruby key={i}>
            {s.t}
            <rt style={{ fontSize: "0.5em", fontWeight: 600 }}>{s.r}</rt>
          </ruby>
        ) : (
          <React.Fragment key={i}>{s.t}</React.Fragment>
        ),
      )}
    </>
  );
}
```

주의: 이 파일은 JSX 를 포함하므로 **`lib/furigana.tsx`** 로 만든다 (import 경로는 `@/lib/furigana` 그대로). `validateRuby`/`hashText` 는 React 무관 순수 함수지만 같은 파일에 둬도 `node --test` 는 JSX 파싱을 못 하므로, **순수 부분만 `lib/furiganaCore.ts` 로 분리**한다: `RubySeg`, `validateRuby`, `hashText` 를 furiganaCore.ts 에 두고 furigana.tsx 가 re-export (`export { validateRuby, type RubySeg } from "./furiganaCore";`). 테스트는 `./furiganaCore.ts` 를 import 하도록 Step 1 파일에서 경로만 수정.

- [ ] **Step 4: 테스트 통과 확인** — Run: `node --experimental-strip-types --test lib/furigana.test.ts` → Expected: PASS.

- [ ] **Step 5: app/api/furigana/route.ts 작성**

```ts
import { NextRequest, NextResponse } from "next/server";
import { makeGroqClient, withGroqKeyFallback } from "@/lib/groq-client";
import { validateRuby, type RubySeg } from "@/lib/furiganaCore";

export const maxDuration = 30;

// groq-translate.ts 와 동일 모델 우선순위
const MODELS = ["llama-3.3-70b-versatile", "openai/gpt-oss-120b"];

const SYSTEM = `You add furigana to Japanese text for elementary school children.
Input: a JSON array of Japanese strings.
Output: JSON {"results": [[{"t": "...", "r": "..."}]]} — for each input string, an array of segments in original order.
Rules:
- "t" = the exact original substring (kanji, kana, punctuation — copy verbatim).
- "r" = hiragana reading. Include "r" ONLY for segments containing kanji. Kana-only or punctuation segments get no "r".
- Concatenating all "t" of one result MUST reproduce the input string EXACTLY (same characters, same order).
- Do not translate, do not add or remove characters. Only JSON.`;

export async function POST(req: NextRequest) {
  let texts: string[];
  try {
    const body = await req.json() as { texts?: string[] };
    texts = (body.texts ?? []).filter((t) => typeof t === "string" && t.trim()).slice(0, 20);
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  if (texts.length === 0) return NextResponse.json({ ok: false, error: "texts empty" }, { status: 400 });

  try {
    const ruby = await withGroqKeyFallback(async (key) => {
      const client = makeGroqClient(key);
      let lastErr: unknown = null;
      for (const model of MODELS) {
        try {
          const completion = await client.chat.completions.create({
            model,
            temperature: 0,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: SYSTEM },
              { role: "user", content: JSON.stringify(texts) },
            ],
          });
          const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}") as { results?: RubySeg[][] };
          const results = parsed.results;
          // 개수 불일치 응답은 통째로 폐기 → 다음 모델 (가드레일)
          if (!Array.isArray(results) || results.length !== texts.length) { lastErr = new Error("count mismatch"); continue; }
          // 원문 복원 검증 — 실패 항목은 null (클라이언트 평문 폴백)
          return results.map((segs, i) =>
            Array.isArray(segs) && validateRuby(texts[i], segs) ? segs : null,
          );
        } catch (err) { lastErr = err; }
      }
      throw lastErr ?? new Error("all models failed");
    });
    return NextResponse.json({ ok: true, ruby });
  } catch (err) {
    console.error("furigana failed", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 502 });
  }
}
```

(주의: `withGroqKeyFallback` 의 실제 시그니처를 열어 확인하고 콜백 인자 형태를 맞출 것 — `lib/groq-translate.ts` 의 사용례를 그대로 따른다.)

- [ ] **Step 6: 그림책 본문·표지에 적용**

`components/StorybookRoom.tsx` 상단 import: `import { useFurigana, RubyText } from "@/lib/furigana";`

`BilingualText`(~2132행) 의 primary 표시부를 교체:

```tsx
  const { primary, secondary } = bilingual(map, lang);
  // [항목 5] 일본어 뷰어: 한자 위 후리가나 (실패 시 평문)
  const rubySegs = useFurigana(lang === "ja" ? primary : null, lang === "ja");
  // ...
      <div style={{ fontSize: primarySize, fontWeight: 700, color: "#1F2937",
                    letterSpacing: -0.2, lineHeight: lang === "ja" ? 1.9 : 1.55 }}>
        {lang === "ja" ? <RubyText segs={rubySegs} fallback={primary} /> : primary}
      </div>
```

`CoverCard`(~1842행) 의 제목 표시도 같은 패턴으로 (제목 텍스트를 변수로 뽑아 `useFurigana` + `RubyText`). 훅 규칙: 조건부 호출 금지 — `useFurigana(lang === "ja" ? title : null, lang === "ja")` 처럼 인자로 제어.

- [ ] **Step 7: 수동 검증** — 학생 언어를 일본어(ja)로 설정 → 자유 읽기에서 한자 포함 페이지에 후리가나 표시 확인, 두 번째 열람 시 캐시 히트(네트워크 탭에 /api/furigana 없음) 확인.

- [ ] **Step 8: 빌드 + Commit** — `npm run build` PASS 후 `git add -A && git commit -m "feat(storybook): 일본어 후리가나 — LLM 변환 + 원문 검증 + RTDB 캐시"`

---

## Task 9: 튜터 꿀비 태블릿 짤림·키보드 가림 수정 (항목 6)

**Files:**
- Modify: `components/TutorChat.tsx` (챗 패널 ~193-203행)

원인: 패널이 `height: min(540px, calc(100vh - 90px))` + `bottom: 16` 고정 — 태블릿 브라우저에서 (a) `100vh` 가 주소창 포함 크기라 하단이 잘리고, (b) 소프트 키보드가 올라오면 visual viewport 만 줄어들어 입력창이 키보드 뒤로 숨는다.

- [ ] **Step 1: visualViewport 훅 추가** (TutorChat.tsx 파일 내 컴포넌트 밖)

```ts
/** 소프트 키보드/브라우저 UI 로 줄어든 실제 가시 영역. 미지원 브라우저는 window 크기. */
function useVisualViewport(): { height: number; bottomInset: number } {
  const [vp, setVp] = useState({ height: 0, bottomInset: 0 });
  useEffect(() => {
    const update = () => {
      const vv = window.visualViewport;
      if (vv) {
        setVp({
          height: Math.round(vv.height),
          bottomInset: Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)),
        });
      } else {
        setVp({ height: window.innerHeight, bottomInset: 0 });
      }
    };
    update();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  return vp;
}
```

- [ ] **Step 2: 패널 위치·높이를 가시 영역 기반으로**

컴포넌트에서 `const vp = useVisualViewport();` 후 패널 스타일 교체:

```tsx
        <div style={{
          position: "fixed",
          bottom: 16 + vp.bottomInset,             // 키보드 위로 패널을 밀어올림
          right: 12, zIndex: 320,
          width: "min(380px, calc(100vw - 24px))",
          height: `min(540px, ${Math.max(vp.height - 32, 260)}px)`, // 실제 가시 높이 기준
          background: "#fff",
          borderRadius: 20, border: "3px solid #FDE68A",
          boxShadow: "0 16px 40px rgba(0,0,0,0.28)",
          display: "flex", flexDirection: "column", overflow: "hidden",
          fontFamily: "'Pretendard Variable', 'Pretendard', 'Noto Sans KR', sans-serif",
          transition: "bottom 0.15s ease-out",
        }}>
```

`vp.height` 초기값 0 대비: `Math.max(vp.height - 32, 260)` 가 260px 최소를 보장하지만, 첫 페인트 시 0 이면 260 고정 프레임이 잠깐 보인다 — `height: 0` 일 때는 기존 `calc(100dvh - 90px)` 폴백을 쓰도록:

```tsx
          height: vp.height > 0 ? `min(540px, ${Math.max(vp.height - 32, 260)}px)` : "min(540px, calc(100dvh - 90px))",
```

플로팅 버튼(!open, ~172행)도 `bottom: 84 + vp.bottomInset` 로.

- [ ] **Step 3: 입력 포커스 시 스크롤 보정** — input 에 `onFocus={() => setTimeout(() => scrollRef.current && (scrollRef.current.scrollTop = scrollRef.current.scrollHeight), 250)}` 추가 (키보드 애니메이션 후 대화 끝으로).

- [ ] **Step 4: 수동 검증** — Chrome DevTools 기기 모드(iPad) + 실제 태블릿에서: 소통창에서 꿀비 열기 → 패널이 화면 안에 온전히 보임, 입력창 탭 → 키보드 위로 패널이 올라와 입력창이 보임.

- [ ] **Step 5: 빌드 + Commit** — `npm run build` PASS 후 `git commit -am "fix(tutor): 태블릿 visualViewport 대응 — 패널 짤림·키보드 가림 해결"`

---

## Task 10: 교사 자동 읽기 — 더빙 + 자동 페이지 넘김 (항목 7 · 중요)

**Files:**
- Modify: `lib/ttsMulti.ts` (speak 완주 대기)
- Modify: `lib/types.ts` (`StorybookSession.autoReading?: boolean`)
- Modify: `lib/storybook.ts` (`setAutoReading`)
- Modify: `components/StorybookRoom.tsx` (`DuringPhase` ~1940행, `TeacherPageControls` ~3253행, `PageCard` ~2070행)

**Interfaces:**
- Consumes: 기존 `setPage(roomCode, page)` — Firebase 세션 구독으로 전 학생 화면이 자동 동기화(이미 구현돼 있음 — 자동 넘김의 전파 비용 0).
- Produces: `speak()` 가 재생 완료까지 resolve 하지 않는 Promise 반환(기존 호출부는 `.finally` 로 speaking 표시를 껐으므로 오히려 정확해짐), `setAutoReading(roomCode, on)`, 교사 컨트롤의 ▶/⏹ 자동 읽기, 학생 화면의 "🔊 읽어주는 중" 배지.

- [ ] **Step 1: speak 의 Web Speech 경로가 끝까지 대기하도록 수정**

`lib/ttsMulti.ts` 의 `speak` 에서 `synth.speak(u); return;` 부분(~194행)을 교체:

```ts
        // 재생 완료까지 대기 — 자동 읽기(연속 재생)와 speaking 표시의 기준.
        // cancelSpeak() 호출 시에도 end/error 가 발화되어 resolve 된다.
        await new Promise<void>((resolve) => {
          const done = () => resolve();
          u.addEventListener("end", done, { once: true });
          u.addEventListener("error", done, { once: true });
          synth.speak(u);
        });
        return;
```

- [ ] **Step 2: 세션 플래그 + setAutoReading**

`lib/types.ts` `StorybookSession` 에 `autoReading?: boolean;` 추가. `lib/storybook.ts` 의 `setAllowReviewChat` 아래에:

```ts
/** [항목 7] 자동 읽기 진행 중 표시 — 교사가 켜면 학생 화면에 배지가 뜬다. */
export async function setAutoReading(roomCode: string, on: boolean): Promise<void> {
  const db = getClientDb();
  await update(ref(db, sessionPath(roomCode)), { autoReading: on });
}
```

- [ ] **Step 3: DuringPhase 에 자동 읽기 루프**

`components/StorybookRoom.tsx` import 에 `setAutoReading`(lib/storybook), `cancelSpeak`(lib/ttsMulti) 추가. `DuringPhase` 에:

```tsx
  // ── [항목 7] 자동 읽기: 교사 기기가 한국어 더빙으로 낭독하며 페이지를 넘긴다.
  // 학생 기기는 기존 setPage 구독으로 함께 넘어간다 (교실 스피커 = 교사 기기).
  const [autoReading, setAutoReadingLocal] = useState(false);
  const autoAbortRef = useRef(false);

  async function startAutoRead() {
    if (autoReading) return;
    autoAbortRef.current = false;
    setAutoReadingLocal(true);
    setAutoReading(roomCode, true).catch(() => {});
    try {
      for (let i = pageIdx; i <= book.pages.length; i++) {
        if (autoAbortRef.current) break;
        await setPage(roomCode, i);
        const p = book.pages.find((pp) => pp.idx === i);
        const text = p?.text?.ko || "";
        if (text) await speakText(text, "ko");       // 완주 대기 (Task 10 Step 1)
        if (autoAbortRef.current) break;
        await new Promise((r) => setTimeout(r, 1500)); // 페이지 사이 숨 고르기
      }
    } finally {
      setAutoReadingLocal(false);
      setAutoReading(roomCode, false).catch(() => {});
    }
  }

  function stopAutoRead() {
    autoAbortRef.current = true;
    cancelSpeak();
    setAutoReadingLocal(false);
    setAutoReading(roomCode, false).catch(() => {});
  }

  // 언마운트/phase 이탈 시 정리
  useEffect(() => () => { autoAbortRef.current = true; cancelSpeak(); }, []);
```

`TeacherPageControls` 렌더에 props 전달: `autoReading={autoReading} onStartAutoRead={startAutoRead} onStopAutoRead={stopAutoRead}`.

- [ ] **Step 4: TeacherPageControls 에 ▶/⏹ 버튼**

props 에 `autoReading: boolean; onStartAutoRead: () => void; onStopAutoRead: () => void;` 추가. 이전/다음 버튼 행(~3280행) 바로 위에:

```tsx
      <button
        onClick={autoReading ? onStopAutoRead : onStartAutoRead}
        style={{
          width: "100%", minHeight: 52, marginBottom: 10,
          background: autoReading
            ? "linear-gradient(135deg, #EF4444, #DC2626)"
            : "linear-gradient(135deg, #3B82F6, #2563EB)",
          color: "#fff", border: "none", borderRadius: 14,
          fontSize: 15, fontWeight: 900, cursor: "pointer",
          boxShadow: "0 4px 12px rgba(59,130,246,0.3)", fontFamily: "inherit",
        }}
      >{autoReading ? "⏹ 자동 읽기 멈추기" : "▶️ 자동 읽기 — 끝까지 읽어주며 넘겨요"}</button>
```

자동 읽기 중에는 수동 이전/다음 버튼을 `disabled={autoReading}` 처리 (동시 넘김 충돌 방지).

- [ ] **Step 5: 학생 화면 배지**

`DuringPhase` 의 `<PageCard ...>` 에 `autoReading={!isTeacher && !!session.autoReading}` prop 추가, `PageCard` 의 일러스트 패널(페이지 번호 배지 옆, ~2114행)에:

```tsx
        {autoReading && (
          <div style={{
            position: "absolute", top: 14, left: 16,
            fontSize: 12, fontWeight: 900, color: "#1D4ED8",
            background: "#DBEAFE", padding: "5px 12px", borderRadius: 999,
            border: "1.5px solid #93C5FD", animation: "pulse 1.2s ease-in-out infinite",
          }}>🔊 선생님이 읽어주는 중</div>
        )}
```

(props 타입에 `autoReading?: boolean;` 추가. 배지 문구는 학생 노출이지만 "다같이 듣는 교실 상황" 라벨이라 한국어 유지 — 필요 시 다음 라운드에 i18n.)

- [ ] **Step 6: 수동 검증** — 교사+학생 두 브라우저로 세션 시작 → 읽기 단계에서 ▶️ 자동 읽기 → 교사 기기에서 한국어 낭독, 끝나면 다음 페이지로 자동 이동, 학생 화면도 따라 넘어가고 배지 표시. ⏹ 즉시 중단 확인.

- [ ] **Step 7: 빌드 + Commit** — `npm run build` PASS 후 `git add -A && git commit -m "feat(storybook): 자동 읽기 — TTS 완주 대기 + 자동 페이지 넘김 + 학생 배지"`

---

## Task 11: 소통창 글추가 버튼을 컬럼 상단으로 (항목 8)

**Files:**
- Modify: `components/PadletBoard.tsx` (글추가 버튼 ~934-958행 → 카드 목록 위 ~896행 앞으로)

- [ ] **Step 1: 버튼 블록 이동**

기존 하단 버튼 JSX(934-958행, `+ {t("addHere", lang)}`)를 잘라내어 **컬럼 관리 팝오버 블록(~894행 닫힘) 바로 다음, 카드 목록 div(~896행) 바로 앞**에 붙인다. 스타일 변경: `borderTop: "1px solid #FEF3C7"` → `borderBottom: "1px solid #FEF3C7"`, 나머지 동일. 시각 보강(태블릿에서 잘 보이게):

```tsx
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setModal({ colId: col.id, colTitle: col.title, colColor: col.color });
                }}
                style={{
                  flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  background: col.color + "14",
                  border: "none",
                  borderBottom: "1px solid #FEF3C7",
                  padding: "12px 0", cursor: "pointer",
                  color: col.color,
                  fontWeight: 900, fontSize: 14,
                  transition: "background 0.15s",
                  userSelect: "none",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = col.color + "26"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = col.color + "14"; }}
              >
                <span style={{ fontSize: 18, lineHeight: 1, fontWeight: 700 }}>＋</span> {t("addHere", lang)}
              </button>
```

- [ ] **Step 2: 빈 컬럼 힌트 문구 확인** — 빈 컬럼 안내(`addBelowHint`, ~906행)가 "아래" 를 가리키면 lib/i18n.ts 의 해당 키 문구를 "위의 ＋ 버튼" 방향으로 15개 언어 모두 수정 (키 이름은 유지).

- [ ] **Step 3: 수동 검증** — 태블릿 뷰포트(768px)에서 소통창 열기 → 각 컬럼 제목 바로 아래에 ＋ 글추가 버튼이 스크롤 없이 보이는지 확인.

- [ ] **Step 4: 빌드 + Commit** — `npm run build` PASS 후 `git commit -am "fix(board): 글추가 버튼을 컬럼 제목 바로 아래로 — 태블릿 가시성"`

---

## Task 12: 그림책 챗봇 — 학생이 쓴 언어로 답한다 (항목 13)

**Files:**
- Modify: `lib/langGuard.ts` + `lib/langGuard.test.ts`
- Modify: `app/api/storybook-chat/route.ts`

**Interfaces:**
- Produces: `resolveReplyLang(studentText: string, studentLang: string): string` — 학생 메시지가 실질적으로 한국어(한글 2자 이상 + 스크립트 비율 ≥ 0.7)면 `"ko"`, 아니면 `studentLang`. 챗 라우트가 시스템 프롬프트 언어·sanitize·질문 강제 언어를 모두 이 값으로 통일.
- 진단 맥락: 프로필 언어가 외국어인 학생(또는 학생 모드로 점검하는 교사)이 **한국어로 질문해도** 시스템 프롬프트가 프로필 언어를 강제해 답·후속 질문이 외국어로 나왔다. "학생이 쓴 언어를 따른다" 를 프롬프트 재량이 아니라 코드로 고정한다.

- [ ] **Step 1: 실패 테스트 작성** — `lib/langGuard.test.ts` 에 추가:

```ts
test("한국어로 쓴 학생 메시지는 프로필 언어와 무관하게 ko", () => {
  assert.equal(resolveReplyLang("붕붕이는 왜 슬펐어요?", "vi"), "ko");
});

test("모국어(비한국어)로 쓴 메시지는 프로필 언어 유지", () => {
  assert.equal(resolveReplyLang("Tại sao con ong buồn?", "vi"), "vi");
});

test("이모지·숫자만 있으면 프로필 언어 유지", () => {
  assert.equal(resolveReplyLang("😀 123", "ja"), "ja");
});

test("한글 한두 글자 섞인 외국어 문장은 프로필 언어 유지", () => {
  assert.equal(resolveReplyLang("Kkulbi 꿀 is sweet, why?", "en"), "en");
});
```

(import 줄에 `resolveReplyLang` 추가.)

- [ ] **Step 2: 실패 확인** — Run: `node --experimental-strip-types --test lib/langGuard.test.ts` → Expected: 새 테스트 FAIL.

- [ ] **Step 3: resolveReplyLang 구현** — `lib/langGuard.ts` 끝에:

```ts
/**
 * 4) 답변 언어 결정 — 학생이 "실제로 쓴" 언어를 따른다.
 *    프로필 언어가 외국어라도 학생이 한국어로 물으면 한국어로 답해야 한다
 *    (교실 공용어 학습 지원 + 교사의 학생 모드 점검). 판정은 보수적으로:
 *    한글이 2자 이상이고 스크립트 문자 중 한글 비율이 70% 이상일 때만 ko.
 */
export function resolveReplyLang(studentText: string, studentLang: string): string {
  if (studentLang === "ko") return "ko";
  const hangulCount = (studentText.match(/[가-힣]/g) || []).length;
  if (hangulCount < 2) return studentLang;
  return targetScriptRatio(studentText, "ko") >= 0.7 ? "ko" : studentLang;
}
```

주의: `targetScriptRatio` 는 ASCII/라틴을 "공통" 으로 세지 않으므로, 라틴 문자 위주 문장(vi/en)은 스크립트 문자가 없어 ratio 1 이 나올 수 있다 — 그래서 **한글 2자 이상 선행 조건이 필수**다(Step 1 의 4번 테스트가 이 경계를 고정). 단 4번 테스트("Kkulbi 꿀 is..." — 한글 1자)는 통과하지만 한글 2자+라틴 문장 케이스가 ko 로 오판될 수 있으니, 라틴 문자가 한글보다 많으면 유지하는 조건을 추가한다:

```ts
  const latinCount = (studentText.match(/[A-Za-z]/g) || []).length;
  if (latinCount > hangulCount) return studentLang;
```

(이 두 줄은 `hangulCount < 2` 검사 다음에 넣는다. 대응 테스트도 추가: `assert.equal(resolveReplyLang("please tell me 꿀벌 story", "en"), "en");`)

- [ ] **Step 4: 테스트 통과 확인** — Run: `node --experimental-strip-types --test lib/langGuard.test.ts` → Expected: 전체 PASS.

- [ ] **Step 5: storybook-chat 라우트에 적용**

`app/api/storybook-chat/route.ts` — import 에 `resolveReplyLang` 추가. POST 핸들러에서 안전검사 직후, 시스템 프롬프트 생성 전에:

```ts
  // [항목 13] 학생이 실제로 쓴 언어로 답한다 — 프로필 언어 강제가 아니라.
  const replyLang = resolveReplyLang(body.studentText, body.studentLang);
```

이후 해당 요청 처리에서 `body.studentLang` 을 쓰던 자리 전부를 `replyLang` 으로 교체: `buildSystemPrompt({ ..., studentLang: replyLang })`, 스트리밍 옵션의 `lang: replyLang`, finalize 의 `sanitizeReply(full, replyLang)` / `fixKoreanRegister`(조건 `replyLang === "ko"`) / `enforceQuestionEnding(cleaned, replyLang)`. 단 **안전 응답(distress/block)의 `replyForSafety(body.studentLang, ...)` 는 프로필 언어 유지** (안전 안내문은 모국어가 안전).

- [ ] **Step 6: 수동 검증** — 학생 언어 vi 프로필로 핫시팅 입장 → 한국어로 질문 → 한국어 답 + 한국어 후속 질문. 베트남어로 질문 → 베트남어 답 확인.

- [ ] **Step 7: 빌드 + Commit** — `npm run build` PASS 후 `git add -A && git commit -m "fix(storybook-chat): 학생이 쓴 언어로 답변 — 외국어 질문 강제 해소"`

---

## 마무리

- [ ] 전체 테스트: `node --experimental-strip-types --test lib/storybookQuiz.test.ts lib/langGuard.test.ts lib/furigana.test.ts lib/distractorMeta.test.ts lib/xmlI18n.test.ts` → 전부 PASS
- [ ] `npm run build` 최종 PASS
- [ ] CLAUDE.md "이번 라운드 산출물" 에 산출 요약 추가 (자기 정리 규칙에 따라)
- [ ] main 머지 여부는 사용자 확인 후 (superpowers:finishing-a-development-branch)

## Self-Review 결과

- **스펙 커버리지:** ①→Task 1~5, ②→Task 6, ③→Task 4+7, ⑤→Task 8, ⑥→Task 9, ⑦→Task 10, ⑧→Task 11, ⑬→Task 12. ④는 사용자 X, ⑨~⑫는 범위 외(다음 라운드) — 누락 아님.
- **기존 책 호환:** designEn/characterIds/example 없는 기존 책도 동작 — refsFor 폴백(전체 캐릭터), exampleFor 본문 폴백, 후리가나는 책 데이터 무관.
- **타입 일관성:** `referenceUrls: string[]`(클라→서버), `referenceImages: {base64,mimeType}[]`(서버 내부), `RubySeg {t,r?}`, `resolveReplyLang(text, lang): string` — 태스크 간 이름 일치 확인 완료.
