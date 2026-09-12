/**
 * 말소리 재생 중재자 — 추가 설계 X19.
 *
 * 이 앱에는 말소리를 내는 경로가 둘이다: Web Speech(SpeechSynthesis)와
 * `/api/tts` 를 `new Audio()` 로 재생하는 HTMLAudio 폴백. 두 경로가 서로를
 * 모르면 **동시에 두 목소리**가 난다. InterpreterDrawer.speakText 가 정확히
 * 그랬다 — WebSpeech 분기로 들어가기 전에 이전 HTMLAudio 를 멈추지 않았다.
 *
 * 그래서 재생 소유권을 이 모듈 하나로 모은다.
 *   - 새 재생 전 **양쪽 모두** 중지 → 활성 음성은 언제나 최대 1개 (ADD-TTS-01)
 *   - 화면을 닫으면 `stopAll()` → 0개
 *   - '소리 끄기' 설정이 켜지면 재생을 **실제로 막는다**. 아무 일도 하지 않는
 *     토글은 만들지 않는다.
 *
 * 브라우저 API 는 `AudioBusEnv` 로 주입한다. node 에서 가짜 speechSynthesis /
 * Audio 로 검사할 수 있어야 하기 때문이다 (scripts/test-audio-bus.mjs).
 *
 * ⚠ 한계: `lib/ttsMulti.ts` 는 자기 HTMLAudio 를 따로 들고 있고 이 라운드에서
 * 수정 금지 파일이다. 그래서 ttsMulti 로 시작된 재생은 이 버스의
 * `stopAll()` 이 speechSynthesis.cancel() 까지만 닿는다. 통합 요청은 보고서의
 * CHANGE-REQUEST 참고.
 */

export type SoundPref = "on" | "off";

export interface BusVoice {
  lang: string;
  name?: string;
}

export interface BusUtterance {
  lang: string;
  addEventListener(type: "end" | "error", cb: () => void, opts?: { once?: boolean }): void;
}

export interface BusSpeech {
  cancel(): void;
  speak(u: BusUtterance): void;
  getVoices(): BusVoice[];
}

export interface BusAudio {
  src: string;
  play(): Promise<void>;
  pause(): void;
  addEventListener(type: "ended" | "error", cb: () => void, opts?: { once?: boolean }): void;
}

export interface AudioBusEnv {
  getSpeech(): BusSpeech | null;
  createUtterance(text: string, bcp47: string): BusUtterance | null;
  createAudio(url: string): BusAudio;
}

export interface SpeakRequest {
  text: string;
  /** 앱 언어 코드(ko/vi/...). 음성 선택과 서버 TTS 양쪽에 쓴다. */
  lang: string;
  bcp47: string;
  /** 이 언어를 Web Speech 로 시도해도 되는지. false 면 곧장 서버 폴백. */
  allowWebSpeech: boolean;
  /** 서버 TTS URL 을 만드는 함수. 호출부가 자기 라우트를 정한다. */
  audioUrl(text: string, lang: string): string;
}

export type SpeakResult =
  | { played: true; via: "web-speech" | "html-audio" }
  | { played: false; reason: "sound-off" | "empty" | "superseded" | "failed" };

/* ── 기본 env: 브라우저 ─────────────────────────────────────────────── */

function defaultEnv(): AudioBusEnv {
  return {
    getSpeech: () =>
      typeof window !== "undefined" && window.speechSynthesis
        ? (window.speechSynthesis as unknown as BusSpeech)
        : null,
    createUtterance: (text, bcp47) => {
      if (typeof window === "undefined" || typeof SpeechSynthesisUtterance === "undefined") return null;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = bcp47;
      return u as unknown as BusUtterance;
    },
    createAudio: (url) => new Audio(url) as unknown as BusAudio,
  };
}

let env: AudioBusEnv | null = null;
function getEnv(): AudioBusEnv {
  if (!env) env = defaultEnv();
  return env;
}

/** 테스트 전용 주입. 제품 코드에서 호출하지 않는다. */
export function configureAudioBus(next: AudioBusEnv | null): void {
  stopAll();
  env = next;
  generation = 0;
}

/* ── 소리 설정 ──────────────────────────────────────────────────────── */

let soundOverride: SoundPref | null = null;

/**
 * 설정을 읽는다. TextSizeMenu 가 바꾼 값이 우선이고, 새로고침 직후처럼 아직
 * 알려준 적이 없으면 `applyChildUx` 가 문서 루트에 찍어둔 `data-ux-sound` 를
 * 본다. 둘 다 없으면 켜짐.
 */
export function isSoundOn(): boolean {
  if (soundOverride) return soundOverride === "on";
  if (typeof document === "undefined") return true;
  return document.documentElement.dataset.uxSound !== "off";
}

/** 설정 변경을 버스에 알린다. 끄면 지금 나고 있는 소리도 즉시 멈춘다. */
export function setSoundPref(pref: SoundPref): void {
  soundOverride = pref;
  if (pref === "off") stopAll();
}

/* ── 재생 소유권 ────────────────────────────────────────────────────── */

let generation = 0;
let activeUtterance: BusUtterance | null = null;
let activeAudio: BusAudio | null = null;

/** 지금 살아 있는 음성 개수. 계약상 0 또는 1 이어야 한다. */
export function activeVoiceCount(): number {
  return (activeUtterance ? 1 : 0) + (activeAudio ? 1 : 0);
}

/** WebSpeech 와 HTMLAudio 를 **함께** 중지한다. 새 재생 전에 반드시 거친다. */
/**
 * 버스 밖에서 소리를 내는 경로(lib/ttsMulti 의 speak 등)가 자기 정지 함수를
 * 여기 걸어두면, 버스가 멈출 때 그 소리도 함께 멈춘다. '동시에 한 목소리'
 * 계약을 앱 전역으로 넓히는 연결부다. 버스는 상대를 import 하지 않는다 —
 * 등록은 언제나 바깥에서 들어온다(순환 import 방지).
 */
const foreignStops = new Set<() => void>();
let stopping = false;

export function registerForeignStop(stop: () => void): () => void {
  foreignStops.add(stop);
  return () => {
    foreignStops.delete(stop);
  };
}

export function stopAll(): void {
  // 등록된 정지 함수가 다시 stopAll 을 부르면 무한 재귀가 된다.
  if (stopping) return;
  stopping = true;
  try {
    foreignStops.forEach((fn) => {
      try {
        fn();
      } catch {
        /* 한 곳이 던져도 나머지는 멈춰야 한다 */
      }
    });
  } finally {
    stopping = false;
  }
  generation++;
  const e = env ?? (typeof window === "undefined" ? null : getEnv());
  try {
    e?.getSpeech()?.cancel();
  } catch {
    /* 일부 브라우저는 cancel 에서 던진다 */
  }
  if (activeAudio) {
    const a = activeAudio;
    activeAudio = null;
    try {
      a.pause();
      a.src = "";
    } catch {
      /* 이미 해제됨 */
    }
  }
  activeUtterance = null;
}

function hasVoiceFor(speech: BusSpeech, bcp47: string): boolean {
  let voices: BusVoice[] = [];
  try {
    voices = speech.getVoices() || [];
  } catch {
    return false;
  }
  const prefix = bcp47.split("-")[0];
  return voices.some((v) => (v.lang || "").toLowerCase().startsWith(prefix.toLowerCase()));
}

/**
 * 한 번에 한 목소리만. 반환은 재생을 **시작했는지** 이고, 끝까지 들었는지가
 * 아니다 — 중간에 다른 재생이 끼어들면 `superseded` 로 끝난다.
 */
export async function speakVia(req: SpeakRequest): Promise<SpeakResult> {
  const text = (req.text || "").trim();
  if (!text) return { played: false, reason: "empty" };
  if (!isSoundOn()) {
    // 설정을 존중한다: 재생을 만들지 않고, 남아 있던 소리도 없앤다.
    stopAll();
    return { played: false, reason: "sound-off" };
  }

  stopAll();
  const gen = generation;
  const e = getEnv();

  const speech = e.getSpeech();
  if (req.allowWebSpeech && speech && hasVoiceFor(speech, req.bcp47)) {
    const u = e.createUtterance(text, req.bcp47);
    if (u) {
      activeUtterance = u;
      const clear = () => {
        if (gen === generation && activeUtterance === u) activeUtterance = null;
      };
      u.addEventListener("end", clear, { once: true });
      u.addEventListener("error", clear, { once: true });
      try {
        speech.speak(u);
        return { played: true, via: "web-speech" };
      } catch {
        if (activeUtterance === u) activeUtterance = null;
      }
    }
  }

  return playOwned(e, req.audioUrl(text, req.lang), gen);
}

/**
 * 녹음 재생처럼 '이미 있는 오디오 URL' 을 같은 소유권 아래에서 튼다.
 * 말소리와 녹음이 겹쳐 나지 않게 하려면 이 경로를 써야 한다.
 */
export async function playUrl(url: string): Promise<SpeakResult> {
  if (!url) return { played: false, reason: "empty" };
  if (!isSoundOn()) {
    stopAll();
    return { played: false, reason: "sound-off" };
  }
  stopAll();
  return playOwned(getEnv(), url, generation);
}

async function playOwned(e: AudioBusEnv, url: string, gen: number): Promise<SpeakResult> {
  const audio = e.createAudio(url);
  activeAudio = audio;
  const clearAudio = () => {
    if (gen === generation && activeAudio === audio) activeAudio = null;
  };
  audio.addEventListener("ended", clearAudio, { once: true });
  audio.addEventListener("error", clearAudio, { once: true });
  try {
    await audio.play();
  } catch {
    if (activeAudio === audio) activeAudio = null;
    return { played: false, reason: "failed" };
  }
  // play() 가 늦게 끝나는 사이 다른 재생이 시작됐으면 이 소리는 즉시 끊는다.
  if (gen !== generation) {
    try {
      audio.pause();
      audio.src = "";
    } catch {
      /* noop */
    }
    if (activeAudio === audio) activeAudio = null;
    return { played: false, reason: "superseded" };
  }
  return { played: true, via: "html-audio" };
}
