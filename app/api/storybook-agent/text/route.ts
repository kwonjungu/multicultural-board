import { NextRequest, NextResponse } from "next/server";
import { generateJson } from "@/lib/gemini";
import {
  LENGTH_SPEC,
  buildCritiqueSystemPrompt,
  buildDraftSystemPrompt,
  buildDraftUserPrompt,
  buildPerLangTranslatePrompt,
  buildReviseSystemPrompt,
} from "@/lib/prompts/storybookPrompts";
import type { TextLength } from "@/lib/prompts/storybookPrompts";

// Vercel Hobby 상한 60s. #7: 시간 예산을 지키기 위해 기본 경로는 LLM 호출을
// 최소화한다 — draft 1회(2.5-flash, thinking off) + 언어별 번역(병렬). 검수/수정
// (critique/revise) 라운드는 시간을 크게 잡아먹어 기본 비활성(opt-in)으로 둔다.
export const maxDuration = 60;

export type { TextLength } from "@/lib/prompts/storybookPrompts";

interface TextAgentRequest {
  topic: string;
  standard: string;    // 성취기준 free-form text or code
  conditions: string;  // free-form extra conditions
  pageCount: number;   // 4..12
  targetLangs: string[];  // e.g. ["ko","en","vi","zh","fil"]
  textLength?: TextLength;
  critique?: boolean;  // #7: 검수/수정 라운드 사용 여부 (기본 false — 시간 절약)
}

// What the model returns. Keep flat/simple; no nested meta.
interface DraftBook {
  titleKo: string;
  coverImagePrompt: string;  // English prompt for the book cover (separate from page 1)
  characters: Array<{
    id: string;
    nameKo: string;
    avatarEmoji: string;
    avatarImagePrompt: string;  // English prompt for character portrait (clean bg)
    designEn?: string;          // canonical appearance sentence (English)
    personality: string;
    speechStyle: string;
    bookContext: string;
  }>;
  pages: Array<{
    idx: number;
    textKo: string;
    illustrationEmoji: string;   // 1-3 emoji
    illustrationHueHint: string; // "warm" | "cool" | "night" | "spring"
    imagePrompt: string;         // English, art style included
    characterIds?: string[];     // ids of characters visible in this scene
  }>;
  questions: Array<{
    id: string;
    tier: "intro" | "check" | "core" | "deep" | "concept";
    textKo: string;
    pageIdx?: number;
    ibConcept?: "form" | "function" | "causation" | "change" | "connection" | "perspective" | "responsibility" | "reflection";
    standard?: string;
  }>;
  // [신규] 단어 퀴즈용 어휘 — 같은 라운드에서 추출(추가 호출 없음). ko 기준.
  vocab?: Array<{
    id: string;            // kebab-case
    lemmaKo: string;       // ko 기본형(원형)
    glossKo: string;       // 1~2학년용 짧은 뜻풀이 (ko)
    distractorsKo: string[]; // 그럴듯한 오답 뜻풀이 3개 (ko)
    exampleKo?: string;    // 이 낱말이 실제로 나오는 책 문장 (ko)
    pageIdx: number;       // 처음 등장 페이지
    difficulty: "easy" | "mid" | "hard";
  }>;
}

interface TextAgentResponse {
  ok: boolean;
  book?: DraftBook & {
    // Translated fields (ko + targetLangs)
    titleTranslations: Record<string, string>;
    pageTexts: Record<number, Record<string, string>>;
    characterNames: Record<string, Record<string, string>>;
    questionTexts: Record<string, Record<string, string>>;
    // [신규] 단어 퀴즈 어휘 (다국어). StorybookVocabWord 와 동형.
    vocabWords?: Array<{
      id: string;
      lemma: string;
      word: Record<string, string>;
      gloss: Record<string, string>;
      distractors: Record<string, string[]>;
      example?: Record<string, string>;
      pageIdx: number;
      difficulty: "easy" | "mid" | "hard";
    }>;
  };
  model?: string;
  error?: string;
}

const HUE_GRADIENTS: Record<string, string> = {
  warm:   "linear-gradient(135deg, #FEF3C7, #FDE68A)",
  cool:   "linear-gradient(135deg, #DBEAFE, #BFDBFE)",
  night:  "linear-gradient(180deg, #1E3A8A, #3730A3 60%, #6366F1)",
  spring: "linear-gradient(135deg, #D1FAE5, #A7F3D0)",
  sunset: "linear-gradient(135deg, #FED7AA, #FBBF24)",
  garden: "linear-gradient(180deg, #FDE68A, #D1FAE5)",
};

export async function POST(req: NextRequest) {
  let body: TextAgentRequest;
  try {
    body = await req.json() as TextAgentRequest;
  } catch {
    return NextResponse.json<TextAgentResponse>({ ok: false, error: "bad json" }, { status: 400 });
  }
  if (!body?.topic || !body?.standard) {
    return NextResponse.json<TextAgentResponse>({ ok: false, error: "missing topic/standard" }, { status: 400 });
  }

  const pageCount = Math.max(4, Math.min(12, Math.floor(body.pageCount || 8)));
  const targetLangs = (body.targetLangs && body.targetLangs.length > 0)
    ? body.targetLangs
    : ["ko", "en", "vi", "zh", "fil"];
  if (!targetLangs.includes("ko")) targetLangs.unshift("ko");

  try {
    // === Step 1: draft ===
    const textLength: TextLength = body.textLength || "medium";
    const draftPrompt = buildDraftUserPrompt({
      topic: body.topic,
      standard: body.standard,
      conditions: body.conditions,
      pageCount,
      textLength,
    });

    const { value: draft1, model } = await generateJson<DraftBook>({
      systemPrompt: buildDraftSystemPrompt(textLength),
      userPrompt: draftPrompt,
      temperature: 0.85,
      maxTokens: 8192,
    });

    // === Step 2: critique (opt-in only) ===
    // #7: 기본 경로에서는 건너뛴다. 직렬 LLM 1~2회를 더해 Hobby 60s 예산을
    // 넘기던 원인이었다. body.critique === true 일 때만 수행한다.
    let final: DraftBook = draft1;
    if (body.critique) {
      try {
        const { value: critique } = await generateJson<{ issues: string[]; needsRevision: boolean }>({
          systemPrompt: buildCritiqueSystemPrompt(),
          userPrompt: `다음 초안을 검토하세요:\n\n${JSON.stringify(draft1)}`,
          temperature: 0.2,
          maxTokens: 400,
        });
        if (critique.needsRevision && critique.issues.length > 0) {
          const { value: revised } = await generateJson<DraftBook>({
            systemPrompt: buildReviseSystemPrompt() + "\n\n" + LENGTH_SPEC[textLength].instruction,
            userPrompt: `이전 초안:\n${JSON.stringify(draft1)}\n\n수정할 부분:\n${critique.issues.map((i) => "- " + i).join("\n")}`,
            temperature: 0.7,
            maxTokens: 8192,
          });
          final = revised;
        }
      } catch (err) {
        // Critique is best-effort; fall back to draft if it fails
        console.warn("critique/revise failed, using draft", err);
      }
    }

    // === Step 3: translate — parallel per language (safer JSON) ===
    const translations = {
      title: {} as Record<string, string>,
      pages: {} as Record<string, Record<string, string>>,
      characters: {} as Record<string, Record<string, string>>,
      questions: {} as Record<string, Record<string, string>>,
      // [신규] vocab: id -> { word/gloss: lang->str, distractors: lang->str[], example: lang->str }
      vocab: {} as Record<string, {
        word: Record<string, string>;
        gloss: Record<string, string>;
        distractors: Record<string, string[]>;
        example: Record<string, string>;
      }>,
    };
    const nonKo = targetLangs.filter((l) => l !== "ko");
    if (nonKo.length > 0) {
      const vocabList = final.vocab || [];
      const translationInput = {
        titleKo: final.titleKo,
        pages: final.pages.map((p) => ({ idx: p.idx, textKo: p.textKo })),
        characters: final.characters.map((c) => ({ id: c.id, nameKo: c.nameKo })),
        questions: final.questions.map((q) => ({ id: q.id, textKo: q.textKo })),
        vocab: vocabList.map((v) => ({
          id: v.id, lemmaKo: v.lemmaKo, glossKo: v.glossKo, distractorsKo: v.distractorsKo, exampleKo: v.exampleKo,
        })),
      };
      interface PerLangResult {
        title: string;
        pages: Record<string, string>;
        characters: Record<string, string>;
        questions: Record<string, string>;
        vocab?: Record<string, { word?: string; gloss?: string; distractors?: string[]; example?: string }>;
      }
      const perLang = await Promise.all(
        nonKo.map(async (lang) => {
          try {
            const { value } = await generateJson<PerLangResult>({
              systemPrompt: buildPerLangTranslatePrompt(lang),
              userPrompt: JSON.stringify(translationInput),
              temperature: 0.3,
              maxTokens: 4096,
            });
            return { lang, value };
          } catch (err) {
            console.warn(`translation failed for ${lang}`, err);
            return null;
          }
        }),
      );
      for (const result of perLang) {
        if (!result) continue;
        const { lang, value } = result;
        if (value.title) translations.title[lang] = value.title;
        if (value.pages) {
          for (const [idx, text] of Object.entries(value.pages)) {
            translations.pages[idx] = { ...(translations.pages[idx] || {}), [lang]: text };
          }
        }
        if (value.characters) {
          for (const [id, name] of Object.entries(value.characters)) {
            translations.characters[id] = { ...(translations.characters[id] || {}), [lang]: name };
          }
        }
        if (value.questions) {
          for (const [id, text] of Object.entries(value.questions)) {
            translations.questions[id] = { ...(translations.questions[id] || {}), [lang]: text };
          }
        }
        if (value.vocab) {
          for (const [id, v] of Object.entries(value.vocab)) {
            const slot = translations.vocab[id] || { word: {}, gloss: {}, distractors: {}, example: {} };
            if (v.word) slot.word[lang] = v.word;
            if (v.gloss) slot.gloss[lang] = v.gloss;
            if (Array.isArray(v.distractors)) slot.distractors[lang] = v.distractors;
            if (v.example) slot.example[lang] = v.example;
            translations.vocab[id] = slot;
          }
        }
      }
    }

    // Merge Korean into translation maps
    translations.title.ko = final.titleKo;
    for (const p of final.pages) {
      translations.pages[String(p.idx)] = {
        ...(translations.pages[String(p.idx)] || {}),
        ko: p.textKo,
      };
    }
    for (const c of final.characters) {
      translations.characters[c.id] = {
        ...(translations.characters[c.id] || {}),
        ko: c.nameKo,
      };
    }
    for (const q of final.questions) {
      translations.questions[q.id] = {
        ...(translations.questions[q.id] || {}),
        ko: q.textKo,
      };
    }

    // Denormalize to page->lang maps by idx
    const pageTexts: Record<number, Record<string, string>> = {};
    for (const p of final.pages) {
      pageTexts[p.idx] = translations.pages[String(p.idx)] || { ko: p.textKo };
    }

    // [신규] vocabWords 조립 — ko 기본값 + 번역 병합. 4지선다에 바로 쓸 형태.
    const vocabWords = (final.vocab || []).map((v) => {
      const t = translations.vocab[v.id] || { word: {}, gloss: {}, distractors: {}, example: {} };
      // example: ko from draft + per-lang from translations (omit if absent)
      const exampleMap: Record<string, string> = { ...t.example };
      if (v.exampleKo) exampleMap.ko = v.exampleKo;
      return {
        id: v.id,
        lemma: v.lemmaKo,
        word: { ...t.word, ko: v.lemmaKo },
        gloss: { ...t.gloss, ko: v.glossKo },
        distractors: { ...t.distractors, ko: v.distractorsKo },
        ...(Object.keys(exampleMap).length > 0 ? { example: exampleMap } : {}),
        pageIdx: typeof v.pageIdx === "number" ? v.pageIdx : 1,
        difficulty: v.difficulty || "mid" as const,
      };
    });

    return NextResponse.json<TextAgentResponse>({
      ok: true,
      model,
      book: {
        ...final,
        titleTranslations: translations.title,
        pageTexts,
        characterNames: translations.characters,
        questionTexts: translations.questions,
        vocabWords,
      },
    });
  } catch (err) {
    console.error("storybook-agent/text failed", err);
    return NextResponse.json<TextAgentResponse>({
      ok: false,
      error: (err as Error).message,
    }, { status: 500 });
  }
}

