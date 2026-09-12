/**
 * X19 음성 중재자 검사 — ADD-TTS-01 + '소리 끄기' 가 실제로 막는지.
 *
 *   실행: node scripts/test-audio-bus.mjs
 *
 * 네트워크도 브라우저도 쓰지 않는다. speechSynthesis 와 HTMLAudio 를 가짜로
 * 주입하고, **동시에 살아 있는 음성 개수**를 밖에서 직접 센다. 구현이 돌려주는
 * activeVoiceCount() 만 믿지 않기 위해서다.
 */
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(join(tmpdir(), "bee-bus-"));

let count = 0;
const check = async (name, fn) => { await fn(); count++; console.log(`PASS ${name}`); };

function deferred() {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
}

/**
 * 가짜 브라우저. `sounding()` 은 "지금 실제로 소리를 내고 있는 것" 의 개수다 —
 * 구현 내부 상태가 아니라 가짜 장치 쪽에서 센다.
 */
function makeBrowser({ voices = ["ko-KR", "en-US", "ja-JP"] } = {}) {
  const utterances = [];
  const audios = [];
  const pendingPlays = [];
  const speech = {
    cancelCalls: 0,
    cancel() {
      this.cancelCalls++;
      for (const u of utterances) {
        if (u.speaking) { u.speaking = false; u.fire("end"); }
      }
    },
    speak(u) { u.speaking = true; },
    getVoices: () => voices.map((lang) => ({ lang, name: `fake ${lang}` })),
  };
  const env = {
    getSpeech: () => speech,
    createUtterance(text, bcp47) {
      const subs = {};
      const u = {
        text, lang: bcp47, speaking: false,
        addEventListener(type, cb) { (subs[type] ||= []).push(cb); },
        fire(type) { for (const cb of subs[type] || []) cb(); },
      };
      utterances.push(u);
      return u;
    },
    createAudio(url) {
      const subs = {};
      const d = deferred();
      const a = {
        src: url, playing: false, paused: false,
        play() { pendingPlays.push({ audio: a, d }); return d.promise; },
        pause() { a.playing = false; a.paused = true; },
        addEventListener(type, cb) { (subs[type] ||= []).push(cb); },
        fire(type) { for (const cb of subs[type] || []) cb(); },
      };
      audios.push(a);
      return a;
    },
  };
  return {
    env, speech, utterances, audios,
    /** 브라우저가 재생을 시작해 준다. */
    settlePlays() {
      const list = pendingPlays.splice(0);
      for (const { audio, d } of list) { audio.playing = true; d.resolve(); }
    },
    /** play() 를 아직 확정하지 않고 보류 (늦은 resolve 재현). */
    pendingPlays,
    sounding() {
      return utterances.filter((u) => u.speaking).length + audios.filter((a) => a.playing).length;
    },
  };
}

const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

const REQ = (lang, bcp47, allowWebSpeech) => ({
  text: `${lang} 문장`,
  lang,
  bcp47,
  allowWebSpeech,
  audioUrl: (t, l) => `/api/tts?lang=${l}&text=${encodeURIComponent(t)}`,
});

try {
  const src = readFileSync(join(root, "lib/audioBus.ts"), "utf8");
  const out = ts.transpileModule(src, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText;
  writeFileSync(join(dir, "bus.mjs"), out);
  const bus = await import(pathToFileURL(join(dir, "bus.mjs")));

  /* ══ ADD-TTS-01 ═════════════════════════════════════════════════ */

  await check("ADD-TTS-01: HTMLAudio 폴백 재생 중 WebSpeech 언어로 바꿔도 음성은 최대 1개", async () => {
    const b = makeBrowser();                 // km 음성은 없다 → 서버 폴백
    bus.configureAudioBus(b.env);
    bus.setSoundPref("on");

    // 1) 크메르어 — WebSpeech 음성이 없으니 HTMLAudio 로 간다.
    const p1 = bus.speakVia(REQ("km", "km-KH", true));
    b.settlePlays();
    const r1 = await p1;
    assert.deepEqual(r1, { played: true, via: "html-audio" });
    assert.equal(b.sounding(), 1, "서버 폴백이 재생되지 않았다");

    // 2) 재생 도중 한국어로 바꾼다 — WebSpeech 경로.
    const p2 = bus.speakVia(REQ("ko", "ko-KR", true));
    const r2 = await p2;
    assert.deepEqual(r2, { played: true, via: "web-speech" });
    assert.equal(b.sounding(), 1, `동시에 ${b.sounding()}개가 소리를 내고 있다`);
    assert.equal(bus.activeVoiceCount(), 1);
    assert.ok(b.audios[0].paused, "이전 HTMLAudio 를 멈추지 않았다");

    // 3) 닫기 → 0개
    bus.stopAll();
    assert.equal(b.sounding(), 0, "닫은 뒤에도 소리가 남아 있다");
    assert.equal(bus.activeVoiceCount(), 0);
  });

  await check("재현: 옛 speakText 는 같은 순서에서 두 목소리를 겹친다", () => {
    // components/InterpreterDrawer.tsx(931f542) 의 speakText 를 그대로 옮긴 모델.
    // WebSpeech 분기에서 speechSynthesis.cancel() 만 하고 HTMLAudio 는 두고 간다.
    const b = makeBrowser();
    const legacySpeak = (lang, bcp47, hasVoice) => {
      if (hasVoice) {
        b.speech.cancel();
        const u = b.env.createUtterance("t", bcp47);
        b.speech.speak(u);
      } else {
        b.speech.cancel();
        const a = b.env.createAudio(`/api/tts?lang=${lang}`);
        a.play();
        a.playing = true;               // 브라우저가 재생 시작
      }
    };
    legacySpeak("km", "km-KH", false);   // 서버 폴백 재생 중
    legacySpeak("ko", "ko-KR", true);    // 한국어로 변경
    assert.equal(b.sounding(), 2, "옛 구조에서 음성이 겹치지 않으면 재현이 아니다");
  });

  await check("반대 방향(WebSpeech → HTMLAudio)도 최대 1개", async () => {
    const b = makeBrowser();
    bus.configureAudioBus(b.env);
    bus.setSoundPref("on");
    await bus.speakVia(REQ("ko", "ko-KR", true));
    assert.equal(b.sounding(), 1);
    const p = bus.speakVia(REQ("my", "my-MM", true));   // 음성 없음 → 서버 폴백
    b.settlePlays();
    await p;
    assert.equal(b.sounding(), 1, "WebSpeech 를 멈추지 않고 오디오를 겹쳤다");
    assert.ok(b.speech.cancelCalls >= 2);
    bus.stopAll();
    assert.equal(b.sounding(), 0);
  });

  await check("play() 가 늦게 끝나는 사이 새 재생이 시작되면 늦은 쪽을 끊는다", async () => {
    const b = makeBrowser();
    bus.configureAudioBus(b.env);
    bus.setSoundPref("on");
    const slow = bus.speakVia(REQ("km", "km-KH", true));   // play() 보류
    await flush();
    const fast = await bus.speakVia(REQ("ko", "ko-KR", true));
    assert.equal(fast.played, true);
    b.settlePlays();                                        // 이제 늦게 재생 성공
    const r = await slow;
    assert.deepEqual(r, { played: false, reason: "superseded" });
    assert.equal(b.sounding(), 1, `늦은 재생이 겹쳤다 (${b.sounding()}개)`);
    bus.stopAll();
    assert.equal(b.sounding(), 0);
  });

  await check("허용하지 않은 언어는 WebSpeech 를 건너뛰고 서버 폴백으로 간다", async () => {
    const b = makeBrowser();
    bus.configureAudioBus(b.env);
    bus.setSoundPref("on");
    const p = bus.speakVia(REQ("ko", "ko-KR", false));     // 음성은 있지만 금지
    b.settlePlays();
    const r = await p;
    assert.equal(r.via, "html-audio");
    assert.equal(b.utterances.length, 0);
    bus.stopAll();
  });

  /* ══ 소리 끄기가 실제로 막는가 ══════════════════════════════════ */

  await check("소리 끄기: 새 재생을 아예 만들지 않는다", async () => {
    const b = makeBrowser();
    bus.configureAudioBus(b.env);
    bus.setSoundPref("off");
    const r1 = await bus.speakVia(REQ("ko", "ko-KR", true));
    assert.deepEqual(r1, { played: false, reason: "sound-off" });
    const r2 = await bus.playUrl("blob:fake/1");
    assert.deepEqual(r2, { played: false, reason: "sound-off" });
    assert.equal(b.utterances.length, 0, "utterance 를 만들었다");
    assert.equal(b.audios.length, 0, "Audio 를 만들었다");
    assert.equal(b.sounding(), 0);
    assert.equal(bus.activeVoiceCount(), 0);
  });

  await check("재생 중에 소리를 끄면 지금 나는 소리도 멈춘다", async () => {
    const b = makeBrowser();
    bus.configureAudioBus(b.env);
    bus.setSoundPref("on");
    const p = bus.speakVia(REQ("km", "km-KH", true));
    b.settlePlays();
    await p;
    assert.equal(b.sounding(), 1);
    bus.setSoundPref("off");
    assert.equal(b.sounding(), 0, "소리 끄기가 재생 중인 소리를 그대로 뒀다");
    assert.equal(bus.activeVoiceCount(), 0);
  });

  await check("다시 켜면 재생된다 — 되돌릴 수 없는 토글이 아니다", async () => {
    const b = makeBrowser();
    bus.configureAudioBus(b.env);
    bus.setSoundPref("off");
    await bus.speakVia(REQ("ko", "ko-KR", true));
    assert.equal(b.utterances.length, 0);
    bus.setSoundPref("on");
    await bus.speakVia(REQ("ko", "ko-KR", true));
    assert.equal(b.sounding(), 1);
    bus.stopAll();
  });

  await check("빈 문자열은 재생하지 않고, 이전 음성도 건드리지 않는다", async () => {
    const b = makeBrowser();
    bus.configureAudioBus(b.env);
    bus.setSoundPref("on");
    await bus.speakVia(REQ("ko", "ko-KR", true));
    const before = b.sounding();
    const r = await bus.speakVia({ ...REQ("ko", "ko-KR", true), text: "   " });
    assert.deepEqual(r, { played: false, reason: "empty" });
    assert.equal(b.sounding(), before);
    bus.stopAll();
  });

  await check("녹음 재생(playUrl)도 같은 소유권 — 말소리와 겹치지 않는다", async () => {
    const b = makeBrowser();
    bus.configureAudioBus(b.env);
    bus.setSoundPref("on");
    await bus.speakVia(REQ("ko", "ko-KR", true));      // WebSpeech 재생 중
    const p = bus.playUrl("blob:fake/my-voice");
    b.settlePlays();
    await p;
    assert.equal(b.sounding(), 1, "내 녹음이 말소리 위에 겹쳐 재생됐다");
    bus.stopAll();
    assert.equal(b.sounding(), 0);
  });

  await check("고정 seed 1,000 단계에서 활성 음성은 언제나 1개 이하", async () => {
    const b = makeBrowser();
    bus.configureAudioBus(b.env);
    let seed = 7919;
    const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
    const langs = [["ko", "ko-KR"], ["km", "km-KH"], ["ja", "ja-JP"], ["my", "my-MM"]];
    for (let i = 0; i < 1000; i++) {
      const op = rnd() % 6;
      if (op === 0 || op === 1) {
        const [l, bc] = langs[rnd() % langs.length];
        const p = bus.speakVia(REQ(l, bc, rnd() % 3 !== 0));
        if (rnd() % 2) b.settlePlays();
        await p;
      } else if (op === 2) {
        const p = bus.playUrl(`blob:fake/${i}`);
        if (rnd() % 2) b.settlePlays();
        await p;
      } else if (op === 3) {
        bus.stopAll();
      } else if (op === 4) {
        bus.setSoundPref(rnd() % 2 ? "on" : "off");
      } else {
        b.settlePlays();
        await flush();
      }
      assert.ok(b.sounding() <= 1, `동시에 ${b.sounding()}개가 소리를 낸다 (step ${i})`);
      assert.ok(bus.activeVoiceCount() <= 1);
    }
    bus.stopAll();
    b.settlePlays();
    await flush();
    assert.equal(b.sounding(), 0, "닫은 뒤 남은 음성이 있다");
  });

  bus.configureAudioBus(null);
  console.log(`\n${count} checks passed`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
