"use client";

// [#6] 실시간 화이트보드 — 하이러닝식 멀티툴 보드 (모니터링 + 프롬프트)
//   학생: 펜·형광펜·직선·사각형·원·화살표·글자·지우개 + 되돌리기로 그리면
//         스냅샷이 자동 업로드.
//   교사: 전 학생 보드를 갤러리로 실시간 모니터링 + 확대 + 공통 주제 내려주기.

import { useEffect, useState } from "react";
import type { UserConfig } from "@/lib/types";
import { useBackLayer } from "@/lib/backStack";
import DrawBoard from "./DrawBoard";
import {
  setWhiteboardPrompt,
  setWhiteboardActive,
  subscribeWhiteboardMeta,
  pushWhiteboardSnapshot,
  subscribeWhiteboardBoards,
  clearWhiteboardBoards,
  type WhiteboardBoard,
} from "@/lib/whiteboard";

const CANVAS_W = 720;
const CANVAS_H = 480;
const PAGE_BG = "linear-gradient(rgba(255,251,235,0.9), rgba(253,230,138,0.9)), url('/landing/game-canyon.webp') center / cover no-repeat";

interface Props {
  user: UserConfig;
  roomCode: string;
  myClientId: string;
  onBack: () => void;
}

export default function WhiteboardRoom({ user, roomCode, myClientId, onBack }: Props) {
  const [prompt, setPrompt] = useState("");
  const [active, setActive] = useState(false);

  useEffect(() => {
    const unsub = subscribeWhiteboardMeta(roomCode, (m) => {
      setPrompt(m.prompt || "");
      setActive(!!m.active);
    });
    return () => unsub();
  }, [roomCode]);

  return (
    <div style={{
      minHeight: "100vh", background: PAGE_BG, backgroundAttachment: "fixed",
      fontFamily: "'Pretendard Variable', 'Pretendard', 'Noto Sans KR', sans-serif",
      padding: "16px 12px 32px",
    }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* 헤더 */}
        <div style={{
          background: "#fff", borderRadius: 20, padding: "12px 14px",
          border: "2px solid #FDE68A", boxShadow: "0 8px 24px rgba(180,83,9,0.12)",
          display: "flex", alignItems: "center", gap: 12, marginBottom: 14,
        }}>
          <button
            onClick={onBack}
            aria-label="back"
            style={{
              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
              background: "#fff", border: "2px solid #FDE68A",
              fontSize: 16, fontWeight: 900, color: "#92400E", cursor: "pointer",
            }}
          >←</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 900, color: "#1F2937", letterSpacing: -0.3 }}>
              🖍️ 실시간 화이트보드
            </div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#B45309", marginTop: 1 }}>
              {user.isTeacher ? "학생들의 그림을 실시간으로 모니터링" : "그림을 그리면 선생님이 실시간으로 봐요"}
            </div>
          </div>
        </div>

        {user.isTeacher ? (
          <TeacherWhiteboard roomCode={roomCode} prompt={prompt} active={active} />
        ) : (
          <StudentWhiteboard roomCode={roomCode} myClientId={myClientId} name={user.myName} prompt={prompt} />
        )}
      </div>
    </div>
  );
}

// ════════════════════ 교사: 갤러리 + 프롬프트 ════════════════════
function TeacherWhiteboard({ roomCode, prompt, active }: { roomCode: string; prompt: string; active: boolean }) {
  const [boards, setBoards] = useState<WhiteboardBoard[]>([]);
  const [draft, setDraft] = useState(prompt);
  const [saving, setSaving] = useState(false);
  const [enlarged, setEnlarged] = useState<WhiteboardBoard | null>(null);
  const [toggling, setToggling] = useState(false);

  useEffect(() => { setDraft(prompt); }, [prompt]);

  async function toggleActive() {
    setToggling(true);
    try { await setWhiteboardActive(roomCode, !active); } catch { /* noop */ }
    setToggling(false);
  }

  useEffect(() => {
    const unsub = subscribeWhiteboardBoards(roomCode, setBoards);
    return () => unsub();
  }, [roomCode]);

  useBackLayer(enlarged !== null, () => setEnlarged(null));

  async function savePrompt() {
    setSaving(true);
    try { await setWhiteboardPrompt(roomCode, draft.trim()); } catch { /* noop */ }
    setSaving(false);
  }

  async function clearAll() {
    if (!window.confirm("모든 학생의 그림을 지웁니다. 계속할까요?")) return;
    try { await clearWhiteboardBoards(roomCode); } catch { /* noop */ }
  }

  return (
    <>
      {/* 활성화 토글 — ON 이면 학생 화면이 자동으로 화이트보드로 따라온다 */}
      <button
        onClick={toggleActive}
        disabled={toggling}
        aria-pressed={active}
        style={{
          width: "100%", marginBottom: 14, display: "flex", alignItems: "center", gap: 12,
          padding: "14px 16px", borderRadius: 18, cursor: toggling ? "wait" : "pointer",
          fontFamily: "inherit", textAlign: "left",
          background: active ? "linear-gradient(135deg, #CCFBF1, #99F6E4)" : "#fff",
          border: `2px solid ${active ? "#14B8A6" : "#FDE68A"}`,
          boxShadow: "0 6px 18px rgba(180,83,9,0.1)",
        }}
      >
        <span style={{ fontSize: 24 }}>{active ? "🟢" : "⚪"}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 15, fontWeight: 900, color: "#1F2937" }}>
            화이트보드 {active ? "활성화됨" : "활성화"}
          </span>
          <span style={{ display: "block", fontSize: 11, fontWeight: 700, color: active ? "#0F766E" : "#92400E", marginTop: 1 }}>
            {active ? "학생 화면이 자동으로 화이트보드로 모였어요" : "켜면 모든 학생 화면이 화이트보드로 자동 이동해요"}
          </span>
        </span>
        <span style={{
          width: 46, height: 26, borderRadius: 999, flexShrink: 0, position: "relative",
          background: active ? "#14B8A6" : "#D1D5DB", transition: "background 0.15s",
        }}>
          <span style={{
            position: "absolute", top: 3, left: active ? 23 : 3,
            width: 20, height: 20, borderRadius: "50%", background: "#fff",
            transition: "left 0.15s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
          }} />
        </span>
      </button>

      {/* 프롬프트 편집 */}
      <div style={{
        background: "#fff", borderRadius: 18, padding: "14px 16px",
        border: "2px solid #FDE68A", boxShadow: "0 6px 18px rgba(180,83,9,0.1)", marginBottom: 14,
      }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: "#92400E", marginBottom: 8 }}>
          ✏️ 오늘의 그리기 주제 (학생 화면에 표시)
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="예: 우리 가족을 그려보세요"
            style={{
              flex: 1, minHeight: 44, padding: "8px 12px", borderRadius: 12,
              border: "2px solid #FDE68A", fontSize: 14, fontWeight: 600, color: "#1F2937",
              fontFamily: "inherit", outline: "none", background: "#FFFBEB",
            }}
          />
          <button
            onClick={savePrompt}
            disabled={saving}
            style={{
              minHeight: 44, padding: "0 16px", borderRadius: 12, border: "none",
              background: saving ? "#E5E7EB" : "linear-gradient(135deg, #F59E0B, #D97706)",
              color: saving ? "#9CA3AF" : "#fff", fontSize: 14, fontWeight: 900, cursor: saving ? "wait" : "pointer",
              whiteSpace: "nowrap",
            }}
          >저장</button>
        </div>
      </div>

      {/* 통계 + 비우기 */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{
          padding: "5px 12px", background: "#fff", border: "2px solid #FDE68A",
          borderRadius: 999, fontSize: 12, fontWeight: 900, color: "#B45309",
        }}>🖼️ {boards.length}명 그리는 중</span>
        <div style={{ flex: 1 }} />
        <button
          onClick={clearAll}
          style={{
            padding: "8px 14px", borderRadius: 12, border: "2px solid #FECACA",
            background: "#fff", color: "#B91C1C", fontSize: 12, fontWeight: 900, cursor: "pointer",
          }}
        >🗑 전체 비우기</button>
      </div>

      {/* 갤러리 */}
      {boards.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "50px 20px", background: "rgba(255,255,255,0.85)",
          borderRadius: 18, border: "2px dashed #FDE68A", color: "#92400E", fontWeight: 700,
        }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🐝</div>
          아직 그림을 그리는 학생이 없어요.
        </div>
      ) : (
        <div style={{
          display: "grid", gap: 12,
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
        }}>
          {boards.map((b) => (
            <button
              key={b.clientId}
              onClick={() => setEnlarged(b)}
              style={{
                background: "#fff", border: "2px solid #FDE68A", borderRadius: 16,
                padding: 8, cursor: "pointer", textAlign: "left",
                boxShadow: "0 6px 16px rgba(180,83,9,0.12)",
              }}
            >
              <img
                src={b.dataUrl}
                alt={`${b.name} 그림`}
                style={{ width: "100%", borderRadius: 10, display: "block", background: "#fff", aspectRatio: `${CANVAS_W} / ${CANVAS_H}`, objectFit: "cover" }}
              />
              <div style={{ fontSize: 12, fontWeight: 900, color: "#1F2937", marginTop: 6, paddingLeft: 2 }}>
                {b.name}
              </div>
            </button>
          ))}
        </div>
      )}

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
            <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
              <div style={{ flex: 1, fontSize: 16, fontWeight: 900, color: "#1F2937" }}>
                🖍️ {enlarged.name}
              </div>
              <button
                onClick={() => setEnlarged(null)}
                aria-label="close"
                style={{
                  width: 36, height: 36, borderRadius: 10, border: "2px solid #FDE68A",
                  background: "#fff", color: "#92400E", fontSize: 16, fontWeight: 900, cursor: "pointer",
                }}
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
  roomCode, myClientId, name, prompt,
}: { roomCode: string; myClientId: string; name: string; prompt: string }) {
  const [synced, setSynced] = useState(false);

  // 빈 보드 1회 등장 + 그릴 때마다 스냅샷 업로드 (공용 DrawBoard onChange).
  const handleChange = (dataUrl: string) => {
    pushWhiteboardSnapshot(roomCode, myClientId, name, dataUrl)
      .then(() => setSynced(true))
      .catch(() => { /* noop */ });
  };

  return (
    <div style={{
      background: "#fff", borderRadius: 20, padding: "14px 16px",
      border: "2px solid #FDE68A", boxShadow: "0 8px 24px rgba(180,83,9,0.12)",
    }}>
      {/* 주제 */}
      {prompt && (
        <div style={{
          background: "#FEF3C7", border: "2px solid #FDE68A", borderRadius: 14,
          padding: "10px 14px", marginBottom: 12, fontSize: 15, fontWeight: 900, color: "#92400E",
        }}>
          ✏️ {prompt}
        </div>
      )}

      {/* 동기화 표시 */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: synced ? "#10B981" : "#D1D5DB" }} />
        <span style={{ fontSize: 11, fontWeight: 800, color: "#6B7280" }}>
          {synced ? "선생님이 보고 있어요" : "연결 중…"}
        </span>
      </div>

      <DrawBoard width={CANVAS_W} height={CANVAS_H} onChange={handleChange} />
    </div>
  );
}
