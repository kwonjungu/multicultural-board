"use client";

import { useState, useEffect, useCallback } from "react";
import { ref, onValue, off } from "firebase/database";
import { getClientDb } from "@/lib/firebase-client";
import { COLUMNS_DEFAULT, LANGUAGES, CARD_PALETTES } from "@/lib/constants";
import { CardData, UserConfig, PostData } from "@/lib/types";
import PadletCard from "./PadletCard";
import PostModal from "./PostModal";

interface Props {
  user: UserConfig;
  onLogout: () => void;
}

export default function PadletBoard({ user, onLogout }: Props) {
  const [cards, setCards] = useState<CardData[]>([]);
  const [modal, setModal] = useState<{ colId: string } | null>(null);
  const [posting, setPosting] = useState(false);
  const viewerLang = user.isTeacher ? user.teacherLangs[0] : user.myLang;

  useEffect(() => {
    const db = getClientDb();
    const cardsRef = ref(db, "cards");
    onValue(cardsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) { setCards([]); return; }
      const list: CardData[] = Object.values(data);
      list.sort((a, b) => b.timestamp - a.timestamp);
      setCards(list);
    });
    return () => off(cardsRef);
  }, []);

  const handlePost = useCallback(async (data: PostData) => {
    if (posting || !modal) return;
    const { cardType, text, writeLang, imageUrl, youtubeId } = data;
    if (cardType === "text" && !text.trim()) return;

    setPosting(true);

    const targetLangs =
      cardType === "text"
        ? user.isTeacher
          ? user.teacherLangs.filter((l) => l !== writeLang)
          : ["ko", "en"].filter((l) => l !== writeLang)
        : [];

    const tempId = `temp_${Date.now()}`;
    const tempCard: CardData = {
      id: tempId,
      colId: modal.colId,
      cardType,
      authorLang: writeLang,
      authorName: user.myName,
      isTeacher: user.isTeacher,
      originalText: text,
      translations: { [writeLang]: text },
      paletteIdx: Math.floor(Math.random() * CARD_PALETTES.length),
      timestamp: Date.now(),
      loading: cardType === "text",
      flagged: false,
      imageUrl,
      youtubeId,
    };
    setCards((prev) => [tempCard, ...prev]);
    setModal(null);

    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text, fromLang: writeLang, targetLangs,
          colId: modal.colId, authorName: user.myName,
          isTeacher: user.isTeacher, paletteIdx: tempCard.paletteIdx,
          cardType, imageUrl, youtubeId,
        }),
      });
      if (!res.ok) throw new Error("API 오류");
      setCards((prev) => prev.filter((c) => c.id !== tempId));
    } catch {
      setCards((prev) =>
        prev.map((c) => c.id === tempId ? { ...c, loading: false, translateError: true } : c)
      );
    }
    setPosting(false);
  }, [posting, modal, user]);

  return (
    <div style={{
      height: "100vh", display: "flex", flexDirection: "column",
      fontFamily: "'Noto Sans KR', sans-serif",
      background: "#F0F2FA", overflow: "hidden",
    }}>
      {/* ── Header ── */}
      <header style={{
        height: 58, flexShrink: 0,
        background: "#0F0C28",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        display: "flex", alignItems: "center", padding: "0 20px", gap: 0,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: "linear-gradient(135deg, #5B57F5, #8B5CF6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 17, boxShadow: "0 4px 12px rgba(91,87,245,0.4)",
            flexShrink: 0,
          }}>🌏</div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 14, color: "#F9FAFB", letterSpacing: -0.3 }}>
              다문화 교실 소통판
            </div>
            <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 400, marginTop: -1 }}>
              Multicultural Board
            </div>
          </div>
        </div>

        {/* Right side */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {/* Language flags */}
          <div style={{ display: "flex", gap: 4 }}>
            {(user.isTeacher ? user.teacherLangs : [user.myLang]).map((l) => (
              <span key={l} style={{
                background: "rgba(255,255,255,0.06)", color: "#9CA3AF",
                borderRadius: 8, fontSize: 13, padding: "4px 8px",
                border: "1px solid rgba(255,255,255,0.08)",
              }}>
                {LANGUAGES[l]?.flag}
              </span>
            ))}
          </div>

          {/* User badge */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(91,87,245,0.15)",
            border: "1px solid rgba(91,87,245,0.3)",
            borderRadius: 20, padding: "5px 14px 5px 5px",
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: "50%",
              background: "linear-gradient(135deg, #5B57F5, #8B5CF6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: user.isTeacher ? 13 : 11, fontWeight: 800, color: "#fff",
            }}>
              {user.isTeacher ? "👩‍🏫" : user.myName.charAt(0).toUpperCase()}
            </div>
            <span style={{ color: "#E5E7EB", fontWeight: 700, fontSize: 13 }}>
              {user.myName}
            </span>
            {user.isTeacher && (
              <span style={{
                fontSize: 9, background: "#5B57F5", color: "#fff",
                borderRadius: 8, padding: "1px 7px", fontWeight: 700,
              }}>선생님</span>
            )}
          </div>

          <button
            onClick={onLogout}
            style={{
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              color: "#6B7280", borderRadius: 10, padding: "6px 12px",
              fontSize: 12, cursor: "pointer", fontWeight: 600, transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.1)";
              (e.currentTarget as HTMLButtonElement).style.color = "#9CA3AF";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)";
              (e.currentTarget as HTMLButtonElement).style.color = "#6B7280";
            }}
          >
            ⚙ 설정
          </button>
        </div>
      </header>

      {/* ── Board ── */}
      <main style={{
        flex: 1, overflowX: "auto", overflowY: "hidden",
        display: "flex", gap: 14, padding: "16px 18px",
        alignItems: "flex-start",
      }}>
        {COLUMNS_DEFAULT.map((col) => {
          const colCards = cards.filter((c) => c.colId === col.id);
          return (
            <div
              key={col.id}
              style={{
                width: 296, flexShrink: 0, display: "flex", flexDirection: "column",
                height: "calc(100vh - 74px)", borderRadius: 16, overflow: "hidden",
                boxShadow: "0 2px 12px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05)",
                background: "#fff", border: "1px solid #E9ECF5",
              }}
            >
              {/* Column header */}
              <div style={{
                padding: "14px 16px 12px",
                borderBottom: "1px solid #F3F4F8",
                display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
                background: "#fff",
              }}>
                <div style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: col.color, flexShrink: 0,
                  boxShadow: `0 0 0 3px ${col.color}22`,
                }} />
                <span style={{
                  flex: 1, fontWeight: 800, fontSize: 13, color: "#111827",
                  letterSpacing: -0.2, lineHeight: 1.35,
                }}>
                  {col.title}
                </span>
                <span style={{
                  background: col.color + "18", color: col.color,
                  borderRadius: 20, fontSize: 11, fontWeight: 800,
                  padding: "2px 10px", minWidth: 28, textAlign: "center",
                }}>
                  {colCards.length}
                </span>
              </div>

              {/* Cards */}
              <div style={{
                flex: 1, overflowY: "auto", padding: "12px 10px 4px",
                background: "#F8F9FC",
                scrollbarWidth: "thin", scrollbarColor: "#D1D5E0 transparent",
              }}>
                {colCards.length === 0 ? (
                  <div style={{
                    textAlign: "center", padding: "40px 16px",
                    color: "#CBD5E1", fontSize: 12, lineHeight: 2,
                    animation: "fadeSlideIn 0.3s ease",
                  }}>
                    <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.5 }}>✏️</div>
                    <div style={{ fontWeight: 600, color: "#9CA3AF" }}>아직 게시물이 없어요</div>
                    <div style={{ fontSize: 11 }}>아래 버튼으로 추가해보세요</div>
                  </div>
                ) : (
                  colCards.map((card) => (
                    <PadletCard key={card.id} card={card} viewerLang={viewerLang} colColor={col.color} />
                  ))
                )}
              </div>

              {/* Add button */}
              <button
                onClick={() => setModal({ colId: col.id })}
                style={{
                  flexShrink: 0, display: "flex", alignItems: "center",
                  justifyContent: "center", gap: 6,
                  background: "#fff", border: "none",
                  borderTop: "1px solid #F3F4F8",
                  padding: "13px 0", cursor: "pointer",
                  color: col.color, fontWeight: 800, fontSize: 13,
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = col.color + "0D")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#fff")}
              >
                <span style={{ fontSize: 17, lineHeight: 1, fontWeight: 400 }}>+</span>
                여기에 추가
              </button>
            </div>
          );
        })}

        {/* Add column (teacher only) */}
        {user.isTeacher && (
          <div style={{
            width: 240, flexShrink: 0, height: 112,
            border: "2px dashed #D1D5E0", borderRadius: 14,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#9CA3AF", fontSize: 13, fontWeight: 700, cursor: "pointer",
            transition: "all 0.2s", background: "transparent",
          }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLDivElement;
              el.style.background = "rgba(91,87,245,0.04)";
              el.style.borderColor = "#5B57F5";
              el.style.color = "#5B57F5";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLDivElement;
              el.style.background = "transparent";
              el.style.borderColor = "#D1D5E0";
              el.style.color = "#9CA3AF";
            }}
          >
            + 컬럼 추가
          </div>
        )}
      </main>

      {modal && (
        <PostModal
          colId={modal.colId}
          user={user}
          posting={posting}
          onPost={handlePost}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
