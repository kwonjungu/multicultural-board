/**
 * X03 녹음 세션 재현·회귀 검사 — ADD-MIC-01 / 02 / 03.
 *
 *   실행: node scripts/test-recording-session.mjs
 *
 * 실제 마이크·네트워크·운영 방(1111)을 건드리지 않는다. 전부 가짜다:
 *   fake clock(취소된 타이머까지 강제로 깨울 수 있음) · controlled promise ·
 *   MediaStreamTrack.stop spy · recorder 인스턴스별 상태.
 *
 * 기대값은 "구현이 뱉는 값" 이 아니라 **사용자 행동과 시간 경계**에서 먼저
 * 정의한다. 그래서 이 파일에는 옛 구조(legacy)를 그대로 흉내 낸 모델이 함께
 * 들어 있고, 같은 타임라인에서 옛 구조가 **실패하는지** 부터 확인한다.
 * 실패가 재현되지 않으면 회귀 검사도 의미가 없다.
 */
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(join(tmpdir(), "bee-rec-"));

let count = 0;
const check = async (name, fn) => {
  await fn();
  count++;
  console.log(`PASS ${name}`);
};

/* ── 가짜 시계 ──────────────────────────────────────────────────────── */
function makeClock() {
  let t = 0;
  let seq = 0;
  const timers = new Map(); // id -> {due, fn, cleared}
  return {
    now: () => t,
    setTimeout(fn, ms) {
      const id = ++seq;
      timers.set(id, { due: t + ms, fn, cleared: false });
      return id;
    },
    clearTimeout(id) {
      const e = timers.get(id);
      if (e) e.cleared = true;
      timers.delete(id);
    },
    /** 시간을 흘린다. 살아 있는 타이머만 due 순서로 깨운다. */
    advanceTo(target) {
      for (;;) {
        let next = null;
        for (const [id, e] of timers) {
          if (e.due <= target && (next === null || e.due < timers.get(next).due)) next = id;
        }
        if (next === null) break;
        const e = timers.get(next);
        timers.delete(next);
        t = e.due;
        e.fn();
      }
      t = Math.max(t, target);
    },
    /** 이미 큐에 들어간 뒤 clearTimeout 이 불린 경합 상황 — 콜백을 강제로 깨운다. */
    forceFire(id, allTimers) {
      const e = allTimers.get(id);
      assert.ok(e, `타이머 ${id} 를 찾을 수 없다`);
      e.fn();
    },
    pending: () => [...timers.keys()],
    _timers: timers,
  };
}

/* ── 가짜 장치 ──────────────────────────────────────────────────────── */
function makeDevices() {
  const stats = { tracksCreated: 0, tracksStopped: 0, recordersCreated: 0, sttCalls: 0, urls: new Set() };
  const allTimerFns = new Map(); // 타이머 id -> entry (강제 발화용)

  function makeStream(n = 2) {
    const tracks = [];
    for (let i = 0; i < n; i++) {
      stats.tracksCreated++;
      tracks.push({
        stopped: false,
        stop() {
          if (this.stopped) return;
          this.stopped = true;
          stats.tracksStopped++;
        },
      });
    }
    return { tracks, getTracks: () => tracks };
  }

  const recorders = [];
  function makeRecorder(stream, mimeType) {
    stats.recordersCreated++;
    const rec = {
      id: recorders.length + 1,
      state: "inactive",
      // 브라우저가 실제로 고르는 값. 요청과 다를 수 있다 — 고정 가정 금지 확인용.
      mimeType: mimeType || "audio/mp4",
      stream,
      ondataavailable: null,
      onstop: null,
      pendingStop: false,
      start() {
        this.state = "recording";
        this.ondataavailable?.({ data: { size: 1200, type: this.mimeType } });
      },
      stop() {
        if (this.state === "inactive") return;
        this.state = "inactive";
        // 실제 MediaRecorder 의 onstop 은 나중에 온다 — 테스트가 직접 흘린다.
        this.pendingStop = true;
      },
      /** onstop 을 지금 발화. 취소 뒤에 늦게 오는 경우를 만들 수 있다. */
      flushStop() {
        if (!this.pendingStop) return false;
        this.pendingStop = false;
        this.onstop?.();
        return true;
      },
    };
    recorders.push(rec);
    return rec;
  }

  return { stats, makeStream, makeRecorder, recorders, allTimerFns };
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

try {
  const src = readFileSync(join(root, "lib/recordingSession.ts"), "utf8");
  const out = ts.transpileModule(src, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText;
  writeFileSync(join(dir, "session.mjs"), out);
  const { createRecordingController, RECORDING_LIMIT_MS } =
    await import(pathToFileURL(join(dir, "session.mjs")));

  assert.equal(RECORDING_LIMIT_MS, 15000, "녹음 길이 정책은 15초다 — 테스트로 늘리지 않는다");

  /** 한 판에 필요한 것들을 만든다. */
  function rig() {
    const clock = makeClock();
    const dev = makeDevices();
    const gumQueue = [];
    const sttQueue = [];
    const events = { phases: [], captured: [], stt: [], denied: 0 };
    const env = {
      now: clock.now,
      setTimeout: clock.setTimeout,
      clearTimeout: clock.clearTimeout,
      getUserMedia() {
        const d = deferred();
        gumQueue.push(d);
        return d.promise;
      },
      pickMimeType: () => "audio/webm",
      createRecorder: (stream, mime) => dev.makeRecorder(stream, mime),
      makeBlob: (parts, type) => ({ size: parts.reduce((a, p) => a + p.size, 0), type }),
      createObjectUrl: (blob) => {
        const u = `blob:fake/${dev.stats.urls.size + 1}`;
        dev.stats.urls.add(u);
        return u;
      },
      revokeObjectUrl: (u) => { dev.stats.urls.delete(u); },
      runStt({ blob, mimeType, token }) {
        dev.stats.sttCalls++;
        const d = deferred();
        sttQueue.push({ d, token, mimeType, blob });
        return d.promise;
      },
    };
    const c = createRecordingController(env, {
      onPhase: (p, ctx) => events.phases.push(`${ctx.sessionId}:${p}`),
      onCaptured: (r) => events.captured.push(r),
      onStt: (r) => events.stt.push(r),
      onDenied: () => { events.denied++; },
    });
    return { clock, dev, gumQueue, sttQueue, events, c, env };
  }

  /** 흔한 순서: 시작 → 권한 허용까지. */
  async function startAndGrant(r, trackCount = 2) {
    const p = r.c.start();
    await flush();
    const d = r.gumQueue.shift();
    assert.ok(d, "getUserMedia 요청이 없다");
    const stream = r.dev.makeStream(trackCount);
    d.resolve(stream);
    await p;
    await flush();
    return stream;
  }

  const liveTracks = (dev) => dev.stats.tracksCreated - dev.stats.tracksStopped;

  /* ══ 0. 재현 — 옛 구조는 같은 타임라인에서 무너진다 ══════════════ */

  await check("재현: 옛 구조에서 A 의 15초 타이머가 B 를 멈춘다 (ADD-MIC-01 이전)", () => {
    // components/VocabRecorder.tsx(931f542) 의 startRecording 을 그대로 옮긴 모델.
    // 타이머를 저장하지 않고, 콜백이 '최신' recorderRef 를 읽는다.
    const clock = makeClock();
    const dev = makeDevices();
    const recorderRef = { current: null };
    const legacyStart = () => {
      const rec = dev.makeRecorder(dev.makeStream(1), "audio/webm");
      recorderRef.current = rec;
      rec.start();
      clock.setTimeout(() => {
        if (recorderRef.current && recorderRef.current.state === "recording") {
          recorderRef.current.stop();       // ← 최신 recorder 를 멈춘다
        }
      }, 15000);
    };
    clock.advanceTo(0); legacyStart();                    // t0  A 시작
    clock.advanceTo(2000); recorderRef.current.stop();    // t2  A 중지
    clock.advanceTo(3000); legacyStart();                 // t3  B 시작
    const b = recorderRef.current;
    clock.advanceTo(15000);                               // t15 A 의 타이머가 깬다
    assert.equal(b.state, "inactive", "옛 구조에서 B 가 t15 에 멈추지 않으면 재현이 아니다");
  });

  /* ══ ADD-MIC-01 ═════════════════════════════════════════════════ */

  await check("ADD-MIC-01: A 를 t2 에 끊고 t3 에 B 를 시작해도 B 는 t15 에 살아 있고 t18 에 멈춘다", async () => {
    const r = rig();
    // t0 — A 시작
    await startAndGrant(r);
    const recA = r.dev.recorders[0];
    assert.equal(recA.state, "recording");
    const timerA = r.clock.pending()[0];
    const timerAEntry = { ...r.clock._timers.get(timerA) };

    // t2 — A 중지
    r.clock.advanceTo(2000);
    r.c.stop();
    recA.flushStop();
    await flush();
    assert.equal(r.events.captured.length, 1, "A 는 캡처돼야 한다");

    // t3 — B 시작
    r.clock.advanceTo(3000);
    await startAndGrant(r);
    const recB = r.dev.recorders[1];
    assert.equal(recB.state, "recording");
    assert.equal(r.clock.pending().length, 1, "살아 있는 타이머는 B 것 하나뿐");

    // t15 — A 의 제한시간. 콜백이 큐에 남아 있었다고 가정하고 강제로 깨운다.
    r.clock.advanceTo(15000);
    r.clock.forceFire(timerA, new Map([[timerA, timerAEntry]]));
    assert.equal(recB.state, "recording", "A 의 타이머가 B 를 멈췄다");

    // t18 — B 의 제한시간
    r.clock.advanceTo(18000);
    assert.equal(recB.state, "inactive", "B 는 자기 시작 시각 + 15초에 멈춰야 한다");
    recB.flushStop();
    await flush();
    assert.equal(r.events.captured.length, 2);
    assert.equal(r.events.captured[1].durationMs, 15000, "B 녹음 길이는 15초");
  });

  await check("ADD-MIC-01 보강: 세션마다 타이머는 정확히 하나, 중지하면 즉시 회수", async () => {
    const r = rig();
    await startAndGrant(r);
    assert.equal(r.clock.pending().length, 1);
    r.c.stop();
    assert.equal(r.clock.pending().length, 0, "중지 후 남은 타이머가 있다");
    r.dev.recorders[0].flushStop();
    await flush();
    assert.equal(r.clock.pending().length, 0);
  });

  /* ══ ADD-MIC-02 ═════════════════════════════════════════════════ */

  await check("ADD-MIC-02: 권한이 늦게 허용돼도 화면을 떠났으면 트랙을 즉시 끊는다", async () => {
    const r = rig();
    const p = r.c.start();
    await flush();
    const d = r.gumQueue.shift();

    // 아이가 닫는다 — 아직 권한 응답 전.
    r.c.cancel("close");
    const phasesAtClose = r.events.phases.length;

    // 그 뒤에 권한이 허용된다.
    const stream = r.dev.makeStream(2);
    d.resolve(stream);
    await p;
    await flush();

    assert.ok(stream.tracks.every((t) => t.stopped), "늦게 받은 트랙이 살아 있다");
    assert.equal(liveTracks(r.dev), 0, "미해제 트랙 0개여야 한다");
    assert.equal(r.dev.stats.recordersCreated, 0, "recorder 를 만들면 안 된다");
    assert.equal(r.dev.stats.sttCalls, 0, "자동 STT 가 돌면 안 된다");
    assert.equal(r.events.phases.length, phasesAtClose, "닫은 뒤 상태 알림이 더 왔다");
    assert.equal(r.clock.pending().length, 0, "미해제 timeout 0개");
  });

  await check("ADD-MIC-02 보강: 닫은 뒤 녹음·타이머·자동 STT 가 모두 0", async () => {
    const r = rig();
    await startAndGrant(r);
    r.c.cancel("close");
    // 브라우저가 stop() 때문에 onstop 을 뒤늦게 보낸다.
    r.dev.recorders[0].flushStop();
    await flush();
    assert.equal(liveTracks(r.dev), 0);
    assert.equal(r.clock.pending().length, 0);
    assert.equal(r.dev.stats.sttCalls, 0, "취소된 세션은 자동 STT 를 시작하지 않는다");
    assert.equal(r.events.captured.length, 0, "취소된 녹음이 캡처로 올라왔다");
    assert.equal(r.dev.stats.urls.size, 0, "objectURL 이 남았다");
    assert.equal(r.c.snapshot().sessionId, null);
  });

  /* ══ ADD-MIC-03 ═════════════════════════════════════════════════ */

  await check("ADD-MIC-03: 예문을 바꾼 뒤 도착한 A 의 STT 응답은 폐기되고 B 는 그대로", async () => {
    const r = rig();
    // A 예문 녹음
    await startAndGrant(r);
    r.clock.advanceTo(2000);
    r.c.stop();
    r.dev.recorders[0].flushStop();
    await flush();
    assert.equal(r.dev.stats.sttCalls, 1);
    const sttA = r.sttQueue.shift();

    // 예문 B 로 전환 — 화면에서 wordId/sentenceIdx 가 바뀐 상황
    r.c.cancel("context-change");
    assert.equal(sttA.token.cancelled, true, "전환했는데 A 의 STT 요청이 살아 있다");

    // B 녹음 완료
    await startAndGrant(r);
    r.clock.advanceTo(6000);
    r.c.stop();
    r.dev.recorders[1].flushStop();
    await flush();
    const sttB = r.sttQueue.shift();
    sttB.d.resolve({ ok: true, text: "비 문장" });
    await flush();

    // 저장 포인터 = 화면이 들고 있는 마지막 캡처. 지금은 B 여야 한다.
    const saved = r.events.captured[r.events.captured.length - 1];
    assert.equal(saved.sessionId, 2);

    // 이제서야 A 의 STT 가 늦게 응답한다.
    sttA.d.resolve({ ok: true, text: "에이 문장" });
    await flush();

    assert.deepEqual(r.events.stt.map((s) => s.text), ["비 문장"], "A 의 결과가 화면에 올라왔다");
    assert.equal(r.events.stt[0].sessionId, 2);
    assert.equal(r.events.captured[r.events.captured.length - 1].sessionId, 2, "저장 포인터가 바뀌었다");
  });

  await check("ADD-MIC-03 보강: 취소 뒤 늦게 온 A 의 onstop 은 자동 STT 를 켜지 않는다", async () => {
    const r = rig();
    await startAndGrant(r);
    r.clock.advanceTo(1000);
    r.c.stop();                         // stop 은 했는데 onstop 이 아직 안 왔다
    r.c.cancel("context-change");       // 그 사이 예문 전환
    const sttBefore = r.dev.stats.sttCalls;
    r.dev.recorders[0].flushStop();     // 이제 onstop 이 늦게 도착
    await flush();
    assert.equal(r.dev.stats.sttCalls, sttBefore, "취소된 세션이 STT 를 시작했다");
    assert.equal(r.events.captured.length, 0);
    assert.equal(liveTracks(r.dev), 0);
  });

  await check("STT 분석은 취소할 수 있고, 취소해도 녹음은 남는다", async () => {
    const r = rig();
    await startAndGrant(r);
    r.clock.advanceTo(2000);
    r.c.stop();
    r.dev.recorders[0].flushStop();
    await flush();
    assert.equal(r.c.phase(), "checking");
    const stt = r.sttQueue.shift();
    r.c.cancelStt();
    assert.equal(stt.token.cancelled, true, "취소가 요청까지 닿지 않았다");
    assert.equal(r.c.phase(), "captured");
    stt.d.resolve({ ok: true, text: "늦은 응답" });
    await flush();
    assert.equal(r.events.stt.length, 0, "취소한 분석 결과가 표시됐다");
    assert.equal(r.c.snapshot().hasObjectUrl, true, "녹음 자체는 남아 있어야 한다");
  });

  await check("브라우저가 고른 mimeType 이 Blob 과 캡처 결과에 그대로 간다", async () => {
    const r = rig();
    await startAndGrant(r);
    // 요청은 audio/webm 이었지만 이 가짜 브라우저는 그대로 받았다고 하자.
    r.dev.recorders[0].mimeType = "audio/mp4";
    r.c.stop();
    r.dev.recorders[0].flushStop();
    await flush();
    const cap = r.events.captured[0];
    assert.equal(cap.mimeType, "audio/mp4", "실제 recorder.mimeType 을 써야 한다");
    assert.equal(cap.blob.type, "audio/mp4", "Blob type 이 형식을 고정 가정했다");
    const stt = r.sttQueue.shift();
    assert.equal(stt.mimeType, "audio/mp4", "업로드/STT 로 넘어가는 형식이 다르다");
  });

  await check("권한 거부는 denied 로 끝나고 자원을 남기지 않는다", async () => {
    const r = rig();
    const p = r.c.start();
    await flush();
    r.gumQueue.shift().reject(new Error("NotAllowedError"));
    await p;
    await flush();
    assert.equal(r.c.phase(), "denied");
    assert.equal(r.events.denied, 1);
    assert.equal(liveTracks(r.dev), 0);
    assert.equal(r.clock.pending().length, 0);
  });

  await check("dispose 후에는 새 녹음이 시작되지 않는다", async () => {
    const r = rig();
    await startAndGrant(r);
    r.c.dispose();
    assert.equal(liveTracks(r.dev), 0);
    assert.equal(r.clock.pending().length, 0);
    const before = r.dev.stats.recordersCreated;
    await r.c.start();
    await flush();
    assert.equal(r.gumQueue.length, 0, "dispose 후 권한을 다시 요청했다");
    assert.equal(r.dev.stats.recordersCreated, before);
  });

  /* ══ 고정 seed 무작위 루프 ═════════════════════════════════════ */

  await check("고정 seed 2,000 단계에서 불변식 유지 (세션 ≤1 · 미해제 트랙 0 · 미해제 timeout 0)", async () => {
    const r = rig();
    let seed = 20260912;
    const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };

    for (let i = 0; i < 2000; i++) {
      const op = rnd() % 8;
      if (op === 0) {
        const p = r.c.start();
        await flush();
        if (r.gumQueue.length && rnd() % 4 !== 0) {
          r.gumQueue.shift().resolve(r.dev.makeStream(2));
        }
        await p.catch(() => {});
        await flush();
      } else if (op === 1) {
        // 보류 중이던 권한 응답을 지금 흘린다 (늦은 resolve 재현)
        const d = r.gumQueue.shift();
        if (d) { d.resolve(r.dev.makeStream(2)); await flush(); }
      } else if (op === 2) {
        r.c.stop();
      } else if (op === 3) {
        r.c.cancel(["restart", "context-change", "close"][rnd() % 3]);
      } else if (op === 4) {
        for (const rec of r.dev.recorders) rec.flushStop();
        await flush();
      } else if (op === 5) {
        const s = r.sttQueue.shift();
        if (s) { s.d.resolve({ ok: rnd() % 2 === 0, text: "x" }); await flush(); }
      } else if (op === 6) {
        r.c.cancelStt();
      } else {
        r.clock.advanceTo(r.clock.now() + 1000 + (rnd() % 9000));
        await flush();
      }

      const snap = r.c.snapshot();
      const recording = r.dev.recorders.filter((x) => x.state === "recording");
      assert.ok(recording.length <= 1, `동시에 살아 있는 녹음 ${recording.length}개`);
      assert.equal(
        r.clock.pending().length, snap.hasTimer ? 1 : 0,
        `미해제 timeout ${r.clock.pending().length}개 (세션 타이머 ${snap.hasTimer})`,
      );
      assert.equal(
        liveTracks(r.dev), snap.hasStream ? 2 : 0,
        `미해제 트랙 ${liveTracks(r.dev)}개 (세션 스트림 ${snap.hasStream})`,
      );
      assert.ok(r.dev.stats.urls.size <= 1, `objectURL 이 ${r.dev.stats.urls.size}개 남았다`);
    }

    // 화면을 닫는다 — 남는 자원 0.
    r.c.dispose();
    for (const rec of r.dev.recorders) rec.flushStop();
    while (r.gumQueue.length) { r.gumQueue.shift().resolve(r.dev.makeStream(2)); }
    await flush();
    assert.equal(liveTracks(r.dev), 0, "닫은 뒤 살아 있는 마이크 트랙이 있다");
    assert.equal(r.clock.pending().length, 0, "닫은 뒤 남은 타이머가 있다");
    assert.equal(r.dev.stats.urls.size, 0, "닫은 뒤 남은 objectURL 이 있다");
    assert.ok(r.dev.recorders.every((x) => x.state === "inactive"), "닫은 뒤에도 녹음 중인 recorder 가 있다");
  });

  console.log(`\n${count} checks passed`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
