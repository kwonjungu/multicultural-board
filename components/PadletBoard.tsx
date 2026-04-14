"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ref, onValue, off, set, remove, update } from "firebase/database";
import { getClientDb } from "@/lib/firebase-client";
import { COLUMNS_DEFAULT, LANGUAGES, CARD_PALETTES } from "@/lib/constants";
import { CardData, UserConfig, PostData, RoomConfig, CardStatus } from "@/lib/types";
import { t } from "@/lib/i18n";
import PadletCard from "./PadletCard";
import PostModal from "./PostModal";
import { QRCodeSVG } from "qrcode.react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface FirebaseColumn {
  id: string;
  title: string;
  color: string;
  order: number;
}

interface Props {
  user: UserConfig;
  roomCode: string;
  roomLangs: string[];
  onLogout: () => void;
  roomConfig: RoomConfig;
  myClientId: string;
}

const COL_COLORS = [
  "#6C63FF", "#FF6584", "#43C59E", "#F59E0B", "#3B82F6",
  "#8B5CF6", "#EC4899", "#14B8A6", "#F97316", "#10B981",
];

export default function PadletBoard({ user, roomCode, roomLangs, onLogout, roomConfig, myClientId }: Props) {
  const [cards, setCards] = useState<CardData[]>([]);
  const [columns, setColumns] = useState<FirebaseColumn[]>(
    COLUMNS_DEFAULT.map((col, i) => ({ ...col, order: i }))
  );
  const [modal, setModal] = useState<{ colId: string; colTitle: string; colColor: string } | null>(null);
  const [posting, setPosting] = useState(false);
  const lang = user.myLang;

  // Teacher state
  const [isTeacher, setIsTeacher] = useState(false);
  const [teacherLangs, setTeacherLangs] = useState<string[]>(roomLangs);
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState(false);

  // Management modal state
  const [showManage, setShowManage] = useState(false);
  const [editTitle, setEditTitle] = useState<Record<string, string>>({});
  const [newColTitle, setNewColTitle] = useState("");
  const [newColColor, setNewColColor] = useState(COL_COLORS[0]);

  // Room config state (live-updated)
  const [roomConfigState, setRoomConfigState] = useState<RoomConfig>(roomConfig);
  const [rosterText, setRosterText] = useState("");

  // Feature modals
  const [showQR, setShowQR] = useState(false);
  const [showApproval, setShowApproval] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [editModal, setEditModal] = useState<{ card: CardData; colTitle: string; colColor: string } | null>(null);

  const boardRef = useRef<HTMLDivElement>(null);

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

  // ── Firebase: rooms/${roomCode}/config (full config listener) ──
  useEffect(() => {
    const db = getClientDb();
    const configRef = ref(db, `rooms/${roomCode}/config`);
    onValue(configRef, (snap) => {
      const val = snap.val() as RoomConfig | null;
      if (val) {
        setRoomConfigState(val);
        if (Array.isArray(val.languages) && val.languages.length > 0) setTeacherLangs(val.languages);
      }
    });
    return () => off(configRef);
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

  // Card visibility
  const visibleCards = isTeacher ? cards : cards.filter((c) => !c.status || c.status === "approved");
  const pendingCount = cards.filter((c) => c.status === "pending").length;

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

  // ── PDF Export ──
  async function exportPDF() {
    if (!boardRef.current) return;
    setShowExport(false);
    const canvas = await html2canvas(boardRef.current, { scale: 1.5, useCORS: true, logging: false });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = (canvas.height * pdfW) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 0, pdfW, Math.min(pdfH, pdf.internal.pageSize.getHeight()));
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
    pdf.save(`${roomCode}_${stamp}.pdf`);
  }

  // ── CSV Export ──
  function exportCSV() {
    setShowExport(false);
    const bom = "\uFEFF";
    const header = "작성자,컬럼,타입,원문,언어,시각\n";
    const rows = visibleCards.map((card) => {
      const col = columns.find((c) => c.id === card.colId);
      const colTitle = (col?.title || card.colId).replace(/"/g, '""');
      let content = (card.originalText || "").replace(/"/g, '""');
      if (card.cardType === "image") content = `[사진] ${card.imageUrl || ""}`;
      if (card.cardType === "youtube") content = `[YouTube] https://youtu.be/${card.youtubeId || ""}`;
      if (card.cardType === "drawing") content = "[그림]";
      const time = new Date(card.timestamp).toLocaleString("ko-KR");
      return `"${card.authorName}","${colTitle}","${card.cardType}","${content}","${card.authorLang}","${time}"`;
    });
    const blob = new Blob([bom + header + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
    a.href = url;
    a.download = `${roomCode}_${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Approval actions ──
  async function approveCard(cardId: string) {
    const db = getClientDb();
    await update(ref(db, `rooms/${roomCode}/cards/${cardId}`), { status: "approved" as CardStatus });
  }

  async function rejectCard(cardId: string) {
    const db = getClientDb();
    await remove(ref(db, `rooms/${roomCode}/cards/${cardId}`));
  }

  const handlePost = useCallback(async (data: PostData) => {
    if (posting || !modal) return;
    const { cardType, text, writeLang, imageUrl, youtubeId, status, authorClientId } = data;
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
      ...(status ? { status } : {}),
      ...(authorClientId ? { authorClientId } : {}),
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
          ...(data.status ? { status: data.status } : {}),
          ...(data.authorClientId ? { authorClientId: data.authorClientId } : {}),
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

  // ── Edit post handler ──
  const handleEditPost = useCallback(async (data: PostData) => {
    if (!editModal) return;
    const db = getClientDb();
    const cardRef = ref(db, `rooms/${roomCode}/cards/${editModal.card.id}`);
    const updates: Record<string, unknown> = {
      originalText: data.text || editModal.card.originalText,
      authorLang: data.writeLang,
      translations: { [data.writeLang]: data.text || "" },
      editedAt: Date.now(),
    };
    if (data.imageUrl) updates.imageUrl = data.imageUrl;
    if (data.youtubeId) updates.youtubeId = data.youtubeId;
    await update(cardRef, updates);
    setEditModal(null);
  }, [editModal, roomCode]);

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

          {/* Teacher-only buttons */}
          {isTeacher && (
            <>
              {/* QR button */}
              <button
                onClick={() => setShowQR(true)}
                style={{
                  background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)",
                  color: "#6EE7B7", borderRadius: 10, padding: "6px 12px",
                  fontSize: 12, cursor: "pointer", fontWeight: 700,
                }}
              >
                📱 QR
              </button>

              {/* Pending badge */}
              {pendingCount > 0 && (
                <button
                  onClick={() => setShowApproval(true)}
                  style={{
                    background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)",
                    color: "#FCD34D", borderRadius: 10, padding: "6px 12px",
                    fontSize: 12, cursor: "pointer", fontWeight: 700,
                  }}
                >
                  🔔 {t("approvalPending", lang)} {pendingCount}
                </button>
              )}

              {/* Export dropdown */}
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => setShowExport((v) => !v)}
                  style={{
                    background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)",
                    color: "#93C5FD", borderRadius: 10, padding: "6px 12px",
                    fontSize: 12, cursor: "pointer", fontWeight: 700,
                  }}
                >
                  📤 {t("exportBtn", lang)} ▾
                </button>
                {showExport && (
                  <div style={{
                    position: "absolute", top: "calc(100% + 6px)", right: 0,
                    background: "#fff", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
                    border: "1px solid #E9ECF5", zIndex: 100, minWidth: 160, overflow: "hidden",
                  }}>
                    <button
                      onClick={exportPDF}
                      style={{
                        width: "100%", padding: "12px 16px", textAlign: "left", border: "none",
                        background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: 600,
                        color: "#374151", display: "block",
                      }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#F9FAFB")}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
                    >
                      📄 {t("exportPdf", lang)}
                    </button>
                    <button
                      onClick={exportCSV}
                      style={{
                        width: "100%", padding: "12px 16px", textAlign: "left", border: "none",
                        background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: 600,
                        color: "#374151", borderTop: "1px solid #F3F4F6", display: "block",
                      }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#F9FAFB")}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
                    >
                      📊 {t("exportCsv", lang)}
                    </button>
                  </div>
                )}
              </div>

              {/* Manage button */}
              <button
                onClick={() => {
                  setRosterText((roomConfigState.roster || []).join("\n"));
                  setShowManage(true);
                }}
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
            </>
          )}

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
      <main
        ref={boardRef}
        style={{
          flex: 1, overflowX: "auto", overflowY: "hidden",
          display: "flex", gap: 14, padding: "16px 18px",
          alignItems: "flex-start",
        }}
      >
        {columns.map((col) => {
          const colCards = visibleCards.filter((c) => c.colId === col.id);
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
                    <PadletCard
                      key={card.id}
                      card={card}
                      viewerLang={lang}
                      colColor={col.color}
                      isTeacher={isTeacher}
                      myClientId={myClientId}
                      isPending={isTeacher && card.status === "pending"}
                      onEdit={() => setEditModal({ card, colTitle: col.title, colColor: col.color })}
                    />
                  ))
                )}
              </div>

              <button
                onClick={() => setModal({ colId: col.id, colTitle: col.title, colColor: col.color })}
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
              {/* Section: Room Settings */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#9CA3AF", letterSpacing: 1, marginBottom: 12 }}>
                  방 설정
                </div>

                {/* QR Entry Toggle */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 0", borderBottom: "1px solid #F3F4F8",
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>{t("qrEntryToggle", lang)}</div>
                  </div>
                  <button
                    onClick={() => {
                      const db = getClientDb();
                      set(ref(db, `rooms/${roomCode}/config/qrEntry`), !roomConfigState.qrEntry);
                    }}
                    style={{
                      width: 48, height: 26, borderRadius: 13, border: "none", cursor: "pointer",
                      background: roomConfigState.qrEntry ? "#5B57F5" : "#E5E7EB",
                      position: "relative", transition: "background 0.2s", flexShrink: 0,
                    }}
                  >
                    <div style={{
                      position: "absolute", top: 3, left: roomConfigState.qrEntry ? 25 : 3,
                      width: 20, height: 20, borderRadius: "50%", background: "#fff",
                      transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                    }} />
                  </button>
                </div>

                {/* Approval Mode Toggle */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 0", borderBottom: "1px solid #F3F4F8",
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>{t("approvalMode", lang)}</div>
                  </div>
                  <button
                    onClick={() => {
                      const db = getClientDb();
                      set(ref(db, `rooms/${roomCode}/config/approvalMode`), !roomConfigState.approvalMode);
                    }}
                    style={{
                      width: 48, height: 26, borderRadius: 13, border: "none", cursor: "pointer",
                      background: roomConfigState.approvalMode ? "#5B57F5" : "#E5E7EB",
                      position: "relative", transition: "background 0.2s", flexShrink: 0,
                    }}
                  >
                    <div style={{
                      position: "absolute", top: 3, left: roomConfigState.approvalMode ? 25 : 3,
                      width: 20, height: 20, borderRadius: "50%", background: "#fff",
                      transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                    }} />
                  </button>
                </div>

                {/* Roster Mode Toggle */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 0", borderBottom: "1px solid #F3F4F8",
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>{t("rosterMode", lang)}</div>
                  </div>
                  <button
                    onClick={() => {
                      const db = getClientDb();
                      set(ref(db, `rooms/${roomCode}/config/rosterMode`), !roomConfigState.rosterMode);
                    }}
                    style={{
                      width: 48, height: 26, borderRadius: 13, border: "none", cursor: "pointer",
                      background: roomConfigState.rosterMode ? "#5B57F5" : "#E5E7EB",
                      position: "relative", transition: "background 0.2s", flexShrink: 0,
                    }}
                  >
                    <div style={{
                      position: "absolute", top: 3, left: roomConfigState.rosterMode ? 25 : 3,
                      width: 20, height: 20, borderRadius: "50%", background: "#fff",
                      transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                    }} />
                  </button>
                </div>

                {/* Roster textarea (when rosterMode is on) */}
                {roomConfigState.rosterMode && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 8 }}>
                      {t("rosterSetup", lang)} (한 줄에 한 명)
                    </div>
                    <textarea
                      value={rosterText}
                      onChange={(e) => setRosterText(e.target.value)}
                      placeholder={"홍길동\n김철수\n이영희"}
                      rows={5}
                      style={{
                        width: "100%", padding: "12px 14px", borderRadius: 12,
                        border: "2px solid #E5E7EB", fontSize: 14, resize: "vertical",
                        boxSizing: "border-box", outline: "none", fontFamily: "inherit",
                        color: "#111827", background: "#F9FAFB",
                      }}
                      onFocus={(e) => { e.target.style.borderColor = "#5B57F5"; e.target.style.background = "#fff"; }}
                      onBlur={(e) => { e.target.style.borderColor = "#E5E7EB"; e.target.style.background = "#F9FAFB"; }}
                    />
                    <button
                      onClick={() => {
                        const db = getClientDb();
                        const names = rosterText.split("\n").map((s) => s.trim()).filter(Boolean);
                        set(ref(db, `rooms/${roomCode}/config/roster`), names);
                      }}
                      style={{
                        marginTop: 8, padding: "9px 20px", borderRadius: 10, border: "none",
                        background: "linear-gradient(135deg, #5B57F5, #8B5CF6)", color: "#fff",
                        fontWeight: 800, fontSize: 13, cursor: "pointer",
                        boxShadow: "0 4px 14px rgba(91,87,245,0.35)",
                      }}
                    >
                      저장
                    </button>
                  </div>
                )}
              </div>

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

              {/* Language management */}
              <div style={{ borderTop: "1px dashed #E5E7EB", paddingTop: 18, marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#9CA3AF", letterSpacing: 1, marginBottom: 10 }}>
                  언어 설정 (학생 입장 시 보이는 언어)
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {Object.entries(LANGUAGES).map(([code, info]) => {
                    const active = teacherLangs.includes(code);
                    return (
                      <button
                        key={code}
                        onClick={() => {
                          const db = getClientDb();
                          const next = active
                            ? teacherLangs.filter((l) => l !== code)
                            : [...teacherLangs, code];
                          if (next.length === 0) return;
                          set(ref(db, `rooms/${roomCode}/config/languages`), next);
                        }}
                        style={{
                          padding: "5px 11px", borderRadius: 20, fontSize: 12,
                          border: `1.5px solid ${active ? "#5B57F5" : "#E5E7EB"}`,
                          background: active ? "#EEEEFF" : "#F9FAFB",
                          color: active ? "#5B57F5" : "#9CA3AF",
                          fontWeight: active ? 700 : 400, cursor: "pointer",
                          transition: "all 0.12s",
                        }}
                      >
                        {info.flag} {info.label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 8 }}>
                  선택된 언어: {teacherLangs.length}개 · 번역 대상 언어이기도 합니다
                </div>
              </div>

              {/* Add column */}
              <div style={{ borderTop: "1px dashed #E5E7EB", paddingTop: 18 }}>
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

      {/* ── QR Modal ── */}
      {showQR && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(9,7,30,0.8)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 400, backdropFilter: "blur(8px)", padding: 20,
        }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowQR(false); }}
        >
          <div style={{
            background: "#fff", borderRadius: 24, padding: "36px 40px",
            maxWidth: 460, width: "100%", textAlign: "center",
            boxShadow: "0 32px 80px rgba(0,0,0,0.4)",
            animation: "fadeSlideIn 0.25s ease",
          }}>
            <h3 style={{ margin: "0 0 4px", fontWeight: 900, fontSize: 18, color: "#111827" }}>
              {t("qrCode", lang)}
            </h3>
            <p style={{ margin: "0 0 24px", fontSize: 13, color: "#6B7280" }}>
              {t("qrDescription", lang)}
            </p>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
              <QRCodeSVG
                value={`${typeof window !== "undefined" ? window.location.origin : ""}/${roomCode}`}
                size={260}
              />
            </div>
            <p style={{ fontSize: 13, color: "#6B7280", wordBreak: "break-all", marginBottom: 24 }}>
              {typeof window !== "undefined" ? window.location.origin : ""}/{roomCode}
            </p>
            <button
              onClick={() => setShowQR(false)}
              style={{
                padding: "12px 32px", borderRadius: 12, background: "linear-gradient(135deg, #5B57F5, #8B5CF6)",
                color: "#fff", fontWeight: 800, border: "none", cursor: "pointer", fontSize: 14,
                boxShadow: "0 4px 16px rgba(91,87,245,0.4)",
              }}
            >닫기</button>
          </div>
        </div>
      )}

      {/* ── Approval Modal ── */}
      {showApproval && isTeacher && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(9,7,30,0.8)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 400, backdropFilter: "blur(8px)", padding: 20,
        }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowApproval(false); }}
        >
          <div style={{
            background: "#fff", borderRadius: 24, width: "100%", maxWidth: 520,
            maxHeight: "88vh", overflowY: "auto",
            boxShadow: "0 32px 80px rgba(0,0,0,0.4)",
            animation: "fadeSlideIn 0.25s ease",
          }}>
            <div style={{
              display: "flex", alignItems: "center", padding: "20px 24px 16px",
              borderBottom: "1px solid #F3F4F8", position: "sticky", top: 0, background: "#fff", zIndex: 1,
            }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 16, color: "#111827" }}>🔔 {t("approvalPending", lang)}</div>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{pendingCount}개 대기 중</div>
              </div>
              <button
                onClick={() => setShowApproval(false)}
                style={{
                  marginLeft: "auto", background: "#F3F4F6", border: "none", borderRadius: "50%",
                  width: 32, height: 32, fontSize: 14, cursor: "pointer", color: "#6B7280",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >✕</button>
            </div>
            <div style={{ padding: "16px 24px 24px" }}>
              {cards.filter((c) => c.status === "pending").length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#9CA3AF" }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                  <div style={{ fontWeight: 600 }}>승인 대기 중인 게시물이 없습니다</div>
                </div>
              ) : (
                cards.filter((c) => c.status === "pending").map((card) => {
                  const col = columns.find((c) => c.id === card.colId);
                  return (
                    <div key={card.id} style={{
                      background: "#FFFBEB", border: "1px solid #FDE68A",
                      borderRadius: 12, padding: "14px 16px", marginBottom: 12,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>{card.authorName}</div>
                        <span style={{ fontSize: 11, color: "#9CA3AF" }}>→</span>
                        <div style={{ fontSize: 11, color: "#6B7280" }}>{col?.title || card.colId}</div>
                        <span style={{ fontSize: 10, background: "#FEF3C7", color: "#D97706", borderRadius: 6, padding: "1px 7px", fontWeight: 700, marginLeft: "auto" }}>
                          대기 중
                        </span>
                      </div>
                      {card.cardType === "text" && (
                        <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, marginBottom: 10 }}>
                          {card.originalText}
                        </div>
                      )}
                      {card.cardType === "image" && card.imageUrl && (
                        <img src={card.imageUrl} alt="pending" style={{ width: "100%", borderRadius: 8, marginBottom: 10 }} />
                      )}
                      {card.cardType === "youtube" && card.youtubeId && (
                        <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 10 }}>
                          YouTube: https://youtu.be/{card.youtubeId}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => approveCard(card.id)}
                          style={{
                            flex: 1, padding: "9px 0", borderRadius: 10, border: "none",
                            background: "#10B981", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13,
                          }}
                        >
                          ✅ {t("approve", lang)}
                        </button>
                        <button
                          onClick={() => rejectCard(card.id)}
                          style={{
                            flex: 1, padding: "9px 0", borderRadius: 10, border: "none",
                            background: "#EF4444", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13,
                          }}
                        >
                          ❌ {t("reject", lang)}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Post Modal ── */}
      {modal && (
        <PostModal
          colId={modal.colId}
          colTitle={modal.colTitle}
          colColor={modal.colColor}
          user={{ ...user, isTeacher, teacherLangs: isTeacher ? teacherLangs : [] }}
          posting={posting}
          onPost={handlePost}
          onClose={() => setModal(null)}
          approvalMode={roomConfigState.approvalMode}
          myClientId={myClientId}
          roomCode={roomCode}
        />
      )}

      {/* ── Edit Modal ── */}
      {editModal && (
        <PostModal
          colId={editModal.card.colId}
          colTitle={editModal.colTitle}
          colColor={editModal.colColor}
          user={{ ...user, isTeacher, teacherLangs: isTeacher ? teacherLangs : [] }}
          posting={posting}
          onPost={handleEditPost}
          onClose={() => setEditModal(null)}
          editCard={editModal.card}
          roomCode={roomCode}
        />
      )}
    </div>
  );
}
