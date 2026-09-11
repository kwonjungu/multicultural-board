"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import BeeMascot from "../BeeMascot";
import ScopedStyle from "../ui/child/ScopedStyle";
import { gt, UI, type LangMap } from "./uiText";

// 게임 고유 UI 문구 (제목·설명)
const NT: Record<string, LangMap> = {
  title: {
    ko: "숫자 빨리 누르기", en: "Tap the Number", vi: "Bấm số nhanh", zh: "快速按数字",
    fil: "Pindutin ang Numero", ja: "すうじタップ", th: "กดเลขให้ไว", id: "Tekan Angka",
    ru: "Нажми число", hi: "नंबर दबाओ", ar: "اضغط الرقم",
  },
  howto: {
    ko: "둘이서 마주 앉아, 들려주는 숫자를 먼저 눌러요!",
    en: "Sit facing each other and tap the number you hear first!",
    vi: "Ngồi đối diện, ai bấm đúng số nghe được trước thì thắng!",
    zh: "两人面对面坐，先按出听到的数字!",
    fil: "Magkaharap kayo, pindutin agad ang numerong narinig!",
    ja: "むかいあって、きこえたすうじをはやくおして!",
    th: "นั่งหันหน้าเข้าหากัน กดเลขที่ได้ยินให้ไวที่สุด!",
    id: "Duduk berhadapan, tekan angka yang kamu dengar lebih dulu!",
    ru: "Сядьте напротив и нажмите услышанное число первым!",
    hi: "आमने-सामने बैठो, सुना हुआ नंबर पहले दबाओ!",
    ar: "اجلسا متقابلين واضغطا الرقم المسموع أولًا!",
  },
  // 소리가 안 나올 때 — 아이 탓으로 쓰지 않고 지금 할 일만 말한다 (README §3-5).
  audioFail: {
    ko: "소리가 안 나왔어요. 글자를 보고 눌러도 되고, 다시 듣기를 눌러도 돼요.",
    en: "The sound did not play. Read the word below, or try listening again.",
    vi: "Âm thanh chưa phát. Hãy đọc chữ bên dưới hoặc nghe lại nhé.",
    zh: "声音没有播放。可以看下面的文字，或再听一次。",
    fil: "Hindi tumunog. Basahin ang salita sa ibaba o pakinggan ulit.",
    ja: "おとが でませんでした。したの もじを みるか、もういちど きいてね。",
    th: "เสียงไม่ดัง อ่านคำด้านล่างหรือฟังอีกครั้งได้เลย",
    id: "Suaranya tidak keluar. Baca katanya di bawah atau dengarkan lagi.",
    ru: "Звук не воспроизвёлся. Прочитай слово ниже или послушай ещё раз.",
    hi: "आवाज़ नहीं चली। नीचे का शब्द पढ़ो या फिर से सुनो।",
    ar: "لم يعمل الصوت. اقرأ الكلمة بالأسفل أو استمع مرة أخرى.",
  },
  firstWins: {
    ko: "먼저 누른 친구만 1점을 받아요",
    en: "Only the first correct tap scores",
    vi: "Chỉ người bấm đúng trước được điểm",
    zh: "只有先按对的人得分",
    fil: "Ang unang tamang pindot lang ang may puntos",
    ja: "さきに おした ひとだけ 1てん",
    th: "คนที่กดถูกก่อนได้แต้ม",
    id: "Hanya yang menekan benar lebih dulu yang dapat poin",
    ru: "Очко получает тот, кто нажал первым",
    hi: "पहले सही दबाने वाले को अंक",
    ar: "النقطة لمن ضغط أولًا",
  },
};

const NUMBERS_WORDS: Record<string, string[]> = {
  ko: ["영","하나","둘","셋","넷","다섯","여섯","일곱","여덟","아홉"],
  en: ["zero","one","two","three","four","five","six","seven","eight","nine"],
  vi: ["không","một","hai","ba","bốn","năm","sáu","bảy","tám","chín"],
  zh: ["零","一","二","三","四","五","六","七","八","九"],
  ja: ["ゼロ","いち","に","さん","よん","ご","ろく","なな","はち","きゅう"],
  th: ["ศูนย์","หนึ่ง","สอง","สาม","สี่","ห้า","หก","เจ็ด","แปด","เก้า"],
  id: ["nol","satu","dua","tiga","empat","lima","enam","tujuh","delapan","sembilan"],
  hi: ["शून्य","एक","दो","तीन","चार","पाँच","छह","सात","आठ","नौ"],
  ru: ["ноль","один","два","три","четыре","пять","шесть","семь","восемь","девять"],
  ar: ["صفر","واحد","اثنان","ثلاثة","أربعة","خمسة","ستة","سبعة","ثمانية","تسعة"],
  fil: ["sero","isa","dalawa","tatlo","apat","lima","anim","pito","walo","siyam"],
  km: ["សូន្យ","មួយ","ពីរ","បី","បួន","ប្រាំ","ប្រាំមួយ","ប្រាំពីរ","ប្រាំបី","ប្រាំបួន"],
  mn: ["тэг","нэг","хоёр","гурав","дөрөв","тав","зургаа","долоо","найм","ес"],
  uz: ["nol","bir","ikki","uch","toʻrt","besh","olti","yetti","sakkiz","toʻqqiz"],
  my: ["သုည","တစ်","နှစ်","သုံး","လေး","ငါး","ခြောက်","ခုနစ်","ရှစ်","ကိုး"],
};

const ROUND_COUNT = 10;
const WRONG_LOCK_MS = 500;

type Phase = "ready" | "play" | "done";
type Player = "A" | "B";
interface Target { n: number; lang: string; round: number }

export default function NumberTap({ langA, langB }: { langA: string; langB: string }) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [round, setRound] = useState(0);
  const [target, setTarget] = useState<Target | null>(null);
  const [winner, setWinner] = useState<Player | null>(null);
  const [flashA, setFlashA] = useState<"ok" | "bad" | null>(null);
  const [flashB, setFlashB] = useState<"ok" | "bad" | null>(null);
  const [lockA, setLockA] = useState(0);
  const [lockB, setLockB] = useState(0);
  const [nowTs, setNowTs] = useState(0);
  const [audioFailed, setAudioFailed] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  /** 예약된 타이머 전부. unmount·재시작 때 한 곳에서 정리한다. */
  const timersRef = useRef<number[]>([]);
  const aliveRef = useRef(true);
  /** 이번 라운드의 선착순 승자. 두 번째 정답은 점수를 받지 못한다. */
  const solvedRef = useRef(false);

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timersRef.current = timersRef.current.filter((t) => t !== id);
      if (aliveRef.current) fn();
    }, ms);
    timersRef.current.push(id);
  }, []);

  const stopAudio = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    try { a.pause(); a.currentTime = 0; } catch { /* 이미 정리된 엘리먼트 */ }
    a.onended = null;
    audioRef.current = null;
  }, []);

  // 시작 직후 종료해도 예약된 pickTarget/flash 타이머와 음성이 남지 않는다.
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      clearTimers();
      stopAudio();
    };
  }, [clearTimers, stopAudio]);

  // 오답 잠금 표시용 시계. 잠금이 걸려 있을 때만 돈다.
  useEffect(() => {
    if (phase !== "play") return;
    const id = window.setInterval(() => setNowTs(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [phase]);

  const speak = useCallback((n: number, lang: string) => {
    const word = NUMBERS_WORDS[lang]?.[n] ?? String(n);
    stopAudio();                       // 새 음성 전에 이전 음성을 반드시 멈춘다
    setAudioFailed(false);
    const audio = new Audio(`/api/tts?text=${encodeURIComponent(word)}&lang=${lang}`);
    audioRef.current = audio;
    audio.onerror = () => { if (aliveRef.current) setAudioFailed(true); };
    audio.play().catch(() => { if (aliveRef.current) setAudioFailed(true); });
  }, [stopAudio]);

  const pickTarget = useCallback((nextRound: number) => {
    const n = Math.floor(Math.random() * 10);
    const lang = Math.random() < 0.5 ? langA : langB;
    solvedRef.current = false;
    setWinner(null);
    setTarget({ n, lang, round: nextRound });
    setRound(nextRound);
    speak(n, lang);
  }, [langA, langB, speak]);

  const replayTts = useCallback(() => {
    if (target) speak(target.n, target.lang);
  }, [target, speak]);

  const start = useCallback(() => {
    clearTimers();
    stopAudio();
    solvedRef.current = false;
    setScoreA(0); setScoreB(0);
    setLockA(0); setLockB(0);
    setFlashA(null); setFlashB(null);
    setWinner(null); setAudioFailed(false);
    setPhase("play");
    later(() => pickTarget(1), 200);
  }, [clearTimers, stopAudio, later, pickTarget]);

  const stop = useCallback(() => {
    clearTimers();
    stopAudio();
    solvedRef.current = true;
    setPhase("done");
  }, [clearTimers, stopAudio]);

  function handleTap(player: Player, n: number) {
    if (!target || phase !== "play") return;
    // 선착순 — 첫 정답이 ref 를 즉시 잠그므로 같은 라운드의 두 번째 정답은 점수가 없다.
    if (solvedRef.current) return;
    const now = Date.now();
    const locked = player === "A" ? lockA : lockB;
    if (now < locked) return;

    const setFlash = player === "A" ? setFlashA : setFlashB;

    if (n === target.n) {
      solvedRef.current = true;
      setWinner(player);
      if (player === "A") setScoreA((s) => s + 1); else setScoreB((s) => s + 1);
      setFlash("ok");
      later(() => setFlash(null), 250);
      stopAudio();
      if (target.round >= ROUND_COUNT) later(stop, 600);
      else later(() => pickTarget(target.round + 1), 600);
    } else {
      // 틀려도 흔들거나 경고음을 내지 않는다. 잠깐 쉬었다가 다시 들어보게 한다.
      if (player === "A") setLockA(now + WRONG_LOCK_MS); else setLockB(now + WRONG_LOCK_MS);
      setFlash("bad");
      later(() => setFlash(null), 250);
    }
  }

  const targetWord = target ? (NUMBERS_WORDS[target.lang]?.[target.n] ?? String(target.n)) : "";

  if (phase === "ready") {
    return (
      <div data-ux-root className="nt-root nt-center">
        <ScopedStyle css={NT_CSS} />
        <BeeMascot size={120} mood="happy" />
        <h1 data-ux-role="title">🔢 {gt(NT.title, langA)}</h1>
        <p data-ux-role="body">{gt(NT.howto, langA)} ({ROUND_COUNT} {gt(UI.round, langA)})</p>
        <p data-ux-role="secondary">{gt(NT.firstWins, langA)}</p>
        <p data-ux-role="secondary">A: {langA.toUpperCase()} · B: {langB.toUpperCase()}</p>
        <button data-ux-role="action" className="nt-primary" onClick={start}>
          ▶ {gt(UI.start, langA)}
        </button>
      </div>
    );
  }

  if (phase === "done") {
    const result = scoreA === scoreB
      ? gt(UI.draw, langA)
      : scoreA > scoreB ? `Player A ${gt(UI.win, langA)}` : `Player B ${gt(UI.win, langA)}`;
    return (
      <div data-ux-root className="nt-root nt-center">
        <ScopedStyle css={NT_CSS} />
        <BeeMascot size={120} mood="cheer" />
        <h1 data-ux-role="title">🏆 {result}</h1>
        <p data-ux-role="body">A: {scoreA} · B: {scoreB}</p>
        <button data-ux-role="action" className="nt-primary" onClick={start}>
          🔁 {gt(UI.playAgain, langA)}
        </button>
      </div>
    );
  }

  return (
    <div data-ux-root className="nt-root nt-play">
      <ScopedStyle css={NT_CSS} />
      <PlayerArea
        player="B" lang={langB} score={scoreB} rotated
        flash={flashB} locked={nowTs < lockB} onTap={(n) => handleTap("B", n)}
      />

      <div className="nt-bar">
        <div className="nt-barinfo">
          <span data-ux-role="secondary">{gt(UI.round, langA)} {round}/{ROUND_COUNT}</span>
          <span data-ux-role="label">🎧 {target?.lang.toUpperCase()} · {targetWord}</span>
        </div>
        <span data-ux-role="label" className="nt-score">A: {scoreA} · B: {scoreB}</span>
        <button
          data-ux-role="control" className="nt-replay"
          onClick={replayTts} aria-label={gt(UI.replay, langA)}
        >🔊 {gt(UI.replay, langA)}</button>
      </div>

      {audioFailed && (
        <p data-ux-role="body" className="nt-audiofail" role="status">
          🔇 {gt(NT.audioFail, langA)}
        </p>
      )}
      {winner && (
        <p data-ux-role="secondary" className="nt-winner" role="status">
          ⭐ Player {winner} · {gt(NT.firstWins, langA)}
        </p>
      )}

      <PlayerArea
        player="A" lang={langA} score={scoreA} rotated={false}
        flash={flashA} locked={nowTs < lockA} onTap={(n) => handleTap("A", n)}
      />
    </div>
  );
}

function PlayerArea({
  player, lang, score, rotated, flash, locked, onTap,
}: {
  player: Player;
  lang: string;
  score: number;
  rotated: boolean;
  flash: "ok" | "bad" | null;
  locked: boolean;
  onTap: (n: number) => void;
}) {
  return (
    <div
      className="nt-area"
      data-flash={flash ?? undefined}
      data-rotated={rotated ? "" : undefined}
    >
      <div className="nt-areatop">
        <span data-ux-role="label">Player {player} · {lang.toUpperCase()}</span>
        <span data-ux-role="label" className="nt-areascore">⭐ {score}</span>
      </div>
      <div className="nt-grid">
        {Array.from({ length: 10 }, (_, i) => (
          <button
            key={i}
            data-ux-role="control"
            className="nt-num"
            onClick={() => onTap(i)}
            disabled={locked}
            aria-label={`Player ${player} ${i}`}
          >{locked ? "⏳" : i}</button>
        ))}
      </div>
    </div>
  );
}

/* 글자 크기는 전부 토큰. 여기에 px 글자 크기를 다시 쓰지 말 것. */
const NT_CSS = `
.nt-root{ color: var(--ux-ink); max-width: 480px; margin: 0 auto; }
.nt-center{
  display: grid; justify-items: center; gap: var(--ux-space-3);
  padding: var(--ux-space-8) var(--ux-space-4);
  text-align: center;
}
.nt-center p{ margin: 0; }
.nt-primary{
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
  border: 2px solid var(--ux-primary-border); font-family: inherit; font-weight: 800;
  margin-top: var(--ux-space-3);
}
.nt-play{
  display: flex; flex-direction: column; min-height: 100vh;
  background: var(--ux-bg);
}
.nt-area{
  flex: 1; display: flex; flex-direction: column;
  padding: var(--ux-space-4);
  background: var(--ux-surface);
  transition: background var(--ux-motion-state) var(--ux-motion-ease);
}
.nt-area[data-flash="ok"]{ background: color-mix(in srgb, var(--ux-success) 14%, var(--ux-surface)); }
.nt-area[data-flash="bad"]{ background: var(--ux-surface-sunk); }
.nt-area[data-rotated]{ transform: rotate(180deg); }
.nt-areatop{ display: flex; justify-content: space-between; gap: var(--ux-space-2); margin-bottom: var(--ux-space-3); }
.nt-areascore{ color: var(--ux-success); }
.nt-grid{
  display: grid; grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: var(--ux-space-2); flex: 1; align-content: center;
}
.nt-num{
  aspect-ratio: 1 / 1;
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-primary-border);
  font-family: inherit; font-weight: 900;
  font-size: var(--ux-font-title);
  padding: 0;
}
.nt-num:disabled{ opacity: .5; cursor: not-allowed; }
.nt-bar{
  display: flex; align-items: center; gap: var(--ux-space-3);
  flex-wrap: wrap;
  padding: var(--ux-space-3) var(--ux-space-4);
  background: var(--ux-primary-fill); color: var(--ux-primary-ink);
  border-top: 3px solid var(--ux-surface); border-bottom: 3px solid var(--ux-surface);
}
.nt-barinfo{ display: grid; gap: var(--ux-space-1); min-width: 0; }
.nt-barinfo [data-ux-role="secondary"]{ color: inherit; }
.nt-score{ flex: 1; text-align: center; }
.nt-replay{
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-primary-border);
  font-family: inherit; font-weight: 800; white-space: nowrap;
}
.nt-audiofail, .nt-winner{
  margin: 0; padding: var(--ux-space-3) var(--ux-space-4);
  background: var(--ux-surface-sunk); text-align: center;
}
`;
