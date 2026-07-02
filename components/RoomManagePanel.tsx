"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { ref, onValue, off, set } from "firebase/database";
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
  const [config, setConfig] = useState<RoomConfig>({ languages: [] });
  const [rosterText, setRosterText] = useState("");
  const [rosterSeeded, setRosterSeeded] = useState(false);

  const teacherLangs = config.languages || [];

  // ── columns: 기본 컬럼 시딩만 담당 ──
  // 컬럼 관리(이름·색·순서·삭제·추가)는 소통판 안으로 완전 이전됨 (설계서 항목 2):
  // 컬럼 헤더 ⚙ 팝오버 + 제목 더블클릭 삭제 + 보드 끝 ＋ 추가.
  useEffect(() => {
    const db = getClientDb();
    const colsRef = ref(db, `rooms/${roomCode}/columns`);
    onValue(colsRef, (snap) => {
      if (!snap.val()) {
        // 방에 컬럼이 없으면 기본 컬럼 시딩
        const defaults: Record<string, Omit<FirebaseColumn, "id">> = {};
        COLUMNS_DEFAULT.forEach((col, i) => {
          defaults[col.id] = { title: col.title, color: col.color, order: i };
        });
        set(colsRef, defaults);
      }
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

      {/* 컬럼 관리는 소통판(보드) 안으로 완전 이전됨 (설계서 항목 2) */}
      <div style={{
        background: "#FFFBEB", border: "1px dashed #FDE68A", borderRadius: 12,
        padding: "10px 14px", marginBottom: 20,
        fontSize: 12, fontWeight: 700, color: "#92400E", lineHeight: 1.6,
      }}>
        💡 컬럼(주제) 관리는 이제 소통판에서 바로 해요.<br />
        · 컬럼 위 <b>⚙</b> — 이름·색·순서 바꾸기<br />
        · 컬럼 제목 <b>더블클릭</b> — 삭제 (경고 후, 8초 안에 되돌리기 가능)<br />
        · 보드 맨 오른쪽 <b>＋</b> — 새 컬럼 추가
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

    </div>
  );
}
