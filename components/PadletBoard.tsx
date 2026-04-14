"use client";

import { useState, useEffect, useCallback } from "react";
import { ref, onValue, off, set, remove } from "firebase/database";
import { getClientDb } from "@/lib/firebase-client";
import { COLUMNS_DEFAULT, LANGUAGES, CARD_PALETTES } from "@/lib/constants";
import { CardData, UserConfig, PostData } from "@/lib/types";
import { t } from "@/lib/i18n";
import PadletCard from "./PadletCard";
import PostModal from "./PostModal";

interface FirebaseColumn {
  id: string;
  title: string;
  color: string;
  order: number;
}

interface Props {
  user: UserConfig;
  roomCode: string;
  onLogout: () => void;
}

const COL_COLORS = [
  "#6C63FF", "#FF6584", "#43C59E", "#F59E0B", "#3B82F6",
  "#8B5CF6", "#EC4899", "#14B8A6", "#F97316", "#10B981",
];

export default function PadletBoard({ user, roomCode, onLogout }: Props) {
  const [cards, setCards] = useState<CardData[]>([]);
  const [columns, setColumns] = useState<FirebaseColumn[]>([]);
  const [modal, setModal] = useState<{ colId: string } | null>(null);
  const [posting, setPosting] = useState(false);
  const lang = user.myLang;

  // Teacher state
  const [isTeacher, setIsTeacher] = useState(false);
  const [teacherLangs] = useState(["ko", "en", "vi", "zh", "fil"]);
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState(false);

  // Management modal state
  const [showManage, setShowManage] = useState(false);
  const [editTitle, setEditTitle] = useState<Record<string, string>>({});
  const [newColTitle, setNewColTitle] = useState("");
  const [newColColor, setNewColColor] = useState(COL_COLORS[0]);

  // ── Firebase: rooms/${roomCode}/columns ──
  useEffect(() => {
    const db = getClientDb();
    const colsRef = ref(db, `rooms/${roomCode}/columns`);
    onValue(colsRef, (snap) => {
      const data = snap.val();
      if (!data) {
        const defaults: Record<string, Omit<FirebaseColumn, "id">> = {};
        COLUMNS_DEFAULT.forEach((col, i) => {
          defaults[col.id] = { title: col.title, color: col.color, order: i };
        });
        set(colsRef, defaults);
      } else {
        const list: FirebaseColumn[] = Object.entries(data).map(([id, val]) => ({
          id,
          ...(val as Omit<FirebaseColumn, "id">),
        }));
        list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setColumns(list);
        const initEdit: Record<string, string> = {};
        list.forEach((c) => { initEdit[c.id] = c.title; });
        setEditTitle(initEdit);
      }
    });
    return () => off(colsRef);
  }, [roomCode]);

  // ── Firebase: rooms/${roomCode}/cards ──
  useEffect(() => {
    const db = getClientDb();
    const cardsRef = ref(db, `rooms/${roomCode}/cards`);
    onValue(cardsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) { setCards([]); return; }
      const list: CardData[] = Object.values(data);
      list.sort((a, b) => b.timestamp - a.timestamp);
      setCards(list);
    });
    return () => off(cardsRef);
  }, [roomCode]);

  function handleTeacherAuth() {
    if (pwInput === roomCode) {
      setIsTeacher(true);
      setShowTeacherModal(false);
      setPwInput("");
      setPwError(false);
    } else {
      setPwError(true);
    }
  }

  // ── Column management ──
  function saveColTitle(colId: string) {
    const title = editTitle[colId]?.trim();
    if (!title) return;
    const db = getClientDb();
    set(ref(db, `rooms/${roomCode}/columns/${colId}/title`), title);
  }

  function changeColColor(colId: string, color: string) {
    const db = getClientDb();
    set(ref(db, `rooms/${roomCode}/columns/${colId}/color`), color);
  }

  function deleteCol(colId: string) {
    if (!confirm("이 컬럼을 삭제할까요?\n컬럼 안의 카드들은 숨겨집니다.")) return;
    const db = getClientDb();
    remove(ref(db, `rooms/${roomCode}/columns/${colId}`));
  }

  function moveCol(colId: string, direction: "up" | "down") {
    const idx = columns.findIndex((c) => c.id === colId);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= columns.length) return;
    const db = getClientDb();
    const myOrder = columns[idx].order;
    const theirOrder = columns[swapIdx].order;
    set(ref(db, `rooms/${roomCode}/columns/${colId}/order`), theirOrder);
    set(ref(db, `rooms/${roomCode}/columns/${columns[swapIdx].id}/order`), myOrder);
  }

  function addColumn() {
    if (!newColTitle.trim()) return;
    const db = getClientDb();
    const newId = `col_${Date.now()}`;
    const maxOrder = columns.length > 0 ? Math.max(...columns.map((c) => c.order)) : -1;
    set(ref(db, `rooms/${roomCode}/columns/${newId}`), {
      title: newColTitle.trim(),
      color: newColColor,
      order: maxOrder + 1,
    });
    setNewColTitle("");
    setNewColColor(COL_COLORS[0]);
  }

  const handlePost = useCallback(async (data: PostData) => {
    if (posting || !modal) return;
    const { cardType, text, writeLang, imageUrl, youtubeId } = data;
    if (cardType === "text" && !text.trim()) return;

    setPosting(true);

    const targetLangs =
      cardType === "text"
        ? isTeacher
          ? teacherLangs.filter((l) => l !== writeLang)
          : ["ko", "en"].filter((l) => l !== writeLang)
        : [];

    const tempId = `temp_${Date.now()}`;
    const tempCard: CardData = {
      id: tempId,
      colId: modal.colId,
      cardType,
      authorLang: writeLang,
      authorName: user.myName,
      isTeacher,
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
          isTeacher, paletteIdx: tempCard.paletteIdx,
          roomCode, cardType, imageUrl, youtubeId,
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
  }, [posting, modal, user, isTeacher, teacherLangs, roomCode]);

  return (
    <div style={{
      height: "100vh", display: "flex", flexDirection: "column",
      fontFamily: "'Noto Sans KR', sans-serif",
      background: "#F0F2FA", overflow: "hidden",
    }}>
      {/* ── Header ── */}
      <header style={{
        height: 58, flexShrink: 0, background: "#0F0C28",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        display: "flex", alignItems: "center", padding: "0 20px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: "linear-gradient(135deg, #5B57F5, #8B5CF6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 17, boxShadow: "0 4px 12px rgba(91,87,245,0.4)", flexShrink: 0,
          }}>🌏</div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 14, color: "#F9FAFB", letterSpacing: -0.3 }}>
              다문화 교실 소통판
            </div>
            <div style={{ fontSize: 10, color: "#6B7280", marginTop: -1 }}>
              Room <span style={{ color: "#7C7AFF", fontWeight: 700 }}>{roomCode}</span>
            </div>
          </div>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {/* User badge */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(91,87,245,0.15)", border: "1px solid rgba(91,87,245,0.3)",
            borderRadius: 20, padding: "5px 14px 5px 5px",
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: "50%",
              background: "linear-gradient(135deg, #5B57F5, #8B5CF6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: isTeacher ? 13 : 11, fontWeight: 800, color: "#fff",
            }}>
              {isTeacher ? "👩‍🏫" : user.myName.charAt(0).toUpperCase()}
            </div>
            <span style={{ color: "#E5E7EB", fontWeight: 700, fontSize: 13 }}>{user.myName}</span>
            {isTeacher && (
              <span style={{ fontSize: 9, background: "#5B57F5", color: "#fff", borderRadius: 8, padding: "1px 7px", fontWeight: 700 }}>
                {t("teacherTag", lang)}
              </span>
            )}
          </div>

          {/* Teacher mode button */}
          {!isTeacher && (
            <button
              onClick={() => { setShowTeacherModal(true); setPwInput(""); setPwError(false); }}
              style={{
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                color: "#9CA3AF", borderRadius: 10, padding: "6px 12px",
                fontSize: 12, cursor: "pointer", fontWeight: 600, transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#E5E7EB"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#9CA3AF"; }}
            >
              {t("teacherBtn", lang)}
            </button>
          )}

          {/* Manage button (teacher only) */}
          {isTeacher && (
            <button
              onClick={() => setShowManage(true)}
              style={{
                background: "rgba(91,87,245,0.2)", border: "1px solid rgba(91,87,245,0.4)",
                color: "#A5B4FC", borderRadius: 10, padding: "6px 14px",
                fontSize: 12, cursor: "pointer", fontWeight: 700, transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(91,87,245,0.35)";
                (e.currentTarget as HTMLButtonElement).style.color = "#fff";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(91,87,245,0.2)";
                (e.currentTarget as HTMLButtonElement).style.color = "#A5B4FC";
              }}
            >
              {t("manage", lang)}
            </button>
          )}

          <button
            onClick={onLogout}
            style={{
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              color: "#6B7280", borderRadius: 10, padding: "6px 12px",
              fontSize: 12, cursor: "pointer", fontWeight: 600, transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#9CA3AF"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#6B7280"; }}
          >
            {t("settings", lang)}
          </button>
        </div>
      </header>

      {/* ── Board ── */}
      <main style={{
        flex: 1, overflowX: "auto", overflowY: "hidden",
        display: "flex", gap: 14, padding: "16px 18px",
        alignItems: "flex-start",
      }}>
        {columns.map((col) => {
          const colCards = cards.filter((c) => c.colId === col.id);
          return (
            <div key={col.id} style={{
              width: 296, flexShrink: 0, display: "flex", flexDirection: "column",
              height: "calc(100vh - 74px)", borderRadius: 16, overflow: "hidden",
              boxShadow: "0 2px 12px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05)",
              background: "#fff", border: "1px solid #E9ECF5",
            }}>
              <div style={{
                padding: "14px 16px 12px", borderBottom: "1px solid #F3F4F8",
                display: "flex", alignItems: "center", gap: 10, flexShrink: 0, background: "#fff",
              }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: col.color, flexShrink: 0, boxShadow: `0 0 0 3px ${col.color}22` }} />
                <span style={{ flex: 1, fontWeight: 800, fontSize: 13, color: "#111827", letterSpacing: -0.2, lineHeight: 1.35 }}>{col.title}</span>
                <span style={{ background: col.color + "18", color: col.color, borderRadius: 20, fontSize: 11, fontWeight: 800, padding: "2px 10px", minWidth: 28, textAlign: "center" }}>
                  {colCards.length}
                </span>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "12px 10px 4px", background: "#F8F9FC", scrollbarWidth: "thin", scrollbarColor: "#D1D5E0 transparent" }}>
                {colCards.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 16px", color: "#CBD5E1" }}>
                    <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.5 }}>✏️</div>
                    <div style={{ fontWeight: 600, color: "#9CA3AF", fontSize: 12 }}>{t("noPosts", lang)}</div>
                    <div style={{ fontSize: 11, marginTop: 4 }}>{t("addBelowHint", lang)}</div>
                  </div>
                ) : (
                  colCards.map((card) => (
                    <PadletCard key={card.id} card={card} viewerLang={lang} colColor={col.color} />
                  ))
                )}
              </div>

              <button
                onClick={() => setModal({ colId: col.id })}
                style={{
                  flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  background: "#fff", border: "none", borderTop: "1px solid #F3F4F8",
                  padding: "13px 0", cursor: "pointer", color: col.color, fontWeight: 800, fontSize: 13,
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = col.color + "0D")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#fff")}
              >
                <span style={{ fontSize: 17, lineHeight: 1, fontWeight: 400 }}>+</span> {t("addHere", lang)}
              </button>
            </div>
          );
        })}
      </main>

      {/* ── Teacher auth modal ── */}
      {showTeacherModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(9,7,30,0.75)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 300, backdropFilter: "blur(6px)",
        }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowTeacherModal(false); }}
        >
          <div style={{
            background: "#fff", borderRadius: 22, padding: "32px 28px",
            maxWidth: 340, width: "100%", boxShadow: "0 24px 60px rgba(0,0,0,0.3)",
            animation: "fadeSlideIn 0.2s ease", textAlign: "center",
          }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>👩‍🏫</div>
            <h3 style={{ margin: "0 0 6px", fontWeight: 900, fontSize: 18, color: "#111827" }}>선생님 모드</h3>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "#6B7280" }}>이 방의 비밀번호를 입력하세요</p>
            <input
              type="password"
              value={pwInput}
              onChange={(e) => { setPwInput(e.target.value); setPwError(false); }}
              onKeyDown={(e) => e.key === "Enter" && handleTeacherAuth()}
              placeholder="비밀번호 (숫자 4자리)"
              maxLength={4}
              autoFocus
              style={{
                width: "100%", padding: "13px 16px", borderRadius: 12, marginBottom: 8,
                border: `2px solid ${pwError ? "#EF4444" : "#E5E7EB"}`,
                fontSize: 20, textAlign: "center", letterSpacing: 8,
                outline: "none", transition: "border-color 0.15s", fontWeight: 700,
                boxSizing: "border-box",
              }}
            />
            {pwError && (
              <p style={{ margin: "0 0 12px", fontSize: 12, color: "#EF4444" }}>
                비밀번호가 틀렸습니다
              </p>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={() => setShowTeacherModal(false)} style={{ flex: 1, padding: "11px 0", borderRadius: 12, fontSize: 14, background: "#F3F4F6", color: "#6B7280", fontWeight: 700, border: "none", cursor: "pointer" }}>취소</button>
              <button onClick={handleTeacherAuth} style={{ flex: 1, padding: "11px 0", borderRadius: 12, fontSize: 14, background: "linear-gradient(135deg, #5B57F5, #8B5CF6)", color: "#fff", fontWeight: 800, border: "none", cursor: "pointer", boxShadow: "0 4px 16px rgba(91,87,245,0.4)" }}>확인</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Management modal ── */}
      {showManage && isTeacher && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(9,7,30,0.8)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 400, backdropFilter: "blur(8px)", padding: 20,
        }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowManage(false); }}
        >
          <div style={{
            background: "#fff", borderRadius: 24, width: "100%", maxWidth: 520,
            maxHeight: "88vh", overflowY: "auto",
            boxShadow: "0 32px 80px rgba(0,0,0,0.4)",
            animation: "fadeSlideIn 0.25s ease",
          }}>
            {/* Modal header */}
            <div style={{
              display: "flex", alignItems: "center", padding: "20px 24px 16px",
              borderBottom: "1px solid #F3F4F8", position: "sticky", top: 0, background: "#fff", zIndex: 1,
            }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 16, color: "#111827" }}>🛠 관리 패널</div>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>Room {roomCode}</div>
              </div>
              <button
                onClick={() => setShowManage(false)}
                style={{
                  marginLeft: "auto", background: "#F3F4F6", border: "none", borderRadius: "50%",
                  width: 32, height: 32, fontSize: 14, cursor: "pointer", color: "#6B7280",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >✕</button>
            </div>

            <div style={{ padding: "20px 24px 28px" }}>
              {/* Section: Column management */}
              <div style={{ fontSize: 11, fontWeight: 800, color: "#9CA3AF", letterSpacing: 1, marginBottom: 12 }}>
                컬럼 관리
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                {columns.map((col, idx) => (
                  <div key={col.id} style={{
                    background: "#F8F9FC", borderRadius: 14, padding: "12px 14px",
                    border: "1px solid #E9ECF5",
                  }}>
                    {/* Row 1: order controls + title */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      {/* Move buttons */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                        <button
                          onClick={() => moveCol(col.id, "up")}
                          disabled={idx === 0}
                          style={{
                            width: 22, height: 22, borderRadius: 6, border: "1px solid #E5E7EB",
                            background: idx === 0 ? "#F9FAFB" : "#fff", cursor: idx === 0 ? "default" : "pointer",
                            fontSize: 10, color: idx === 0 ? "#D1D5DB" : "#6B7280",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}
                        >▲</button>
                        <button
                          onClick={() => moveCol(col.id, "down")}
                          disabled={idx === columns.length - 1}
                          style={{
                            width: 22, height: 22, borderRadius: 6, border: "1px solid #E5E7EB",
                            background: idx === columns.length - 1 ? "#F9FAFB" : "#fff",
                            cursor: idx === columns.length - 1 ? "default" : "pointer",
                            fontSize: 10, color: idx === columns.length - 1 ? "#D1D5DB" : "#6B7280",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}
                        >▼</button>
                      </div>

                      {/* Color dot */}
                      <div style={{
                        width: 12, height: 12, borderRadius: "50%", background: col.color,
                        flexShrink: 0, boxShadow: `0 0 0 3px ${col.color}33`,
                      }} />

                      {/* Title input */}
                      <input
                        value={editTitle[col.id] ?? col.title}
                        onChange={(e) => setEditTitle((prev) => ({ ...prev, [col.id]: e.target.value }))}
                        onBlur={() => saveColTitle(col.id)}
                        onKeyDown={(e) => e.key === "Enter" && saveColTitle(col.id)}
                        style={{
                          flex: 1, padding: "7px 10px", borderRadius: 9,
                          border: "1.5px solid #E5E7EB", fontSize: 13, fontWeight: 700,
                          color: "#111827", background: "#fff", outline: "none",
                        }}
                        onFocus={(e) => (e.target.style.borderColor = col.color)}
                        onBlurCapture={(e) => (e.target.style.borderColor = "#E5E7EB")}
                      />

                      {/* Delete */}
                      <button
                        onClick={() => deleteCol(col.id)}
                        style={{
                          width: 30, height: 30, borderRadius: 8, border: "none",
                          background: "#FEF2F2", color: "#EF4444", cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
                          flexShrink: 0,
                        }}
                        title="컬럼 삭제"
                      >🗑</button>
                    </div>

                    {/* Row 2: color swatches */}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingLeft: 30 }}>
                      {COL_COLORS.map((color) => (
                        <button
                          key={color}
                          onClick={() => changeColColor(col.id, color)}
                          style={{
                            width: 22, height: 22, borderRadius: "50%", background: color, border: "none",
                            cursor: "pointer", transition: "transform 0.12s",
                            outline: col.color === color ? `3px solid ${color}` : "none",
                            outlineOffset: 2,
                            transform: col.color === color ? "scale(1.2)" : "scale(1)",
                          }}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Add column */}
              <div style={{
                borderTop: "1px dashed #E5E7EB", paddingTop: 18,
              }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#9CA3AF", letterSpacing: 1, marginBottom: 10 }}>
                  새 컬럼 추가
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <input
                    value={newColTitle}
                    onChange={(e) => setNewColTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addColumn()}
                    placeholder="컬럼 이름 입력..."
                    style={{
                      flex: 1, padding: "10px 14px", borderRadius: 11,
                      border: "1.5px solid #E5E7EB", fontSize: 14, color: "#111827",
                      background: "#F9FAFB", outline: "none",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "#5B57F5";
                      e.target.style.background = "#fff";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "#E5E7EB";
                      e.target.style.background = "#F9FAFB";
                    }}
                  />
                  <button
                    onClick={addColumn}
                    disabled={!newColTitle.trim()}
                    style={{
                      padding: "10px 18px", borderRadius: 11, border: "none",
                      background: newColTitle.trim() ? "linear-gradient(135deg, #5B57F5, #8B5CF6)" : "#F3F4F6",
                      color: newColTitle.trim() ? "#fff" : "#D1D5DB",
                      fontWeight: 800, fontSize: 13, cursor: newColTitle.trim() ? "pointer" : "not-allowed",
                      boxShadow: newColTitle.trim() ? "0 4px 14px rgba(91,87,245,0.35)" : "none",
                      whiteSpace: "nowrap",
                    }}
                  >+ 추가</button>
                </div>

                {/* New col color picker */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {COL_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewColColor(color)}
                      style={{
                        width: 26, height: 26, borderRadius: "50%", background: color, border: "none",
                        cursor: "pointer", transition: "transform 0.12s",
                        outline: newColColor === color ? `3px solid ${color}` : "none",
                        outlineOffset: 2,
                        transform: newColColor === color ? "scale(1.2)" : "scale(1)",
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <PostModal
          colId={modal.colId}
          user={{ ...user, isTeacher, teacherLangs: isTeacher ? teacherLangs : [] }}
          posting={posting}
          onPost={handlePost}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
