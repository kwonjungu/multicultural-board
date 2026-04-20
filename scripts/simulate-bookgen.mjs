#!/usr/bin/env node
// Simulate the full text-agent → agentToStorybook → stripUndefined → Firebase
// serialization path, using a DraftBook that intentionally omits optional
// fields (pageIdx for intro/core/deep/concept, ibConcept for most tiers,
// standard for non-deep, etc.).
//
// Firebase Realtime DB's own serializer rejects `undefined`; Firebase throws
// the same "value argument contains undefined" error we saw. We detect the
// same condition by scanning the object tree and also by checking whether
// JSON.stringify and structuredClone agree.

// ---- stripUndefined (mirror of lib/storybook.ts) ----
function stripUndefined(value) {
  if (value === undefined) return value;
  if (value === null) return value;
  if (Array.isArray(value)) {
    return value.map((v) => stripUndefined(v)).filter((v) => v !== undefined);
  }
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue;
      out[k] = stripUndefined(v);
    }
    return out;
  }
  return value;
}

// ---- HUE map mirror ----
const HUE = {
  warm:   "linear-gradient(135deg, #FEF3C7, #FDE68A)",
  cool:   "linear-gradient(135deg, #DBEAFE, #BFDBFE)",
  night:  "linear-gradient(180deg, #1E3A8A, #3730A3 60%, #6366F1)",
  spring: "linear-gradient(135deg, #D1FAE5, #A7F3D0)",
  sunset: "linear-gradient(135deg, #FED7AA, #FBBF24)",
  garden: "linear-gradient(180deg, #FDE68A, #D1FAE5)",
};

// ---- agentToStorybook mirror ----
function agentToStorybook(src, bookId, authorName) {
  const now = Date.now();
  const pages = src.pages.map((p) => ({
    idx: p.idx,
    text: src.pageTexts[p.idx] || { ko: p.textKo },
    illustration: {
      emoji: p.illustrationEmoji,
      bgGradient: HUE[p.illustrationHueHint] || HUE.warm,
    },
    imagePrompt: p.imagePrompt,
  }));
  const characters = src.characters.map((c) => ({
    id: c.id,
    name: src.characterNames[c.id] || { ko: c.nameKo },
    avatarEmoji: c.avatarEmoji,
    personality: c.personality,
    speechStyle: c.speechStyle,
    bookContext: c.bookContext,
  }));
  const questions = src.questions.map((q) => ({
    id: q.id,
    tier: q.tier,
    text: src.questionTexts[q.id] || { ko: q.textKo },
    pageIdx: q.pageIdx,    // often undefined
    ibConcept: q.ibConcept, // often undefined
    standard: q.standard,   // often undefined
  }));
  const firstEmoji = src.pages[0]?.illustrationEmoji || "📖";
  return {
    id: bookId,
    title: src.titleTranslations?.ko ? src.titleTranslations : { ko: src.titleKo },
    cover: {
      emoji: firstEmoji,
      bgGradient: HUE[src.pages[0]?.illustrationHueHint || "warm"] || HUE.warm,
    },
    authorName,
    createdAt: now,
    pages,
    characters,
    questions,
  };
}

// ---- Scanner: find every path where value === undefined ----
function findUndefined(obj, path = "") {
  const out = [];
  if (obj === undefined) {
    out.push(path || "<root>");
    return out;
  }
  if (obj === null) return out;
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => out.push(...findUndefined(v, `${path}[${i}]`)));
    return out;
  }
  if (typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      // Also account for keys with explicitly-undefined values
      if (v === undefined) out.push(`${path}${path ? "." : ""}${k}`);
      else out.push(...findUndefined(v, `${path}${path ? "." : ""}${k}`));
    }
    // Detect keys with undefined that Object.entries skips
    for (const k of Object.keys(obj)) {
      if (obj[k] === undefined) {
        const p = `${path}${path ? "." : ""}${k}`;
        if (!out.includes(p)) out.push(p);
      }
    }
  }
  return out;
}

// ---- Synthetic Gemini response ----
// Mirrors the shape the text agent returns.
const draftFromGemini = {
  titleKo: "붕붕이의 달콤한 나눔",
  characters: [
    {
      id: "buzzy",
      nameKo: "붕붕이",
      avatarEmoji: "🐝",
      personality: "부지런하고 따뜻한 성격",
      speechStyle: "말끝에 ~붕! 붙이기",
      bookContext: "꿀을 나눌지 고민하다 결국 나눈다",
      // note: no systemPromptExtra — that's fine, our mapper doesn't read it
    },
    {
      id: "ant",
      nameKo: "개미 친구",
      avatarEmoji: "🐜",
      personality: "예의 바르고 가족을 아낌",
      speechStyle: "정중한 ~답니다 체",
      bookContext: "붕붕이에게 도움을 청한다",
    },
  ],
  pages: [
    { idx: 1, textKo: "붕붕이는 꽃밭으로 갔어요.", illustrationEmoji: "🌸🐝", illustrationHueHint: "warm", imagePrompt: "A cute bee in a flower field" },
    { idx: 2, textKo: "꿀을 많이 모았어요.", illustrationEmoji: "🍯", illustrationHueHint: "sunset", imagePrompt: "Honey jars" },
    { idx: 3, textKo: "개미가 찾아왔어요.", illustrationEmoji: "🐜", illustrationHueHint: "warm", imagePrompt: "An ant at the door" },
    { idx: 4, textKo: "붕붕이는 망설였어요.", illustrationEmoji: "🐝💭", illustrationHueHint: "cool", imagePrompt: "A hesitating bee" },
    { idx: 5, textKo: "함께 나눠 먹었어요.", illustrationEmoji: "🤝", illustrationHueHint: "spring", imagePrompt: "Sharing honey" },
    { idx: 6, textKo: "모두가 행복했어요.", illustrationEmoji: "🌟", illustrationHueHint: "night", imagePrompt: "Starry happy night" },
  ],
  questions: [
    // intro (no pageIdx, no ibConcept, no standard)
    { id: "q-intro-1", tier: "intro", textKo: "표지의 붕붕이는 어떤 기분일까?" },
    { id: "q-intro-2", tier: "intro", textKo: "꿀을 많이 모으면 기분이 어떨까?" },
    // check (with pageIdx, no ibConcept/standard)
    { id: "q-check-1", tier: "check", textKo: "붕붕이가 간 곳은 어디?", pageIdx: 1 },
    { id: "q-check-3", tier: "check", textKo: "찾아온 손님은 누구?", pageIdx: 3 },
    // core (no pageIdx/ibConcept/standard)
    { id: "q-core-1", tier: "core", textKo: "붕붕이는 왜 망설였을까?" },
    // deep (with standard, no pageIdx/ibConcept)
    { id: "q-deep-1", tier: "deep", textKo: "너라면 네 것을 나눌 수 있어?", standard: "2국05-04 이야기 속 인물의 마음 파악하기" },
    // concept (with ibConcept, no pageIdx/standard)
    { id: "q-concept-1", tier: "concept", textKo: "붕붕이에게 '나눔'은 어떤 변화일까?", ibConcept: "change" },
  ],
  titleTranslations: { ko: "붕붕이의 달콤한 나눔", en: "Buzzy's Sweet Sharing" },
  pageTexts: {
    1: { ko: "붕붕이는 꽃밭으로 갔어요.", en: "Buzzy went to the flower field." },
    2: { ko: "꿀을 많이 모았어요.", en: "Collected lots of honey." },
    // 3,4,5,6 intentionally omitted in translations to test fallback
  },
  characterNames: {
    buzzy: { ko: "붕붕이", en: "Buzzy" },
    // ant omitted to test fallback
  },
  questionTexts: {
    "q-intro-1": { ko: "표지의 붕붕이는 어떤 기분일까?", en: "How does cover Buzzy feel?" },
    // most omitted
  },
};

console.log("=== Stage 1: agentToStorybook output ===");
const book = agentToStorybook(draftFromGemini, "gen-sim-test-0001", "시뮬레이션교사");
const undefinedPaths = findUndefined(book);
console.log(`undefined paths before stripUndefined: ${undefinedPaths.length}`);
for (const p of undefinedPaths) console.log("  -", p);

console.log("\n=== Stage 2: after stripUndefined ===");
const cleaned = stripUndefined(book);
const undefinedPathsAfter = findUndefined(cleaned);
console.log(`undefined paths after stripUndefined: ${undefinedPathsAfter.length}`);
for (const p of undefinedPathsAfter) console.log("  -", p);

// Simulate what Firebase does: it walks the tree and throws on undefined.
function simulateFirebaseValidate(obj, path = "") {
  if (obj === undefined) {
    throw new Error(`Firebase would reject: undefined at ${path || "<root>"}`);
  }
  if (obj === null || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => simulateFirebaseValidate(v, `${path}[${i}]`));
    return;
  }
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) throw new Error(`Firebase would reject: undefined at ${path}${path ? "." : ""}${k}`);
    simulateFirebaseValidate(v, `${path}${path ? "." : ""}${k}`);
  }
}

console.log("\n=== Stage 3: simulate Firebase set() validation ===");
try {
  simulateFirebaseValidate(cleaned);
  console.log("✅ PASS — Firebase would accept this payload.");
} catch (err) {
  console.error("❌ FAIL —", err.message);
  process.exit(1);
}

console.log("\n=== Sample output (first question, pages count, char names) ===");
console.log("first question:", JSON.stringify(cleaned.questions[0], null, 2));
console.log("page 3 text (fallback):", JSON.stringify(cleaned.pages[2].text, null, 2));
console.log("ant name (fallback):", JSON.stringify(cleaned.characters[1].name, null, 2));
console.log(`total questions: ${cleaned.questions.length}, pages: ${cleaned.pages.length}, chars: ${cleaned.characters.length}`);
