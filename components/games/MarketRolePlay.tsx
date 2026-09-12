"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LANGUAGES } from "@/lib/constants";
import BeeMascot from "../BeeMascot";
import ScopedStyle from "../ui/child/ScopedStyle";

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
  const audioRef = useRef<HTMLAudioElement | null>(null);

  /** 새 음성 전에 이전 음성을 반드시 멈춘다. unmount cleanup 도 이걸 부른다. */
  const stopAudio = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    try { a.pause(); a.currentTime = 0; } catch { /* 이미 정리된 엘리먼트 */ }
    audioRef.current = null;
  }, []);

  useEffect(() => {
    return () => { stopAudio(); };
  }, [stopAudio]);

  const playTts = useCallback((text: string, lang: string) => {
    stopAudio();
    const a = new Audio(`/api/tts?text=${encodeURIComponent(text)}&lang=${lang}`);
    audioRef.current = a;
    a.play().catch(() => { /* 소리가 없어도 글자로 계속 읽을 수 있다 */ });
  }, [stopAudio]);

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
      <div data-ux-root className="mk-root mk-center">
        <ScopedStyle css={MK_CSS} />
        <BeeMascot size={120} mood={good === total ? "cheer" : "happy"} />
        <h1 data-ux-role="title">
          🛒 {good === total ? "완벽한 대화!" : `${good} / ${total}`}
        </h1>
      </div>
    );
  }

  const cur = SCENE[idx];

  return (
    <div data-ux-root className="mk-root">
      <ScopedStyle css={MK_CSS} />
      <p data-ux-role="label" className="mk-kicker">🍎 시장 역할극</p>

      <div className="mk-play">
        <div className="mk-thread">
          {/* Dialogue history */}
          {SCENE.slice(0, idx).map((step, i) => {
            const chosen = step.speaker === "you" && step.options ? step.options[picks[Math.floor(i / 2)] ?? 0] : null;
            const text = chosen ? chosen.text : step.line;
            const isShop = step.speaker === "shop";
            return (
              <div key={i} className="mk-row" data-side={isShop ? "shop" : "you"}>
                <div className="mk-bubble" data-side={isShop ? "shop" : "you"}>
                  <p data-ux-role="body">{text[langA]}</p>
                  <p data-ux-role="secondary">{text[langB]}</p>
                </div>
              </div>
            );
          })}

          {cur.speaker === "shop" && (
            <div className="mk-row" data-side="shop">
              <div className="mk-bubble" data-side="now">
                <p data-ux-role="label" className="mk-who">
                  🧑‍🌾 {LANGUAGES[langA]?.flag} 상인
                </p>
                <p data-ux-role="body-emphasis" data-ux-reading>{cur.line[langA]}</p>
                <p data-ux-role="secondary" data-ux-reading>{cur.line[langB]}</p>
                <div className="mk-listenrow">
                  <button data-ux-role="control" className="mk-listen" onClick={() => playTts(cur.line[langA], langA)}>
                    🔊 {langA.toUpperCase()}
                  </button>
                  <button data-ux-role="control" className="mk-listen" onClick={() => playTts(cur.line[langB], langB)}>
                    🔊 {langB.toUpperCase()}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mk-actions">
          {cur.speaker === "shop" && (
            <button data-ux-role="action" className="mk-primary" onClick={() => setIdx((i) => i + 1)}>
              다음 →
            </button>
          )}

          {cur.speaker === "you" && cur.options && (
            <>
              <p data-ux-role="body-emphasis" className="mk-ask">👉 뭐라고 대답할까요?</p>
              <div className="mk-choices">
                {cur.options.map((opt, i) => (
                  <button key={i} data-ux-role="control" className="mk-choice" onClick={() => handlePick(i)}>
                    <span data-ux-role="label">{opt.text[langA]}</span>
                    <span data-ux-role="secondary">{opt.text[langB]}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* 글자 크기는 전부 토큰. 여기에 px 글자 크기를 다시 쓰지 말 것. */
const MK_CSS = `
.mk-root{
  color: var(--ux-ink);
  padding: var(--ux-space-4) var(--ux-space-4) var(--ux-space-8);
  width: 100%; max-width: 1200px; margin: 0 auto; box-sizing: border-box;
}
.mk-center{ display: grid; justify-items: center; gap: var(--ux-space-3); text-align: center; padding-top: var(--ux-space-8); }
.mk-kicker{ display: block; text-align: center; color: var(--ux-ink-soft); margin: 0 0 var(--ux-space-4); }

/* 넓은 화면: 대화는 왼쪽, 지금 고를 것은 오른쪽에 붙여 둔다. */
.mk-play{ display: grid; gap: var(--ux-space-4); }
@media (min-width: 900px){ .mk-play{ grid-template-columns: minmax(0, 1fr) minmax(0, 380px); align-items: start; } }

.mk-thread{ display: grid; gap: var(--ux-space-3); }
.mk-row{ display: flex; }
.mk-row[data-side="you"]{ justify-content: flex-end; }
.mk-bubble{
  max-width: 90%; padding: var(--ux-space-3) var(--ux-space-4);
  border-radius: var(--ux-radius-surface);
  background: var(--ux-surface-sunk); border: 2px solid transparent;
  display: grid; gap: var(--ux-space-1);
}
.mk-bubble p{ margin: 0; }
.mk-bubble[data-side="you"]{ background: var(--ux-hint-lavender); }
.mk-bubble[data-side="now"]{ background: var(--ux-surface); border-color: var(--ux-primary-border); }
.mk-who{ color: var(--ux-primary-ink); font-weight: 900; }
.mk-listenrow{ display: flex; gap: var(--ux-space-2); flex-wrap: wrap; margin-top: var(--ux-space-2); }
.mk-listen[data-ux-role="control"]{
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-primary-border); font-family: inherit; font-weight: 800;
}

.mk-actions{ display: grid; gap: var(--ux-space-3); align-content: start; }
.mk-ask{ margin: 0; text-align: center; }
.mk-primary[data-ux-role="action"]{
  width: 100%;
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
  border: 2px solid var(--ux-primary-border); font-family: inherit; font-weight: 800;
}
.mk-choices{ display: grid; gap: var(--ux-space-3); }
.mk-choice[data-ux-role="control"]{
  display: grid; gap: var(--ux-space-1); text-align: left; justify-items: start;
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-ink-soft); font-family: inherit; font-weight: 700;
  word-break: keep-all;
}
.mk-choice:hover{ border-color: var(--ux-primary-border); }
`;
