"use client";

import { useState } from "react";
import { CardData } from "@/lib/types";
import { LANGUAGES, CARD_PALETTES } from "@/lib/constants";

const TTS_LANG_MAP: Record<string, string> = {
  ko: "ko-KR", en: "en-US", vi: "vi-VN", zh: "zh-CN", fil: "fil-PH",
  ja: "ja-JP", th: "th-TH", km: "km-KH", mn: "mn-MN", ru: "ru-RU",
  uz: "uz-UZ", hi: "hi-IN", id: "id-ID", ar: "ar-SA", my: "my-MM",
};

function speakText(text: string, lang: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = TTS_LANG_MAP[lang] || "en-US";
  window.speechSynthesis.speak(u);
}

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  return `${Math.floor(s / 3600)}시간 전`;
}

function TranslationRow({ lang, text, accent }: { lang: string; text: string; accent: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 8,
      padding: "7px 0", borderTop: "1px solid #F3F4F6",
    }}>
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: 0.2,
        background: accent + "18", color: accent,
        borderRadius: 8, padding: "2px 7px", flexShrink: 0, marginTop: 2,
        whiteSpace: "nowrap",
      }}>
        {LANGUAGES[lang]?.flag} {LANGUAGES[lang]?.label}
      </span>
      <span style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, flex: 1 }}>{text}</span>
      <button
        onClick={() => speakText(text, lang)}
        title="읽어주기"
        style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: 12, color: "#CBD5E1", flexShrink: 0, padding: "2px",
          transition: "color 0.15s", lineHeight: 1,
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = accent)}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#CBD5E1")}
      >🔊</button>
    </div>
  );
}

interface Props {
  card: CardData;
  viewerLang: string;
  colColor: string;
}

export default function PadletCard({ card, viewerLang, colColor }: Props) {
  const p = CARD_PALETTES[card.paletteIdx % CARD_PALETTES.length];
  const [open, setOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const cardType = card.cardType || "text";

  const otherLangs = Object.keys(card.translations || {}).filter(
    (l) => l !== card.authorLang && l !== viewerLang
  );

  return (
    <div
      style={{
        background: p.bg,
        borderRadius: 14,
        border: "1px solid #EEF0F6",
        borderLeft: `4px solid ${p.accent}`,
        boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 2px 6px rgba(0,0,0,0.04)",
        marginBottom: 10,
        transition: "box-shadow 0.2s, transform 0.2s",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 24px rgba(0,0,0,0.1)";
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 3px rgba(0,0,0,0.05), 0 2px 6px rgba(0,0,0,0.04)";
        (e.currentTarget as HTMLDivElement).style.transform = "none";
      }}
    >
      <div style={{ padding: "12px 14px 14px" }}>
        {/* Author row */}
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
            background: `linear-gradient(135deg, ${p.accent}cc, ${p.accent}66)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: card.isTeacher ? 15 : 13, fontWeight: 900, color: "#fff",
          }}>
            {card.isTeacher ? "👩‍🏫" : card.authorName.charAt(0).toUpperCase()}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>
                {card.authorName}
              </span>
              {card.isTeacher && (
                <span style={{
                  fontSize: 9, background: p.accent, color: "#fff",
                  borderRadius: 6, padding: "1px 7px", fontWeight: 700,
                }}>선생님</span>
              )}
              {cardType !== "text" && (
                <span style={{
                  fontSize: 9, background: "#F3F4F6", color: "#6B7280",
                  borderRadius: 6, padding: "1px 7px",
                }}>
                  {cardType === "image" ? "🖼️ 사진" : cardType === "youtube" ? "📺 YouTube" : "✏️ 그림"}
                </span>
              )}
              {card.flagged && (
                <span style={{
                  fontSize: 9, background: "#FEF2F2", color: "#DC2626",
                  borderRadius: 6, padding: "1px 7px", border: "1px solid #FECACA",
                }}>⚠️ 검토</span>
              )}
            </div>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
              {LANGUAGES[card.authorLang]?.flag}
              <span>{LANGUAGES[card.authorLang]?.label}</span>
              <span style={{ color: "#E5E7EB" }}>·</span>
              <span>{timeAgo(card.timestamp)}</span>
            </div>
          </div>
        </div>

        {/* ── Image / Drawing ── */}
        {(cardType === "image" || cardType === "drawing") && card.imageUrl && !imgError && (
          <img
            src={card.imageUrl}
            alt={cardType}
            onError={() => setImgError(true)}
            style={{ width: "100%", borderRadius: 10, display: "block" }}
          />
        )}
        {(cardType === "image" || cardType === "drawing") && imgError && (
          <div style={{ padding: "24px", textAlign: "center", color: "#9CA3AF", fontSize: 12, background: "#F9FAFB", borderRadius: 10 }}>
            이미지를 불러올 수 없습니다
          </div>
        )}

        {/* ── YouTube ── */}
        {cardType === "youtube" && card.youtubeId && (
          <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: 10, overflow: "hidden" }}>
            <iframe
              src={`https://www.youtube.com/embed/${card.youtubeId}`}
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="YouTube video"
            />
          </div>
        )}

        {/* ── Text ── */}
        {cardType === "text" && (
          <>
            <div style={{
              fontSize: 14, fontWeight: 600, color: "#111827", lineHeight: 1.7,
              padding: "9px 11px",
              background: "rgba(255,255,255,0.75)",
              borderRadius: 9, border: "1px solid #F3F4F6",
              display: "flex", gap: 8, alignItems: "flex-start",
            }}>
              <span style={{ flex: 1 }}>{card.originalText}</span>
              <button
                onClick={() => speakText(card.originalText, card.authorLang)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#CBD5E1", flexShrink: 0, padding: "2px", transition: "color 0.15s" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = p.accent)}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#CBD5E1")}
              >🔊</button>
            </div>

            {card.loading && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#9CA3AF", marginTop: 8 }}>
                <span style={{ display: "inline-block", animation: "pulse 1.2s ease-in-out infinite" }}>● ● ●</span>
              </div>
            )}

            {!card.loading && card.translations?.[viewerLang] && viewerLang !== card.authorLang && (
              <div style={{ paddingTop: 2 }}>
                <TranslationRow lang={viewerLang} text={card.translations[viewerLang]} accent={colColor} />
              </div>
            )}

            {card.translateError && (
              <div style={{ fontSize: 11, color: "#EF4444", marginTop: 6 }}>⚠️ 번역 실패</div>
            )}

            {otherLangs.length > 0 && (
              <div>
                <button
                  onClick={() => setOpen((v) => !v)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 11, color: p.accent, fontWeight: 700,
                    padding: "6px 0 0", display: "flex", alignItems: "center", gap: 3,
                  }}
                >
                  {open ? "▲ 접기" : `▼ +${otherLangs.length}개 언어 더보기`}
                </button>
                {open && otherLangs.map((l) =>
                  card.translations[l] ? (
                    <TranslationRow key={l} lang={l} text={card.translations[l]} accent={p.accent} />
                  ) : null
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
