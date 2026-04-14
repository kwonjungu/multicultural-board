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

function LangBadge({ lang, text, accent }: { lang: string; text: string; accent: string }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "flex-start", marginTop: 7 }}>
      <span style={{
        flexShrink: 0, fontSize: 11, fontWeight: 700,
        background: accent + "22", color: accent,
        borderRadius: 12, padding: "2px 8px", lineHeight: "18px", whiteSpace: "nowrap",
      }}>
        {LANGUAGES[lang]?.flag} {LANGUAGES[lang]?.label}
      </span>
      <span style={{ fontSize: 13, color: "#555", lineHeight: 1.55, flex: 1 }}>{text}</span>
      <button
        onClick={() => speakText(text, lang)}
        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, opacity: 0.4, flexShrink: 0, padding: 0 }}
        title="읽어주기"
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
        background: p.bg, borderRadius: 14, overflow: "hidden",
        boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
        marginBottom: 10, position: "relative",
        transition: "box-shadow 0.18s, transform 0.18s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 22px rgba(0,0,0,0.13)";
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 10px rgba(0,0,0,0.08)";
        (e.currentTarget as HTMLDivElement).style.transform = "none";
      }}
    >
      {/* 컬러 탑바 */}
      <div style={{ height: 5, background: p.top }} />

      <div style={{ padding: "12px 13px 14px" }}>
        {/* 작성자 헤더 */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
            background: p.dot, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
          }}>
            {card.isTeacher ? "👩‍🏫" : LANGUAGES[card.authorLang]?.flag}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#1a1a1a", display: "flex", alignItems: "center", gap: 5 }}>
              {card.authorName}
              {card.isTeacher && (
                <span style={{ fontSize: 9, background: p.dot, color: "#fff", borderRadius: 8, padding: "1px 6px" }}>선생님</span>
              )}
              {cardType !== "text" && (
                <span style={{ fontSize: 9, background: "#f0f0f0", color: "#888", borderRadius: 8, padding: "1px 6px" }}>
                  {cardType === "image" ? "🖼️" : cardType === "youtube" ? "📺" : "✏️"}
                </span>
              )}
            </div>
            <div style={{ fontSize: 10, color: "#bbb" }}>
              {LANGUAGES[card.authorLang]?.flag} {LANGUAGES[card.authorLang]?.label} · {timeAgo(card.timestamp)}
            </div>
          </div>
          {card.flagged && (
            <span style={{ fontSize: 10, background: "#FFEBEE", color: "#C62828", borderRadius: 8, padding: "2px 6px", border: "1px solid #FFCDD2" }}>
              ⚠️ 검토
            </span>
          )}
        </div>

        {/* ── 사진 / 그림 카드 ── */}
        {(cardType === "image" || cardType === "drawing") && card.imageUrl && !imgError && (
          <img
            src={card.imageUrl}
            alt={cardType === "drawing" ? "그림" : "사진"}
            onError={() => setImgError(true)}
            style={{ width: "100%", borderRadius: 10, marginBottom: 4, display: "block" }}
          />
        )}
        {(cardType === "image" || cardType === "drawing") && imgError && (
          <div style={{ padding: "20px 0", textAlign: "center", color: "#ccc", fontSize: 12 }}>이미지를 불러올 수 없습니다</div>
        )}

        {/* ── YouTube 카드 ── */}
        {cardType === "youtube" && card.youtubeId && (
          <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: 10, overflow: "hidden", marginBottom: 4 }}>
            <iframe
              src={`https://www.youtube.com/embed/${card.youtubeId}`}
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="YouTube video"
            />
          </div>
        )}

        {/* ── 텍스트 카드 ── */}
        {cardType === "text" && (
          <>
            {/* 원문 */}
            <div style={{
              fontSize: 14, fontWeight: 600, color: "#1a1a1a", lineHeight: 1.65,
              background: "rgba(255,255,255,0.6)", borderRadius: 10,
              padding: "8px 10px", display: "flex", gap: 6, alignItems: "flex-start",
            }}>
              <span style={{ flex: 1 }}>{card.originalText}</span>
              <button
                onClick={() => speakText(card.originalText, card.authorLang)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, opacity: 0.4, flexShrink: 0, padding: 0 }}
              >🔊</button>
            </div>

            {/* 로딩 */}
            {card.loading && (
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#bbb", marginTop: 8 }}>
                <span style={{ display: "inline-block", animation: "spin 0.9s linear infinite", fontSize: 13 }}>⟳</span>
                번역 중...
              </div>
            )}

            {/* 내 언어 번역 우선 노출 */}
            {!card.loading && card.translations?.[viewerLang] && viewerLang !== card.authorLang && (
              <LangBadge lang={viewerLang} text={card.translations[viewerLang]} accent={colColor} />
            )}

            {/* 번역 오류 */}
            {card.translateError && (
              <div style={{ fontSize: 11, color: "#E65100", marginTop: 6 }}>⚠️ 번역 실패</div>
            )}

            {/* 다른 언어 펼치기 */}
            {otherLangs.length > 0 && (
              <>
                <button
                  onClick={() => setOpen((v) => !v)}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: p.dot, fontWeight: 700, marginTop: 7, padding: 0 }}
                >
                  {open ? "▲ 접기" : `▼ +${otherLangs.length}개 언어`}
                </button>
                {open && otherLangs.map((l) =>
                  card.translations[l] ? (
                    <LangBadge key={l} lang={l} text={card.translations[l]} accent={p.dot} />
                  ) : null
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
