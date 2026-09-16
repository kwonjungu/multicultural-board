"use client";

// [#6] 실시간 화이트보드 — 하이러닝식 멀티툴 보드 (모니터링 + 프롬프트)
//   학생: 펜·형광펜·직선·사각형·원·화살표·글자·지우개 + 되돌리기로 그리면
//         스냅샷이 자동 업로드.
//   교사: 전 학생 보드를 갤러리로 실시간 모니터링 + 확대 + 공통 주제 내려주기.

import { useEffect, useState } from "react";
import type { UserConfig } from "@/lib/types";
import { useBackLayer } from "@/lib/backStack";
import DrawBoard from "./DrawBoard";
import ScopedStyle from "./ui/child/ScopedStyle";
import {
  setWhiteboardPrompt,
  setWhiteboardActive,
  subscribeWhiteboardMeta,
  pushWhiteboardSnapshot,
  subscribeWhiteboardBoards,
  clearWhiteboardBoards,
  type WhiteboardMeta,
  type WhiteboardBoard,
} from "@/lib/whiteboard";

const CANVAS_W = 720;
const CANVAS_H = 480;
const PAGE_BG = "linear-gradient(rgba(255,251,235,0.9), rgba(253,230,138,0.9)), url('/landing/game-canyon.webp') center / cover no-repeat";

/**
 * 화면 CSS — U-WB01 (04 §5 / §1 Q5).
 *
 * 이전에는 폭이 900px 로 고정돼 있어 넓은 화면에서는 좌우 여백만 계속
 * 커졌다(§1 Q5 가 금지한 패턴). 캔버스가 이 화면의 핵심이므로 폭을 넓혀
 * 실제로 더 크게 그릴 수 있게 한다 — tokens.json responsive.containers 의
 * 넓은 화면 상한(1280px)을 따른다.
 *
 * 교사 화면은 조작(토글·주제 입력·통계)과 갤러리(가변 개수 카드)의 성격이
 * 달라 세로로만 쌓으면 조작이 항상 위쪽 절반을 차지하고 갤러리가 밀린다.
 * 900px 이상에서는 조작을 왼쪽 고정 폭 사이드바로 돌리고 갤러리를 오른쪽
 * 남는 폭에 맡긴다 — 그래야 학생이 늘어도 갤러리가 넓게 쓴다.
 *
 * 버튼은 좌우로 나눈다: 보조(닫기·되돌아가기)는 낮은 강조, 주 동작(저장·
 * 활성화 토글)은 오른쪽/굵게. 크기는 인라인 px 가 아니라 [data-ux-role]
 * 토큰이 정한다.
 */
const WB_CSS = `
.wb-page{ max-width: 1180px; margin: 0 auto; }
.wb-header{
  background: #fff; border-radius: var(--ux-radius-panel); padding: var(--ux-space-3) var(--ux-space-4);
  border: 2px solid #FDE68A; box-shadow: 0 8px 24px rgba(180,83,9,0.12);
  display: flex; align-items: center; gap: var(--ux-space-3); margin-bottom: var(--ux-space-4);
}
.wb-back{
  flex-shrink: 0; background: #fff; border: 2px solid #FDE68A; color: #92400E; font-weight: 900;
}
.wb-header-text{ flex: 1; min-width: 0; }
.wb-title{ color: #1F2937; font-weight: 900; letter-spacing: -0.3px; }
.wb-sub{ color: #B45309; margin-top: 1px; }

.wb-toggle{
  width: 100%; display: flex; align-items: center; gap: var(--ux-space-3);
  margin-bottom: var(--ux-space-4); cursor: pointer; font-family: inherit; text-align: left;
  border: 2px solid #FDE68A; box-shadow: 0 6px 18px rgba(180,83,9,0.1);
}
.wb-toggle.on{ background: linear-gradient(135deg, #CCFBF1, #99F6E4); border-color: #14B8A6; }
.wb-toggle:not(.on){ background: #fff; }
.wb-toggle-emoji{ font-size: 24px; }
.wb-toggle-text{ flex: 1; min-width: 0; }
.wb-toggle-label{ display: block; color: #1F2937; font-weight: 900; }
.wb-toggle-hint{ display: block; margin-top: 1px; }
.wb-toggle-hint.on{ color: #0F766E; }
.wb-toggle-hint:not(.on){ color: #92400E; }
.wb-switch{
  width: 46px; height: 26px; border-radius: 999px; flex-shrink: 0; position: relative; transition: background 0.15s;
}
.wb-switch.on{ background: #14B8A6; }
.wb-switch:not(.on){ background: #D1D5DB; }
.wb-switch-dot{
  position: absolute; top: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff;
  transition: left 0.15s; box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}

.wb-prompt-card{
  background: #fff; border-radius: var(--ux-radius-panel); padding: var(--ux-space-4);
  border: 2px solid #FDE68A; box-shadow: 0 6px 18px rgba(180,83,9,0.1); margin-bottom: var(--ux-space-4);
}
.wb-prompt-heading{ color: #92400E; margin-bottom: var(--ux-space-2); }
.wb-prompt-row{ display: flex; gap: var(--ux-space-2); }
.wb-prompt-input{
  flex: 1; min-width: 0; min-height: var(--ux-control-min); box-sizing: border-box;
  border-radius: var(--ux-radius-surface); border: 2px solid #FDE68A;
  font-size: var(--ux-font-body); color: #1F2937; font-family: inherit; font-weight: 600;
  outline: none; background: #FFFBEB; padding: var(--ux-space-2) var(--ux-space-3);
}
.wb-prompt-save{
  border: none; white-space: nowrap; font-family: inherit; font-weight: 900; color: #fff;
}
.wb-prompt-save:not(:disabled){ background: linear-gradient(135deg, #F59E0B, #D97706); cursor: pointer; }
.wb-prompt-save:disabled{ background: #E5E7EB; color: #9CA3AF; cursor: wait; }

.wb-statsrow{ display: flex; align-items: center; gap: var(--ux-space-3); flex-wrap: wrap; margin-bottom: var(--ux-space-3); }
.wb-statchip{
  display: inline-flex; align-items: center;
  background: #fff; border: 2px solid #FDE68A; border-radius: var(--ux-radius-pill);
  color: #B45309; font-weight: 900; padding: var(--ux-space-2) var(--ux-space-3);
}
.wb-clearall{ margin-left: auto; border: 2px solid #FECACA; background: #fff; color: #B91C1C; font-weight: 900; }

.wb-empty{
  text-align: center; padding: 50px 20px; background: rgba(255,255,255,0.85);
  border-radius: var(--ux-radius-panel); border: 2px dashed #FDE68A; color: #92400E; font-weight: 700;
}

/* 갤러리 열 수는 폭으로만 정한다(다른 목록 화면과 같은 경계). 사이드바가
   생기는 900px 이상에서도 남는 폭 안에서 auto-fill 이 알아서 늘어난다. */
.wb-gallery{ display: grid; gap: var(--ux-space-3); grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); }
.wb-gcard{
  background: #fff; border: 2px solid #FDE68A; border-radius: var(--ux-radius-surface);
  cursor: pointer; text-align: left; box-shadow: 0 6px 16px rgba(180,83,9,0.12);
  padding: var(--ux-space-2);
}
.wb-gcard-name{ color: #1F2937; font-weight: 900; margin-top: var(--ux-space-2); padding-left: 2px; }

.wb-modal-close{ background: #fff; border: 2px solid #FDE68A; color: #92400E; font-weight: 900; }

.wb-sync{ display: flex; align-items: center; gap: 6px; margin-bottom: var(--ux-space-3); }
.wb-sync-dot{ width: 8px; height: 8px; border-radius: 50%; }
.wb-sync-dot.on{ background: #10B981; }
.wb-sync-dot:not(.on){ background: #D1D5DB; }

/* 900px 이상: 교사 조작(토글·주제·통계)을 왼쪽 사이드바로, 갤러리를 오른쪽에.
   세로로만 쌓으면 학생이 늘수록 갤러리가 계속 아래로 밀린다. */
@media (min-width: 900px){
  .wb-teacher{ display: flex; align-items: flex-start; gap: var(--ux-space-4); }
  .wb-teacher-side{ width: 320px; flex-shrink: 0; position: sticky; top: var(--ux-space-4); }
  .wb-teacher-main{ flex: 1; min-width: 0; }
}
`;

/**
 * 개발용 fixture 주입구 (HARNESS §2 G0). 값이 있으면 이 화면은 Firebase 를
 * 구독하지도, 쓰지도 않는다. 운영 방(1111) 학생 보드를 fixture 로 복제하지 않는다.
 */
export interface WhiteboardFixture {
  meta?: WhiteboardMeta;
  /** 교사 갤러리에 채울 학생 보드 — dataUrl 은 지어낸 그림(데이터 URL)이어야 한다. */
  boards?: WhiteboardBoard[];
  /** 학생 화면 자신의 캔버스에 심을 초기 그림(빈 캔버스 방지). */
  myBoardImageDataUrl?: string;
}

interface Props {
  user: UserConfig;
  roomCode: string;
  myClientId: string;
  onBack: () => void;
  fixture?: WhiteboardFixture;
}

export default function WhiteboardRoom({ user, roomCode, myClientId, onBack, fixture }: Props) {
  /** fixture 가 주입되면 네트워크 경계를 통째로 끈다. */
  const offline = !!fixture;
  const [prompt, setPrompt] = useState(fixture?.meta?.prompt || "");
  const [active, setActive] = useState(!!fixture?.meta?.active);

  useEffect(() => {
    if (offline) return;
    const unsub = subscribeWhiteboardMeta(roomCode, (m) => {
      setPrompt(m.prompt || "");
      setActive(!!m.active);
    });
    return () => unsub();
  }, [roomCode, offline]);

  return (
    <div
      data-ux-root
      style={{
        minHeight: "100svh", background: PAGE_BG, backgroundAttachment: "fixed",
        fontFamily: "'Pretendard Variable', 'Pretendard', 'Noto Sans KR', sans-serif",
        padding: "var(--ux-space-4) var(--ux-space-3) var(--ux-space-8)",
      }}
    >
      <ScopedStyle css={WB_CSS} />
      <div className="wb-page">
        {/* 헤더 */}
        <div className="wb-header">
          <button
            onClick={onBack}
            aria-label="back"
            data-ux-role="control"
            className="wb-back"
          >←</button>
          <div className="wb-header-text">
            <div data-ux-role="body-emphasis" className="wb-title">🖍️ 실시간 화이트보드</div>
            <div data-ux-role="secondary" className="wb-sub">
              {user.isTeacher ? "학생들의 그림을 실시간으로 모니터링" : "그림을 그리면 선생님이 실시간으로 봐요"}
            </div>
          </div>
        </div>

        {user.isTeacher ? (
          <TeacherWhiteboard roomCode={roomCode} prompt={prompt} active={active} offline={offline} initialBoards={fixture?.boards ?? []} />
        ) : (
          <StudentWhiteboard
            roomCode={roomCode}
            myClientId={myClientId}
            name={user.myName}
            prompt={prompt}
            offline={offline}
            initialImageDataUrl={fixture?.myBoardImageDataUrl}
          />
        )}
      </div>
    </div>
  );
}

// ════════════════════ 교사: 갤러리 + 프롬프트 ════════════════════
function TeacherWhiteboard({
  roomCode, prompt, active, offline, initialBoards,
}: { roomCode: string; prompt: string; active: boolean; offline: boolean; initialBoards: WhiteboardBoard[] }) {
  const [boards, setBoards] = useState<WhiteboardBoard[]>(initialBoards);
  const [draft, setDraft] = useState(prompt);
  const [saving, setSaving] = useState(false);
  const [enlarged, setEnlarged] = useState<WhiteboardBoard | null>(null);
  const [toggling, setToggling] = useState(false);

  useEffect(() => { setDraft(prompt); }, [prompt]);

  async function toggleActive() {
    if (offline) return;
    setToggling(true);
    try { await setWhiteboardActive(roomCode, !active); } catch { /* noop */ }
    setToggling(false);
  }

  useEffect(() => {
    if (offline) return;
    const unsub = subscribeWhiteboardBoards(roomCode, setBoards);
    return () => unsub();
  }, [roomCode, offline]);

  useBackLayer(enlarged !== null, () => setEnlarged(null));

  async function savePrompt() {
    if (offline) return;
    setSaving(true);
    try { await setWhiteboardPrompt(roomCode, draft.trim()); } catch { /* noop */ }
    setSaving(false);
  }

  async function clearAll() {
    if (offline) return;
    if (!window.confirm("모든 학생의 그림을 지웁니다. 계속할까요?")) return;
    try { await clearWhiteboardBoards(roomCode); } catch { /* noop */ }
  }

  return (
    <>
      <div className="wb-teacher">
        <div className="wb-teacher-side">
          {/* 활성화 토글 — ON 이면 학생 화면이 자동으로 화이트보드로 따라온다 */}
          <button
            onClick={toggleActive}
            disabled={toggling}
            aria-pressed={active}
            data-ux-role="action"
            className={active ? "wb-toggle on" : "wb-toggle"}
            style={{ cursor: toggling ? "wait" : "pointer" }}
          >
            <span aria-hidden className="wb-toggle-emoji">{active ? "🟢" : "⚪"}</span>
            <span className="wb-toggle-text">
              <span className="wb-toggle-label">화이트보드 {active ? "활성화됨" : "활성화"}</span>
              <span data-ux-role="secondary" className={active ? "wb-toggle-hint on" : "wb-toggle-hint"}>
                {active ? "학생 화면이 자동으로 화이트보드로 모였어요" : "켜면 모든 학생 화면이 화이트보드로 자동 이동해요"}
              </span>
            </span>
            <span aria-hidden className={active ? "wb-switch on" : "wb-switch"}>
              <span className="wb-switch-dot" style={{ left: active ? 23 : 3 }} />
            </span>
          </button>

          {/* 프롬프트 편집 */}
          <div className="wb-prompt-card">
            <div data-ux-role="label" className="wb-prompt-heading">✏️ 오늘의 그리기 주제 (학생 화면에 표시)</div>
            <div className="wb-prompt-row">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="예: 우리 가족을 그려보세요"
                className="wb-prompt-input"
              />
              <button
                onClick={savePrompt}
                disabled={saving}
                data-ux-role="control"
                className="wb-prompt-save"
              >저장</button>
            </div>
          </div>

          {/* 통계 + 비우기 */}
          <div className="wb-statsrow">
            <span data-ux-role="label" className="wb-statchip">🖼️ {boards.length}명 그리는 중</span>
            <button
              onClick={clearAll}
              data-ux-role="control"
              className="wb-clearall"
            >🗑 전체 비우기</button>
          </div>
        </div>

        {/* 갤러리 */}
        <div className="wb-teacher-main">
          {boards.length === 0 ? (
            <div className="wb-empty">
              <div style={{ fontSize: 40, marginBottom: 8 }}>🐝</div>
              아직 그림을 그리는 학생이 없어요.
            </div>
          ) : (
            <div className="wb-gallery">
              {boards.map((b) => (
                <button
                  key={b.clientId}
                  onClick={() => setEnlarged(b)}
                  data-ux-role="control"
                  className="wb-gcard"
                >
                  <img
                    src={b.dataUrl}
                    alt={`${b.name} 그림`}
                    style={{ width: "100%", borderRadius: 10, display: "block", background: "#fff", aspectRatio: `${CANVAS_W} / ${CANVAS_H}`, objectFit: "cover" }}
                  />
                  <div data-ux-role="label" className="wb-gcard-name">{b.name}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 확대 모달 */}
      {enlarged && (
        <div
          onClick={() => setEnlarged(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 450,
            background: "rgba(9,7,30,0.8)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{
            background: "#fff", borderRadius: 22, padding: 16, maxWidth: 820, width: "100%",
            boxShadow: "0 32px 80px rgba(0,0,0,0.4)",
          }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 10, gap: 10 }}>
              <div data-ux-role="body-emphasis" style={{ flex: 1, color: "#1F2937" }}>
                🖍️ {enlarged.name}
              </div>
              <button
                onClick={() => setEnlarged(null)}
                aria-label="close"
                data-ux-role="control"
                className="wb-modal-close"
              >✕</button>
            </div>
            <img src={enlarged.dataUrl} alt={`${enlarged.name} 그림`} style={{ width: "100%", borderRadius: 12, background: "#fff" }} />
          </div>
        </div>
      )}
    </>
  );
}

// ════════════════════ 학생: 공용 DrawBoard + 자동 업로드 ════════════════════
function StudentWhiteboard({
  roomCode, myClientId, name, prompt, offline, initialImageDataUrl,
}: { roomCode: string; myClientId: string; name: string; prompt: string; offline: boolean; initialImageDataUrl?: string }) {
  // fixture 에서는 "선생님이 보고 있어요" 상태를 이미 동기화된 것으로 보여준다
  // (검수 화면이 계속 "연결 중…"으로 멈춰 있지 않도록).
  const [synced, setSynced] = useState(offline);

  // 빈 보드 1회 등장 + 그릴 때마다 스냅샷 업로드 (공용 DrawBoard onChange).
  const handleChange = (dataUrl: string) => {
    if (offline) return;
    pushWhiteboardSnapshot(roomCode, myClientId, name, dataUrl)
      .then(() => setSynced(true))
      .catch(() => { /* noop */ });
  };

  return (
    <div style={{
      background: "#fff", borderRadius: 20, padding: "var(--ux-space-4)",
      border: "2px solid #FDE68A", boxShadow: "0 8px 24px rgba(180,83,9,0.12)",
    }}>
      {/* 주제 */}
      {prompt && (
        <div data-ux-role="body-emphasis" style={{
          background: "#FEF3C7", border: "2px solid #FDE68A", borderRadius: 14,
          padding: "10px 14px", marginBottom: 12, color: "#92400E",
        }}>
          ✏️ {prompt}
        </div>
      )}

      {/* 동기화 표시 */}
      <div className="wb-sync">
        <span className={synced ? "wb-sync-dot on" : "wb-sync-dot"} />
        <span data-ux-role="secondary">{synced ? "선생님이 보고 있어요" : "연결 중…"}</span>
      </div>

      <DrawBoard
        width={CANVAS_W} height={CANVAS_H} onChange={handleChange}
        fixture={initialImageDataUrl ? { initialImageDataUrl } : undefined}
      />
    </div>
  );
}
