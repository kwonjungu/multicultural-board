"use client";

import { useState, useEffect } from "react";
import type { Storybook, StorybookPage, StorybookCharacter, StorybookQuestion, QuestionTier, IbConcept } from "@/lib/types";
import { saveGeneratedBook, updateGeneratedBookPageImage, updateGeneratedBookField, updateGeneratedBookCharacterAvatar } from "@/lib/storybook";

interface Props {
  teacherName: string;
  onCreated: (bookId: string) => void;
  onCancel: () => void;
}

type Stage = "input" | "generating" | "preview" | "error";

type TextLength = "short" | "medium" | "long";

interface CreatorInput {
  topic: string;
  standard: string;
  conditions: string;
  pageCount: number;
  textLength: TextLength;
}

const LENGTH_OPTIONS: Array<{
  id: TextLength;
  label: string;
  desc: string;
  example: string;
}> = [
  {
    id: "short",
    label: "짧게",
    desc: "1문장 · 8~15자",
    example: "\"붕붕이는 꽃밭으로 갔어요.\"",
  },
  {
    id: "medium",
    label: "중간",
    desc: "2~3문장 · 각 15~30자",
    example: "\"붕붕이는 꿀을 모으러 꽃밭에 갔어요. 오늘도 열심히! 햇살이 따뜻했어요.\"",
  },
  {
    id: "long",
    label: "길게",
    desc: "3~5문장 · 각 20~40자",
    example: "\"아침 해가 떠오르자, 붕붕이는 날개를 반짝이며 꽃밭으로 날아갔어요. 노란 민들레가 고개를 들고 인사했죠. '오늘도 안녕!' 붕붕이의 마음은 두근두근했어요.\"",
  },
];

// Hue gradient map — mirrors server. Keep minimal; fallback is warm.
const HUE: Record<string, string> = {
  warm:   "linear-gradient(135deg, #FEF3C7, #FDE68A)",
  cool:   "linear-gradient(135deg, #DBEAFE, #BFDBFE)",
  night:  "linear-gradient(180deg, #1E3A8A, #3730A3 60%, #6366F1)",
  spring: "linear-gradient(135deg, #D1FAE5, #A7F3D0)",
  sunset: "linear-gradient(135deg, #FED7AA, #FBBF24)",
  garden: "linear-gradient(180deg, #FDE68A, #D1FAE5)",
};

interface TextAgentBook {
  titleKo: string;
  coverImagePrompt: string;
  characters: Array<{
    id: string;
    nameKo: string;
    avatarEmoji: string;
    avatarImagePrompt?: string;
    personality: string;
    speechStyle: string;
    bookContext: string;
  }>;
  pages: Array<{
    idx: number;
    textKo: string;
    illustrationEmoji: string;
    illustrationHueHint: string;
    imagePrompt: string;
  }>;
  questions: Array<{
    id: string;
    tier: QuestionTier;
    textKo: string;
    pageIdx?: number;
    ibConcept?: IbConcept;
    standard?: string;
  }>;
  titleTranslations: Record<string, string>;
  pageTexts: Record<number, Record<string, string>>;
  characterNames: Record<string, Record<string, string>>;
  questionTexts: Record<string, Record<string, string>>;
}

function agentToStorybook(
  src: TextAgentBook,
  bookId: string,
  authorName: string,
): Storybook {
  const now = Date.now();
  const pages: StorybookPage[] = src.pages.map((p) => ({
    idx: p.idx,
    text: src.pageTexts[p.idx] || { ko: p.textKo },
    illustration: {
      emoji: p.illustrationEmoji,
      bgGradient: HUE[p.illustrationHueHint] || HUE.warm,
    },
    imagePrompt: p.imagePrompt,
  }));
  const characters: StorybookCharacter[] = src.characters.map((c) => ({
    id: c.id,
    name: src.characterNames[c.id] || { ko: c.nameKo },
    avatarEmoji: c.avatarEmoji,
    avatarImagePrompt: c.avatarImagePrompt,
    personality: c.personality,
    speechStyle: c.speechStyle,
    bookContext: c.bookContext,
  }));
  const questions: StorybookQuestion[] = src.questions.map((q) => ({
    id: q.id,
    tier: q.tier,
    text: src.questionTexts[q.id] || { ko: q.textKo },
    pageIdx: q.pageIdx,
    ibConcept: q.ibConcept,
    standard: q.standard,
  }));
  const firstEmoji = src.pages[0]?.illustrationEmoji || "📖";
  return {
    id: bookId,
    title: src.titleTranslations && src.titleTranslations.ko
      ? src.titleTranslations
      : { ko: src.titleKo },
    cover: {
      emoji: firstEmoji,
      bgGradient: HUE[src.pages[0]?.illustrationHueHint || "warm"] || HUE.warm,
      imagePrompt: src.coverImagePrompt,
    },
    authorName,
    createdAt: now,
    pages,
    characters,
    questions,
  };
}

export default function StorybookCreator({ teacherName, onCreated, onCancel }: Props) {
  const [stage, setStage] = useState<Stage>("input");
  const [input, setInput] = useState<CreatorInput>({
    topic: "",
    standard: "",
    conditions: "",
    pageCount: 6,
    textLength: "medium",
  });
  const [progress, setProgress] = useState<{
    message: string;
    textDone: boolean;
    imageDoneCount: number;
    imageTotal: number;
  }>({ message: "", textDone: false, imageDoneCount: 0, imageTotal: 0 });
  const [book, setBook] = useState<Storybook | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!input.topic.trim() || !input.standard.trim()) {
      setError("주제와 성취기준은 필수입니다.");
      return;
    }
    setError(null);
    setStage("generating");
    setProgress({
      message: "📝 스토리와 질문을 작성하고 있어요…",
      textDone: false,
      imageDoneCount: 0,
      imageTotal: input.pageCount,
    });

    const bookId = `gen-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

    try {
      // Step 1: generate text
      const textRes = await fetch("/api/storybook-agent/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: input.topic,
          standard: input.standard,
          conditions: input.conditions,
          pageCount: input.pageCount,
          textLength: input.textLength,
          targetLangs: ["ko", "en", "vi", "zh", "fil"],
        }),
      });
      if (!textRes.ok) {
        const err = await textRes.json().catch(() => ({ error: "network error" }));
        throw new Error(err.error || "텍스트 생성 실패");
      }
      const textData = await textRes.json() as { ok: boolean; book?: TextAgentBook; error?: string };
      if (!textData.ok || !textData.book) {
        throw new Error(textData.error || "텍스트 생성 실패");
      }

      const storybook = agentToStorybook(textData.book, bookId, teacherName);
      await saveGeneratedBook(storybook);
      setBook(storybook);
      const imageCount = storybook.pages.length + 1 + storybook.characters.length; // pages + cover + character portraits
      setProgress((p) => ({
        ...p, textDone: true,
        imageTotal: imageCount,
        message: "🎨 표지·페이지·등장인물 이미지를 그리고 있어요…",
      }));

      // Step 2: generate cover + pages + character portraits in parallel
      type ImgTask =
        | { kind: "cover"; prompt: string }
        | { kind: "page"; idx: number; prompt: string }
        | { kind: "char"; characterId: string; prompt: string };

      const tasks: ImgTask[] = [
        {
          kind: "cover",
          prompt: textData.book.coverImagePrompt
            || `Book cover illustration: "${storybook.title?.ko}". Cute cartoon, soft watercolor, warm palette.`,
        },
        ...storybook.pages.map((p) => ({
          kind: "page" as const,
          idx: p.idx,
          prompt: p.imagePrompt || `A children's book illustration of: ${p.illustration.emoji}`,
        })),
        ...storybook.characters
          .filter((c) => c.avatarImagePrompt)
          .map((c) => ({
            kind: "char" as const,
            characterId: c.id,
            prompt: c.avatarImagePrompt!,
          })),
      ];

      const imagePromises = tasks.map(async (task) => {
        try {
          const reqBody: Record<string, unknown> = {
            bookId,
            prompt: task.prompt,
          };
          if (task.kind === "cover") reqBody.pageIdx = 0;
          else if (task.kind === "page") reqBody.pageIdx = task.idx;
          else reqBody.characterId = task.characterId;

          const res = await fetch("/api/storybook-agent/image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(reqBody),
          });
          if (!res.ok) return;
          const data = await res.json() as { ok: boolean; url?: string };
          if (!data.ok || !data.url) return;

          if (task.kind === "cover") {
            await updateGeneratedBookPageImage(bookId, 0, data.url);
            setBook((prev) => prev ? { ...prev, cover: { ...prev.cover, imageUrl: data.url } } : prev);
          } else if (task.kind === "page") {
            await updateGeneratedBookPageImage(bookId, task.idx, data.url);
            setBook((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                pages: prev.pages.map((p) =>
                  p.idx === task.idx
                    ? { ...p, illustration: { ...p.illustration, imageUrl: data.url } }
                    : p,
                ),
              };
            });
          } else {
            await updateGeneratedBookCharacterAvatar(bookId, task.characterId, data.url);
            setBook((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                characters: prev.characters.map((c) =>
                  c.id === task.characterId ? { ...c, avatarUrl: data.url } : c,
                ),
              };
            });
          }
        } catch (err) {
          console.warn("image gen failed for", task, err);
        } finally {
          setProgress((p) => ({
            ...p,
            imageDoneCount: p.imageDoneCount + 1,
            message: `🎨 이미지를 그리고 있어요… (${p.imageDoneCount + 1}/${p.imageTotal})`,
          }));
        }
      });
      await Promise.all(imagePromises);

      setProgress((p) => ({ ...p, message: "✨ 완성! 미리보기를 확인하세요." }));
      setStage("preview");
    } catch (err) {
      console.error("generation failed", err);
      setError((err as Error).message || "생성 실패");
      setStage("error");
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #FFFBEB 0%, #FEF3C7 40%, #FDE68A 100%)",
        fontFamily: "'Noto Sans KR', sans-serif",
        padding: "20px 16px 40px",
      }}
    >
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <button
            onClick={onCancel}
            disabled={stage === "generating"}
            aria-label="back"
            style={{
              width: 44, height: 44, borderRadius: 14,
              background: "#fff", border: "2px solid #FDE68A",
              fontSize: 18, fontWeight: 900, color: "#92400E",
              cursor: stage === "generating" ? "not-allowed" : "pointer",
              opacity: stage === "generating" ? 0.5 : 1,
            }}
          >←</button>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#1F2937", letterSpacing: -0.3 }}>
            🎨 새 그림책 만들기
          </h1>
        </div>

        {stage === "input" && (
          <InputForm
            input={input}
            onChange={setInput}
            onSubmit={handleGenerate}
            error={error}
          />
        )}
        {stage === "generating" && (
          <ProgressMonitor progress={progress} />
        )}
        {stage === "preview" && book && (
          <PreviewPanel
            book={book}
            onBookChange={(next) => setBook(next)}
            onAccept={() => onCreated(book.id)}
            onRegenerateImage={async (pageIdx, prompt) => {
              try {
                const res = await fetch("/api/storybook-agent/image", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    bookId: book.id,
                    pageIdx,
                    prompt,
                  }),
                });
                const data = await res.json() as { ok: boolean; url?: string };
                if (data.ok && data.url) {
                  await updateGeneratedBookPageImage(book.id, pageIdx, data.url);
                  setBook((prev) => {
                    if (!prev) return prev;
                    if (pageIdx === 0) {
                      return { ...prev, cover: { ...prev.cover, imageUrl: data.url } };
                    }
                    return {
                      ...prev,
                      pages: prev.pages.map((p) =>
                        p.idx === pageIdx
                          ? { ...p, illustration: { ...p.illustration, imageUrl: data.url } }
                          : p,
                      ),
                    };
                  });
                }
              } catch (err) {
                console.error("regenerate image failed", err);
              }
            }}
          />
        )}
        {stage === "error" && (
          <div style={{
            background: "#fff", borderRadius: 22, padding: 24,
            border: "3px solid #FCA5A5", textAlign: "center",
          }}>
            <div style={{ fontSize: 48 }}>😿</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#991B1B", marginTop: 10 }}>
              {error || "생성에 실패했어요"}
            </div>
            <button
              onClick={() => setStage("input")}
              style={{
                marginTop: 16, minHeight: 48, padding: "12px 24px",
                background: "linear-gradient(135deg, #F59E0B, #D97706)",
                color: "#fff", border: "none", borderRadius: 14,
                fontSize: 15, fontWeight: 900, cursor: "pointer",
              }}
            >다시 시도</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Input form
// ============================================================

function InputForm({
  input, onChange, onSubmit, error,
}: {
  input: CreatorInput;
  onChange: (next: CreatorInput) => void;
  onSubmit: () => void;
  error: string | null;
}) {
  const labelStyle = {
    fontSize: 13, fontWeight: 900, color: "#92400E",
    letterSpacing: -0.1, marginBottom: 6,
  } as const;
  const inputStyle = {
    width: "100%", minHeight: 44, padding: "10px 14px",
    border: "2px solid #FDE68A", borderRadius: 14,
    fontSize: 15, fontWeight: 600, color: "#1F2937",
    background: "#fff", fontFamily: "inherit", outline: "none",
  } as const;

  return (
    <div style={{
      background: "#fff", borderRadius: 22, padding: 20,
      border: "2px solid #FDE68A",
      boxShadow: "0 8px 24px rgba(180,83,9,0.12)",
    }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <div style={labelStyle}>주제 *</div>
          <textarea
            value={input.topic}
            onChange={(e) => onChange({ ...input, topic: e.target.value })}
            placeholder="예: 나눔 / 우정 / 용기… 또는 구체적인 상황·배경을 길게 설명해도 돼요"
            maxLength={1000}
            rows={2}
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
          />
          <CountBadge current={input.topic.length} max={1000} />
        </div>
        <div>
          <div style={labelStyle}>성취기준 *</div>
          <textarea
            value={input.standard}
            onChange={(e) => onChange({ ...input, standard: e.target.value })}
            placeholder="교육과정 코드 + 본문 전체를 그대로 붙여넣어도 됩니다 (예: 2국05-04 이야기 속 인물의 마음을 파악하며 글을 읽는다.)"
            maxLength={2000}
            rows={3}
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
          />
          <CountBadge current={input.standard.length} max={2000} />
        </div>
        <div>
          <div style={labelStyle}>추가 조건 (선택)</div>
          <textarea
            value={input.conditions}
            onChange={(e) => onChange({ ...input, conditions: e.target.value })}
            placeholder="예: 다문화 주인공 / 따뜻한 수채화 / 특정 캐릭터 / 피해야 할 내용 / 수업 상황 등 자유롭게 길게 적으세요"
            maxLength={3000}
            rows={5}
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
          />
          <CountBadge current={input.conditions.length} max={3000} />
        </div>
        <div>
          <div style={labelStyle}>페이지 수</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[4, 6, 8, 10].map((n) => (
              <button
                key={n}
                onClick={() => onChange({ ...input, pageCount: n })}
                style={{
                  flex: 1, minHeight: 44,
                  background: input.pageCount === n
                    ? "linear-gradient(135deg, #F59E0B, #D97706)"
                    : "#fff",
                  color: input.pageCount === n ? "#fff" : "#92400E",
                  border: `2px solid ${input.pageCount === n ? "#D97706" : "#FDE68A"}`,
                  borderRadius: 12, fontSize: 15, fontWeight: 900,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >{n}장</button>
            ))}
          </div>
        </div>

        <div>
          <div style={labelStyle}>페이지 글 길이</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {LENGTH_OPTIONS.map((opt) => {
              const selected = input.textLength === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => onChange({ ...input, textLength: opt.id })}
                  style={{
                    textAlign: "left",
                    padding: "10px 14px",
                    background: selected
                      ? "linear-gradient(135deg, #FEF3C7, #FDE68A)"
                      : "#fff",
                    color: "#1F2937",
                    border: `2px solid ${selected ? "#F59E0B" : "#FDE68A"}`,
                    borderRadius: 14,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    boxShadow: selected ? "0 4px 12px rgba(245,158,11,0.25)" : "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 900, color: "#B45309" }}>
                      {opt.label}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#92400E" }}>
                      {opt.desc}
                    </span>
                  </div>
                  <div style={{
                    marginTop: 4, fontSize: 12, fontWeight: 600,
                    color: "#1F2937", lineHeight: 1.4, fontStyle: "italic",
                  }}>
                    {opt.example}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div style={{
            background: "#FEF2F2", color: "#991B1B",
            padding: "10px 14px", borderRadius: 12,
            border: "1.5px solid #FECACA",
            fontSize: 13, fontWeight: 700,
          }}>❌ {error}</div>
        )}

        <button
          onClick={onSubmit}
          style={{
            minHeight: 54,
            background: "linear-gradient(135deg, #F59E0B, #D97706)",
            color: "#fff", fontSize: 17, fontWeight: 900,
            border: "none", borderRadius: 16, cursor: "pointer",
            boxShadow: "0 8px 20px rgba(245,158,11,0.4)",
            letterSpacing: -0.2,
            marginTop: 4,
          }}
        >🤖 자동 만들기 시작</button>
        <div style={{
          fontSize: 11, fontWeight: 700, color: "#92400E",
          textAlign: "center", opacity: 0.8, lineHeight: 1.4,
        }}>
          AI가 스토리 → 이미지 → 질문 → 등장인물을 순서대로 생성합니다.<br />
          약 1~3분 정도 걸려요.
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Progress monitor
// ============================================================

function ProgressMonitor({
  progress,
}: {
  progress: {
    message: string;
    textDone: boolean;
    imageDoneCount: number;
    imageTotal: number;
  };
}) {
  const overallPct = progress.textDone
    ? 20 + (progress.imageDoneCount / Math.max(1, progress.imageTotal)) * 80
    : 10;
  return (
    <div style={{
      background: "#fff", borderRadius: 22, padding: 28,
      border: "2px solid #FDE68A",
      boxShadow: "0 8px 24px rgba(180,83,9,0.12)",
      textAlign: "center",
    }}>
      <img
        src="/mascot/bee-loading.png"
        alt=""
        aria-hidden="true"
        style={{ width: 120, height: 120, animation: "heroBeeFloat 1.5s ease-in-out infinite" }}
      />
      <div style={{
        fontSize: 17, fontWeight: 900, color: "#1F2937",
        marginTop: 12, letterSpacing: -0.2, lineHeight: 1.4,
      }}>
        🤖 에이전트가 그림책을 만들고 있어요<br />
        <span style={{ fontSize: 13, color: "#92400E", fontWeight: 700 }}>
          커피 한 잔 드세요!
        </span>
      </div>
      <div style={{
        marginTop: 18, height: 14, borderRadius: 999,
        background: "#FEF3C7", overflow: "hidden", border: "1px solid #FDE68A",
      }}>
        <div style={{
          width: `${overallPct}%`, height: "100%",
          background: "linear-gradient(90deg, #F59E0B, #D97706)",
          transition: "width 0.5s ease",
        }} />
      </div>
      <div style={{
        marginTop: 10, fontSize: 13, fontWeight: 800, color: "#B45309",
      }}>
        {progress.message}
      </div>
      <div style={{
        marginTop: 14, display: "flex", flexDirection: "column", gap: 6,
        fontSize: 12, fontWeight: 700, color: "#92400E", textAlign: "left",
        maxWidth: 260, marginLeft: "auto", marginRight: "auto",
      }}>
        <Row done={progress.textDone} label="스토리·질문·등장인물" />
        <Row
          done={progress.imageTotal > 0 && progress.imageDoneCount >= progress.imageTotal}
          inProgress={progress.textDone && progress.imageDoneCount < progress.imageTotal}
          label={`페이지 이미지 ${progress.imageDoneCount}/${progress.imageTotal}`}
        />
      </div>
    </div>
  );
}

function Row({ done, inProgress, label }: { done: boolean; inProgress?: boolean; label: string }) {
  const icon = done ? "✅" : inProgress ? "⏳" : "⏱";
  return <div>{icon} {label}</div>;
}

function CountBadge({ current, max }: { current: number; max: number }) {
  const near = current >= max * 0.9;
  return (
    <div style={{
      textAlign: "right",
      fontSize: 10, fontWeight: 800,
      color: near ? "#B91C1C" : "#92400E",
      marginTop: 3,
      letterSpacing: 0.2,
    }}>
      {current.toLocaleString()} / {max.toLocaleString()}
    </div>
  );
}

// ============================================================
// Inline editors — shared small primitives for Preview
// ============================================================

const miniBtnPrimary: React.CSSProperties = {
  minHeight: 32, padding: "4px 12px",
  background: "linear-gradient(135deg, #F59E0B, #D97706)",
  color: "#fff", border: "none",
  borderRadius: 10, fontSize: 12, fontWeight: 900,
  cursor: "pointer", fontFamily: "inherit",
};
const miniBtnGhost: React.CSSProperties = {
  minHeight: 32, padding: "4px 10px",
  background: "#fff", border: "1.5px solid #FDE68A",
  color: "#92400E", fontSize: 12, fontWeight: 900,
  borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
};

function PageTextEditor({
  initial, onSave,
}: {
  initial: string;
  onSave: (next: string) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [editing, setEditing] = useState(false);
  // Sync draft when parent book changes externally (e.g. regenerated)
  useEffect(() => { if (!editing) setDraft(initial); }, [initial, editing]);

  if (!editing) {
    return (
      <div
        onClick={() => setEditing(true)}
        style={{
          fontSize: 13, fontWeight: 600, color: "#1F2937",
          marginTop: 2, lineHeight: 1.4, wordBreak: "break-word",
          cursor: "text",
          padding: "4px 6px",
          borderRadius: 6,
          border: "1px dashed transparent",
          transition: "border 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.border = "1px dashed #F59E0B")}
        onMouseLeave={(e) => (e.currentTarget.style.border = "1px dashed transparent")}
        title="클릭해서 편집"
      >
        {initial || <span style={{ color: "#9CA3AF" }}>본문 없음 — 클릭해서 작성</span>}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 4 }}>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={3}
        autoFocus
        maxLength={500}
        style={{
          width: "100%",
          padding: "6px 10px",
          border: "2px solid #F59E0B",
          borderRadius: 10,
          fontSize: 13, fontWeight: 600, fontFamily: "inherit",
          color: "#1F2937", lineHeight: 1.4,
          resize: "vertical", outline: "none",
        }}
      />
      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        <button onClick={() => { onSave(draft.trim()); setEditing(false); }} style={miniBtnPrimary}>
          저장
        </button>
        <button onClick={() => { setDraft(initial); setEditing(false); }} style={miniBtnGhost}>
          취소
        </button>
      </div>
    </div>
  );
}

function QuestionEditor({
  q, onSave, onDelete,
}: {
  q: { id: string; tier: string; text?: Record<string, string> };
  onSave: (next: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(q.text?.ko || "");
  useEffect(() => { if (!editing) setDraft(q.text?.ko || ""); }, [q.text?.ko, editing]);

  return (
    <div style={{
      padding: "8px 10px", background: "#FFFBEB",
      border: "1px solid #FDE68A", borderRadius: 10,
    }}>
      <div style={{
        display: "flex", alignItems: "flex-start", gap: 8,
      }}>
        <span style={{
          fontSize: 10, fontWeight: 900, color: "#B45309",
          background: "#FEF3C7", padding: "2px 8px", borderRadius: 999,
          whiteSpace: "nowrap", marginTop: 2,
        }}>
          {q.tier}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={2}
                autoFocus
                maxLength={250}
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  border: "2px solid #F59E0B",
                  borderRadius: 8,
                  fontSize: 12, fontWeight: 600, fontFamily: "inherit",
                  color: "#1F2937", lineHeight: 1.4,
                  resize: "vertical", outline: "none",
                }}
              />
              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                <button onClick={() => { onSave(draft.trim()); setEditing(false); }} style={miniBtnPrimary}>저장</button>
                <button onClick={() => { setDraft(q.text?.ko || ""); setEditing(false); }} style={miniBtnGhost}>취소</button>
              </div>
            </>
          ) : (
            <div
              onClick={() => setEditing(true)}
              style={{
                fontSize: 12, fontWeight: 700, color: "#1F2937",
                lineHeight: 1.4, cursor: "text",
              }}
            >{q.text?.ko}</div>
          )}
        </div>
        {!editing && (
          <button onClick={onDelete} style={{
            ...miniBtnGhost, border: "1.5px solid #FCA5A5", color: "#B91C1C",
            fontSize: 11, minHeight: 28, padding: "2px 8px",
          }}>🗑</button>
        )}
      </div>
    </div>
  );
}

function CharacterEditor({
  c, onSaveField,
}: {
  c: {
    id: string; avatarEmoji: string;
    name?: Record<string, string>;
    personality: string; speechStyle: string; bookContext: string;
  };
  onSaveField: (field: "name" | "personality" | "speechStyle" | "bookContext", value: string) => void;
}) {
  return (
    <div style={{
      padding: 12, background: "#FFFBEB",
      border: "1px solid #FDE68A", borderRadius: 12,
      display: "grid", gridTemplateColumns: "60px 1fr", gap: 10,
    }}>
      <div style={{ fontSize: 44, textAlign: "center" }}>{c.avatarEmoji}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <EditableLine
          label="이름"
          value={c.name?.ko || ""}
          onSave={(v) => onSaveField("name", v)}
          strong
        />
        <EditableLine
          label="성격"
          value={c.personality}
          onSave={(v) => onSaveField("personality", v)}
          multiline
        />
        <EditableLine
          label="말투"
          value={c.speechStyle}
          onSave={(v) => onSaveField("speechStyle", v)}
          multiline
        />
        <EditableLine
          label="책에서의 역할"
          value={c.bookContext}
          onSave={(v) => onSaveField("bookContext", v)}
          multiline
        />
      </div>
    </div>
  );
}

function EditableLine({
  label, value, onSave, strong, multiline,
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
  strong?: boolean;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);

  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 900, color: "#92400E", letterSpacing: 0.2 }}>
        {label}
      </div>
      {editing ? (
        <div style={{ marginTop: 2 }}>
          {multiline ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              autoFocus
              maxLength={400}
              style={{
                width: "100%",
                padding: "6px 10px",
                border: "2px solid #F59E0B",
                borderRadius: 8,
                fontSize: 12, fontWeight: 600, fontFamily: "inherit",
                color: "#1F2937", lineHeight: 1.4,
                resize: "vertical", outline: "none",
              }}
            />
          ) : (
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { onSave(draft.trim()); setEditing(false); } }}
              autoFocus
              maxLength={80}
              style={{
                width: "100%",
                padding: "6px 10px",
                border: "2px solid #F59E0B",
                borderRadius: 8,
                fontSize: 13, fontWeight: 700, fontFamily: "inherit",
                color: "#1F2937",
                outline: "none",
              }}
            />
          )}
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <button onClick={() => { onSave(draft.trim()); setEditing(false); }} style={miniBtnPrimary}>저장</button>
            <button onClick={() => { setDraft(value); setEditing(false); }} style={miniBtnGhost}>취소</button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => setEditing(true)}
          style={{
            fontSize: strong ? 14 : 11,
            fontWeight: strong ? 900 : 600,
            color: strong ? "#1F2937" : "#4B5563",
            lineHeight: 1.4,
            cursor: "text",
            padding: "3px 4px",
            borderRadius: 4,
            marginTop: 1,
            wordBreak: "break-word",
          }}
          title="클릭해서 편집"
        >
          {value || <span style={{ color: "#9CA3AF", fontStyle: "italic" }}>비어있음</span>}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Preview panel
// ============================================================

function PreviewPanel({
  book, onBookChange, onAccept, onRegenerateImage,
}: {
  book: Storybook;
  onBookChange: (next: Storybook) => void;
  onAccept: () => void;
  onRegenerateImage: (pageIdx: number, prompt: string) => Promise<void>;
}) {
  const [editingPage, setEditingPage] = useState<number | null>(null);
  const [editPrompt, setEditPrompt] = useState<string>("");
  const [busyPage, setBusyPage] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(book.title?.ko || "");

  async function saveTitle() {
    const next = { ...book, title: { ...book.title, ko: titleDraft.trim() || book.title?.ko || "" } };
    onBookChange(next);
    try { await updateGeneratedBookField(book.id, { title: next.title }); } catch (err) { console.error(err); }
    setEditingTitle(false);
  }

  async function savePageText(pageIdx: number, nextKo: string) {
    const next = {
      ...book,
      pages: book.pages.map((p) =>
        p.idx === pageIdx
          ? { ...p, text: { ...p.text, ko: nextKo } }
          : p,
      ),
    };
    onBookChange(next);
    try { await updateGeneratedBookField(book.id, { pages: next.pages }); } catch (err) { console.error(err); }
  }

  async function saveQuestionText(qid: string, nextKo: string) {
    const next = {
      ...book,
      questions: book.questions.map((q) =>
        q.id === qid ? { ...q, text: { ...q.text, ko: nextKo } } : q,
      ),
    };
    onBookChange(next);
    try { await updateGeneratedBookField(book.id, { questions: next.questions }); } catch (err) { console.error(err); }
  }

  async function deleteQuestion(qid: string) {
    const next = {
      ...book,
      questions: book.questions.filter((q) => q.id !== qid),
    };
    onBookChange(next);
    try { await updateGeneratedBookField(book.id, { questions: next.questions }); } catch (err) { console.error(err); }
  }

  async function saveCharacterField(cid: string, field: "name" | "personality" | "speechStyle" | "bookContext", value: string) {
    const next = {
      ...book,
      characters: book.characters.map((c) => {
        if (c.id !== cid) return c;
        if (field === "name") return { ...c, name: { ...c.name, ko: value } };
        return { ...c, [field]: value };
      }),
    };
    onBookChange(next);
    try { await updateGeneratedBookField(book.id, { characters: next.characters }); } catch (err) { console.error(err); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Header — editable title */}
      <div style={{
        background: "#fff", borderRadius: 22, padding: 18,
        border: "2px solid #FDE68A",
        boxShadow: "0 8px 24px rgba(180,83,9,0.12)",
      }}>
        {book.cover.imageUrl && (
          <div style={{
            width: "100%", aspectRatio: "4/3",
            borderRadius: 16, overflow: "hidden", marginBottom: 14,
            boxShadow: "0 6px 20px rgba(180,83,9,0.18)",
          }}>
            <img
              src={book.cover.imageUrl}
              alt=""
              aria-hidden="true"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          </div>
        )}
        {editingTitle ? (
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); }}
              maxLength={80}
              style={{
                flex: 1, minHeight: 44, padding: "8px 12px",
                border: "2px solid #F59E0B", borderRadius: 12,
                fontSize: 18, fontWeight: 900, color: "#1F2937",
                fontFamily: "inherit", outline: "none",
              }}
            />
            <button onClick={saveTitle} style={miniBtnPrimary}>저장</button>
            <button onClick={() => { setTitleDraft(book.title?.ko || ""); setEditingTitle(false); }} style={miniBtnGhost}>취소</button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#1F2937", letterSpacing: -0.3, textAlign: "center" }}>
              📖 {book.title?.ko || book.id}
            </div>
            <button
              onClick={() => { setTitleDraft(book.title?.ko || ""); setEditingTitle(true); }}
              style={miniBtnGhost}
              aria-label="제목 수정"
            >✏️</button>
            <button
              onClick={() => {
                const prompt = window.prompt(
                  "표지 이미지 프롬프트 (영어로 자세히)",
                  book.cover.imagePrompt || "",
                );
                if (prompt && prompt.trim()) {
                  onRegenerateImage(0, prompt.trim());
                }
              }}
              style={miniBtnGhost}
              aria-label="표지 이미지 재생성"
            >🔄 표지</button>
          </div>
        )}
        <div style={{ fontSize: 13, fontWeight: 700, color: "#92400E", marginTop: 8, textAlign: "center" }}>
          {book.pages.length}장 · 질문 {book.questions.length}개 · 등장인물 {book.characters.length}명
        </div>
      </div>

      {/* Pages strip */}
      <div style={{
        background: "#fff", borderRadius: 22, padding: 14,
        border: "2px solid #FDE68A",
        boxShadow: "0 8px 24px rgba(180,83,9,0.12)",
      }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: "#92400E", marginBottom: 10 }}>
          📑 페이지 ({book.pages.length}장)
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {book.pages.map((p) => {
            const isEditing = editingPage === p.idx;
            const isBusy = busyPage === p.idx;
            return (
              <div
                key={p.idx}
                style={{
                  display: "grid",
                  gridTemplateColumns: "140px 1fr",
                  gap: 12,
                  padding: 12,
                  background: "#FFFBEB",
                  border: "1.5px solid #FDE68A",
                  borderRadius: 14,
                }}
              >
                <div style={{
                  width: 140, height: 140,
                  borderRadius: 12, overflow: "hidden",
                  background: p.illustration.bgGradient,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {p.illustration.imageUrl ? (
                    <img
                      src={p.illustration.imageUrl}
                      alt=""
                      aria-hidden="true"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <div style={{ fontSize: 56 }}>{p.illustration.emoji}</div>
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#B45309" }}>
                    {p.idx}쪽
                  </div>
                  <PageTextEditor
                    initial={p.text?.ko || ""}
                    onSave={(next) => savePageText(p.idx, next)}
                  />
                  {!isEditing && (
                    <button
                      onClick={() => {
                        setEditingPage(p.idx);
                        setEditPrompt(p.imagePrompt || "");
                      }}
                      style={{
                        marginTop: 6, minHeight: 30, padding: "4px 10px",
                        background: "#fff", border: "1.5px solid #FDE68A",
                        color: "#92400E", fontSize: 11, fontWeight: 900,
                        borderRadius: 8, cursor: "pointer",
                      }}
                    >🔄 이미지 다시 만들기</button>
                  )}
                  {isEditing && (
                    <div style={{ marginTop: 6 }}>
                      <textarea
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        rows={2}
                        placeholder="그림 설명 (영어)"
                        style={{
                          width: "100%",
                          padding: "6px 10px",
                          border: "1.5px solid #FDE68A",
                          borderRadius: 8,
                          fontSize: 11, fontFamily: "inherit",
                          resize: "vertical",
                        }}
                      />
                      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                        <button
                          onClick={async () => {
                            if (isBusy) return;
                            setBusyPage(p.idx);
                            await onRegenerateImage(p.idx, editPrompt.trim() || p.imagePrompt || "");
                            setBusyPage(null);
                            setEditingPage(null);
                          }}
                          disabled={isBusy}
                          style={{
                            minHeight: 28, padding: "4px 10px",
                            background: isBusy ? "#E5E7EB" : "linear-gradient(135deg, #F59E0B, #D97706)",
                            color: isBusy ? "#9CA3AF" : "#fff",
                            border: "none", borderRadius: 8,
                            fontSize: 11, fontWeight: 900,
                            cursor: isBusy ? "wait" : "pointer",
                          }}
                        >{isBusy ? "⏳ 만드는 중…" : "✅ 생성"}</button>
                        <button
                          onClick={() => setEditingPage(null)}
                          disabled={isBusy}
                          style={{
                            minHeight: 28, padding: "4px 10px",
                            background: "#fff", border: "1.5px solid #E5E7EB",
                            color: "#6B7280", fontSize: 11, fontWeight: 900,
                            borderRadius: 8, cursor: "pointer",
                          }}
                        >취소</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Questions strip — editable */}
      <div style={{
        background: "#fff", borderRadius: 22, padding: 14,
        border: "2px solid #FDE68A",
        boxShadow: "0 8px 24px rgba(180,83,9,0.12)",
      }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: "#92400E", marginBottom: 10 }}>
          ❓ 질문 ({book.questions.length}개)
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {book.questions.map((q) => (
            <QuestionEditor
              key={q.id}
              q={q}
              onSave={(next) => saveQuestionText(q.id, next)}
              onDelete={() => {
                if (window.confirm("이 질문을 삭제할까요?")) deleteQuestion(q.id);
              }}
            />
          ))}
        </div>
      </div>

      {/* Characters strip — editable */}
      <div style={{
        background: "#fff", borderRadius: 22, padding: 14,
        border: "2px solid #FDE68A",
        boxShadow: "0 8px 24px rgba(180,83,9,0.12)",
      }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: "#92400E", marginBottom: 10 }}>
          🎭 등장인물
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {book.characters.map((c) => (
            <CharacterEditor
              key={c.id}
              c={c}
              onSaveField={(field, value) => saveCharacterField(c.id, field, value)}
            />
          ))}
        </div>
      </div>

      <button
        onClick={onAccept}
        style={{
          minHeight: 54,
          background: "linear-gradient(135deg, #10B981, #059669)",
          color: "#fff", fontSize: 17, fontWeight: 900,
          border: "none", borderRadius: 16, cursor: "pointer",
          boxShadow: "0 8px 20px rgba(16,185,129,0.4)",
          letterSpacing: -0.2,
        }}
      >✅ 라이브러리에 저장 + 수업 시작</button>
    </div>
  );
}
