"use client";

// 문화카드 — 모서리/중앙 칸에 멈추면 세계 인사말 카드가 뜬다.
// 나라 데이터는 다문화 지구본과 공유 (lib/globeData).
// 닫기는 cultureNode 만 지우며 턴 흐름과 무관 (더블탭 무해).

import React from "react";
import { flagUrlFor, globeCountryName, type GlobeCountry } from "@/lib/globeData";
import { LANGUAGES } from "@/lib/constants";
import { speak } from "@/lib/ttsMulti";

export default function CultureCard({
  country, viewerLang, onClose,
}: {
  country: GlobeCountry;
  viewerLang: string;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 500,
        background: "rgba(15,10,40,0.6)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(380px, 100%)",
          background: "#fff", borderRadius: 24,
          border: "4px solid #FDE68A",
          boxShadow: "0 20px 50px rgba(0,0,0,0.45)",
          padding: "22px 20px", textAlign: "center",
          animation: "cultureUp 0.3s ease-out",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 900, color: "#B45309", letterSpacing: 1, marginBottom: 10 }}>
          🌍 세계 인사 카드
        </div>
        <img
          src={country.landmark}
          alt=""
          aria-hidden="true"
          style={{ width: 110, height: 110, objectFit: "contain", filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.2))" }}
        />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8 }}>
          <img
            src={flagUrlFor(country.code, "w80")}
            alt=""
            aria-hidden="true"
            style={{ width: 32, height: "auto", borderRadius: 4, boxShadow: "0 1px 4px rgba(0,0,0,0.25)" }}
          />
          <div style={{ fontSize: 19, fontWeight: 900, color: "#1F2937" }}>
            {globeCountryName(country, viewerLang)}
          </div>
        </div>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#6B7280", marginTop: 2 }}>
          {LANGUAGES[country.lang]?.label}
        </div>
        <button
          onClick={() => speak(country.hello, country.lang)}
          style={{
            marginTop: 12,
            background: "linear-gradient(135deg, #F59E0B, #D97706)",
            border: "none", color: "#fff", borderRadius: 99,
            padding: "12px 26px", fontSize: 18, fontWeight: 900, cursor: "pointer",
            boxShadow: "0 6px 16px rgba(245,158,11,0.45)",
          }}
        >
          🔊 {country.hello}
        </button>
        <div>
          <button
            onClick={onClose}
            style={{
              marginTop: 14, background: "#F3F4F6", border: "none",
              color: "#374151", borderRadius: 14, padding: "10px 28px",
              fontSize: 14, fontWeight: 900, cursor: "pointer",
            }}
          >
            계속 하기 →
          </button>
        </div>
        <style>{`
          @keyframes cultureUp {
            from { transform: translateY(26px) scale(0.95); opacity: 0; }
            to { transform: translateY(0) scale(1); opacity: 1; }
          }
        `}</style>
      </div>
    </div>
  );
}
