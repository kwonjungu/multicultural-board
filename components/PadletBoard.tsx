"use client";

import { useState, useEffect, useCallback } from "react";
import { ref, onValue, off } from "firebase/database";
import { getClientDb } from "@/lib/firebase-client";
import { COLUMNS_DEFAULT, LANGUAGES, CARD_PALETTES } from "@/lib/constants";
import { CardData, UserConfig } from "@/lib/types";
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

  // ── Firebase Realtime DB 구독 ──
  useEffect(() => {
    const db = getClientDb();
    const cardsRef = ref(db, "cards");

    onValue(cardsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) { setCards([]); return; }
      const list: CardData[] = Object.values(data);
      // 최신순 정렬
      list.sort((a, b) => b.timestamp - a.timestamp);
      setCards(list);
    });

    return () => off(cardsRef);
  }, []);

  // ── 게시 처리 ──
  const handlePost = useCallback(async (text: string, writeLang: string) => {
    if (!text.trim() || posting || !modal) return;
    setPosting(true);

    const targetLangs = user.isTeacher
      ? user.teacherLangs.filter((l) => l !== writeLang)
      : ["ko", "en"].filter((l) => l !== writeLang);

    // 낙관적 업데이트: 로컬에 임시 카드 추가
    const tempId = `temp_${Date.now()}`;
    const tempCard: CardData = {
      id: tempId,
      colId: modal.colId,
      authorLang: writeLang,
      authorName: user.myName,
      isTeacher: user.isTeacher,
      originalText: text,
      translations: { [writeLang]: text },
      paletteIdx: Math.floor(Math.random() * CARD_PALETTES.length),
      timestamp: Date.now(),
      loading: true,
      flagged: false,
    };
    setCards((prev) => [tempCard, ...prev]);
    setModal(null);

    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          fromLang: writeLang,
          targetLangs,
          colId: modal.colId,
          authorName: user.myName,
          isTeacher: user.isTeacher,
          paletteIdx: tempCard.paletteIdx,
        }),
      });

      if (!res.ok) throw new Error("API 오류");

      // 성공 시 Firebase에 저장됐으니 임시 카드만 제거
      // (onValue 구독이 실제 데이터 받아서 자동 갱신됨)
      setCards((prev) => prev.filter((c) => c.id !== tempId));
    } catch {
      // 실패 시 임시 카드에 오류 표시
      setCards((prev) =>
        prev.map((c) =>
          c.id === tempId ? { ...c, loading: false, translateError: true } : c
        )
      );
    }

    setPosting(false);
  }, [posting, modal, user]);

  return (
    <div style={{
      height: "100vh", display: "flex", flexDirection: "column",
      fontFamily: "'Noto Sans KR', sans-serif",
      background: "#E8EAF6", overflow: "hidden",
    }}>
      {/* ── 헤더 ── */}
      <header style={{
        height: 56, flexShrink: 0,
        background: "linear-gradient(90deg, #1a1a2e 0%, #16213e 100%)",
        borderBottom: "3px solid #6C63FF",
        display: "flex", alignItems: "center", gap: 14, padding: "0 20px",
      }}>
        <span style={{ fontSize: 22 }}>🌏</span>
        <span style={{ fontWeight: 900, fontSize: 15, color: "#fff" }}>
          다문화 교실 소통판
        </span>
        <span style={{ fontSize: 11, color: "#7986CB" }}>Multicultural Board</span>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {/* 내 정보 뱃지 */}
          <div style={{
            background: "#6C63FF22", border: "1px solid #6C63FF66",
            borderRadius: 20, padding: "4px 14px",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ fontSize: 14 }}>
              {user.isTeacher ? "👩‍🏫" : LANGUAGES[user.myLang]?.flag}
            </span>
            <span style={{ color: "#C5CAE9", fontWeight: 700, fontSize: 13 }}>
              {user.myName}
            </span>
            {user.isTeacher && (
              <span style={{
                fontSize: 10, background: "#6C63FF", color: "#fff",
                borderRadius: 10, padding: "1px 7px",
              }}>선생님</span>
            )}
          </div>

          {/* 활성 언어 */}
          {(user.isTeacher ? user.teacherLangs : [user.myLang]).map((l) => (
            <span key={l} style={{
              background: "rgba(255,255,255,0.07)", color: "#9FA8DA",
              borderRadius: 16, fontSize: 12, padding: "3px 10px",
            }}>
              {LANGUAGES[l]?.flag}
            </span>
          ))}

          <button
            onClick={onLogout}
            style={{
              background: "none", border: "1px solid rgba(255,255,255,0.15)",
              color: "#7986CB", borderRadius: 20, padding: "4px 12px",
              fontSize: 11, cursor: "pointer",
            }}
          >
            ⚙ 설정
          </button>
        </div>
      </header>

      {/* ── 컬럼 보드 ── */}
      <main style={{
        flex: 1, overflowX: "auto", overflowY: "hidden",
        display: "flex", gap: 14, padding: "14px 16px",
        alignItems: "flex-start",
      }}>
        {COLUMNS_DEFAULT.map((col) => {
          const colCards = cards.filter((c) => c.colId === col.id);
          return (
            <div
              key={col.id}
              style={{
                width: 292, flexShrink: 0, display: "flex", flexDirection: "column",
                height: "calc(100vh - 70px)",
                borderRadius: 16, overflow: "hidden",
                boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
              }}
            >
              {/* 컬럼 헤더 */}
              <div style={{
                background: col.color, padding: "14px 16px",
                display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
              }}>
                <span style={{ flex: 1, fontWeight: 800, fontSize: 13, color: "#fff", lineHeight: 1.35 }}>
                  {col.title}
                </span>
                <span style={{
                  background: "rgba(255,255,255,0.22)", color: "#fff",
                  borderRadius: 20, fontSize: 12, fontWeight: 800,
                  padding: "2px 10px", minWidth: 28, textAlign: "center",
                }}>
                  {colCards.length}
                </span>
              </div>

              {/* 카드 목록 */}
              <div style={{
                flex: 1, overflowY: "auto", background: "#ECEEF7",
                padding: "12px 10px 4px",
                scrollbarWidth: "thin", scrollbarColor: "#C5CAE9 transparent",
              }}>
                {colCards.length === 0 ? (
                  <div style={{
                    textAlign: "center", color: "#c0c4d6",
                    padding: "36px 16px", fontSize: 13, lineHeight: 2,
                  }}>
                    <div style={{ fontSize: 30, marginBottom: 8 }}>✏️</div>
                    아직 게시물이 없어요<br />아래 버튼으로 추가해보세요!
                  </div>
                ) : (
                  colCards.map((card) => (
                    <PadletCard
                      key={card.id}
                      card={card}
                      viewerLang={viewerLang}
                      colColor={col.color}
                    />
                  ))
                )}
              </div>

              {/* 하단 추가 버튼 */}
              <button
                onClick={() => setModal({ colId: col.id })}
                style={{
                  flexShrink: 0, display: "flex", alignItems: "center",
                  justifyContent: "center", gap: 6,
                  background: "#fff", border: "none",
                  borderTop: `3px solid ${col.color}22`,
                  padding: "13px 0", cursor: "pointer",
                  color: col.color, fontWeight: 800, fontSize: 13,
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = col.color + "12")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#fff")}
              >
                <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> 여기에 추가
              </button>
            </div>
          );
        })}

        {/* 컬럼 추가 (교사 전용) */}
        {user.isTeacher && (
          <div style={{
            width: 240, flexShrink: 0, height: 110,
            border: "2.5px dashed #9FA8DA", borderRadius: 14,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#9FA8DA", fontSize: 14, fontWeight: 700, cursor: "pointer",
            transition: "all 0.2s",
          }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLDivElement;
              el.style.background = "rgba(108,99,255,0.06)";
              el.style.borderColor = "#6C63FF";
              el.style.color = "#6C63FF";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLDivElement;
              el.style.background = "transparent";
              el.style.borderColor = "#9FA8DA";
              el.style.color = "#9FA8DA";
            }}
          >
            + 컬럼 추가
          </div>
        )}
      </main>

      {/* ── 입력 모달 ── */}
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
