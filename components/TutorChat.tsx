"use client";

// 앱 전역 플로팅 "AI 튜터 꿀비" 챗 위젯.
// 모든 허브 화면(소통창/게임/단어/그림책/칭찬)에서 우하단 버튼으로 열 수 있다.
// 서버: /api/tutor-chat (SSE 스트리밍, 안전 레이어 포함) — 이 계약은 바꾸지 않는다.
// 대화는 sessionStorage 에만 보관 — 탭 닫으면 사라진다 (Firebase 미사용).
//
// 튜터는 '보조 도움'이고 소통창은 '친구에게 보내는 글'이다. 두 가지를 같은
// 것으로 보이게 하지 않는다 (README §6.4). 여기의 답은 어디에도 공유되지 않으며,
// 친구에게 보여주려면 소통창에 직접 올려야 한다.

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { checkSafety, replyForSafety } from "@/lib/chatSafety";
import { readChatStream } from "@/lib/chatStreamClient";
import { raiseAlert } from "@/lib/storybook";
import { t } from "@/lib/i18n";
import { useOpenLayerCount } from "@/lib/backStack";
import type { UserConfig } from "@/lib/types";
import MicButton from "./MicButton";
import ScopedStyle from "./ui/child/ScopedStyle";

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
  /**
   * 꾸미기·통역 같은 창이 열려 있으면 꿀비 버튼을 비켜 준다.
   *
   * 이 버튼은 position:fixed; z-index:300 이라 모달·서랍 위에 그대로 떠 있었다.
   * 아이 입장에서는 창을 열었는데 그 위로 다른 버튼이 툭 튀어나온 것으로 보인다
   * (사용자 보고). 이미 열어 둔 대화 패널은 닫지 않는다 — 쓰던 것을 빼앗지
   * 않고, 아직 안 연 버튼만 숨긴다.
   */
  const openLayers = useOpenLayerCount();
  const [collapsed, setCollapsed] = useState(false);
  const [messages, setMessages] = useState<TutorMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [streamText, setStreamText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [blockHint, setBlockHint] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);
  const vp = useVisualViewport();

  /** 가장 최근 요청의 번호. 이보다 오래된 응답은 버린다 (STREAM-01). */
  const reqSeqRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  /** 실패했을 때 다시 보낼 질문. 아이가 다시 타이핑하게 만들지 않는다. */
  const lastAskRef = useRef<string | null>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    // StrictMode 의 mount→cleanup→mount 에서 aliveRef 가 false 로 굳지 않게 되살린다.
    aliveRef.current = true;
    setMounted(true);
    return () => {
      aliveRef.current = false;
      // unmount 하면 진행 중인 스트림도 끝난다.
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

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
  }, [messages, streamText, open, collapsed]);

  /** 진행 중인 생성을 멈춘다. 닫기·숨김·unmount·'멈추기' 가 같은 경로를 쓴다. */
  function stopStream() {
    reqSeqRef.current += 1;   // 이 다음에 도착하는 응답은 전부 오래된 것이 된다
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    setStreamText(null);
  }

  function closePanel() {
    stopStream();
    setOpen(false);
    setCollapsed(false);
  }

  // hidden 으로 숨겨질 때도 생성을 남겨 두지 않는다.
  useEffect(() => {
    if (hidden) stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidden]);

  async function ask(text: string) {
    const mySeq = reqSeqRef.current + 1;
    reqSeqRef.current = mySeq;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    lastAskRef.current = text;
    setFailed(false);
    setBlockHint(null);
    setBusy(true);

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
        signal: ctrl.signal,
        body: JSON.stringify({
          studentLang: lang,
          studentName: user.myName,
          history,
          studentText: text,
        }),
      });
      const final = await readChatStream(res, (acc) => {
        // 멈추기·교체 이후에 흘러들어온 조각은 화면에 쓰지 않는다.
        if (reqSeqRef.current !== mySeq || !aliveRef.current) return;
        setStreamText(acc);
      });
      // 최신 요청이 아니면 이 응답은 버린다 — 늦게 도착한 A 가 B 를 덮지 않는다.
      if (reqSeqRef.current !== mySeq || !aliveRef.current) return;
      if (final.kind === "distress") {
        raiseAlert(roomCode, {
          clientId: myClientId, studentName: user.myName,
          timestamp: Date.now(), kind: "distress",
        }).catch(() => {});
      }
      if (!final.reply) {
        // 빈 응답/통신 실패는 콘텐츠 차단이 아니다 — 다시 물어볼 수 있게 둔다.
        setFailed(true);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: final.reply }]);
      }
    } catch (err) {
      if (reqSeqRef.current !== mySeq || !aliveRef.current) return;
      if ((err as { name?: string })?.name === "AbortError") return;
      console.error("tutor chat failed", err);
      setFailed(true);
    }
    if (reqSeqRef.current !== mySeq || !aliveRef.current) return;
    setStreamText(null);
    setBusy(false);
    abortRef.current = null;
  }

  function handleSend() {
    const text = draft.trim();
    if (busy) { setBlockHint(t("postBusyWait", lang)); return; }
    if (!text) { setBlockHint(t("tutorNeedQuestion", lang)); return; }
    setDraft("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    void ask(text);
  }

  function handleRetry() {
    const text = lastAskRef.current;
    if (!text || busy) return;
    void ask(text);
  }

  /** 조합 중 Enter 는 확정용이다 — 전송으로 쓰지 않는다 (IME-01). */
  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter") return;
    if ((e.nativeEvent as unknown as { isComposing?: boolean }).isComposing) return;
    if (e.shiftKey) return;   // 줄바꿈은 그대로 둔다
    e.preventDefault();
    handleSend();
  }

  if (hidden || !mounted) return null;

  const panelHeight = vp.height > 0
    ? `min(560px, ${Math.max(vp.height - 32, 240)}px)`
    : "min(560px, calc(100dvh - 90px))";

  const widget = (
    <div data-ux-root className="tc-root">
      <ScopedStyle css={TC_CSS} />

      {/* 플로팅 버튼 — 아이콘 단독이 아니라 글자 라벨을 같이 둔다.
          다른 창이 열려 있는 동안에는 그 위에 겹쳐 뜨지 않는다. */}
      {!open && openLayers === 0 && (
        <button
          type="button"
          data-ux-role="control"
          className="tc-fab"
          aria-label={t("tutorOpenLabel", lang)}
          title={t("tutorOpenLabel", lang)}
          style={{ bottom: 84 + vp.bottomInset }}
          onClick={() => { setOpen(true); setCollapsed(false); }}
        >
          <img
            src="/_opt/mascot/bee-tutor-384.webp"
            alt=""
            aria-hidden="true"
            className="tc-fab-img"
            // 파생본 -> 원본 -> 숨김 순으로 내려간다.
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement;
              if (!img.dataset.fellBack) { img.dataset.fellBack = "1"; img.src = "/mascot/bee-tutor.png"; return; }
              img.style.display = "none";
            }}
          />
          <span data-ux-role="label" className="tc-fab-label">{t("tutorOpenLabel", lang)}</span>
        </button>
      )}

      {open && (
        <section
          className="tc-panel"
          aria-label={pickL(L_TITLE, lang)}
          style={{ bottom: 16 + vp.bottomInset, height: collapsed ? "auto" : panelHeight }}
        >
          <header className="tc-head">
            <img src="/_opt/mascot/bee-tutor-384.webp"
          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = "/mascot/bee-tutor.png"; }} alt="" aria-hidden="true" className="tc-head-img" />
            <h2 data-ux-role="label" className="tc-title">{pickL(L_TITLE, lang)}</h2>
            <button
              type="button"
              data-ux-role="control"
              className="tc-quiet"
              aria-expanded={!collapsed}
              onClick={() => setCollapsed((c) => !c)}
            >{collapsed ? t("tutorExpand", lang) : t("tutorCollapse", lang)}</button>
            <button type="button" data-ux-role="control" className="tc-quiet" onClick={closePanel}>
              <span aria-hidden>✕</span> {t("postCloseLabel", lang)}
            </button>
          </header>

          {/* 소통창과 튜터의 경계 — 여기 답은 친구에게 가지 않는다 */}
          <p data-ux-role="secondary" className="tc-private">🔒 {t("tutorPrivateNote", lang)}</p>

          {!collapsed && (
            <>
              <div ref={scrollRef} className="tc-log" role="log">
                {/* 인사말 — 저장하지 않는 가상 첫 메시지 */}
                <TutorBubble role="assistant" content={pickL(L_GREETING, lang)} />
                {messages.map((m, i) => (
                  <TutorBubble key={i} role={m.role} content={m.content} />
                ))}
                {busy && (
                  <TutorBubble role="assistant" content={streamText || `⟳ ${t("tutorAsking", lang)}`} />
                )}
                {failed && (
                  <div className="tc-failed" role="alert">
                    <p data-ux-role="body">{t("tutorFailed", lang)}</p>
                    <button type="button" data-ux-role="control" className="tc-secondary" onClick={handleRetry}>
                      {t("tutorRetry", lang)}
                    </button>
                  </div>
                )}
              </div>

              <p data-ux-role="secondary" className="tc-share-note">{t("tutorPrivateLong", lang)}</p>

              {blockHint && <p data-ux-role="body" className="tc-blockhint" role="status">{blockHint}</p>}

              <div className="tc-input-row">
                <MicButton
                  lang={lang}
                  size={56}
                  onText={(text) => setDraft((d) => (d ? `${d} ${text}` : text))}
                />
                <textarea
                  data-ux-role="body"
                  className="tc-input"
                  value={draft}
                  rows={2}
                  lang={lang}
                  onChange={(e) => { setDraft(e.target.value); setBlockHint(null); }}
                  onKeyDown={onKeyDown}
                  placeholder={pickL(L_PLACEHOLDER, lang)}
                  maxLength={400}
                  aria-label={pickL(L_PLACEHOLDER, lang)}
                />
              </div>
              <div className="tc-actions">
                {busy ? (
                  <button type="button" data-ux-role="action" className="tc-secondary tc-wide" onClick={stopStream}>
                    ⏹ {t("tutorStop", lang)}
                  </button>
                ) : (
                  <button
                    type="button"
                    data-ux-role="action"
                    className="tc-primary tc-wide"
                    aria-disabled={!draft.trim()}
                    onClick={handleSend}
                  >{t("tutorSend", lang)}</button>
                )}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );

  // 화면 본체와 data-ux-root 가 겹치지 않도록 body 로 띄운다.
  return createPortal(widget, document.body);
}

function TutorBubble({ role, content }: {
  role: "user" | "assistant";
  content: string;
}) {
  const isUser = role === "user";
  return (
    <p data-ux-role="body" data-ux-reading className={isUser ? "tc-bubble me" : "tc-bubble bee"}>
      {content}
    </p>
  );
}

/* ── 튜터 패널 전용 규칙 ───────────────────────────────────────────
   대화문은 --ux-font-body(기본 20px 상당), 입력창도 같은 크기다. 패널 높이는
   visualViewport 로 잡아 키보드가 올라와도 입력과 보내기가 가려지지 않는다. */
const TC_CSS = `
.tc-root{ position: static; }
.tc-fab{
  position: fixed; right: 12px; z-index: 300;
  display: inline-flex; align-items: center; gap: var(--ux-space-2);
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
  border: 2px solid var(--ux-primary-border);
  border-radius: var(--ux-radius-pill);
  font-family: inherit; font-weight: 800;
  box-shadow: 0 6px 18px rgba(137,83,0,.28);
}
.tc-fab-img{ width: 36px; height: 36px; object-fit: contain; flex-shrink: 0; }
/* 평소에는 접어 둔다.
   화면 위에 늘 떠 있는 물건이라 글자까지 펼쳐 두면 아이 화면을 계속 가린다
   (사용자 지시: "접어놔 학생 것에서"). 뜻은 aria-label 과 title 이 지키고,
   마우스를 올리거나 키보드 포커스가 오면 이름이 펼쳐진다 — 아이콘만 남겨
   뜻이 사라지는 것은 피한다. */
.tc-fab{ border-radius: 50%; padding: 0; }
.tc-fab-label{
  white-space: nowrap;
  max-width: 0; overflow: hidden; opacity: 0;
  transition: max-width .18s ease, opacity .18s ease, margin-inline-end .18s ease;
  margin-inline-end: 0;
}
.tc-fab:hover, .tc-fab:focus-visible{ border-radius: var(--ux-radius-pill); }
.tc-fab:hover .tc-fab-label, .tc-fab:focus-visible .tc-fab-label{
  max-width: 12rem; opacity: 1; margin-inline-end: var(--ux-space-2);
}
/* 손가락만 쓰는 기기에서는 hover 가 없다 — 접힌 채로 두고 뜻은 라벨이 아니라
   꿀비 그림과 aria-label 이 나른다. */
@media (hover: none){
  .tc-fab:hover .tc-fab-label{ max-width: 0; opacity: 0; margin-inline-end: 0; }
}

.tc-panel{
  position: fixed; right: 8px; left: 8px; z-index: 320;
  max-width: 420px; margin-left: auto;
  display: flex; flex-direction: column; gap: var(--ux-space-2);
  background: var(--ux-surface);
  border: 3px solid var(--ux-primary-border);
  border-radius: var(--ux-radius-panel);
  padding: var(--ux-space-3);
  box-shadow: 0 16px 40px rgba(41,37,31,.28);
  box-sizing: border-box;
}
.tc-head{ display: flex; align-items: center; gap: var(--ux-space-2); flex-wrap: wrap; }
.tc-head-img{ width: 40px; height: 40px; object-fit: contain; flex-shrink: 0; }
.tc-title{
  flex: 1 1 8ch; min-width: 0; margin: 0; color: var(--ux-ink); font-weight: 900;
  word-break: keep-all; overflow-wrap: anywhere;
}
.tc-private{
  margin: 0; padding: var(--ux-space-2) var(--ux-space-3);
  background: var(--ux-surface-sunk); border-radius: var(--ux-radius-pill);
  word-break: keep-all; overflow-wrap: anywhere;
}
.tc-share-note{ margin: 0; word-break: keep-all; overflow-wrap: anywhere; }
.tc-log{
  flex: 1; min-height: 0; overflow-y: auto;
  display: flex; flex-direction: column; gap: var(--ux-space-2);
  background: var(--ux-bg); border-radius: var(--ux-radius-surface);
  padding: var(--ux-space-3);
}
.tc-bubble{
  margin: 0; max-width: 90%;
  padding: var(--ux-space-2) var(--ux-space-3);
  border-radius: var(--ux-radius-surface);
  white-space: pre-wrap; word-break: keep-all; overflow-wrap: anywhere;
}
.tc-bubble.bee{ align-self: flex-start; background: var(--ux-surface); border: 2px solid var(--ux-primary-border); color: var(--ux-ink); }
.tc-bubble.me{ align-self: flex-end; background: var(--ux-surface-sunk); border: 2px solid var(--ux-selected-border); color: var(--ux-ink); }
.tc-failed{
  display: grid; gap: var(--ux-space-2);
  border: 2px dashed var(--ux-error); border-radius: var(--ux-radius-surface);
  padding: var(--ux-space-3);
}
.tc-failed p{ margin: 0; color: var(--ux-error); font-weight: 800; }
.tc-blockhint{
  margin: 0; color: var(--ux-ink); font-weight: 700;
  background: var(--ux-surface-sunk); border: 2px dashed var(--ux-primary-border);
  border-radius: var(--ux-radius-surface); padding: var(--ux-space-2) var(--ux-space-3);
  word-break: keep-all; overflow-wrap: anywhere;
}
.tc-input-row{ display: flex; gap: var(--ux-space-2); align-items: stretch; }
.tc-input{
  flex: 1; min-width: 0; box-sizing: border-box; font-family: inherit;
  font-size: var(--ux-font-body); line-height: var(--ux-lh-reading);
  font-weight: 600; color: var(--ux-ink); background: var(--ux-surface);
  border: 2px solid var(--ux-ink-soft); border-radius: var(--ux-radius-surface);
  padding: var(--ux-space-2) var(--ux-space-3);
  min-height: var(--ux-action-min); resize: none;
}
.tc-input:focus{ border-color: var(--ux-selected-border); }
.tc-actions{ display: flex; gap: var(--ux-space-2); }
.tc-wide{ width: 100%; }
.tc-primary{
  font-family: inherit; font-weight: 900;
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
  border: 2px solid var(--ux-primary-border);
}
.tc-primary[aria-disabled="true"]{
  background: var(--ux-surface-sunk); color: var(--ux-ink-soft);
  border: 2px dashed var(--ux-ink-soft);
}
.tc-secondary{
  font-family: inherit; font-weight: 800;
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-primary-border);
}
.tc-quiet{
  font-family: inherit; font-weight: 800; flex-shrink: 0;
  background: transparent; color: var(--ux-ink-soft);
  border: 2px solid transparent;
  display: inline-flex; align-items: center; justify-content: center; gap: var(--ux-space-2);
}
@media (min-width: 700px){
  .tc-panel{ left: auto; width: 420px; right: 16px; }
  .tc-fab{ right: 18px; }
}
`;
