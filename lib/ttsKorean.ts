// 한국어 TTS 공용 유틸 — Web Speech API 우선, 실패 시 /api/tts 폴백
// 속도(rate) 조정 지원.

let serverTtsAudio: HTMLAudioElement | null = null;

export async function speakKorean(text: string, rate = 1): Promise<void> {
  if (typeof window === "undefined") return;
  const voices = window.speechSynthesis?.getVoices() ?? [];
  const hasVoice = voices.some((v) => v.lang.startsWith("ko"));
  if (hasVoice) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ko-KR";
    u.rate = rate;
    window.speechSynthesis.speak(u);
    return;
  }
  try {
    window.speechSynthesis?.cancel();
    if (serverTtsAudio) { serverTtsAudio.pause(); serverTtsAudio = null; }
    const url = `/api/tts?lang=ko&text=${encodeURIComponent(text.slice(0, 200))}`;
    const audio = new Audio(url);
    audio.playbackRate = rate;
    serverTtsAudio = audio;
    await audio.play();
  } catch {
    // silent — network error 또는 autoplay 차단
  }
}

/**
 * 임의 언어 TTS — lang 코드로 Web Speech API 호출, 실패 시 서버 폴백.
 * 단어/예문 외 일반 문장 재생용.
 */
const WEB_SPEECH_SUPPORTED = new Set(["ko", "en", "vi", "zh", "ja", "th", "ru", "hi", "id", "ar"]);
const TTS_LANG_MAP: Record<string, string> = {
  ko: "ko-KR", en: "en-US", vi: "vi-VN", zh: "zh-CN", fil: "fil-PH",
  ja: "ja-JP", th: "th-TH", km: "km-KH", mn: "mn-MN", ru: "ru-RU",
  uz: "uz-UZ", hi: "hi-IN", id: "id-ID", ar: "ar-SA", my: "my-MM",
};

export async function speakLang(text: string, lang: string, rate = 1): Promise<void> {
  if (typeof window === "undefined") return;
  const bcp47 = TTS_LANG_MAP[lang] || "en-US";
  const voices = window.speechSynthesis?.getVoices() ?? [];
  const langPrefix = bcp47.split("-")[0];
  const hasVoice = voices.some((v) => v.lang.startsWith(langPrefix));

  if (WEB_SPEECH_SUPPORTED.has(lang) && hasVoice) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = bcp47;
    u.rate = rate;
    window.speechSynthesis.speak(u);
    return;
  }
  try {
    window.speechSynthesis?.cancel();
    if (serverTtsAudio) { serverTtsAudio.pause(); serverTtsAudio = null; }
    const url = `/api/tts?lang=${encodeURIComponent(lang)}&text=${encodeURIComponent(text.slice(0, 200))}`;
    const audio = new Audio(url);
    audio.playbackRate = rate;
    serverTtsAudio = audio;
    await audio.play();
  } catch {
    // silent
  }
}
