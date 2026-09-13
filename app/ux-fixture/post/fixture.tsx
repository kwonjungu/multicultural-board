"use client";

import { useEffect, useRef, useState } from "react";
import PostModal, { type PostSubmitOutcome, type PostSubmitPayload } from "@/components/PostModal";
import TutorChat from "@/components/TutorChat";
import {
  initialPostDraft,
  postDraftReducer,
  type PostDraftAction,
  type PostDraftState,
} from "@/lib/postDraftState";

/** 고정 입력: 시각 2026-09-11T00:00:00Z, seed 17, 가짜 이름만. */
const USER = { myLang: "ko", myName: "학생 01", isTeacher: false, teacherLangs: [] };

type Scenario = "ok" | "fail" | "slow" | "offline" | "silent";
/** 튜터 스트림 주입: off · 천천히 오는 정상 스트림 · 빈 응답(실패). */
type TutorMode = "off" | "stream" | "fail";

const SCENARIOS: { id: Scenario; label: string; note: string }[] = [
  { id: "ok",      label: "200 정상",        note: "60ms 뒤 {ok:true}" },
  { id: "fail",    label: "500 서버 오류",   note: "60ms 뒤 {ok:false, error:server}" },
  { id: "slow",    label: "2초 지연 후 성공", note: "보내는 중 화면 확인용" },
  { id: "offline", label: "offline (throw)", note: "fetch 자체가 실패하는 경우" },
  { id: "silent",  label: "결과 미보고",     note: "기존 PadletBoard 처럼 void 반환" },
];

interface SaveLog {
  n: number;
  clientRequestId: string;
  cardType: string;
  text: string;
  scenario: Scenario;
  outcome: string;
  /** 같은 id 로 이미 저장된 카드가 있었는가 — 서버/DB 저장 경계의 중복 방지. */
  dedup: boolean;
}

/** 결함 주입 시나리오를 순수 reducer 로 재생한다 — 브라우저·네트워크 없이. */
const REPLAYS: { id: string; title: string; expect: string; steps: PostDraftAction[] }[] = [
  {
    id: "duplicate",
    title: "중복 응답",
    expect: "published (두 번째 성공 응답은 무시)",
    steps: [
      { type: "edit", patch: { text: "같은 응답이 두 번 온다" } },
      { type: "preview" },
      { type: "submit", requestId: "rq-dup" },
      { type: "serverAccepted", requestId: "rq-dup" },
      { type: "serverAccepted", requestId: "rq-dup" },
    ],
  },
  {
    id: "outOfOrder",
    title: "응답 순서 뒤바뀜",
    expect: "published (늦게 온 실패가 성공을 덮지 않음)",
    steps: [
      { type: "edit", patch: { text: "실패가 늦게 도착한다" } },
      { type: "preview" },
      { type: "submit", requestId: "rq-order" },
      { type: "serverAccepted", requestId: "rq-order" },
      { type: "serverRejected", requestId: "rq-order", error: "server" },
    ],
  },
  {
    id: "lateAfterAbort",
    title: "abort 후 늦은 응답",
    expect: "failed → 본문 보존, 옛 id 응답은 무시",
    steps: [
      { type: "edit", patch: { text: "취소한 요청의 응답" } },
      { type: "preview" },
      { type: "submit", requestId: "rq-old" },
      { type: "serverRejected", requestId: "rq-old", error: "network" },
      { type: "serverAccepted", requestId: "rq-old" },
    ],
  },
  {
    id: "retrySameId",
    title: "실패 → 재시도 → 성공",
    expect: "published, attempts 2, 같은 clientRequestId",
    steps: [
      { type: "edit", patch: { text: "연결이 끊겼다가 다시 붙는다" } },
      { type: "preview" },
      { type: "submit", requestId: "rq-retry" },
      { type: "serverRejected", requestId: "rq-retry", error: "network" },
      { type: "submit", requestId: "rq-NEW-ignored" },
      { type: "serverAccepted", requestId: "rq-retry" },
    ],
  },
  {
    id: "approval",
    title: "교사 승인 모드",
    expect: "awaitingReview (공개 아님)",
    steps: [
      { type: "edit", patch: { text: "선생님이 먼저 본다" } },
      { type: "preview" },
      { type: "submit", requestId: "rq-appr", approval: true },
      { type: "serverAccepted", requestId: "rq-appr", approval: true },
    ],
  },
];

function replay(steps: PostDraftAction[]): PostDraftState {
  return steps.reduce(postDraftReducer, initialPostDraft());
}

export default function PostFixture() {
  const [scenario, setScenario] = useState<Scenario>("ok");
  const [approval, setApproval] = useState(false);
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<SaveLog[]>([]);
  const [ready, setReady] = useState(false);
  /** 주입한 가짜 저장소. 같은 clientRequestId 는 한 번만 저장된다. */
  const storeRef = useRef(new Map<string, PostSubmitPayload>());
  const seqRef = useRef(0);
  const scenarioRef = useRef<Scenario>("ok");
  scenarioRef.current = scenario;
  const [tutor, setTutor] = useState<TutorMode>("off");
  const tutorRef = useRef<TutorMode>("off");
  tutorRef.current = tutor;

  // 쿼리로 자동화 스크립트가 상태를 고정한다: ?scenario=slow&approval=1&open=1
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const s = q.get("scenario") as Scenario | null;
    if (s && SCENARIOS.some((x) => x.id === s)) setScenario(s);
    if (q.get("approval") === "1") setApproval(true);
    if (q.get("open") === "1") setOpen(true);
    const tm = q.get("tutor");
    if (tm === "stream" || tm === "fail") setTutor(tm);
    setReady(true);
  }, []);

  // 네트워크 차단: fixture 는 어떤 원격 호출도 하지 않는다. /api/* 는 canned 응답,
  // 그 밖의 외부 호출은 시끄럽게 실패시켜 실수로 새는 경로를 드러낸다.
  useEffect(() => {
    const real = window.fetch.bind(window);
    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const path = url.startsWith("http") ? new URL(url).pathname : url;
      if (path.startsWith("/_next") || path.startsWith("/__next")) return real(input as RequestInfo, init);
      if (path === "/api/upload") {
        return new Response(JSON.stringify({ url: "/mascot/bee-cheer.png" }), {
          status: 200, headers: { "content-type": "application/json" },
        });
      }
      if (path === "/api/stt") {
        return new Response(JSON.stringify({ text: "가짜 음성 결과" }), {
          status: 200, headers: { "content-type": "application/json" },
        });
      }
      if (path === "/api/tutor-chat") return cannedTutorStream(tutorRef.current);
      if (path.startsWith("/api/")) throw new Error(`[fixture] 차단된 호출: ${path}`);
      return real(input as RequestInfo, init);
    }) as typeof window.fetch;
    return () => { window.fetch = real; };
  }, []);

  /** 주입 가능한 가짜 저장 함수. 여기가 실제 저장 경계를 흉내 낸다. */
  async function fakeSave(data: PostSubmitPayload): Promise<PostSubmitOutcome | void> {
    const sc = scenarioRef.current;
    const id = data.clientRequestId || "(없음)";
    const wait = sc === "slow" ? 2000 : 60;
    await new Promise((r) => setTimeout(r, wait));

    const n = ++seqRef.current;
    const push = (outcome: string, dedup: boolean) =>
      setLogs((prev) => [...prev, {
        n, clientRequestId: id, cardType: data.cardType,
        text: (data.text || "").slice(0, 30), scenario: sc, outcome, dedup,
      }]);

    if (sc === "offline") { push("throw (offline)", false); throw new Error("offline"); }
    if (sc === "fail") { push("{ok:false, error:server}", false); return { ok: false, error: "server" }; }

    // 저장 경계의 중복 방지 — 같은 id 는 카드를 새로 만들지 않는다.
    const dedup = storeRef.current.has(id);
    if (!dedup) storeRef.current.set(id, data);

    if (sc === "silent") { push("void (결과 미보고)", dedup); return; }
    push("{ok:true}", dedup);
    return { ok: true };
  }

  if (!ready) return null;

  return (
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 900, margin: "0 auto", overflowWrap: "anywhere" }}>
      <h1 data-fixture-chrome style={{ fontSize: "1.4rem", margin: 0 }}>작성 흐름 fixture (개발 전용)</h1>
      <p data-fixture-chrome style={{ margin: 0 }}>
        운영 방·Firebase·원격 API 를 쓰지 않는다. 저장은 아래 가짜 함수가 받고,
        <code> /api/* </code> 는 이 화면이 가로챈다.
      </p>

      <section data-fixture-chrome style={{ display: "grid", gap: 8 }}>
        <strong>저장 시나리오</strong>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              data-fx={`scenario-${s.id}`}
              onClick={() => setScenario(s.id)}
              style={{
                padding: "10px 14px", minHeight: 44, cursor: "pointer",
                border: scenario === s.id ? "3px solid #895300" : "1px solid #999",
                borderRadius: 10, background: "#fff",
              }}
            >{s.label}<br /><small>{s.note}</small></button>
          ))}
        </div>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={approval} onChange={(e) => setApproval(e.target.checked)} data-fx="approval" />
          교사 승인 모드 (POST-03)
        </label>
        <button type="button" data-fx="open" onClick={() => setOpen(true)} style={{ padding: "12px 16px", minHeight: 48, cursor: "pointer" }}>
          글쓰기 모달 열기
        </button>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <strong style={{ width: "100%" }}>튜터 꿀비 스트림 주입</strong>
          {(["off", "stream", "fail"] as TutorMode[]).map((m) => (
            <button
              key={m}
              type="button"
              data-fx={`tutor-${m}`}
              onClick={() => setTutor(m)}
              style={{
                padding: "10px 14px", minHeight: 44, cursor: "pointer", borderRadius: 10, background: "#fff",
                border: tutor === m ? "3px solid #895300" : "1px solid #999",
              }}
            >{m}</button>
          ))}
        </div>
      </section>

      <section data-fixture-chrome style={{ display: "grid", gap: 8 }}>
        <strong>가짜 저장소 기록 (같은 clientRequestId 는 한 번만 저장)</strong>
        <ol data-fx="log" style={{ margin: 0, paddingLeft: 20 }}>
          {logs.map((l) => (
            <li key={l.n}>
              <code>{l.clientRequestId}</code> · {l.cardType} · “{l.text}” · {l.scenario} → {l.outcome}
              {l.dedup ? " · 중복 id → 저장 생략" : ""}
            </li>
          ))}
        </ol>
        <p data-fx="store-size" style={{ margin: 0 }}>저장된 카드 수: {storeRef.current.size} / 호출 수: {logs.length}</p>
      </section>

      <section data-fixture-chrome style={{ display: "grid", gap: 8 }}>
        <strong>결함 주입 재생 (순수 reducer — 네트워크 없음)</strong>
        {/* 넓은 표는 문서가 아니라 자기 상자 안에서 가로 스크롤한다 (HARNESS §4). */}
        <div style={{ overflowX: "auto", maxWidth: "100%" }}>
        <table data-fx="replay" style={{ borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr><th style={TH}>경우</th><th style={TH}>기대</th><th style={TH}>결과 phase</th><th style={TH}>확정</th><th style={TH}>attempts</th><th style={TH}>본문</th></tr>
          </thead>
          <tbody>
            {REPLAYS.map((r) => {
              const s = replay(r.steps);
              return (
                <tr key={r.id} data-fx={`replay-${r.id}`}>
                  <td style={TD}>{r.title}</td>
                  <td style={TD}>{r.expect}</td>
                  <td style={TD}><code data-fx="phase">{s.phase}</code></td>
                  <td style={TD}>{s.serverConfirmed ? "서버 확정" : "로컬 에코만"}</td>
                  <td style={TD}>{s.attempts}</td>
                  <td style={TD}>{s.draft.text || "(없음)"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </section>

      {tutor !== "off" && (
        <TutorChat roomCode="9999" myClientId="fixture-client" user={USER} />
      )}

      {open && (
        <PostModal
          colId="col-fixture"
          colTitle="오늘 기분"
          colColor="#F59E0B"
          user={USER}
          posting={false}
          approvalMode={approval}
          myClientId="fixture-client"
          roomCode="9999"
          onPost={fakeSave}
          onClose={() => setOpen(false)}
        />
      )}
    </main>
  );
}

/**
 * /api/tutor-chat 을 대신하는 canned SSE. 실제 Groq·네트워크를 쓰지 않는다.
 * 서버(lib/groq-stream.ts)가 내보내는 delta/final 이벤트 모양 그대로 흉내 낸다.
 */
function cannedTutorStream(mode: TutorMode): Response {
  if (mode === "fail") {
    // 빈 응답 — 콘텐츠 차단이 아니라 통신 실패로 다뤄야 하는 경우.
    return new Response(JSON.stringify({ reply: "", kind: "error" }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  }
  const parts = ["안녕! ", "‘학교’ 는 ", "school 이라는 뜻이야. ", "같이 읽어 볼까?"];
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const text of parts) {
        await new Promise((r) => setTimeout(r, 700));
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: "delta", text })}

`));
      }
      controller.enqueue(enc.encode(`data: ${JSON.stringify({
        type: "final", reply: parts.join(""), kind: "normal", model: "fixture",
      })}

`));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

const TH: React.CSSProperties = { border: "1px solid #ccc", padding: "6px 8px", textAlign: "left" };
const TD: React.CSSProperties = { border: "1px solid #ccc", padding: "6px 8px" };
