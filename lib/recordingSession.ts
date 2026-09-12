/**
 * 녹음은 화면 상태가 아니라 **세션 자원**이다 — 추가 설계 X03.
 *
 * 한 번의 "말해 보기" 에 딸리는 자원을 전부 하나로 묶는다:
 *   sessionId · recorder instance · 15초 timeout · media tracks ·
 *   진행 중 STT 요청(pendingRequestId) · objectURL
 *
 * 고쳐야 했던 것 (components/VocabRecorder.tsx 의 옛 startRecording):
 *   - 15초 timeout 을 어디에도 저장하지 않고, 콜백이 **최신** recorderRef 를
 *     읽었다. A 를 2초에 끊고 3초에 B 를 시작하면 A 의 타이머가 t=15 에 깨어나
 *     "지금 recording 중인 recorder" = B 를 멈춰버린다.
 *   - getUserMedia 가 화면을 떠난 뒤 늦게 성공하면 트랙이 살아 있었다.
 *   - onstop 이 취소 여부를 보지 않고 항상 자동 STT 를 시작했다.
 *
 * 그래서 timeout 콜백은 **그때의 rec 과 sessionId 를 클로저로 캡처**하고,
 * 자기 세션이 여전히 최신일 때만 그 rec 를 멈춘다. 모든 늦은 응답
 * (getUserMedia / onstop / STT) 은 같은 방식으로 세션 유효성을 먼저 본다.
 *
 * 브라우저 API 는 전부 `RecordingEnv` 로 주입한다. 그래야 node 에서
 * fake clock + controlled promise + track.stop spy 로 재현 검사를 돌릴 수 있다
 * (scripts/test-recording-session.mjs). 실제 브라우저 구현은
 * `browserRecordingEnv()` 하나뿐이다.
 */

/** 녹음 길이 정책. 정책 값이므로 테스트를 통과시키려고 늘리지 않는다. */
export const RECORDING_LIMIT_MS = 15000;

export type RecordingPhase =
  | "idle"
  | "requesting"
  | "recording"
  | "stopping"
  | "captured"
  | "checking"
  | "denied";

export type CancelReason = "restart" | "context-change" | "close" | "dispose";

export interface TrackLike {
  stop(): void;
}
export interface StreamLike {
  getTracks(): TrackLike[];
}
export interface BlobLike {
  size: number;
  type: string;
}
export interface RecorderLike {
  readonly state: "inactive" | "recording" | "paused";
  /** 브라우저가 실제로 고른 형식. 고정 가정 금지 — Blob/업로드에 이 값을 쓴다. */
  readonly mimeType: string;
  start(): void;
  stop(): void;
  ondataavailable: ((e: { data: BlobLike }) => void) | null;
  onstop: (() => void) | null;
}

/** 진행 중 요청을 끊기 위한 최소 토큰. 브라우저 구현은 AbortController 로 잇는다. */
export interface CancelToken {
  readonly cancelled: boolean;
  onCancel(cb: () => void): void;
}

export interface SttOutcome {
  ok: boolean;
  /** 인식된 문자열. 실패면 빈 문자열. */
  text: string;
  error?: unknown;
}

export interface RecordingEnv {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  getUserMedia(): Promise<StreamLike>;
  /** 지원되는 형식 중 하나. "" 이면 브라우저 기본값으로 recorder 를 만든다. */
  pickMimeType(): string;
  createRecorder(stream: StreamLike, mimeType: string): RecorderLike;
  makeBlob(parts: BlobLike[], type: string): BlobLike;
  createObjectUrl(blob: BlobLike): string;
  revokeObjectUrl(url: string): void;
  runStt(req: { blob: BlobLike; mimeType: string; token: CancelToken }): Promise<SttOutcome>;
}

export interface CapturedRecording {
  sessionId: number;
  blob: BlobLike;
  url: string;
  durationMs: number;
  /** 브라우저가 실제로 쓴 형식 — Blob type 과 업로드 metadata 가 이 값을 따른다. */
  mimeType: string;
}

export interface RecordingCallbacks {
  onPhase?(phase: RecordingPhase, ctx: { sessionId: number; reason?: CancelReason }): void;
  onCaptured?(r: CapturedRecording): void;
  onStt?(r: SttOutcome & { sessionId: number }): void;
  onDenied?(err: unknown): void;
}

export interface RecordingSnapshot {
  sessionId: number | null;
  phase: RecordingPhase;
  hasRecorder: boolean;
  hasStream: boolean;
  hasTimer: boolean;
  hasObjectUrl: boolean;
  sttPending: boolean;
  startedAt: number | null;
}

export interface RecordingController {
  /** 이전 세션을 정리하고 새 세션을 연다. 권한 요청은 이 안에서 일어난다. */
  start(): Promise<void>;
  /** 아이가 말을 끝냄 → 녹음 종료 후 자동 STT. */
  stop(): void;
  /** 예문 변경 · 닫기 · 다시 말하기 — 결과를 버린다. 자동 STT 를 시작하지 않는다. */
  cancel(reason: CancelReason): void;
  /** 분석만 취소하고 녹음 자체는 남긴다. */
  cancelStt(): void;
  /** 언마운트. 모든 자원 회수. */
  dispose(): void;
  phase(): RecordingPhase;
  sessionId(): number | null;
  elapsedMs(): number;
  snapshot(): RecordingSnapshot;
}

interface Session {
  id: number;
  phase: RecordingPhase;
  recorder: RecorderLike | null;
  stream: StreamLike | null;
  timer: unknown | null;
  startedAt: number;
  chunks: BlobLike[];
  requestedMime: string;
  objectUrl: string | null;
  cancelled: boolean;
  stt: MutableToken | null;
}

interface MutableToken extends CancelToken {
  cancel(): void;
}

function makeToken(): MutableToken {
  let cancelled = false;
  const subs: Array<() => void> = [];
  return {
    get cancelled() {
      return cancelled;
    },
    onCancel(cb) {
      if (cancelled) cb();
      else subs.push(cb);
    },
    cancel() {
      if (cancelled) return;
      cancelled = true;
      for (const cb of subs.splice(0)) {
        try {
          cb();
        } catch {
          /* 취소 알림 실패는 무시 — 정리는 계속돼야 한다 */
        }
      }
    },
  };
}

function stopTracks(stream: StreamLike | null): void {
  if (!stream) return;
  let tracks: TrackLike[] = [];
  try {
    tracks = stream.getTracks() || [];
  } catch {
    return;
  }
  for (const t of tracks) {
    try {
      t.stop();
    } catch {
      /* 이미 끝난 트랙 */
    }
  }
}

export function createRecordingController(
  env: RecordingEnv,
  cb: RecordingCallbacks = {},
): RecordingController {
  let seq = 0;
  let current: Session | null = null;
  let disposed = false;

  function setPhase(s: Session, phase: RecordingPhase, reason?: CancelReason): void {
    s.phase = phase;
    // 취소된 세션은 더 이상 화면에 말을 걸지 않는다 (ADD-MIC-02: 상태 알림 0개).
    if (s.cancelled && phase !== "idle") return;
    cb.onPhase?.(phase, { sessionId: s.id, reason });
  }

  function clearTimer(s: Session): void {
    if (s.timer === null) return;
    env.clearTimeout(s.timer);
    s.timer = null;
  }

  function releaseUrl(s: Session): void {
    if (!s.objectUrl) return;
    try {
      env.revokeObjectUrl(s.objectUrl);
    } catch {
      /* 이미 해제됨 */
    }
    s.objectUrl = null;
  }

  /** 세션 자원 전체 회수. 이 함수만이 자원을 놓아준다. */
  function teardown(s: Session): void {
    clearTimer(s);
    s.stt?.cancel();
    s.stt = null;
    const rec = s.recorder;
    if (rec) {
      rec.ondataavailable = null;
      // onstop 은 남겨둔다 — 실제 브라우저는 stop() 후에 한 번 더 부르고,
      // 그 핸들러가 cancelled 를 보고 조용히 트랙을 정리한다.
      try {
        if (rec.state !== "inactive") rec.stop();
      } catch {
        /* 이미 멈춤 */
      }
    }
    stopTracks(s.stream);
    s.stream = null;
    s.recorder = null;
    s.chunks = [];
    releaseUrl(s);
  }

  function cancel(reason: CancelReason): void {
    const s = current;
    current = null;
    if (!s) return;
    if (s.cancelled) {
      teardown(s);
      return;
    }
    s.cancelled = true;
    teardown(s);
    s.phase = "idle";
    cb.onPhase?.("idle", { sessionId: s.id, reason });
  }

  async function runSttFor(s: Session, blob: BlobLike, mimeType: string): Promise<void> {
    const token = makeToken();
    s.stt = token;
    setPhase(s, "checking");
    let outcome: SttOutcome;
    try {
      outcome = await env.runStt({ blob, mimeType, token });
    } catch (err) {
      outcome = { ok: false, text: "", error: err };
    }
    // 늦은 응답: 취소됐거나 다른 세션으로 넘어갔으면 통째로 폐기 (ADD-MIC-03).
    if (token.cancelled || s.cancelled || current !== s) return;
    s.stt = null;
    setPhase(s, "captured");
    cb.onStt?.({ ...outcome, sessionId: s.id });
  }

  function finishSession(s: Session, rec: RecorderLike): void {
    const durationMs = Math.max(0, env.now() - s.startedAt);
    clearTimer(s);
    // 트랙은 취소 여부와 무관하게 항상 회수한다.
    stopTracks(s.stream);
    s.stream = null;
    const mimeType = rec.mimeType || s.requestedMime || "audio/webm";
    const parts = s.chunks;
    s.chunks = [];
    // 취소된 세션의 결과물은 만들지도 않는다 — objectURL 도, 자동 STT 도 없다.
    if (s.cancelled || current !== s) return;
    const blob = env.makeBlob(parts, mimeType);
    releaseUrl(s);
    const url = env.createObjectUrl(blob);
    s.objectUrl = url;
    setPhase(s, "captured");
    cb.onCaptured?.({ sessionId: s.id, blob, url, durationMs, mimeType });
    void runSttFor(s, blob, mimeType);
  }

  async function start(): Promise<void> {
    if (disposed) return;
    cancel("restart");
    const s: Session = {
      id: ++seq,
      phase: "idle",
      recorder: null,
      stream: null,
      timer: null,
      startedAt: 0,
      chunks: [],
      requestedMime: "",
      objectUrl: null,
      cancelled: false,
      stt: null,
    };
    current = s;
    setPhase(s, "requesting");

    let stream: StreamLike;
    try {
      stream = await env.getUserMedia();
    } catch (err) {
      if (s.cancelled || current !== s) return;
      setPhase(s, "denied");
      cb.onDenied?.(err);
      return;
    }

    // 권한이 늦게 떨어졌는데 이미 화면을 떠났다면 트랙을 즉시 끊는다 (ADD-MIC-02).
    if (disposed || s.cancelled || current !== s) {
      stopTracks(stream);
      return;
    }
    s.stream = stream;

    let rec: RecorderLike;
    const mime = env.pickMimeType();
    s.requestedMime = mime;
    try {
      rec = env.createRecorder(stream, mime);
    } catch (err) {
      stopTracks(stream);
      s.stream = null;
      if (s.cancelled || current !== s) return;
      setPhase(s, "denied");
      cb.onDenied?.(err);
      return;
    }
    s.recorder = rec;
    rec.ondataavailable = (e) => {
      if (e?.data && e.data.size > 0) s.chunks.push(e.data);
    };
    rec.onstop = () => finishSession(s, rec);

    try {
      rec.start();
    } catch (err) {
      stopTracks(stream);
      s.stream = null;
      s.recorder = null;
      if (s.cancelled || current !== s) return;
      setPhase(s, "denied");
      cb.onDenied?.(err);
      return;
    }
    s.startedAt = env.now();
    setPhase(s, "recording");

    // ★ 제한시간 콜백은 '그때의 세션과 recorder' 만 건드린다.
    //   최신 recorderRef 를 읽으면 A 의 타이머가 B 를 멈춘다 (ADD-MIC-01).
    s.timer = env.setTimeout(() => {
      s.timer = null;
      if (s.cancelled || current !== s) return;
      if (rec.state !== "recording") return;
      stopSession(s);
    }, RECORDING_LIMIT_MS);
  }

  function stopSession(s: Session): void {
    clearTimer(s);
    const rec = s.recorder;
    if (!rec) return;
    if (rec.state === "inactive") return;
    setPhase(s, "stopping");
    try {
      rec.stop();
    } catch {
      /* 이미 멈춘 recorder — onstop 이 오지 않을 수 있으니 자원만 회수 */
      stopTracks(s.stream);
      s.stream = null;
    }
  }

  return {
    start,
    stop() {
      if (current) stopSession(current);
    },
    cancel,
    cancelStt() {
      const s = current;
      if (!s || !s.stt) return;
      s.stt.cancel();
      s.stt = null;
      setPhase(s, "captured");
    },
    dispose() {
      disposed = true;
      cancel("dispose");
    },
    phase() {
      return current?.phase ?? "idle";
    },
    sessionId() {
      return current?.id ?? null;
    },
    elapsedMs() {
      if (!current || !current.startedAt) return 0;
      if (current.phase !== "recording" && current.phase !== "stopping") return 0;
      return Math.max(0, env.now() - current.startedAt);
    },
    snapshot() {
      const s = current;
      return {
        sessionId: s?.id ?? null,
        phase: s?.phase ?? "idle",
        hasRecorder: !!s?.recorder,
        hasStream: !!s?.stream,
        hasTimer: !!s && s.timer !== null,
        hasObjectUrl: !!s?.objectUrl,
        sttPending: !!s?.stt && !s.stt.cancelled,
        startedAt: s?.startedAt || null,
      };
    },
  };
}

/* ── 브라우저 구현 ──────────────────────────────────────────────────── */

/** MediaRecorder 가 실제로 지원하는 형식을 고른다. webm 고정 가정 금지. */
const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/ogg",
];

export function pickSupportedMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const m of MIME_CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m;
    } catch {
      /* 구형 브라우저엔 isTypeSupported 가 없다 */
    }
  }
  return "";
}

export function isRecordingSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

/** STT 호출 한 곳. provider 교체는 이 프로젝트 범위 밖이다 — /api/stt 유지. */
async function postStt(blob: BlobLike, mimeType: string, token: CancelToken): Promise<SttOutcome> {
  const ac = new AbortController();
  token.onCancel(() => ac.abort());
  const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("ogg") ? "ogg" : "webm";
  const form = new FormData();
  form.append("audio", new File([blob as unknown as Blob], `recording.${ext}`, { type: mimeType }));
  form.append("lang", "ko");
  const res = await fetch("/api/stt", { method: "POST", body: form, signal: ac.signal });
  if (!res.ok) throw new Error(`stt ${res.status}`);
  const j = (await res.json()) as { text?: string };
  return { ok: true, text: (j.text ?? "").trim() };
}

export function browserRecordingEnv(): RecordingEnv {
  return {
    now: () => Date.now(),
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
    clearTimeout: (h) => window.clearTimeout(h as number),
    getUserMedia: () => navigator.mediaDevices.getUserMedia({ audio: true }),
    pickMimeType: pickSupportedMimeType,
    createRecorder: (stream, mimeType) =>
      (mimeType
        ? new MediaRecorder(stream as unknown as MediaStream, { mimeType })
        : new MediaRecorder(stream as unknown as MediaStream)) as unknown as RecorderLike,
    makeBlob: (parts, type) =>
      new Blob(parts as unknown as BlobPart[], { type }) as unknown as BlobLike,
    createObjectUrl: (blob) => URL.createObjectURL(blob as unknown as Blob),
    revokeObjectUrl: (url) => URL.revokeObjectURL(url),
    runStt: ({ blob, mimeType, token }) => postStt(blob, mimeType, token),
  };
}
