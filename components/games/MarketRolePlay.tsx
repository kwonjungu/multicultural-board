"use client";

import { useState } from "react";
import { LANGUAGES } from "@/lib/constants";
import BeeMascot from "../BeeMascot";

type Step = {
  speaker: "shop" | "you";
  line: Record<string, string>;
  options?: { text: Record<string, string>; good: boolean }[];
};

const SCENE: Step[] = [
  {
    speaker: "shop",
    line: {
      ko: "어서 오세요! 무엇을 드릴까요?",
      en: "Welcome! What would you like?",
      vi: "Xin mời! Bạn muốn mua gì?",
      zh: "欢迎光临！您想要什么？",
      ja: "いらっしゃいませ！何にしますか？",
      th: "ยินดีต้อนรับ! รับอะไรดีคะ?",
      id: "Selamat datang! Mau beli apa?",
      hi: "स्वागत है! आप क्या लेंगे?",
      ru: "Добро пожаловать! Что хотите?",
      ar: "أهلا! ماذا تريد؟",
      fil: "Magandang araw! Ano po ang kukunin?",
      km: "សូមស្វាគមន៍! តើចង់បានអ្វី?",
      mn: "Тавтай морил! Юу авах вэ?",
      uz: "Xush kelibsiz! Nima olasiz?",
      my: "ကြိုဆိုပါတယ်! ဘာလိုချင်ပါသလဲ?",
    },
  },
  {
    speaker: "you",
    line: { ko: "", en: "" },
    options: [
      { text: { ko: "사과 두 개 주세요.", en: "Two apples please.", vi: "Cho tôi hai quả táo.", zh: "请给我两个苹果。", ja: "りんごを二つください。", th: "ขอแอปเปิ้ลสองลูก", id: "Tolong dua apel.", hi: "दो सेब दीजिए।", ru: "Два яблока, пожалуйста.", ar: "تفاحتان من فضلك.", fil: "Dalawang mansanas po.", km: "សូមផ្លែប៉ោមពីរ", mn: "Хоёр алим өгнө үү.", uz: "Ikki olma bering.", my: "ပန်းသီးနှစ်လုံးပေးပါ" }, good: true },
      { text: { ko: "안녕!", en: "Bye!", vi: "Tạm biệt!", zh: "再见！", ja: "さよなら！", th: "ลาก่อน", id: "Selamat tinggal!", hi: "अलविदा!", ru: "Пока!", ar: "وداعا!", fil: "Paalam!", km: "លាហើយ!", mn: "Баяртай!", uz: "Xayr!", my: "ဘိုင်ဘိုင်!" }, good: false },
    ],
  },
  {
    speaker: "shop",
    line: {
      ko: "네, 2000원이에요.",
      en: "Sure, that is 2000 won.",
      vi: "Được, 2000 won.",
      zh: "好的，2000韩元。",
      ja: "はい、2000ウォンです。",
      th: "ได้ค่ะ 2000 วอน",
      id: "Oke, 2000 won.",
      hi: "ठीक है, 2000 वॉन।",
      ru: "Хорошо, 2000 вон.",
      ar: "حسنا، 2000 وون.",
      fil: "Sige, 2000 won.",
      km: "យល់ព្រម 2000 វ៉ុន។",
      mn: "За, 2000 вон.",
      uz: "Yaxshi, 2000 von.",
      my: "ဟုတ်ကဲ့၊ 2000 ဝမ်ပါ။",
    },
  },
  {
    speaker: "you",
    line: { ko: "", en: "" },
    options: [
      { text: { ko: "여기 있어요. 감사합니다!", en: "Here you go. Thank you!", vi: "Đây ạ. Cảm ơn!", zh: "给您。谢谢！", ja: "はい、ありがとう！", th: "นี่ค่ะ ขอบคุณ!", id: "Ini. Terima kasih!", hi: "ये लीजिए। धन्यवाद!", ru: "Вот. Спасибо!", ar: "تفضل. شكرا!", fil: "Heto po. Salamat!", km: "នេះ! អរគុណ!", mn: "Энд байна. Баярлалаа!", uz: "Mana. Rahmat!", my: "ဒါပေးမယ်။ ကျေးဇူး!" }, good: true },
      { text: { ko: "음...", en: "Hmm...", vi: "Ừm...", zh: "嗯……", ja: "うーん…", th: "เอ่อ…", id: "Hmm…", hi: "हम्म…", ru: "Хм…", ar: "آه…", fil: "Hmm…", km: "អ៊ឺ…", mn: "Хмм…", uz: "Hmm…", my: "အင်း…" }, good: false },
    ],
  },
];

export default function MarketRolePlay({ langA, langB }: { langA: string; langB: string }) {
  const [idx, setIdx] = useState(0);
  const [picks, setPicks] = useState<number[]>([]);
  const [finished, setFinished] = useState(false);

  function playTts(text: string, lang: string) {
    new Audio(`/api/tts?text=${encodeURIComponent(text)}&lang=${lang}`).play().catch(() => {});
  }

  function handlePick(opIdx: number) {
    setPicks((p) => [...p, opIdx]);
    if (idx + 1 >= SCENE.length) setFinished(true);
    else setIdx(idx + 1);
  }

  if (finished) {
    const good = picks.filter((_, i) => {
      const step = SCENE.filter((s) => s.speaker === "you")[i];
      return step?.options?.[picks[i]]?.good;
    }).length;
    const total = SCENE.filter((s) => s.speaker === "you").length;
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <BeeMascot size={120} mood={good === total ? "cheer" : "happy"} />
        <div style={{ fontSize: 24, fontWeight: 900, marginTop: 14 }}>
          🛒 {good === total ? "완벽한 대화!" : `${good} / ${total}`}
        </div>
      </div>
    );
  }

  const cur = SCENE[idx];

  return (
    <div style={{ padding: "16px 16px 40px", maxWidth: 560, margin: "0 auto" }}>
      <div style={{ textAlign: "center", fontSize: 12, color: "#6B7280", fontWeight: 700, marginBottom: 12 }}>
        🍎 시장 역할극
      </div>

      {/* Dialogue history */}
      {SCENE.slice(0, idx).map((step, i) => {
        const chosen = step.speaker === "you" && step.options ? step.options[picks[Math.floor(i / 2)] ?? 0] : null;
        const text = chosen ? chosen.text : step.line;
        const isShop = step.speaker === "shop";
        return (
          <div key={i} style={{
            display: "flex", justifyContent: isShop ? "flex-start" : "flex-end",
            marginBottom: 10,
          }}>
            <div style={{
              maxWidth: "80%", padding: "10px 14px", borderRadius: 14,
              background: isShop ? "#F3F4F6" : "#DBEAFE",
              fontSize: 14, fontWeight: 600, color: "#111827",
            }}>
              <div>{text[langA]}</div>
              <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>{text[langB]}</div>
            </div>
          </div>
        );
      })}

      {cur.speaker === "shop" ? (
        <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 12 }}>
          <div style={{
            maxWidth: "80%", padding: "14px 16px", borderRadius: 14,
            background: "#FEF3C7", fontSize: 14, fontWeight: 700,
          }}>
            <div style={{ fontSize: 11, color: "#D97706", fontWeight: 800, marginBottom: 4 }}>
              🧑‍🌾 {LANGUAGES[langA]?.flag} 상인
            </div>
            <div>{cur.line[langA]}</div>
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>{cur.line[langB]}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button onClick={() => playTts(cur.line[langA], langA)} style={tinyBtn}>🔊 {langA.toUpperCase()}</button>
              <button onClick={() => playTts(cur.line[langB], langB)} style={tinyBtn}>🔊 {langB.toUpperCase()}</button>
            </div>
          </div>
        </div>
      ) : null}

      {cur.speaker === "shop" && (
        <button
          onClick={() => setIdx((i) => i + 1)}
          style={{
            width: "100%", background: "#F59E0B", color: "#fff", border: "none",
            padding: 12, borderRadius: 14, fontSize: 14, fontWeight: 800, cursor: "pointer",
          }}
        >다음 →</button>
      )}

      {cur.speaker === "you" && cur.options && (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 700, textAlign: "center" }}>
            👉 뭐라고 대답할까요?
          </div>
          {cur.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => handlePick(i)}
              style={{
                padding: "12px 14px", borderRadius: 14,
                border: "2px solid #E5E7EB", background: "#fff",
                cursor: "pointer", fontSize: 14, fontWeight: 700, color: "#111827",
                textAlign: "left",
              }}
            >
              <div>{opt.text[langA]}</div>
              <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{opt.text[langB]}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const tinyBtn: React.CSSProperties = {
  background: "#fff", border: "1px solid #E5E7EB",
  padding: "4px 10px", borderRadius: 99, cursor: "pointer",
  fontSize: 11, fontWeight: 700, color: "#374151",
};
