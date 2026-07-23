"use client";

// 앱 전역 플로팅 "AI 튜터 꿀비" 챗 위젯.
// 모든 허브 화면(소통창/게임/단어/그림책/칭찬)에서 우하단 버튼으로 열 수 있다.
// 서버: /api/tutor-chat (SSE 스트리밍, 안전 레이어 포함)
// 대화는 sessionStorage 에만 보관 — 탭 닫으면 사라진다 (Firebase 미사용).

import React, { useEffect, useRef, useState } from "react";
import { checkSafety, replyForSafety } from "@/lib/chatSafety";
import { readChatStream } from "@/lib/chatStreamClient";
import { raiseAlert } from "@/lib/storybook";
import type { UserConfig } from "@/lib/types";
import MicButton from "./MicButton";

interface TutorMsg {
  role: "user" | "assistant";
  content: string;
}

/** 소프트 키보드/브라우저 UI 로 줄어든 실제 가시 영역. 미지원 브라우저는 window 크기. */
function useVisualViewport(): { height: number; bottomInset: number } {
  const [vp, setVp] = useState({ height: 0, bottomInset: 0 });
  useEffect(() => {
    const update = () => {
      const vv = window.visualViewport;
      if (vv) {
        setVp({
          height: Math.round(vv.height),
          bottomInset: Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)),
        });
      } else {
        setVp({ height: window.innerHeight, bottomInset: 0 });
      }
    };
    update();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  return vp;
}

// 위젯 자체 라벨 — i18n.ts 에 키를 늘리는 대신 자체 보관 (위젯 전용 3종)
const L_TITLE: Record<string, string> = {
  ko: "AI 튜터 꿀비", en: "Kkulbi the AI Tutor", vi: "Gia sư AI Kkulbi",
  zh: "AI辅导员 Kkulbi", fil: "AI Tutor na si Kkulbi", ja: "AIチューター クルビ",
  th: "ติวเตอร์ AI คุลบี", km: "គ្រូ AI Kkulbi", mn: "AI багш Ккулби",
  ru: "ИИ-наставник Ккулби", uz: "AI ustoz Kkulbi", hi: "AI ट्यूटर क्कुलबी",
  id: "Tutor AI Kkulbi", ar: "المعلم الذكي كولبي", my: "AI ဆရာ Kkulbi",
};

const L_PLACEHOLDER: Record<string, string> = {
  ko: "궁금한 것을 물어봐!", en: "Ask me anything!", vi: "Hỏi mình bất cứ điều gì!",
  zh: "有什么想问的吗?", fil: "Magtanong ka lang!", ja: "なんでも きいてね!",
  th: "ถามอะไรก็ได้เลย!", km: "សួរអ្វីក៏បាន!", mn: "Юу ч асуугаарай!",
  ru: "Спроси что угодно!", uz: "Istalgan narsani so'rang!", hi: "कुछ भी पूछो!",
  id: "Tanya apa saja!", ar: "اسألني أي شيء!", my: "ဘာမဆို မေးပါ!",
};

const L_GREETING: Record<string, string> = {
  ko: "안녕! 나는 AI 튜터 꿀비야 🐝 한국어 단어, 학교 생활, 공부… 뭐든 물어봐!",
  en: "Hi! I'm Kkulbi, your AI tutor 🐝 Ask me about Korean words, school life, or homework!",
  vi: "Chào bạn! Mình là Kkulbi, gia sư AI 🐝 Hỏi mình về từ tiếng Hàn, trường học hay bài tập nhé!",
  zh: "你好!我是AI辅导员Kkulbi 🐝 韩语单词、学校生活、学习…都可以问我!",
  fil: "Kumusta! Ako si Kkulbi, ang AI tutor mo 🐝 Magtanong tungkol sa salitang Korean, school life, o aralin!",
  ja: "こんにちは!AIチューターのクルビだよ 🐝 かんこくごの ことばや がっこうのこと、なんでも きいてね!",
  th: "สวัสดี! ฉันคือคุลบี ติวเตอร์ AI 🐝 ถามเรื่องคำศัพท์เกาหลี ชีวิตในโรงเรียน หรือการบ้านได้เลย!",
  km: "សួស្តី! ខ្ញុំ Kkulbi គ្រូ AI 🐝 សួរអំពីពាក្យកូរ៉េ ជីវិតសាលា ឬមេរៀនបាន!",
  mn: "Сайн уу! Би Ккулби, AI багш 🐝 Солонгос үг, сургуулийн амьдрал, хичээлээ асуугаарай!",
  ru: "Привет! Я Ккулби, твой ИИ-наставник 🐝 Спрашивай про корейские слова, школу или уроки!",
  uz: "Salom! Men Kkulbi, AI ustozman 🐝 Koreys so'zlari, maktab hayoti yoki darslar haqida so'rang!",
  hi: "नमस्ते! मैं क्कुलबी, तुम्हारा AI ट्यूटर 🐝 कोरियाई शब्द, स्कूल या पढ़ाई के बारे में पूछो!",
  id: "Halo! Aku Kkulbi, tutor AI-mu 🐝 Tanya tentang kata Korea, kehidupan sekolah, atau PR!",
  ar: "مرحبًا! أنا كولبي، معلمك الذكي 🐝 اسألني عن الكلمات الكورية أو المدرسة أو الدروس!",
  my: "မင်္ဂလာပါ! ငါက AI ဆရာ Kkulbi ပါ 🐝 ကိုရီးယားစကားလုံး၊ ကျောင်းအကြောင်း ဘာမဆို မေးပါ!",
};

function pickL(table: Record<string, string>, lang: string): string {
  return table[lang] || table.ko || table.en;
}

const MAX_STORED = 40;

export default function TutorChat({
  roomCode, myClientId, user, hidden,
}: {
  roomCode: string;
  myClientId: string;
  user: UserConfig;
  /** 전체화면 인터랙티브 뷰(게임룸 등)에서는 숨김 — 플로팅 버튼(zIndex 900)이
   *  게임의 우하단 버튼을 가려 탭을 가로채는 사고 방지 */
  hidden?: boolean;
}) {
  const lang = user.myLang;
  const storageKey = `tutorChat:${roomCode}:${myClientId}`;
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<TutorMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [streamText, setStreamText] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);
  const vp = useVisualViewport();

  // 세션 내 대화 복원 (탭 단위)
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as TutorMsg[];
        if (Array.isArray(parsed)) setMessages(parsed.slice(-MAX_STORED));
      }
    } catch { /* ignore */ }
  }, [storageKey]);

  useEffect(() => {
    try { sessionStorage.setItem(storageKey, JSON.stringify(messages.slice(-MAX_STORED))); }
    catch { /* ignore */ }
  }, [messages, storageKey]);

  // 새 메시지/스트림 도착 시 맨 아래로
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streamText, open]);

  async function handleSend() {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    setBusy(true);
    setMessages((prev) => [...prev, { role: "user", content: text }]);

    // 클라이언트 사전 안전검사 (서버에도 동일 검사 있음)
    const pre = checkSafety(text);
    if (pre.distress) {
      setMessages((prev) => [...prev, { role: "assistant", content: replyForSafety(lang, "distress") }]);
      raiseAlert(roomCode, {
        clientId: myClientId, studentName: user.myName,
        timestamp: Date.now(), kind: "distress",
      }).catch(() => {});
      setBusy(false);
      return;
    }
    if (pre.blocked) {
      setMessages((prev) => [...prev, { role: "assistant", content: replyForSafety(lang, "warning") }]);
      setBusy(false);
      return;
    }

    try {
      const history = messages.slice(-12);
      const res = await fetch("/api/tutor-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentLang: lang,
          studentName: user.myName,
          history,
          studentText: text,
        }),
      });
      const final = await readChatStream(res, (acc) => setStreamText(acc));
      if (final.kind === "distress") {
        raiseAlert(roomCode, {
          clientId: myClientId, studentName: user.myName,
          timestamp: Date.now(), kind: "distress",
        }).catch(() => {});
      }
      setMessages((prev) => [...prev, {
        role: "assistant",
        // 빈 응답/통신 실패는 콘텐츠 차단이 아니므로 "error" 문구 — "block" 을 쓰면
        // 정상 질문이 부적절 판정받은 것처럼 보인다.
        content: final.reply || replyForSafety(lang, "error"),
      }]);
    } catch (err) {
      console.error("tutor chat failed", err);
      setMessages((prev) => [...prev, { role: "assistant", content: replyForSafety(lang, "error") }]);
    }
    setStreamText(null);
    setBusy(false);
  }

  if (hidden) return null;

  return (
    <>
      {/* 플로팅 버튼 — HubTutorialBootstrap(bottom 20/right 20) 위에 쌓는다 */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label={pickL(L_TITLE, lang)}
          style={{
            // zIndex 는 전체화면 뷰(게임룸 460·토론 450·모달 400)보다 낮게 —
            // 그 위에 떠서 게임 버튼 탭을 가로채던 버그의 재발 방지
            position: "fixed", bottom: 84 + vp.bottomInset, right: 18, zIndex: 300,
            width: 60, height: 60, borderRadius: "50%",
            border: "3px solid #FDE68A",
            background: "linear-gradient(135deg, #F59E0B, #D97706)",
            boxShadow: "0 8px 20px rgba(180,83,9,0.4)",
            fontSize: 28, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 4,
          }}
        >
          <img
            src="/mascot/bee-tutor.png"
            alt=""
            aria-hidden="true"
            onError={(e) => { (e.currentTarget as HTMLImageElement).outerHTML = "🐝"; }}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        </button>
      )}

      {/* 챗 패널 */}
      {open && (
        <div style={{
          position: "fixed", bottom: 16 + vp.bottomInset, right: 12, zIndex: 320,
          width: "min(380px, calc(100vw - 24px))",
          height: vp.height > 0 ? `min(540px, ${Math.max(vp.height - 32, 260)}px)` : "min(540px, calc(100dvh - 90px))",
          background: "#fff",
          borderRadius: 20, border: "3px solid #FDE68A",
          boxShadow: "0 16px 40px rgba(0,0,0,0.28)",
          display: "flex", flexDirection: "column", overflow: "hidden",
          fontFamily: "'Pretendard Variable', 'Pretendard', 'Noto Sans KR', sans-serif",
          transition: "bottom 0.15s ease-out",
        }}>
          {/* 헤더 */}
          <div style={{
            background: "linear-gradient(135deg, #FEF3C7, #FDE68A)",
            padding: "10px 14px",
            display: "flex", alignItems: "center", gap: 10,
            borderBottom: "2px solid #F59E0B33",
          }}>
            <img
              src="/mascot/bee-tutor.png"
              alt=""
              aria-hidden="true"
              style={{ width: 40, height: 40, objectFit: "contain", flexShrink: 0 }}
            />
            <div style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 900, color: "#1F2937" }}>
              {pickL(L_TITLE, lang)}
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="close"
              style={{
                background: "transparent", border: "none", cursor: "pointer",
                fontSize: 20, fontWeight: 900, color: "#92400E", padding: 4,
              }}
            >✕</button>
          </div>

          {/* 메시지 */}
          <div ref={scrollRef} style={{
            flex: 1, padding: 12, overflowY: "auto",
            display: "flex", flexDirection: "column", gap: 8,
            background: "#FFFBEB",
          }}>
            {/* 인사말 — 저장하지 않는 가상 첫 메시지 */}
            <TutorBubble role="assistant" content={pickL(L_GREETING, lang)} />
            {messages.map((m, i) => (
              <TutorBubble key={i} role={m.role} content={m.content} />
            ))}
            {busy && (
              <TutorBubble role="assistant" content={streamText || "···"} dimmed={!streamText} />
            )}
          </div>

          {/* 입력 */}
          <div style={{
            padding: "8px 10px 10px", background: "#fff",
            borderTop: "2px solid #FDE68A", display: "flex", gap: 8, alignItems: "center",
          }}>
            <MicButton
              lang={lang}
              disabled={busy}
              size={42}
              onText={(text) => setDraft((d) => (d ? `${d} ${text}` : text))}
            />
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
              onFocus={() => setTimeout(() => scrollRef.current && (scrollRef.current.scrollTop = scrollRef.current.scrollHeight), 250)}
              placeholder={pickL(L_PLACEHOLDER, lang)}
              disabled={busy}
              maxLength={200}
              style={{
                flex: 1, minHeight: 42, padding: "8px 12px",
                border: "2px solid #FDE68A", borderRadius: 12,
                fontSize: 14, fontWeight: 600, color: "#1F2937",
                fontFamily: "inherit", outline: "none", background: "#FFFBEB",
              }}
            />
            <button
              onClick={handleSend}
              disabled={busy || !draft.trim()}
              style={{
                minWidth: 56, borderRadius: 12, border: "none",
                cursor: busy || !draft.trim() ? "default" : "pointer",
                background: !draft.trim() || busy
                  ? "#E5E7EB"
                  : "linear-gradient(135deg, #F59E0B, #D97706)",
                color: !draft.trim() || busy ? "#9CA3AF" : "#fff",
                fontSize: 16, fontWeight: 900,
              }}
            >➤</button>
          </div>
        </div>
      )}
    </>
  );
}

function TutorBubble({ role, content, dimmed }: {
  role: "user" | "assistant";
  content: string;
  dimmed?: boolean;
}) {
  const isUser = role === "user";
  return (
    <div style={{
      alignSelf: isUser ? "flex-end" : "flex-start",
      maxWidth: "85%",
      padding: "9px 13px",
      background: isUser ? "linear-gradient(135deg, #3B82F6, #2563EB)" : "#fff",
      color: isUser ? "#fff" : dimmed ? "#92400E" : "#1F2937",
      borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
      border: isUser ? "none" : "2px solid #FDE68A",
      fontSize: 14, fontWeight: 600, lineHeight: 1.45,
      wordBreak: "break-word", whiteSpace: "pre-wrap",
      boxShadow: isUser ? "0 4px 10px rgba(59,130,246,0.25)" : "0 2px 8px rgba(180,83,9,0.1)",
    }}>
      {content}
    </div>
  );
}
