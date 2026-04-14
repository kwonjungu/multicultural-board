"use client";

import { useEffect, useRef, useState } from "react";
import { LANGUAGES, COLUMNS_DEFAULT } from "@/lib/constants";
import { UserConfig } from "@/lib/types";

interface Props {
  colId: string;
  user: UserConfig;
  posting: boolean;
  onPost: (text: string, writeLang: string) => void;
  onClose: () => void;
}

export default function PostModal({ colId, user, posting, onPost, onClose }: Props) {
  const [inputText, setInputText] = useState("");
  const [writeLang, setWriteLang] = useState(user.myLang);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const col = COLUMNS_DEFAULT.find((c) => c.id === colId);

  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 80);
  }, []);

  const langOptions = user.isTeacher ? user.teacherLangs : Object.keys(LANGUAGES);

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(15,12,41,0.72)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        zIndex: 200, backdropFilter: "blur(5px)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "#fff", borderRadius: "22px 22px 0 0",
        width: "100%", maxWidth: 560, padding: "22px 22px 36px",
        boxShadow: "0 -12px 48px rgba(0,0,0,0.25)",
        animation: "slideUp 0.22s ease",
      }}>
        {/* 헤더 */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{
            width: 10, height: 10, borderRadius: "50%",
            background: col?.color, flexShrink: 0,
          }} />
          <span style={{ fontWeight: 900, fontSize: 14, color: "#1a1a1a", flex: 1 }}>
            {col?.title}
          </span>
          <button
            onClick={onClose}
            style={{
              background: "#f2f2f2", border: "none", borderRadius: "50%",
              width: 28, height: 28, fontSize: 13, cursor: "pointer", color: "#777",
            }}
          >
            ✕
          </button>
        </div>

        {/* 작성 언어 선택 */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#bbb", fontWeight: 700 }}>작성 언어</span>
          {langOptions.map((l) => (
            <button
              key={l}
              onClick={() => setWriteLang(l)}
              style={{
                padding: "5px 12px", borderRadius: 16, fontSize: 12,
                border: `2px solid ${writeLang === l ? col?.color : "#eee"}`,
                background: writeLang === l ? (col?.color || "#6C63FF") + "18" : "#fafafa",
                color: writeLang === l ? col?.color : "#aaa",
                fontWeight: writeLang === l ? 800 : 400, cursor: "pointer",
                transition: "all 0.12s",
              }}
            >
              {LANGUAGES[l]?.flag} {LANGUAGES[l]?.label}
            </button>
          ))}
        </div>

        {/* 입력 */}
        <textarea
          ref={textareaRef}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) onPost(inputText, writeLang);
          }}
          placeholder={`${LANGUAGES[writeLang]?.flag} ${LANGUAGES[writeLang]?.label}로 입력하면 자동으로 번역됩니다...`}
          rows={4}
          style={{
            width: "100%", padding: "13px 15px", borderRadius: 14,
            border: "2px solid #e5e5e5", fontSize: 15, resize: "none",
            boxSizing: "border-box", fontFamily: "inherit", lineHeight: 1.65,
            outline: "none", transition: "border-color 0.18s", color: "#1a1a1a",
          }}
          onFocus={(e) => (e.target.style.borderColor = col?.color || "#6C63FF")}
          onBlur={(e) => (e.target.style.borderColor = "#e5e5e5")}
        />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
          <span style={{ fontSize: 11, color: "#ccc" }}>
            Ctrl+Enter · 자동 번역 포함
          </span>
          <button
            onClick={() => onPost(inputText, writeLang)}
            disabled={posting || !inputText.trim()}
            style={{
              padding: "11px 26px", borderRadius: 13, fontSize: 14,
              background:
                posting || !inputText.trim()
                  ? "#e8e8e8"
                  : `linear-gradient(135deg, ${col?.color}, #9B59B6)`,
              color: posting || !inputText.trim() ? "#bbb" : "#fff",
              fontWeight: 900, border: "none",
              cursor: posting || !inputText.trim() ? "not-allowed" : "pointer",
              boxShadow:
                !posting && inputText.trim()
                  ? `0 4px 16px ${col?.color}44`
                  : "none",
              transition: "all 0.18s",
            }}
          >
            {posting ? "⟳ 번역 중..." : "게시하기 📤"}
          </button>
        </div>
      </div>
    </div>
  );
}
