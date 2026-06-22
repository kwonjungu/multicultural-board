"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { ref, onValue, off, set, remove } from "firebase/database";
import { getClientDb } from "@/lib/firebase-client";
import { COLUMNS_DEFAULT, LANGUAGES, BRAND_GRADIENT } from "@/lib/constants";
import { RoomConfig } from "@/lib/types";
import { t } from "@/lib/i18n";

interface FirebaseColumn {
  id: string;
  title: string;
  color: string;
  order: number;
}

const COL_COLORS = [
  "#F59E0B", "#FF6584", "#43C59E", "#F59E0B", "#3B82F6",
  "#D97706", "#EC4899", "#14B8A6", "#F97316", "#10B981",
];

interface Props {
  roomCode: string;
  lang: string;
}

/**
 * 교사용 방 관리 패널 (자체 완결형).
 * config / columns 를 직접 구독·수정하므로 어디서든 단독으로 렌더 가능.
 * 시작화면(HomeHub) 과 소통창(PadletBoard) 어디서나 동일 동작.
 */
export default function RoomManagePanel({ roomCode, lang }: Props) {
  const [columns, setColumns] = useState<FirebaseColumn[]>([]);
  const [config, setConfig] = useState<RoomConfig>({ languages: [] });
  const [editTitle, setEditTitle] = useState<Record<string, string>>({});
  const [newColTitle, setNewColTitle] = useState("");
  const [newColColor, setNewColColor] = useState(COL_COLORS[0]);
  const [rosterText, setRosterText] = useState("");
  const [rosterSeeded, setRosterSeeded] = useState(false);

  const teacherLangs = config.languages || [];

  // ── columns 구독 ──
  useEffect(() => {
    const db = getClientDb();
    const colsRef = ref(db, `rooms/${roomCode}/columns`);
    onValue(colsRef, (snap) => {
      const data = snap.val();
      if (!data) {
        // 방에 컬럼이 없으면 기본 컬럼 시딩
        const defaults: Record<string, Omit<FirebaseColumn, "id">> = {};
        COLUMNS_DEFAULT.forEach((col, i) => {
          defaults[col.id] = { title: col.title, color: col.color, order: i };
        });
        set(colsRef, defaults);
        return;
      }
      const list: FirebaseColumn[] = Object.entries(data).map(([id, val]) => ({
        id,
        ...(val as Omit<FirebaseColumn, "id">),
      }));
      list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setColumns(list);
      const initEdit: Record<string, string> = {};
      list.forEach((c) => { initEdit[c.id] = c.title; });
      setEditTitle(initEdit);
    });
    return () => off(colsRef);
  }, [roomCode]);

  // ── config 구독 ──
  useEffect(() => {
    const db = getClientDb();
    const configRef = ref(db, `rooms/${roomCode}/config`);
    onValue(configRef, (snap) => {
      const val = snap.val() as RoomConfig | null;
      if (!val) return;
      if (val.roster && !Array.isArray(val.roster)) {
        val.roster = Object.values(val.roster as unknown as Record<string, string>);
      }
      if (val.languages && !Array.isArray(val.languages)) {
        val.languages = Object.values(val.languages as unknown as Record<string, string>);
      }
      setConfig(val);
      // 명렬표 textarea 는 최초 1회만 시딩 (사용자 편집 보존)
      setRosterSeeded((seeded) => {
        if (!seeded) setRosterText((val.roster || []).join("\n"));
        return true;
      });
    });
    return () => off(configRef);
  }, [roomCode]);

  // ── actions ──
  function toggleConfig(key: "qrEntry" | "approvalMode" | "rosterMode") {
    const db = getClientDb();
    set(ref(db, `rooms/${roomCode}/config/${key}`), !config[key]);
  }

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
    if (!confirm(`"${col.title}" 컬럼을 삭제할까요? 안의 카드도 보이지 않게 됩니다.`)) return;
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

  function saveRoster() {
    const db = getClientDb();
    const names = rosterText.split("\n").map((s) => s.trim()).filter(Boolean);
    set(ref(db, `rooms/${roomCode}/config/roster`), names);
  }

  function toggleLang(code: string) {
    const active = teacherLangs.includes(code);
    const next = active ? teacherLangs.filter((l) => l !== code) : [...teacherLangs, code];
    if (next.length === 0) return;
    const db = getClientDb();
    set(ref(db, `rooms/${roomCode}/config/languages`), next);
  }

  const sectionLabel: CSSProperties = {
    fontSize: 11, fontWeight: 800, color: "#9CA3AF", letterSpacing: 1, marginBottom: 12,
  };

  function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
    return (
      <button
        onClick={onClick}
        style={{
          width: 48, height: 26, borderRadius: 13, border: "none", cursor: "pointer",
          background: on ? "#F59E0B" : "#E5E7EB",
          position: "relative", transition: "background 0.2s", flexShrink: 0,
        }}
      >
        <div style={{
          position: "absolute", top: 3, left: on ? 25 : 3,
          width: 20, height: 20, borderRadius: "50%", background: "#fff",
          transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }} />
      </button>
    );
  }

  return (
    <div>
      {/* Section: Room Settings */}
      <div style={{ marginBottom: 20 }}>
        <div style={sectionLabel}>방 설정</div>

        {[
          { key: "qrEntry" as const, label: t("qrEntryToggle", lang) },
          { key: "approvalMode" as const, label: t("approvalMode", lang) },
          { key: "rosterMode" as const, label: t("rosterMode", lang) },
        ].map((row) => (
          <div key={row.key} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 0", borderBottom: "1px solid #FEF3C7",
          }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>{row.label}</div>
            <Toggle on={!!config[row.key]} onClick={() => toggleConfig(row.key)} />
          </div>
        ))}

        {/* Roster textarea (rosterMode on) */}
        {config.rosterMode && (
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
              onClick={saveRoster}
              style={{
                marginTop: 8, padding: "9px 20px", borderRadius: 10, border: "none",
                background: BRAND_GRADIENT, color: "#fff",
                fontWeight: 800, fontSize: 13, cursor: "pointer",
                boxShadow: "0 4px 14px rgba(245,158,11,0.35)",
              }}
            >저장</button>
          </div>
        )}
      </div>

      {/* Section: Column management */}
      <div style={sectionLabel}>컬럼 관리</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {columns.map((col, idx) => (
          <div key={col.id} style={{
            background: "#FFFBEB", borderRadius: 14, padding: "12px 14px",
            border: "1px solid #E9ECF5",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
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

              <div style={{
                width: 12, height: 12, borderRadius: "50%", background: col.color,
                flexShrink: 0, boxShadow: `0 0 0 3px ${col.color}33`,
              }} />

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
        <div style={{ ...sectionLabel, marginBottom: 10 }}>언어 설정 (학생 입장 시 보이는 언어)</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {Object.entries(LANGUAGES).map(([code, info]) => {
            const active = teacherLangs.includes(code);
            return (
              <button
                key={code}
                onClick={() => toggleLang(code)}
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
        <div style={{ ...sectionLabel, marginBottom: 10 }}>새 컬럼 추가</div>
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
            onFocus={(e) => { e.target.style.borderColor = "#F59E0B"; e.target.style.background = "#fff"; }}
            onBlur={(e) => { e.target.style.borderColor = "#E5E7EB"; e.target.style.background = "#F9FAFB"; }}
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
  );
}
