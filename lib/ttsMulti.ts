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

// 예전에는 '브라우저 음성이 미덥지 않은 언어' 만 서버로 보냈다. 지금은 모든
// 언어가 서버 음성을 먼저 쓰므로(제스처 창 안에서 재생을 시작하기 위해) 이
// 목록은 필요 없어졌다. 기록만 남긴다: fil·km·mn·uz·my 는 Web Speech 에
// 쓸 만한 목소리가 거의 없다.

// Tracks the current HTML5 audio element so cancelSpeak() can stop it.
let currentAudio: HTMLAudioElement | null = null;
// 다음 조각을 앞 조각 재생 중에 미리 만들어(= 미리 내려받기 시작해) 둔 것.
// 아직 play() 를 부르지 않은 상태라서 소리는 절대 안 난다. cancelSpeak() 이
// 이것도 함께 버려야 취소 후 뒤늦게 재생되는 '유령 오디오' 가 안 생긴다.
let prefetchedAudio: HTMLAudioElement | null = null;
// 취소 여부를 currentAudio 가 null 인지로 판단하면 안 된다 — 조각이 정상
// 종료(ended)될 때도 done() 이 currentAudio 를 null 로 만들기 때문에, 그
// 방식으로는 '정상 종료' 와 '취소' 를 구분하지 못해 둘째 조각부터 재생이
// 아예 안 되는 문제가 있었다. 세대 번호로 명확히 구분한다: cancelSpeak() 이
// 세대를 올리면, 그 이전 세대로 시작된 재생은 이후 어떤 시점에도 스스로
// '취소됐다' 는 걸 알아챈다.
let playGeneration = 0;

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

/** 재생이 시작조차 못 하면 이 시간 안에 실패로 본다. */
const AUDIO_START_MS = 2000;
/** 길이를 알기 전까지 쓰는 임시 상한. 알게 되면 실제 길이로 좁힌다. */
const AUDIO_MAX_MS = 15000;

function ttsUrlFor(langShort: string, part: string): string {
  return `/api/tts?lang=${encodeURIComponent(langShort)}&text=${encodeURIComponent(part)}`;
}

async function playServerTts(text: string, langShort: string): Promise<void> {
  const chunks = chunkText(text);
  if (chunks.length === 0) return;
  // 이 재생 호출 전용 세대 번호. cancelSpeak() 이 playGeneration 을 올리면
  // 이 값과 어긋나 '취소됨' 을 알 수 있다.
  const myGen = ++playGeneration;
  const tuning = TUNING[langShort] || DEFAULT_TUNING;

  // 미리 받기와 실제 재생이 같은 생성 함수를 쓴다. new Audio(url) 시점에
  // 브라우저가 알아서 내려받기 시작하지만, play() 를 부르기 전까지는
  // 절대 소리가 나지 않는다 — 그래서 취소된 미리받기는 안전하게 버릴 수 있다.
  const createAudio = (part: string): HTMLAudioElement => {
    const audio = new Audio(ttsUrlFor(langShort, part));
    audio.playbackRate = tuning.rate;
    audio.volume = tuning.volume;
    return audio;
  };

  // 다음에 재생할(또는 이미 미리 받아 둔) 오디오. 루프 시작 전에 첫 조각을
  // 만들어 두는 것도 같은 흐름이다 — 그냥 '한 조각 미리' 상태로 시작한다.
  let pending: HTMLAudioElement | null = createAudio(chunks[0]);

  for (let i = 0; i < chunks.length; i++) {
    if (myGen !== playGeneration) return; // 취소됨 — cancelSpeak() 이 이미 정리했다

    const audio = pending as HTMLAudioElement;
    pending = null;
    currentAudio = audio;
    if (prefetchedAudio === audio) prefetchedAudio = null; // 미리받기 신분 졸업, 이제 '현재' 다

    await new Promise<void>((resolve, reject) => {
      /**
       * 'ended' 만 기다리면 재생이 시작되지 못했을 때 영영 끝나지 않는다.
       * 그러면 호출부의 finally 가 안 돌아 듣기 버튼이 눌린 채로 굳는다
       * (실제 신고된 증상). 시작과 종료 양쪽에 시간을 못 박는다.
       */
      let started = false;
      let settled = false;
      const done = (ok: boolean, why?: string) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(startGuard);
        window.clearTimeout(maxGuard);
        if (currentAudio === audio) currentAudio = null;
        if (ok) resolve();
        else {
          try { audio.pause(); } catch { /* 무시 */ }
          reject(new Error(why || "audio failed"));
        }
      };
      const startGuard = window.setTimeout(() => {
        if (!started) done(false, "audio did not start");
      }, AUDIO_START_MS);
      let maxGuard = window.setTimeout(() => done(true), AUDIO_MAX_MS);
      // 길이를 알면 그 길이에 맞춰 상한을 좁힌다 — 끝 이벤트가 안 와도
      // 버튼이 오래 물려 있지 않게 한다.
      audio.addEventListener("loadedmetadata", () => {
        const d = audio.duration;
        if (!Number.isFinite(d) || d <= 0) return;
        window.clearTimeout(maxGuard);
        const rate = audio.playbackRate || 1;
        maxGuard = window.setTimeout(() => done(true), (d / rate) * 1000 + 1200);
      }, { once: true });

      audio.addEventListener("playing", () => {
        started = true;
        // 이 조각이 재생을 "시작"한 바로 그 시점에 다음 조각을 미리 만든다.
        // play() 는 아직 안 부르므로(다음 루프 차례가 됐을 때 부른다) 지금
        // 취소돼도 이 오디오는 절대 소리를 내지 않는다.
        if (
          myGen === playGeneration &&
          i + 1 < chunks.length &&
          !prefetchedAudio
        ) {
          const next = createAudio(chunks[i + 1]);
          prefetchedAudio = next;
          pending = next;
        }
      }, { once: true });
      audio.addEventListener("ended", () => done(true), { once: true });
      audio.addEventListener("error", () => done(false, "audio error"), { once: true });
      audio.play().then(() => { started = true; }).catch((e) => done(false, String(e && e.name)));
    });

    if (myGen !== playGeneration) return; // 도중에 취소됐으면 다음 조각으로 넘어가지 않는다
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

/**
 * 읽어 주기의 결과.
 *   "server"  — 서버 음성(/api/tts)으로 재생이 시작됐다
 *   "browser" — 브라우저 음성으로 재생이 시작됐다
 *   "muted"   — 앱에서 소리를 꺼 둔 상태라 일부러 안 냈다
 *   "failed"  — 둘 다 실패했다(네트워크·자동재생 차단·목소리 없음)
 *   "empty"   — 읽을 글이 없다
 * 부르는 쪽이 이 값을 보고 **화면에 이유를 말할 수 있다.** 예전에는 어떤
 * 경로로 실패하든 아무 말도 없어서, 아이도 우리도 원인을 알 수 없었다.
 */
export type SpeakResult = "server" | "browser" | "muted" | "failed" | "empty";

export async function speak(text: string, langShort: string): Promise<SpeakResult> {
  if (typeof window === "undefined" || !text.trim()) return "empty";
  // 소리를 끈 아이에게는 아무 소리도 나면 안 된다. 화면 안내는 그대로 두고
  // 재생만 건너뛴다(호출부는 await 로 '다 읽었다' 를 기다리므로 즉시 resolve).
  if (!isSoundOn()) return "muted";
  ensureRegistered();

  // 이전 재생 정지 — 이 파일 것과 버스 것 양쪽 모두.
  cancelSpeak();
  stopAll();
  /**
   * **서버 음성을 먼저 쓴다.**
   *
   * 예전에는 브라우저 음성(Web Speech)을 먼저 시도하고, 조용히 실패하면
   * 1.5초 뒤 감시견이 서버 음성으로 넘겼다. 그런데 그 1.5초 사이에 클릭에서
   * 이어지는 '사용자 제스처 창' 이 닫혀, 정작 서버 음성의 play() 가 브라우저
   * 자동재생 정책에 막혔다 — 아이 입장에서는 눌러도 **아무 소리도 안 났다**
   * (실제로 반복 신고된 증상이다).
   *
   * 서버 경로(/api/tts)는 클릭 직후 바로 play() 를 부르므로 제스처 창 안에서
   * 시작되고, 15개 언어를 모두 같은 품질로 덮는다. 브라우저 음성은 그 다음
   * 차례로 남긴다 — 네트워크가 끊긴 교실에서도 소리가 나야 하기 때문이다.
   */
  try {
    await playServerTts(text, langShort);
    return "server";
  } catch {
    // 네트워크·서버 실패 → 아래 브라우저 음성으로 이어간다.
  }

  {
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
        if (spoke) return "browser";
        // 브라우저가 조용했다 — 아래 서버 TTS 로 이어진다.
      }
    }
    // else: no voice found → fall through to server TTS
  }

  // 여기까지 왔다면 서버도 브라우저 목소리 선택도 실패한 것이다.
  // 마지막으로 기본 목소리에 맡긴다 — 엉뚱한 발음이라도 침묵보다 낫다.
  const synth2 = window.speechSynthesis;
  if (!synth2) return "failed";
  const u = new SpeechSynthesisUtterance(text);
  u.lang = BCP47[langShort] || "en-US";
  // 이 마지막 시도도 조용히 실패할 수 있다. start 가 오면 성공으로 본다.
  return await new Promise<SpeakResult>((resolve) => {
    let settled = false;
    const done = (r: SpeakResult) => { if (!settled) { settled = true; resolve(r); } };
    u.addEventListener("start", () => done("browser"), { once: true });
    u.addEventListener("error", () => done("failed"), { once: true });
    window.setTimeout(() => done("failed"), 1500);
    synth2.speak(u);
  });
}

export function cancelSpeak() {
  if (typeof window === "undefined") return;
  clearKeepAlive();
  window.speechSynthesis?.cancel();
  // 세대를 먼저 올린다 — playServerTts 의 진행 중이던 루프가 다음 확인
  // 시점에 곧바로 '취소됨' 을 알아채고 더 진행하지 않게 한다.
  playGeneration++;
  if (currentAudio) {
    try { currentAudio.pause(); } catch {}
    currentAudio.src = "";
    currentAudio = null;
  }
  // 미리 받아 둔 다음 조각도 함께 버린다 — play() 를 부른 적이 없으니
  // pause() 는 안전 장치일 뿐이고, 핵심은 참조를 끊어 이후 그 누구도
  // 이 오디오에 play() 를 부르지 못하게 하는 것이다(유령 재생 방지).
  if (prefetchedAudio) {
    try { prefetchedAudio.pause(); } catch {}
    prefetchedAudio.src = "";
    prefetchedAudio = null;
  }
}
