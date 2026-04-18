"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ref, onValue, off, set, remove, update } from "firebase/database";
import { getClientDb } from "@/lib/firebase-client";
import { COLUMNS_DEFAULT, LANGUAGES, CARD_PALETTES, BRAND_GRADIENT } from "@/lib/constants";
import { CardData, UserConfig, PostData, RoomConfig, CardStatus, CommentData } from "@/lib/types";
import { t } from "@/lib/i18n";
import PadletCard from "./PadletCard";
import PostModal from "./PostModal";
import PptxTranslateModal from "./PptxTranslateModal";
import DiscussionCreateModal from "./DiscussionCreateModal";
import DiscussionSession from "./DiscussionSession";
import GameRoom from "./GameRoom";
import InterpreterDrawer from "./InterpreterDrawer";
import { columnIconFor } from "@/lib/assets";
import { QRCodeSVG } from "qrcode.react";

type PendingItem =
  | { kind: "card"; data: CardData }
  | { kind: "comment"; data: CommentData; parentCard: CardData };

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
  "#F59E0B", "#FF6584", "#43C59E", "#F59E0B", "#3B82F6",
  "#D97706", "#EC4899", "#14B8A6", "#F97316", "#10B981",
];

export default function PadletBoard({ user, roomCode, roomLangs, onLogout, roomConfig, myClientId }: Props) {
  const [cards, setCards] = useState<CardData[]>([]);
  const [columns, setColumns] = useState<FirebaseColumn[]>(
    COLUMNS_DEFAULT.map((col, i) => ({ ...col, order: i }))
  );
  const [modal, setModal] = useState<{ colId: string; colTitle: string; colColor: string } | null>(null);
  const [interpreterOpen, setInterpreterOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const lang = user.myLang;

  // Teacher state
  const isTeacher = user.isTeacher ?? false;
  const [teacherLangs, setTeacherLangs] = useState<string[]>(roomLangs);

  // Management modal state
  const [showManage, setShowManage] = useState(false);
  const [editTitle, setEditTitle] = useState<Record<string, string>>({});
  const [newColTitle, setNewColTitle] = useState("");
  const [newColColor, setNewColColor] = useState(COL_COLORS[0]);

  // Room config state (live-updated)
  const [roomConfigState, setRoomConfigState] = useState<RoomConfig>(roomConfig);
  const [rosterText, setRosterText] = useState("");

  // Pending items (cards + comments) for approval panel
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);

  // Feature modals
  const [showQR, setShowQR] = useState(false);
  const [showApproval, setShowApproval] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showPptx, setShowPptx] = useState(false);
  const [showDiscussionCreate, setShowDiscussionCreate] = useState(false);
  const [showGameRoom, setShowGameRoom] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionMinimized, setSessionMinimized] = useState(false);
  const [editModal, setEditModal] = useState<{ card: CardData; colTitle: string; colColor: string } | null>(null);

  const boardRef = useRef<HTMLDivElement>(null);
  const [colDeleteActive, setColDeleteActive] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasLongPress = useRef(false);

  // Undo snackbar
  const [undoToast, setUndoToast] = useState<{
    message: string;
    onUndo: () => void;
    timeoutId: ReturnType<typeof setTimeout>;
  } | null>(null);

  function showUndoToast(message: string, onUndo: () => void) {
    setUndoToast((prev) => {
      if (prev) clearTimeout(prev.timeoutId);
      const timeoutId = setTimeout(() => setUndoToast(null), 8000);
      return { message, onUndo, timeoutId };
    });
  }

  function handleUndo() {
    if (!undoToast) return;
    clearTimeout(undoToast.timeoutId);
    undoToast.onUndo();
    setUndoToast(null);
  }

  function dismissToast() {
    if (!undoToast) return;
    clearTimeout(undoToast.timeoutId);
    setUndoToast(null);
  }

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
        // Normalize Firebase numeric-keyed objects back to arrays
        if (val.roster && !Array.isArray(val.roster)) {
          val.roster = Object.values(val.roster as unknown as Record<string, string>);
        }
        if (val.languages && !Array.isArray(val.languages)) {
          val.languages = Object.values(val.languages as unknown as Record<string, string>);
        }
        setRoomConfigState(val);
        if (Array.isArray(val.languages) && val.languages.length > 0) setTeacherLangs(val.languages);
      }
    });
    return () => off(configRef);
  }, [roomCode]);

  // ── ESC key handler for modals ──
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (showManage) setShowManage(false);
        else if (showQR) setShowQR(false);
        else if (showApproval) setShowApproval(false);
        else if (showPptx) setShowPptx(false);
        else if (showDiscussionCreate) setShowDiscussionCreate(false);
        else if (editModal) setEditModal(null);
      }
    }
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [showManage, showQR, showApproval, showPptx, showDiscussionCreate, editModal]);

  // ── Firebase: rooms/${roomCode}/activeSession ──
  useEffect(() => {
    const db = getClientDb();
    const aRef = ref(db, `rooms/${roomCode}/activeSession`);
    const cb = onValue(aRef, (snap) => {
      const id = snap.val() as string | null;
      setActiveSessionId(id);
      if (id) setSessionMinimized(false);
    });
    return () => off(aRef, "value", cb);
  }, [roomCode]);

  // ── Firebase: rooms/${roomCode}/cards ──
  useEffect(() => {
    const db = getClientDb();
    const cardsRef = ref(db, `rooms/${roomCode}/cards`);
    onValue(cardsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) { setCards([]); setPendingItems([]); return; }

      // Raw data includes nested comments sub-tree
      type RawCard = CardData & { comments?: Record<string, CommentData> };
      const rawList: RawCard[] = Object.values(data);

      // Cards without comments for normal display
      const list: CardData[] = rawList.map(({ comments: _c, ...rest }) => rest as CardData);
      list.sort((a, b) => b.timestamp - a.timestamp);
      setCards(list);

      // Build pending items (cards + comments)
      const pending: PendingItem[] = [];
      for (const raw of rawList) {
        const card = list.find((c) => c.id === raw.id)!;
        if (!card) continue;
        if (raw.status === "pending") pending.push({ kind: "card", data: card });
        if (raw.comments) {
          for (const comment of Object.values(raw.comments)) {
            if (comment.status === "pending") {
              pending.push({ kind: "comment", data: comment, parentCard: card });
            }
          }
        }
      }
      pending.sort((a, b) => {
        const tsA = a.kind === "card" ? a.data.timestamp : a.data.timestamp;
        const tsB = b.kind === "card" ? b.data.timestamp : b.data.timestamp;
        return tsA - tsB;
      });
      setPendingItems(pending);
    });
    return () => off(cardsRef);
  }, [roomCode]);

  // Card visibility
  const visibleCards = isTeacher ? cards : cards.filter((c) => !c.status || c.status === "approved");
  const pendingCount = pendingItems.length;

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
    const col = columns.find((c) => c.id === colId);
    if (!col) return;
    const db = getClientDb();
    const { id: _id, ...colData } = col;
    remove(ref(db, `rooms/${roomCode}/columns/${colId}`));
    showUndoToast(`"${col.title}" 컬럼을 삭제했습니다`, () => {
      set(ref(db, `rooms/${roomCode}/columns/${colId}`), colData);
    });
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

  async function deleteCard(cardId: string) {
    const db = getClientDb();
    const { get: dbGet, ref: dbRef } = await import("firebase/database");
    const snap = await dbGet(dbRef(db, `rooms/${roomCode}/cards/${cardId}`));
    const fullCard = snap.val();
    if (!fullCard) return;
    await remove(ref(db, `rooms/${roomCode}/cards/${cardId}`));
    const authorName = typeof fullCard.authorName === "string" ? fullCard.authorName : "";
    showUndoToast(
      authorName ? `"${authorName}"님의 카드를 삭제했습니다` : "카드를 삭제했습니다",
      () => {
        set(ref(db, `rooms/${roomCode}/cards/${cardId}`), fullCard);
      }
    );
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

  // ── PDF Export (text-based with comment summaries) ──
  async function exportPDF() {
    setShowExport(false);
    const { default: jsPDFLib } = await import("jspdf");
    const pdf = new jsPDFLib({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = pdf.internal.pageSize.getWidth();
    const margin = 14;
    let y = margin;
    const lineH = 6;
    const maxW = W - margin * 2;

    function ensurePage(need = 10) {
      if (y + need > 285) { pdf.addPage(); y = margin; }
    }

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text(`Room ${roomCode}`, margin, y);
    y += lineH + 2;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(130, 130, 130);
    pdf.text(new Date().toLocaleString("ko-KR"), margin, y);
    pdf.setTextColor(0, 0, 0);
    y += lineH + 4;

    for (const col of columns) {
      const colCards = visibleCards.filter((c) => c.colId === col.id);
      if (!colCards.length) continue;
      ensurePage(14);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.text(col.title, margin, y);
      y += lineH;

      for (const card of colCards) {
        ensurePage(20);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.text(`${card.authorName} (${LANGUAGES[card.authorLang]?.flag || ""} ${card.authorLang})`, margin + 4, y);
        y += lineH - 1;

        pdf.setFont("helvetica", "normal");
        const body =
          card.cardType === "image" ? "[이미지 첨부]"
          : card.cardType === "youtube" ? `[YouTube: ${card.youtubeId}]`
          : card.cardType === "drawing" ? "[그림]"
          : card.originalText || "";
        const lines = pdf.splitTextToSize(body, maxW - 4);
        lines.slice(0, 4).forEach((line: string) => {
          ensurePage();
          pdf.text(line, margin + 4, y);
          y += lineH - 1;
        });
        if (lines.length > 4) {
          pdf.setTextColor(130, 130, 130);
          pdf.text(`... (${lines.length - 4} more lines)`, margin + 4, y);
          pdf.setTextColor(0, 0, 0);
          y += lineH - 1;
        }

        // Comment summaries from pendingItems (approved comments)
        const cardComments = pendingItems
          .filter((p) => p.kind === "comment" && p.parentCard.id === card.id && p.data.status !== "pending")
          .map((p) => (p as { kind: "comment"; data: CommentData; parentCard: CardData }).data);
        if (cardComments.length) {
          const shown = cardComments.slice(0, 3);
          const more = cardComments.length - 3;
          shown.forEach((c) => {
            ensurePage();
            pdf.setTextColor(80, 80, 180);
            pdf.setFontSize(8);
            const cLine = `  💬 ${c.authorName}: ${c.text.slice(0, 60)}${c.text.length > 60 ? "…" : ""}`;
            pdf.text(cLine, margin + 4, y);
            y += lineH - 2;
          });
          if (more > 0) {
            pdf.text(`  ... +${more}개`, margin + 4, y);
            y += lineH - 2;
          }
          pdf.setTextColor(0, 0, 0);
          pdf.setFontSize(9);
        }
        y += 2;
      }
      y += 4;
    }

    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
    pdf.save(`${roomCode}_${stamp}.pdf`);
  }

  // ── CSV Export (includes comment rows) ──
  async function exportCSV() {
    setShowExport(false);
    const { get, ref: dbRef } = await import("firebase/database");
    const db = getClientDb();

    // Fetch full card data (with comments) for export
    type RawCard = CardData & { comments?: Record<string, CommentData> };
    const snap = await get(dbRef(db, `rooms/${roomCode}/cards`)).catch(() => null);
    const rawData: Record<string, RawCard> = snap?.val() || {};

    const bom = "\uFEFF";
    const header = "종류,작성자,컬럼,타입,원문,언어,시각\n";
    const rows: string[] = [];

    for (const card of visibleCards) {
      const col = columns.find((c) => c.id === card.colId);
      const colTitle = (col?.title || card.colId).replace(/"/g, '""');
      let content = (card.originalText || "").replace(/"/g, '""');
      if (card.cardType === "image") content = `[사진] ${card.imageUrl || ""}`;
      if (card.cardType === "youtube") content = `[YouTube] https://youtu.be/${card.youtubeId || ""}`;
      if (card.cardType === "drawing") content = "[그림]";
      const time = new Date(card.timestamp).toLocaleString("ko-KR");
      rows.push(`"card","${card.authorName}","${colTitle}","${card.cardType}","${content}","${card.authorLang}","${time}"`);

      // Append approved comments
      const rawCard = rawData[card.id];
      if (rawCard?.comments) {
        for (const comment of Object.values(rawCard.comments)) {
          if (comment.status === "pending") continue; // skip unapproved
          const commentText = comment.text.replace(/"/g, '""');
          const commentTime = new Date(comment.timestamp).toLocaleString("ko-KR");
          rows.push(`"comment","${comment.authorName}","${colTitle}","comment","${commentText}","${comment.authorLang}","${commentTime}"`);
        }
      }
    }

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

  // ── Image Export (single PNG capture of whole board) ──
  async function exportImage() {
    setShowExport(false);
    const el = boardRef.current;
    if (!el) return;
    const { default: html2canvas } = await import("html2canvas");
    const prevOverflowX = el.style.overflowX;
    const prevOverflowY = el.style.overflowY;
    const prevHeight = el.style.height;
    el.style.overflowX = "visible";
    el.style.overflowY = "visible";
    el.style.height = "auto";
    try {
      const canvas = await html2canvas(el, {
        backgroundColor: "#F8F9FE",
        scale: window.devicePixelRatio > 1 ? 2 : 1.5,
        useCORS: true,
        logging: false,
        width: el.scrollWidth,
        height: el.scrollHeight,
        windowWidth: el.scrollWidth,
        windowHeight: el.scrollHeight,
      });
      const now = new Date();
      const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `bee-board-${roomCode}-${stamp}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, "image/png");
    } finally {
      el.style.overflowX = prevOverflowX;
      el.style.overflowY = prevOverflowY;
      el.style.height = prevHeight;
    }
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

  async function approveComment(cardId: string, commentId: string) {
    const db = getClientDb();
    await set(ref(db, `rooms/${roomCode}/cards/${cardId}/comments/${commentId}/status`), "approved" as CardStatus);
  }

  async function rejectComment(cardId: string, commentId: string) {
    const db = getClientDb();
    await remove(ref(db, `rooms/${roomCode}/cards/${cardId}/comments/${commentId}`));
  }

  const handlePost = useCallback(async (data: PostData) => {
    if (posting || !modal) return;
    const { cardType, text, writeLang, imageUrl, youtubeId, status, authorClientId } = data;
    if (cardType === "text" && !text.trim()) return;

    setPosting(true);

    // 교사가 설정한 방 언어 목록으로 번역 (학생도 동일하게 적용)
    const targetLangs =
      cardType === "text"
        ? teacherLangs.filter((l) => l !== writeLang)
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
    if (!editModal || posting) return;
    setPosting(true);
    const db = getClientDb();
    const cardId = editModal.card.id;

    try {
      let translations: Record<string, string> = { [data.writeLang]: data.text || "" };

      // Re-translate text cards via translate API (cardType "comment" = translate-only, no Firebase save)
      if (data.cardType === "text" && data.text?.trim()) {
        const targetLangs = teacherLangs.filter((l) => l !== data.writeLang);
        if (targetLangs.length > 0) {
          const res = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: data.text,
              fromLang: data.writeLang,
              targetLangs,
              colId: "comment",
              authorName: user.myName,
              isTeacher,
              paletteIdx: editModal.card.paletteIdx,
              roomCode,
              cardType: "comment", // translate-only mode, returns translations without saving
            }),
          });
          if (res.ok) {
            const result = await res.json();
            if (result.translations) translations = result.translations;
          }
        }
      }

      const updates: Record<string, unknown> = {
        originalText: data.text || editModal.card.originalText,
        authorLang: data.writeLang,
        translations,
        editedAt: Date.now(),
      };
      // Only update imageUrl if a new one was uploaded; otherwise preserve existing
      if (data.imageUrl) updates.imageUrl = data.imageUrl;
      if (data.youtubeId) updates.youtubeId = data.youtubeId;

      await update(ref(db, `rooms/${roomCode}/cards/${cardId}`), updates);
    } catch {
      // keep card as-is on error
    }
    setPosting(false);
    setEditModal(null);
  }, [editModal, posting, user, isTeacher, teacherLangs, roomCode]);

  return (
    <div style={{
      height: "100vh", display: "flex", flexDirection: "column",
      fontFamily: "'Noto Sans KR', sans-serif",
      background: "linear-gradient(180deg, #FEF9E7 0%, #FFFDF3 40%, #FFFAE8 100%)",
      overflow: "hidden",
    }}>
      {/* ── Header ── */}
      <header style={{
        minHeight: 72, flexShrink: 0,
        background: "#fff",
        borderBottom: "1px solid #F3EAD0",
        display: "flex", alignItems: "center", padding: "10px 22px",
        gap: 14, boxShadow: "0 2px 10px rgba(245,158,11,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img
            src="/mascot/bee-cheer.png"
            alt=""
            aria-hidden="true"
            style={{ width: 52, height: 52, flexShrink: 0, filter: "drop-shadow(0 6px 14px rgba(245,158,11,0.35))" }}
          />
          <div>
            <div style={{ fontWeight: 900, fontSize: 19, color: "#111827", letterSpacing: -0.4, lineHeight: 1.1 }}>
              꿀벌 소통창
            </div>
            <div style={{ fontSize: 13, color: "#92400E", marginTop: 3, fontWeight: 700 }}>
              우리 방 <span style={{ color: "#B45309", fontWeight: 900, letterSpacing: 2, marginLeft: 4 }}>{roomCode}</span>
            </div>
          </div>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {/* User badge */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "#FEF3C7", border: "2px solid #FDE68A",
            borderRadius: 24, padding: "6px 16px 6px 6px",
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: BRAND_GRADIENT,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: isTeacher ? 16 : 14, fontWeight: 800, color: "#fff",
            }}>
              {isTeacher ? "👩‍🏫" : user.myName.charAt(0).toUpperCase()}
            </div>
            <span style={{ color: "#92400E", fontWeight: 800, fontSize: 15 }}>{user.myName}</span>
            {isTeacher && (
              <span style={{ fontSize: 12, background: "#F59E0B", color: "#fff", borderRadius: 10, padding: "2px 9px", fontWeight: 800 }}>
                {t("teacherTag", lang)}
              </span>
            )}
          </div>

          {/* 🎙️ 통역 도우미 — available to everyone */}
          <button
            onClick={() => setInterpreterOpen(true)}
            aria-label="통역 도우미 열기"
            style={{
              background: "linear-gradient(135deg, #1F2937, #374151)",
              border: "none", color: "#fff",
              borderRadius: 16, padding: "10px 16px",
              fontSize: 15, cursor: "pointer", fontWeight: 900, minHeight: 44,
              boxShadow: "0 6px 18px rgba(31,41,55,0.35)",
              display: "inline-flex", alignItems: "center", gap: 6,
              transition: "transform 0.12s",
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.96)")}
            onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            🎙️ 통역
            <span style={{
              fontSize: 9, fontWeight: 900, background: "#F59E0B", color: "#fff",
              padding: "2px 6px", borderRadius: 999, letterSpacing: 0.5,
            }}>BETA</span>
          </button>

          {/* Teacher-only buttons */}
          {isTeacher && (
            <>
              {/* QR button */}
              <button
                onClick={() => setShowQR(true)}
                style={{
                  background: "#ECFDF5", border: "2px solid #A7F3D0",
                  color: "#047857", borderRadius: 16, padding: "10px 16px",
                  fontSize: 15, cursor: "pointer", fontWeight: 800, minHeight: 44,
                  transition: "transform 0.12s",
                }}
                onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.96)")}
                onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
              >
                📱 QR
              </button>

              {/* Pending badge */}
              {pendingCount > 0 && (
                <button
                  onClick={() => setShowApproval(true)}
                  style={{
                    background: "#FEF3C7", border: "2px solid #FBBF24",
                    color: "#92400E", borderRadius: 16, padding: "10px 16px",
                    fontSize: 15, cursor: "pointer", fontWeight: 800, minHeight: 44,
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
                    background: "#EFF6FF", border: "2px solid #BFDBFE",
                    color: "#1D4ED8", borderRadius: 16, padding: "10px 16px",
                    fontSize: 15, cursor: "pointer", fontWeight: 800, minHeight: 44,
                    transition: "transform 0.12s",
                  }}
                  onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.96)")}
                  onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                >
                  📤 {t("exportBtn", lang)} ▾
                </button>
                {showExport && (
                  <div style={{
                    position: "absolute", top: "calc(100% + 8px)", right: 0,
                    background: "#fff", borderRadius: 18, boxShadow: "0 12px 36px rgba(0,0,0,0.18)",
                    border: "2px solid #FDE68A", zIndex: 100, minWidth: 200, overflow: "hidden",
                  }}>
                    <button
                      onClick={exportPDF}
                      style={{
                        width: "100%", padding: "14px 18px", textAlign: "left", border: "none",
                        background: "transparent", cursor: "pointer", fontSize: 15, fontWeight: 700,
                        color: "#374151", display: "block",
                      }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#FEF9E7")}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
                    >
                      📄 {t("exportPdf", lang)}
                    </button>
                    <button
                      onClick={exportCSV}
                      style={{
                        width: "100%", padding: "14px 18px", textAlign: "left", border: "none",
                        background: "transparent", cursor: "pointer", fontSize: 15, fontWeight: 700,
                        color: "#374151", borderTop: "1px solid #FEF3C7", display: "block",
                      }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#FEF9E7")}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
                    >
                      📊 {t("exportCsv", lang)}
                    </button>
                    <button
                      onClick={exportImage}
                      style={{
                        width: "100%", padding: "14px 18px", textAlign: "left", border: "none",
                        background: "transparent", cursor: "pointer", fontSize: 15, fontWeight: 700,
                        color: "#374151", borderTop: "1px solid #FEF3C7", display: "block",
                      }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#FEF9E7")}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
                    >
                      🖼️ {t("exportImage", lang)}
                    </button>
                  </div>
                )}
              </div>

              {/* 의견 나누기 button */}
              <button
                onClick={() => {
                  if (activeSessionId) setSessionMinimized(false);
                  else setShowDiscussionCreate(true);
                }}
                style={{
                  background: activeSessionId ? "#FEE2E2" : "#F5F3FF",
                  border: `2px solid ${activeSessionId ? "#FCA5A5" : "#DDD6FE"}`,
                  color: activeSessionId ? "#B91C1C" : "#6D28D9",
                  borderRadius: 16, padding: "10px 16px",
                  fontSize: 15, cursor: "pointer", fontWeight: 800, minHeight: 44,
                  transition: "transform 0.12s",
                }}
                onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.96)")}
                onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
              >
                {activeSessionId ? "🔴 진행 중" : "💭 의견 나누기"}
              </button>

              {/* 🎮 소통의 방 button */}
              <button
                onClick={() => setShowGameRoom(true)}
                style={{
                  background: "linear-gradient(135deg, #FBBF24, #F59E0B)",
                  border: "none",
                  color: "#fff", borderRadius: 16, padding: "10px 18px",
                  fontSize: 15, cursor: "pointer", fontWeight: 900, minHeight: 44,
                  boxShadow: "0 6px 18px rgba(245,158,11,0.4)",
                  transition: "transform 0.12s",
                }}
                onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.96)")}
                onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
              >
                🎮 소통의 방
              </button>

              {/* PPTX 번역 button */}
              <button
                onClick={() => setShowPptx(true)}
                style={{
                  background: "#FDF2F8", border: "2px solid #FBCFE8",
                  color: "#BE185D", borderRadius: 16, padding: "10px 16px",
                  fontSize: 15, cursor: "pointer", fontWeight: 800, minHeight: 44,
                  transition: "transform 0.12s",
                }}
                onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.96)")}
                onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
              >
                📊 PPTX 번역
              </button>

              {/* Manage button */}
              <button
                onClick={() => {
                  setRosterText((roomConfigState.roster || []).join("\n"));
                  setShowManage(true);
                }}
                style={{
                  background: "#FEF3C7", border: "2px solid #FDE68A",
                  color: "#B45309", borderRadius: 16, padding: "10px 18px",
                  fontSize: 15, cursor: "pointer", fontWeight: 800, minHeight: 44,
                  transition: "transform 0.12s",
                }}
                onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.96)")}
                onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
              >
                ⚙ {t("manage", lang)}
              </button>
            </>
          )}

          <button
            onClick={onLogout}
            style={{
              background: "#F9FAFB", border: "2px solid #E5E7EB",
              color: "#6B7280", borderRadius: 16, padding: "10px 16px",
              fontSize: 15, cursor: "pointer", fontWeight: 700, minHeight: 44,
              transition: "transform 0.12s",
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.96)")}
            onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            🚪 나가기
          </button>
        </div>
      </header>

      {/* ── Board ── */}
      <main
        ref={boardRef}
        onClick={() => { if (colDeleteActive) setColDeleteActive(null); }}
        style={{
          flex: 1, overflowX: "auto", overflowY: "hidden",
          display: "flex", gap: 14, padding: "16px 18px",
          alignItems: "flex-start",
          scrollSnapType: "x mandatory",
        }}
      >
        {columns.map((col) => {
          const colCards = visibleCards.filter((c) => c.colId === col.id);
          return (
            <div key={col.id} style={{
              width: "clamp(270px, 28vw, 330px)", flexShrink: 0, display: "flex", flexDirection: "column",
              height: "calc(100vh - 90px)", borderRadius: 22, overflow: "hidden",
              boxShadow: "0 4px 18px rgba(245,158,11,0.12), 0 1px 3px rgba(0,0,0,0.05)",
              background: "#fff", border: "2px solid #FEF3C7",
              scrollSnapAlign: "start",
            }}>
              <div style={{
                padding: "14px 18px 12px",
                display: "flex", alignItems: "center", gap: 12, flexShrink: 0,
                background: `linear-gradient(135deg, ${col.color}, ${col.color}dd)`,
                color: "#fff",
                boxShadow: `0 6px 16px ${col.color}55`,
              }}>
                {(() => {
                  const iconSrc = columnIconFor(col.title);
                  if (iconSrc) {
                    return (
                      <img
                        src={iconSrc}
                        alt=""
                        aria-hidden="true"
                        style={{
                          width: 42, height: 42, flexShrink: 0,
                          background: "rgba(255,255,255,0.9)", borderRadius: 12,
                          padding: 4, boxShadow: "0 3px 8px rgba(0,0,0,0.1)",
                        }}
                      />
                    );
                  }
                  return null;
                })()}
                <span style={{ flex: 1, fontWeight: 900, fontSize: 18, color: "#fff", letterSpacing: -0.3, lineHeight: 1.3, textShadow: "0 1px 2px rgba(0,0,0,0.12)" }}>{col.title.replace(/^[^A-Za-z가-힣]+/, "").trim()}</span>
                <span style={{ background: "rgba(255,255,255,0.3)", color: "#fff", borderRadius: 999, fontSize: 14, fontWeight: 900, padding: "4px 12px", minWidth: 32, textAlign: "center" }}>
                  {colCards.length}
                </span>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "14px 12px 6px", background: "#FFFEF7", scrollbarWidth: "thin", scrollbarColor: "#FDE68A transparent" }}>
                {colCards.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "44px 16px", color: "#D1D5DB" }}>
                    <img
                      src="/mascot/bee-sleep.png"
                      alt=""
                      aria-hidden="true"
                      style={{ width: 92, height: 92, display: "block", margin: "0 auto 12px", opacity: 0.85 }}
                    />
                    <div style={{ fontWeight: 800, color: "#6B7280", fontSize: 16 }}>{t("noPosts", lang)}</div>
                    <div style={{ fontSize: 14, marginTop: 6, color: "#9CA3AF", fontWeight: 600 }}>{t("addBelowHint", lang)}</div>
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
                      authorName={user.myName}
                      isPending={isTeacher && card.status === "pending"}
                      onEdit={() => setEditModal({ card, colTitle: col.title, colColor: col.color })}
                      onDelete={isTeacher ? () => deleteCard(card.id) : undefined}
                      roomCode={roomCode}
                      roomLangs={teacherLangs}
                      approvalMode={roomConfigState.approvalMode}
                    />
                  ))
                )}
              </div>

              <button
                onPointerDown={(e) => {
                  e.stopPropagation();
                  if (!isTeacher) return;
                  wasLongPress.current = false;
                  longPressTimer.current = setTimeout(() => {
                    wasLongPress.current = true;
                    setColDeleteActive(col.id);
                  }, 600);
                }}
                onPointerUp={() => {
                  if (longPressTimer.current) {
                    clearTimeout(longPressTimer.current);
                    longPressTimer.current = null;
                  }
                }}
                onPointerLeave={() => {
                  if (longPressTimer.current) {
                    clearTimeout(longPressTimer.current);
                    longPressTimer.current = null;
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (wasLongPress.current) { wasLongPress.current = false; return; }
                  if (colDeleteActive === col.id) {
                    deleteCol(col.id);
                    setColDeleteActive(null);
                    return;
                  }
                  setModal({ colId: col.id, colTitle: col.title, colColor: col.color });
                }}
                style={{
                  flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  background: isTeacher && colDeleteActive === col.id ? "#FEF2F2" : "#fff",
                  border: "none",
                  borderTop: isTeacher && colDeleteActive === col.id ? "1px solid #FECACA" : "1px solid #FEF3C7",
                  padding: "13px 0", cursor: "pointer",
                  color: isTeacher && colDeleteActive === col.id ? "#EF4444" : col.color,
                  fontWeight: 800, fontSize: 13,
                  transition: "background 0.15s, color 0.15s",
                  userSelect: "none",
                }}
                onMouseEnter={(e) => {
                  const btn = e.currentTarget as HTMLButtonElement;
                  btn.style.background = isTeacher && colDeleteActive === col.id ? "#FEE2E2" : col.color + "0D";
                }}
                onMouseLeave={(e) => {
                  const btn = e.currentTarget as HTMLButtonElement;
                  btn.style.background = isTeacher && colDeleteActive === col.id ? "#FEF2F2" : "#fff";
                }}
              >
                {isTeacher && colDeleteActive === col.id
                  ? <><span style={{ fontSize: 17, lineHeight: 1 }}>✕</span> 컬럼 삭제</>
                  : <><span style={{ fontSize: 17, lineHeight: 1, fontWeight: 400 }}>+</span> {t("addHere", lang)}</>
                }
              </button>
            </div>
          );
        })}
      </main>

      {/* ── Management modal ── */}
      {showManage && isTeacher && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(9,7,30,0.8)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 400, backdropFilter: "blur(8px)", padding: 20,
        }}
          role="dialog" aria-modal="true" aria-labelledby="modal-title-manage"
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
              borderBottom: "1px solid #FEF3C7", position: "sticky", top: 0, background: "#fff", zIndex: 1,
            }}>
              <div>
                <div id="modal-title-manage" style={{ fontWeight: 900, fontSize: 16, color: "#111827" }}>🛠 관리 패널</div>
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
                  padding: "12px 0", borderBottom: "1px solid #FEF3C7",
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
                      background: roomConfigState.qrEntry ? "#F59E0B" : "#E5E7EB",
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
                  padding: "12px 0", borderBottom: "1px solid #FEF3C7",
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
                      background: roomConfigState.approvalMode ? "#F59E0B" : "#E5E7EB",
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
                  padding: "12px 0", borderBottom: "1px solid #FEF3C7",
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
                      background: roomConfigState.rosterMode ? "#F59E0B" : "#E5E7EB",
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
                      onFocus={(e) => { e.target.style.borderColor = "#F59E0B"; e.target.style.background = "#fff"; }}
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
                        background: BRAND_GRADIENT, color: "#fff",
                        fontWeight: 800, fontSize: 13, cursor: "pointer",
                        boxShadow: "0 4px 14px rgba(245,158,11,0.35)",
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
                    background: "#FFFBEB", borderRadius: 14, padding: "12px 14px",
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
                          border: `1.5px solid ${active ? "#F59E0B" : "#E5E7EB"}`,
                          background: active ? "#EEEEFF" : "#F9FAFB",
                          color: active ? "#F59E0B" : "#9CA3AF",
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
                      e.target.style.borderColor = "#F59E0B";
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
                      background: newColTitle.trim() ? BRAND_GRADIENT : "#F3F4F6",
                      color: newColTitle.trim() ? "#fff" : "#D1D5DB",
                      fontWeight: 800, fontSize: 13, cursor: newColTitle.trim() ? "pointer" : "not-allowed",
                      boxShadow: newColTitle.trim() ? "0 4px 14px rgba(245,158,11,0.35)" : "none",
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

      {/* ── PPTX 번역 Modal ── */}
      {showPptx && isTeacher && (
        <PptxTranslateModal
          defaultFromLang={lang === "ko" ? "ko" : lang}
          defaultToLang={lang === "ko" ? "en" : "ko"}
          onClose={() => setShowPptx(false)}
        />
      )}

      {/* ── 🎮 소통의 방 ── */}
      {showGameRoom && (
        <GameRoom myLang={lang} onClose={() => setShowGameRoom(false)} />
      )}

      {/* ── 🎙️ 통역 도우미 Drawer ── */}
      <InterpreterDrawer
        open={interpreterOpen}
        onClose={() => setInterpreterOpen(false)}
        viewerLang={lang}
        availableLangs={teacherLangs.length > 0 ? teacherLangs : Object.keys(LANGUAGES)}
      />

      {/* ── 의견 나누기: 생성 모달 (교사) ── */}
      {showDiscussionCreate && isTeacher && (
        <DiscussionCreateModal
          roomCode={roomCode}
          teacherClientId={myClientId}
          teacherName={user.myName}
          teacherLang={lang}
          roomLangs={teacherLangs}
          onClose={() => setShowDiscussionCreate(false)}
        />
      )}

      {/* ── 의견 나누기: 활성 세션 오버레이 ── */}
      {activeSessionId && !sessionMinimized && (
        <DiscussionSession
          roomCode={roomCode}
          sessionId={activeSessionId}
          isTeacher={isTeacher}
          myClientId={myClientId}
          myName={user.myName}
          myLang={lang}
          onExit={() => setSessionMinimized(true)}
        />
      )}

      {/* ── QR Modal ── */}
      {showQR && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(9,7,30,0.8)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 400, backdropFilter: "blur(8px)", padding: 20,
        }}
          role="dialog" aria-modal="true" aria-labelledby="modal-title-qr"
          onClick={(e) => { if (e.target === e.currentTarget) setShowQR(false); }}
        >
          <div style={{
            background: "#fff", borderRadius: 24, padding: "36px 40px",
            maxWidth: 460, width: "100%", textAlign: "center",
            boxShadow: "0 32px 80px rgba(0,0,0,0.4)",
            animation: "fadeSlideIn 0.25s ease",
          }}>
            <h3 id="modal-title-qr" style={{ margin: "0 0 4px", fontWeight: 900, fontSize: 18, color: "#111827" }}>
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
                padding: "12px 32px", borderRadius: 12, background: BRAND_GRADIENT,
                color: "#fff", fontWeight: 800, border: "none", cursor: "pointer", fontSize: 14,
                boxShadow: "0 4px 16px rgba(245,158,11,0.4)",
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
          role="dialog" aria-modal="true" aria-labelledby="modal-title-approval"
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
              borderBottom: "1px solid #FEF3C7", position: "sticky", top: 0, background: "#fff", zIndex: 1,
            }}>
              <div>
                <div id="modal-title-approval" style={{ fontWeight: 900, fontSize: 16, color: "#111827" }}>🔔 {t("approvalPending", lang)}</div>
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
              {pendingItems.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#9CA3AF" }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                  <div style={{ fontWeight: 600 }}>승인 대기 중인 게시물이 없습니다</div>
                </div>
              ) : (
                pendingItems.map((item) => {
                  if (item.kind === "card") {
                    const card = item.data;
                    const col = columns.find((c) => c.id === card.colId);
                    return (
                      <div key={`card-${card.id}`} style={{
                        background: "#FFFBEB", border: "1px solid #FDE68A",
                        borderRadius: 12, padding: "14px 16px", marginBottom: 12,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>{card.authorName}</div>
                          <span style={{ fontSize: 11, color: "#9CA3AF" }}>→</span>
                          <div style={{ fontSize: 11, color: "#6B7280" }}>{col?.title || card.colId}</div>
                          <span style={{ fontSize: 10, background: "#FEF3C7", color: "#D97706", borderRadius: 6, padding: "1px 7px", fontWeight: 700, marginLeft: "auto" }}>
                            {t("approvalPending", lang)}
                          </span>
                        </div>
                        {card.cardType === "text" && (
                          <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, marginBottom: 10 }}>{card.originalText}</div>
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
                          <button onClick={() => approveCard(card.id)} style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "none", background: "#10B981", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                            ✅ {t("approve", lang)}
                          </button>
                          <button onClick={() => rejectCard(card.id)} style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "none", background: "#EF4444", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                            ❌ {t("reject", lang)}
                          </button>
                        </div>
                      </div>
                    );
                  } else {
                    // comment item
                    const comment = item.data;
                    const parentCard = item.parentCard;
                    const col = columns.find((c) => c.id === parentCard.colId);
                    return (
                      <div key={`comment-${comment.id}`} style={{
                        background: "#F0F9FF", border: "1px solid #BAE6FD",
                        borderRadius: 12, padding: "14px 16px", marginBottom: 12,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>💬 {comment.authorName}</div>
                          <span style={{ fontSize: 11, color: "#9CA3AF" }}>→</span>
                          <div style={{ fontSize: 11, color: "#6B7280" }}>{col?.title || parentCard.colId}</div>
                          <span style={{ fontSize: 10, background: "#DBEAFE", color: "#2563EB", borderRadius: 6, padding: "1px 7px", fontWeight: 700, marginLeft: "auto" }}>
                            {t("pendingComment", lang)}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 6, fontStyle: "italic" }}>
                          ↳ {parentCard.authorName}: {(parentCard.originalText || "").slice(0, 50)}{(parentCard.originalText || "").length > 50 ? "…" : ""}
                        </div>
                        <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, marginBottom: 10 }}>{comment.text}</div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => approveComment(parentCard.id, comment.id)} style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "none", background: "#10B981", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                            ✅ {t("approve", lang)}
                          </button>
                          <button onClick={() => rejectComment(parentCard.id, comment.id)} style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "none", background: "#EF4444", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                            ❌ {t("reject", lang)}
                          </button>
                        </div>
                      </div>
                    );
                  }
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

      {/* ── Undo Snackbar ── */}
      {undoToast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed", bottom: 24, left: "50%",
            transform: "translateX(-50%)",
            background: "#111827", color: "#fff",
            borderRadius: 12, padding: "12px 14px 12px 18px",
            display: "flex", alignItems: "center", gap: 12,
            boxShadow: "0 10px 40px rgba(0,0,0,0.35)",
            zIndex: 600, minWidth: 280, maxWidth: "90vw",
            fontSize: 14, fontWeight: 600,
            animation: "fadeSlideIn 0.2s ease",
          }}
        >
          <span style={{ fontSize: 16 }}>🗑</span>
          <span style={{ flex: 1 }}>{undoToast.message}</span>
          <button
            onClick={handleUndo}
            style={{
              background: "rgba(245,158,11,0.25)",
              border: "1px solid rgba(165,180,252,0.5)",
              color: "#FDE68A", borderRadius: 8,
              padding: "6px 12px", cursor: "pointer",
              fontWeight: 800, fontSize: 13,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(245,158,11,0.5)";
              (e.currentTarget as HTMLButtonElement).style.color = "#fff";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(245,158,11,0.25)";
              (e.currentTarget as HTMLButtonElement).style.color = "#FDE68A";
            }}
          >
            ↩ 되돌리기
          </button>
          <button
            onClick={dismissToast}
            aria-label="닫기"
            style={{
              background: "transparent", border: "none",
              color: "#9CA3AF", cursor: "pointer",
              fontSize: 14, padding: "4px 6px",
              lineHeight: 1,
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#fff")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#9CA3AF")}
          >
            ✕
          </button>
        </div>
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

      {/* ── ✏️ FAB: 아무 칼럼에 글쓰기 ── */}
      {!modal && !editModal && !showPptx && !showGameRoom && !showDiscussionCreate && !activeSessionId && columns.length > 0 && (
        <button
          onClick={() => {
            const first = columns[0];
            setModal({ colId: first.id, colTitle: first.title, colColor: first.color });
          }}
          aria-label="새 글 쓰기"
          style={{
            position: "fixed", right: "clamp(16px, 3vw, 28px)", bottom: "clamp(16px, 3vw, 28px)",
            width: 68, height: 68, borderRadius: "50%", border: "none",
            background: "linear-gradient(135deg, #F59E0B, #D97706)",
            color: "#fff", fontSize: 30, fontWeight: 900,
            boxShadow: "0 12px 32px rgba(245,158,11,0.55), inset 0 -4px 0 rgba(0,0,0,0.15)",
            cursor: "pointer", zIndex: 150, display: "flex", alignItems: "center", justifyContent: "center",
            transition: "transform 0.12s",
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.94)")}
          onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          ✏️
        </button>
      )}
    </div>
  );
}
