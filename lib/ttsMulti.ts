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

export async function speak(text: string, langShort: string): Promise<void> {
  if (typeof window === "undefined" || !text.trim()) return;

  // Stop any previous playback
  cancelSpeak();

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
        synth.speak(u);
        return;
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
  window.speechSynthesis?.cancel();
  if (currentAudio) {
    try { currentAudio.pause(); } catch {}
    currentAudio.src = "";
    currentAudio = null;
  }
}
