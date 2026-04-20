import { NextRequest, NextResponse } from "next/server";
import { generateJson } from "@/lib/gemini";

// Vercel Hobby: 10s, Pro: 60s. We keep each call under ~25s by issuing 2 LLM
// rounds (draft + critique-revise) on a single fast model.
export const maxDuration = 60;

export type TextLength = "short" | "medium" | "long";

interface TextAgentRequest {
  topic: string;
  standard: string;    // 성취기준 free-form text or code
  conditions: string;  // free-form extra conditions
  pageCount: number;   // 4..12
  targetLangs: string[];  // e.g. ["ko","en","vi","zh","fil"]
  textLength?: TextLength;
}

const LENGTH_SPEC: Record<TextLength, { instruction: string; example: string }> = {
  short: {
    instruction: "페이지당 1문장 8~15자 이내. 리듬감 있게, 그림책 저학년용.",
    example: "예: \"붕붕이는 꽃밭으로 갔어요.\"",
  },
  medium: {
    instruction: "페이지당 2~3문장, 각 15~30자. 간결하지만 감정을 담아.",
    example: "예: \"붕붕이는 꿀을 모으러 꽃밭에 갔어요. 오늘도 열심히! 햇살이 따뜻했어요.\"",
  },
  long: {
    instruction: "페이지당 3~5문장, 각 20~40자. 장면 묘사와 감정 변화를 풍부하게.",
    example: "예: \"아침 해가 떠오르자, 붕붕이는 날개를 반짝이며 꽃밭으로 날아갔어요. 노란 민들레가 고개를 들고 인사했죠. '오늘도 안녕!' 붕붕이의 마음은 두근두근했어요. 한 방울씩 모은 꿀이 벌써 꽤 쌓였거든요.\"",
  },
};

// What the model returns. Keep flat/simple; no nested meta.
interface DraftBook {
  titleKo: string;
  coverImagePrompt: string;  // English prompt for the book cover (separate from page 1)
  characters: Array<{
    id: string;
    nameKo: string;
    avatarEmoji: string;
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
  }>;
  questions: Array<{
    id: string;
    tier: "intro" | "check" | "core" | "deep" | "concept";
    textKo: string;
    pageIdx?: number;
    ibConcept?: "form" | "function" | "causation" | "change" | "connection" | "perspective" | "responsibility" | "reflection";
    standard?: string;
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

function buildDraftSystemPrompt(textLength: TextLength): string {
  const spec = LENGTH_SPEC[textLength];
  return `You are a children's picture book author and curriculum designer writing for Korean elementary school (ages 7-9) in a multicultural classroom.

Your job: generate a warm, age-appropriate picture book along with reading-comprehension questions and short character personas.

IB Primary Years Programme "key concepts" you may choose from when writing "concept" questions:
form, function, causation, change, connection, perspective, responsibility, reflection.

You MUST reply with valid JSON matching this schema (all text in Korean unless the field name ends in "Ko" or unless stated):
{
  "titleKo": string,
  "coverImagePrompt": string (English, detailed book-COVER illustration prompt — a title-card style scene featuring the protagonist and theme. Include art style: "soft watercolor children's book cover, warm colors, cute cartoon, gentle palette, dreamy lighting"),
  "characters": [
    {
      "id": string (kebab-case),
      "nameKo": string,
      "avatarEmoji": string (1 emoji),
      "personality": string (Korean, 1-2 sentences, used by chatbot system prompt),
      "speechStyle": string (Korean, describes speech quirks and give an example),
      "bookContext": string (Korean, summary of this character's arc in the book)
    }, ... 2-3 characters
  ],
  "pages": [
    {
      "idx": number (1-based),
      "textKo": string (Korean, follows the LENGTH specification below),
      "illustrationEmoji": string (1-4 emoji representing the scene),
      "illustrationHueHint": "warm" | "cool" | "night" | "spring" | "sunset" | "garden",
      "imagePrompt": string (English, describes the scene in detail for an image generator. Include art style: "soft watercolor children's book illustration, warm colors, cute cartoon")
    }, ... exactly N pages where N is the requested count
  ],
  "questions": [
    { "id": string (kebab-case), "tier": "intro", "textKo": string }, ... 2 intro questions,
    { "id": string, "tier": "check", "textKo": string, "pageIdx": number }, ... one per ~2 pages,
    { "id": string, "tier": "core", "textKo": string }, ... 1-2 core questions,
    { "id": string, "tier": "deep", "textKo": string, "standard": string }, ... 1-2 deep questions tying to the provided standard,
    { "id": string, "tier": "concept", "textKo": string, "ibConcept": one of the IB concepts above }, ... 1-2 concept questions
  ]
}

=== Page text LENGTH requirement (strict) ===
${spec.instruction}
${spec.example}

Rules:
- Warm, hopeful tone. No scary, violent, or sexual content.
- Imagery must be gentle and cute. Avoid photorealism.
- IB concept questions should use the Korean word naturally (e.g. '변화', '책임', '연결').
- Character speechStyle should include an example phrase in quotes so the downstream chatbot stays consistent.
- Use kebab-case ids like "q-intro-1", "q-check-2", "q-core-1", "char-buzz".
- The cover prompt must visually match page 1's style to keep the art consistent.`;
}

function buildCritiqueSystemPrompt(): string {
  return `You are a strict editor for Korean elementary picture books.
Given a draft book JSON, check for:
1. Page text too long, complex words, or inappropriate tone.
2. Missing or weak emotional arc.
3. Questions that don't match their tier.
4. Image prompts that lack art style or clarity.
5. Characters whose speechStyle lacks a concrete example.

Return JSON: { "issues": string[] (Korean, max 6 bullets), "needsRevision": boolean }.
If the book is solid, return { "issues": [], "needsRevision": false }.`;
}

function buildReviseSystemPrompt(): string {
  return `You are the original children's book author. Given the previous draft JSON and a list of issues, produce a revised JSON with the same schema. Apply all the issues. Do not drop any pages or questions unless strictly required.`;
}

// One-language translation prompt (smaller = safer JSON output)
function buildPerLangTranslatePrompt(targetLang: string): string {
  return `You translate a Korean children's picture book into ${targetLang}.

Input JSON: { titleKo, pages[{idx,textKo}], characters[{id,nameKo}], questions[{id,textKo}] }.
Output JSON exactly in this shape:
{
  "title": string,
  "pages": { "<idx as string>": string },
  "characters": { "<id>": string },
  "questions": { "<id>": string }
}

Rules:
- Translate into ${targetLang}. Natural, age-appropriate for 7-9 year-old.
- Preserve emojis and punctuation.
- Do not explain. Only JSON.`;
}

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
    const draftPrompt = `주제: ${body.topic}
성취기준: ${body.standard}
추가 조건: ${body.conditions || "(없음)"}
페이지 수: ${pageCount}
페이지 글 길이: ${textLength === "short" ? "짧게" : textLength === "long" ? "길게" : "중간"}

위 정보로 Korean elementary picture book을 작성하세요. 스키마와 길이 규칙을 정확히 지켜야 합니다.`;

    const { value: draft1, model } = await generateJson<DraftBook>({
      systemPrompt: buildDraftSystemPrompt(textLength),
      userPrompt: draftPrompt,
      temperature: 0.85,
      maxTokens: 8192,
    });

    // === Step 2: critique ===
    let final: DraftBook = draft1;
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

    // === Step 3: translate — parallel per language (safer JSON) ===
    const translations = {
      title: {} as Record<string, string>,
      pages: {} as Record<string, Record<string, string>>,
      characters: {} as Record<string, Record<string, string>>,
      questions: {} as Record<string, Record<string, string>>,
    };
    const nonKo = targetLangs.filter((l) => l !== "ko");
    if (nonKo.length > 0) {
      const translationInput = {
        titleKo: final.titleKo,
        pages: final.pages.map((p) => ({ idx: p.idx, textKo: p.textKo })),
        characters: final.characters.map((c) => ({ id: c.id, nameKo: c.nameKo })),
        questions: final.questions.map((q) => ({ id: q.id, textKo: q.textKo })),
      };
      interface PerLangResult {
        title: string;
        pages: Record<string, string>;
        characters: Record<string, string>;
        questions: Record<string, string>;
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

    return NextResponse.json<TextAgentResponse>({
      ok: true,
      model,
      book: {
        ...final,
        titleTranslations: translations.title,
        pageTexts,
        characterNames: translations.characters,
        questionTexts: translations.questions,
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

