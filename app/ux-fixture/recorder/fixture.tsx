"use client";

import { useMemo, useState } from "react";
import VocabRecorder from "@/components/VocabRecorder";
import type { RecordingEnv, RecorderLike, BlobLike } from "@/lib/recordingSession";

/**
 * 가짜 녹음 환경. 마이크·네트워크·Firebase 를 전혀 건드리지 않는다.
 *
 * - getUserMedia 는 트랙이 없는 가짜 스트림을 즉시 준다(권한 창이 뜨지 않는다).
 * - recorder 는 stop() 뒤 다음 tick 에 onstop 을 부른다(실제 브라우저처럼 비동기).
 * - STT 는 고정된 문자열을 지연 후 돌려준다 — '분석 중' 상태를 실측할 수 있다.
 */
function makeFixtureEnv(sttDelayMs: number, recognized: string): RecordingEnv {
  return {
    now: () => Date.now(),
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
    clearTimeout: (h) => window.clearTimeout(h as number),
    getUserMedia: async () => ({ getTracks: () => [] }),
    pickMimeType: () => "audio/webm",
    createRecorder: (): RecorderLike => {
      const rec = {
        state: "inactive" as "inactive" | "recording" | "paused",
        mimeType: "audio/webm",
        ondataavailable: null as RecorderLike["ondataavailable"],
        onstop: null as RecorderLike["onstop"],
        start() {
          rec.state = "recording";
          rec.ondataavailable?.({ data: { size: 2048, type: "audio/webm" } });
        },
        stop() {
          if (rec.state === "inactive") return;
          rec.state = "inactive";
          window.setTimeout(() => rec.onstop?.(), 0);
        },
      };
      return rec as unknown as RecorderLike;
    },
    makeBlob: (parts, type): BlobLike => ({
      size: parts.reduce((a, p) => a + p.size, 0) || 2048,
      type,
    }),
    // 재생은 하지 않는다 — 소리가 나면 실측이 아니라 부작용이다.
    createObjectUrl: () => "about:blank#fixture-recording",
    revokeObjectUrl: () => {},
    runStt: ({ token }) =>
      new Promise((resolve) => {
        const id = window.setTimeout(() => resolve({ ok: true, text: recognized }), sttDelayMs);
        token.onCancel(() => window.clearTimeout(id));
      }),
  };
}

const SENTENCE = "학교에 같이 가요";

export default function RecorderFixture() {
  // 예문 전환(ADD-MIC-03)을 손으로도 확인할 수 있게 둔다.
  const [idx, setIdx] = useState(0);
  const env = useMemo(() => makeFixtureEnv(1200, "학교에 가요"), []);

  return (
    <div data-ux-root className="rf-root">
      <header className="rf-head">
        <h1 data-ux-role="title" style={{ margin: 0 }}>말해 보기 화면 검수</h1>
        <p data-ux-role="secondary" style={{ margin: 0 }}>
          개발용 화면입니다. 마이크와 인터넷을 쓰지 않고, 녹음·인식을 흉내 냅니다.
        </p>
      </header>

      <div className="rf-bar">
        <button
          type="button"
          data-ux-role="control"
          className="rf-switch"
          onClick={() => setIdx((n) => (n + 1) % 2)}
        >
          <span aria-hidden="true">↔</span>
          <span>다른 예문으로 바꾸기 (지금 {idx + 1}번)</span>
        </button>
      </div>

      <p data-ux-role="body-emphasis" className="rf-sentence" data-ux-reading>
        {idx === 0 ? SENTENCE : "친구야, 같이 놀자"}
      </p>

      <VocabRecorder
        key="fixture-recorder"
        sentenceText={idx === 0 ? SENTENCE : "친구야, 같이 놀자"}
        wordForms={["학교", "가요"]}
        onOriginalPlay={() => { /* fixture 에서는 소리를 내지 않는다 */ }}
        onComplete={() => { /* 상위 학습 흐름 없음 */ }}
        roomCode="9999"
        clientId="fixture-learner"
        wordId="fixture-word"
        sentenceIdx={idx}
        lang="ko"
        recordingEnv={env}
      />

      <style dangerouslySetInnerHTML={{ __html: `
.rf-root{
  min-height: 100%;
  background: var(--ux-bg);
  color: var(--ux-ink);
  padding: var(--ux-space-5);
  display: grid; gap: var(--ux-space-4);
  align-content: start;
  max-width: 1180px; margin: 0 auto;
}
.rf-head{ display: grid; gap: var(--ux-space-1); }
.rf-bar{ display: flex; gap: var(--ux-space-2); flex-wrap: wrap; }
.rf-switch[data-ux-role="control"]{
  display: inline-flex; align-items: center; gap: var(--ux-space-2);
  background: var(--ux-surface); color: var(--ux-ink);
  border: 2px solid var(--ux-primary-border);
  font-family: inherit; font-weight: 700;
  white-space: normal; word-break: keep-all;
}
.rf-sentence{
  margin: 0; padding: var(--ux-space-4);
  background: var(--ux-surface); border: 2px solid var(--ux-primary-border);
  border-radius: var(--ux-radius-surface);
}
` }} />
    </div>
  );
}
