"use client";

import { useState } from "react";
import type { Storybook, StorybookPage, StorybookCharacter, StorybookQuestion, QuestionTier, IbConcept } from "@/lib/types";
import { saveGeneratedBook, updateGeneratedBookPageImage } from "@/lib/storybook";

interface Props {
  teacherName: string;
  onCreated: (bookId: string) => void;
  onCancel: () => void;
}

type Stage = "input" | "generating" | "preview" | "error";

interface CreatorInput {
  topic: string;
  standard: string;
  conditions: string;
  pageCount: number;
}

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
      setProgress((p) => ({ ...p, textDone: true, message: "🎨 페이지 이미지를 그리고 있어요…" }));

      // Step 2: generate images in parallel
      const imagePromises = storybook.pages.map(async (page) => {
        try {
          const res = await fetch("/api/storybook-agent/image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              bookId,
              pageIdx: page.idx,
              prompt: page.imagePrompt || `A children's book illustration of: ${page.illustration.emoji}`,
            }),
          });
          if (!res.ok) return;
          const data = await res.json() as { ok: boolean; url?: string };
          if (data.ok && data.url) {
            await updateGeneratedBookPageImage(bookId, page.idx, data.url);
            setBook((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                pages: prev.pages.map((p) =>
                  p.idx === page.idx
                    ? { ...p, illustration: { ...p.illustration, imageUrl: data.url } }
                    : p,
                ),
              };
            });
          }
        } catch (err) {
          console.warn("image gen failed for page", page.idx, err);
        } finally {
          setProgress((p) => ({
            ...p,
            imageDoneCount: p.imageDoneCount + 1,
            message: `🎨 페이지 이미지를 그리고 있어요… (${p.imageDoneCount + 1}/${p.imageTotal})`,
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
// Preview panel
// ============================================================

function PreviewPanel({
  book, onAccept, onRegenerateImage,
}: {
  book: Storybook;
  onAccept: () => void;
  onRegenerateImage: (pageIdx: number, prompt: string) => Promise<void>;
}) {
  const [editingPage, setEditingPage] = useState<number | null>(null);
  const [editPrompt, setEditPrompt] = useState<string>("");
  const [busyPage, setBusyPage] = useState<number | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Header */}
      <div style={{
        background: "#fff", borderRadius: 22, padding: 18,
        border: "2px solid #FDE68A",
        boxShadow: "0 8px 24px rgba(180,83,9,0.12)",
        textAlign: "center",
      }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#1F2937", letterSpacing: -0.3 }}>
          📖 {book.title?.ko || book.id}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#92400E", marginTop: 4 }}>
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
                  gridTemplateColumns: "80px 1fr",
                  gap: 10,
                  padding: 10,
                  background: "#FFFBEB",
                  border: "1.5px solid #FDE68A",
                  borderRadius: 14,
                }}
              >
                <div style={{
                  width: 80, height: 80,
                  borderRadius: 10, overflow: "hidden",
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
                    <div style={{ fontSize: 32 }}>{p.illustration.emoji}</div>
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#B45309" }}>
                    {p.idx}쪽
                  </div>
                  <div style={{
                    fontSize: 13, fontWeight: 600, color: "#1F2937",
                    marginTop: 2, lineHeight: 1.4, wordBreak: "break-word",
                  }}>
                    {p.text?.ko || ""}
                  </div>
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

      {/* Questions strip */}
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
            <div
              key={q.id}
              style={{
                padding: "8px 10px", background: "#FFFBEB",
                border: "1px solid #FDE68A", borderRadius: 10,
                fontSize: 12, fontWeight: 700, color: "#1F2937",
                lineHeight: 1.4,
              }}
            >
              <span style={{ fontWeight: 900, color: "#B45309", marginRight: 6 }}>
                [{q.tier}]
              </span>
              {q.text?.ko}
            </div>
          ))}
        </div>
      </div>

      {/* Characters strip */}
      <div style={{
        background: "#fff", borderRadius: 22, padding: 14,
        border: "2px solid #FDE68A",
        boxShadow: "0 8px 24px rgba(180,83,9,0.12)",
      }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: "#92400E", marginBottom: 10 }}>
          🎭 등장인물
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {book.characters.map((c) => (
            <div
              key={c.id}
              style={{
                flex: "1 1 140px",
                padding: 12, background: "#FFFBEB",
                border: "1px solid #FDE68A", borderRadius: 12,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 40 }}>{c.avatarEmoji}</div>
              <div style={{ fontSize: 14, fontWeight: 900, color: "#1F2937", marginTop: 4 }}>
                {c.name?.ko}
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#6B7280", marginTop: 4, lineHeight: 1.3 }}>
                {c.personality}
              </div>
            </div>
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
