"use client";

// 앱 전역 플로팅 "실시간 통역" 버튼.
// 튜터 꿀비(우하단)와 대칭으로 좌하단에 떠서, 모든 허브 화면에서 통역 도우미를
// 열 수 있다. (예전에는 허브 타일/소통창 내부 버튼으로만 진입했음 → 전역화.)

import { useState } from "react";
import InterpreterDrawer from "./InterpreterDrawer";
import { useBackLayer } from "@/lib/backStack";

const L_LABEL: Record<string, string> = {
  ko: "실시간 통역", en: "Live Interpreter", vi: "Phiên dịch trực tiếp",
  zh: "实时翻译", fil: "Live na Interpreter", ja: "リアルタイム通訳",
  th: "ล่ามแบบเรียลไทม์", km: "អ្នកបកប្រែផ្ទាល់", mn: "Шууд орчуулга",
  ru: "Живой переводчик", uz: "Jonli tarjimon", hi: "लाइव अनुवादक",
  id: "Penerjemah Langsung", ar: "مترجم مباشر", my: "တိုက်ရိုက် ဘာသာပြန်",
};

export default function InterpreterFab({
  viewerLang,
  availableLangs,
  hidden,
}: {
  viewerLang: string;
  availableLangs: string[];
  /** 전체화면 인터랙티브 뷰(게임룸 등)에서는 숨김 — 좌하단 버튼이 화면을 가리지 않도록 */
  hidden?: boolean;
}) {
  const [open, setOpen] = useState(false);

  // 뒤로 가기 한 번이면 통역 드로어를 닫는다 (사이트 이탈 방지).
  useBackLayer(open, () => setOpen(false));

  if (hidden) return null;

  const label = L_LABEL[viewerLang] || L_LABEL.ko;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label={label}
          title={label}
          style={{
            // zIndex 는 전체화면 뷰(게임룸 460·토론 450·모달 400)보다 낮게 —
            // 튜터 꿀비(우하단 bottom 84 · 60px) 바로 위에 세로로 쌓는다.
            position: "fixed", bottom: 156, right: 18, zIndex: 300,
            width: 60, height: 60, borderRadius: "50%",
            border: "3px solid #BFDBFE",
            background: "linear-gradient(135deg, #3B82F6, #2563EB)",
            boxShadow: "0 8px 20px rgba(30,64,175,0.4)",
            fontSize: 28, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 4,
          }}
        >
          <img
            src="/mascot/bee-headset.png"
            alt=""
            aria-hidden="true"
            onError={(e) => { (e.currentTarget as HTMLImageElement).outerHTML = "🎙️"; }}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        </button>
      )}

      <InterpreterDrawer
        open={open}
        onClose={() => setOpen(false)}
        viewerLang={viewerLang}
        availableLangs={availableLangs}
      />
    </>
  );
}
