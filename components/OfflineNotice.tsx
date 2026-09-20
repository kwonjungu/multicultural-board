"use client";
/**
 * 오프라인(로컬 목 DB) 모드 안내 배너.
 * lib/db.ts 가 오프라인 판정 시 window 에 "db-offline-mode" 이벤트를 쏜다.
 * 심사 환경에서 인터넷이 없어도 무엇이 되고 안 되는지 즉시 알 수 있게 한다.
 */
import { useEffect, useState } from "react";
import { isOfflineMode } from "@/lib/db";

export default function OfflineNotice() {
  const [offline, setOffline] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isOfflineMode() === true) setOffline(true);
    const on = () => setOffline(true);
    window.addEventListener("db-offline-mode", on);
    return () => window.removeEventListener("db-offline-mode", on);
  }, []);

  if (!offline || dismissed) return null;
  return (
    <div
      role="status"
      style={{
        position: "fixed",
        top: 8,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        maxWidth: "min(92vw, 640px)",
        background: "#fffbe8",
        border: "2px solid #e0b400",
        borderRadius: 12,
        padding: "8px 14px",
        fontSize: 13,
        fontWeight: 700,
        color: "#6b5300",
        boxShadow: "0 4px 14px rgba(0,0,0,.12)",
        display: "flex",
        gap: 10,
        alignItems: "center",
      }}
    >
      <span aria-hidden>📴</span>
      <span style={{ wordBreak: "keep-all" }}>
        오프라인 모드로 실행 중입니다 — 소통 게임·단어 카드·그림책 읽기 등 로컬
        기능을 체험할 수 있어요. AI 번역·챗봇·그림책 생성은 인터넷 연결 시
        동작합니다.
      </span>
      <button
        onClick={() => setDismissed(true)}
        aria-label="안내 닫기"
        style={{
          border: "none",
          background: "transparent",
          fontSize: 16,
          fontWeight: 900,
          color: "#a08300",
          cursor: "pointer",
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}
