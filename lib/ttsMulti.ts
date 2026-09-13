import { isSoundOn, registerForeignStop, stopAll } from "./audioBus";
// Multi-language TTS helper built on top of Web Speech API.
// Picks the best available OS/browser voice for each language and applies
// child-friendly rate/pitch so reading aloud doesn't feel robotic.
//
// NOTE: voice availability depends entirely on the user's browser + OS.
// Chrome on Windows tends to have Google voices; Safari on iOS has Siri voices.
// If a matching voice isn't available we fall back to the default voice for
// the requested BCP-47 lang tag — which is still usually better than random.

export type AppLang =
  | "ko" | "en" | "vi" | "zh" | "fil"
  | "ja" | "th" | "km" | "mn" | "ru"
  | "uz" | "hi" | "id" | "ar" | "my";

// BCP-47 codes per app language.
const BCP47: Record<string, string> = {
  ko: "ko-KR",
  en: "en-US",
  vi: "vi-VN",
  zh: "zh-CN",
  fil: "fil-PH",
  ja: "ja-JP",
  th: "th-TH",
  km: "km-KH",
  mn: "mn-MN",
  ru: "ru-RU",
  uz: "uz-UZ",
  hi: "hi-IN",
  id: "id-ID",
  ar: "ar-SA",
  my: "my-MM",
};

// Per-language tuning. Rates < 1 slow down, pitch > 1 makes it brighter.
// Values tuned for 7-9 year-old listeners; softer/slower than default.
interface Tuning { rate: number; pitch: number; volume: number; }
const TUNING: Record<string, Tuning> = {
  ko:  { rate: 0.95, pitch: 1.05, volume: 1 },
  en:  { rate: 0.92, pitch: 1.05, volume: 1 },
  vi:  { rate: 0.90, pitch: 1.05, volume: 1 },
  zh:  { rate: 0.92, pitch: 1.05, volume: 1 },
  fil: { rate: 0.93, pitch: 1.05, volume: 1 },
  ja:  { rate: 0.93, pitch: 1.08, volume: 1 },
  th:  { rate: 0.90, pitch: 1.05, volume: 1 },
  km:  { rate: 0.90, pitch: 1.05, volume: 1 },
  mn:  { rate: 0.92, pitch: 1.02, volume: 1 },
  ru:  { rate: 0.93, pitch: 1.00, volume: 1 },
  uz:  { rate: 0.93, pitch: 1.02, volume: 1 },
  hi:  { rate: 0.92, pitch: 1.05, volume: 1 },
  id:  { rate: 0.92, pitch: 1.05, volume: 1 },
  ar:  { rate: 0.90, pitch: 1.00, volume: 1 },
  my:  { rate: 0.90, pitch: 1.05, volume: 1 },
};

const DEFAULT_TUNING: Tuning = { rate: 0.93, pitch: 1.05, volume: 1 };

// Score a voice against a requested lang. Higher is better.
function scoreVoice(voice: SpeechSynthesisVoice, wantBcp47: string, langShort: string): number {
  const voiceLang = voice.lang || "";
  let score = 0;
  if (voiceLang.toLowerCase() === wantBcp47.toLowerCase()) score += 100;
  else if (voiceLang.toLowerCase().startsWith(langShort + "-")) score += 80;
  else if (voiceLang.toLowerCase().startsWith(langShort)) score += 60;
  else return 0;

  const name = voice.name.toLowerCase();
  // Prefer higher-quality providers when multiple match.
  if (name.includes("google")) score += 25;
  if (name.includes("microsoft")) score += 15;
  if (name.includes("natural") || name.includes("neural") || name.includes("premium")) score += 20;
  if (name.includes("online")) score += 10;
  // Slightly prefer female voices (common for child audiobooks).
  if (name.includes("female") || name.includes("woman") || /\b(eun|yuna|jenny|siwon|soo|heami|minsu|seoul|jimin|aria|sunhi|heera)\b/.test(name)) score += 5;
  // Penalize obviously robotic "compact" voices.
  if (name.includes("compact")) score -= 10;
  return score;
}

function pickVoice(langShort: string): SpeechSynthesisVoice | null {
  if (typeof window === "undefined") return null;
  const synth = window.speechSynthesis;
  if (!synth) return null;
  const voices = synth.getVoices();
  if (!voices || voices.length === 0) return null;
  const wantBcp47 = BCP47[langShort] || langShort;
  let best: SpeechSynthesisVoice | null = null;
  let bestScore = 0;
  for (const v of voices) {
    const s = scoreVoice(v, wantBcp47, langShort);
    if (s > bestScore) { bestScore = s; best = v; }
  }
  return bestScore > 0 ? best : null;
}

// Voices in some browsers load asynchronously. Ensure we have them.
async function ensureVoicesReady(): Promise<void> {
  if (typeof window === "undefined") return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  const existing = synth.getVoices();
  if (existing && existing.length > 0) return;
  await new Promise<void>((resolve) => {
    let resolved = false;
    const done = () => { if (resolved) return; resolved = true; resolve(); };
    const handler = () => done();
    synth.addEventListener("voiceschanged", handler, { once: true });
    // Safety timeout
    setTimeout(done, 1500);
  });
}

// Languages where Web Speech API rarely has a usable voice. For these we
// skip the browser and go straight to the server /api/tts (Google Translate
// proxy), which covers all 15 supported languages.
const WEBSPEECH_UNRELIABLE = new Set(["fil", "km", "mn", "uz", "my"]);

// Tracks the current HTML5 audio element so cancelSpeak() can stop it.
let currentAudio: HTMLAudioElement | null = null;

// Chrome 은 긴 글을 읽다가 15초쯤에서 스스로 멈춘다. 살아 있는 동안 resume()
// 을 계속 넣어 끊기지 않게 한다. cancelSpeak() 이 함께 정리한다.
let keepAlive: ReturnType<typeof setInterval> | null = null;
function clearKeepAlive() { if (keepAlive) { clearInterval(keepAlive); keepAlive = null; } }

/**
 * Split long text into ≤200-char chunks (Google Translate TTS hard limit).
 * Breaks on sentence-ending punctuation when possible, else on whitespace.
 */
function chunkText(text: string, limit = 180): string[] {
  const out: string[] = [];
  let rest = text.trim();
  while (rest.length > limit) {
    // Prefer sentence boundary
    let cut = -1;
    const punct = [". ", "! ", "? ", "。", "！", "？", "…\n", "…"];
    for (const p of punct) {
      const idx = rest.lastIndexOf(p, limit);
      if (idx > cut) cut = idx + p.length;
    }
    if (cut <= 0) {
      // Fall back to last whitespace before limit
      const wsIdx = rest.lastIndexOf(" ", limit);
      cut = wsIdx > 0 ? wsIdx + 1 : limit;
    }
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}

async function playServerTts(text: string, langShort: string): Promise<void> {
  const chunks = chunkText(text);
  for (const part of chunks) {
    const url = `/api/tts?lang=${encodeURIComponent(langShort)}&text=${encodeURIComponent(part)}`;
    await new Promise<void>((resolve, reject) => {
      const audio = new Audio(url);
      currentAudio = audio;
      const tuning = TUNING[langShort] || DEFAULT_TUNING;
      audio.playbackRate = tuning.rate;
      audio.volume = tuning.volume;
      audio.addEventListener("ended", () => {
        if (currentAudio === audio) currentAudio = null;
        resolve();
      }, { once: true });
      audio.addEventListener("error", () => {
        if (currentAudio === audio) currentAudio = null;
        reject(new Error("audio error"));
      }, { once: true });
      audio.play().catch(reject);
    });
    // If speaking was cancelled between chunks, stop
    if (!currentAudio) break;
  }
}

/**
 * 이 경로도 audioBus 의 '동시에 한 목소리' 계약에 넣는다. 등록해두면 통역
 * 서랍이나 녹음 화면이 말하기 시작할 때 카드 읽어주기도 함께 멈춘다.
 * 등록은 모듈 1회. cancelSpeak 은 stopAll 을 부르지 않는다 — 부르면 재귀다.
 */
let registered = false;
function ensureRegistered() {
  if (registered || typeof window === "undefined") return;
  registered = true;
  registerForeignStop(cancelSpeak);
}

export async function speak(text: string, langShort: string): Promise<void> {
  if (typeof window === "undefined" || !text.trim()) return;
  // 소리를 끈 아이에게는 아무 소리도 나면 안 된다. 화면 안내는 그대로 두고
  // 재생만 건너뛴다(호출부는 await 로 '다 읽었다' 를 기다리므로 즉시 resolve).
  if (!isSoundOn()) return;
  ensureRegistered();

  // 이전 재생 정지 — 이 파일 것과 버스 것 양쪽 모두.
  cancelSpeak();
  stopAll();
  // Chrome 은 cancel() 바로 뒤에 온 speak() 를 통째로 삼키는 일이 있다.
  // 한 틱 쉬어 큐가 비워질 시간을 준다 — 아이가 못 느낄 만큼 짧다.
  await new Promise((r) => setTimeout(r, 60));

  // For reliably-unsupported languages, skip browser entirely.
  const goServerFirst = WEBSPEECH_UNRELIABLE.has(langShort);

  if (!goServerFirst) {
    const synth = window.speechSynthesis;
    if (synth) {
      await ensureVoicesReady();
      const voice = pickVoice(langShort);
      if (voice) {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = BCP47[langShort] || "en-US";
        u.voice = voice;
        const tuning = TUNING[langShort] || DEFAULT_TUNING;
        u.rate = tuning.rate;
        u.pitch = tuning.pitch;
        u.volume = tuning.volume;

        /**
         * 브라우저 음성은 **조용히 실패한다.** cancel() 직후의 speak() 를
         * 삼키는 Chrome 버그, 목소리는 목록에 있는데 실제로는 안 나오는 경우,
         * OS 음성 서비스가 죽은 경우 — 어느 쪽이든 end 도 error 도 오지 않고
         * 아이는 "듣기가 안 된다" 만 겪는다. start 가 제때 안 오면 브라우저를
         * 포기하고 서버 TTS(/api/tts) 로 내려간다. 서버 경로는 15개 언어를
         * 모두 덮는다.
         */
        const spoke = await new Promise<boolean>((resolve) => {
          let started = false;
          let settled = false;
          const finish = (ok: boolean) => {
            if (settled) return;
            settled = true;
            clearTimeout(watchdog);
            clearKeepAlive();
            resolve(ok);
          };
          u.addEventListener("start", () => { started = true; }, { once: true });
          u.addEventListener("end", () => finish(true), { once: true });
          u.addEventListener("error", () => finish(false), { once: true });
          const watchdog = setTimeout(() => {
            if (started) return;              // 말하는 중이면 그대로 둔다
            try { synth.cancel(); } catch { /* 무시 */ }
            finish(false);
          }, 1500);
          clearKeepAlive();
          keepAlive = setInterval(() => {
            try { if (synth.speaking) synth.resume(); } catch { /* 무시 */ }
          }, 5000);
          synth.speak(u);
        });
        if (spoke) return;
        // 브라우저가 조용했다 — 아래 서버 TTS 로 이어진다.
      }
    }
    // else: no voice found → fall through to server TTS
  }

  try {
    await playServerTts(text, langShort);
  } catch (err) {
    console.warn("server TTS failed, trying browser default", err);
    // Final fallback: browser with default voice (may read in English)
    const synth = window.speechSynthesis;
    if (synth) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = BCP47[langShort] || "en-US";
      synth.speak(u);
    }
  }
}

export function cancelSpeak() {
  if (typeof window === "undefined") return;
  clearKeepAlive();
  window.speechSynthesis?.cancel();
  if (currentAudio) {
    try { currentAudio.pause(); } catch {}
    currentAudio.src = "";
    currentAudio = null;
  }
}
