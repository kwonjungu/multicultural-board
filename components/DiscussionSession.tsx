"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ref,
  onValue,
  off,
  set,
  push,
  remove,
  onDisconnect,
} from "firebase/database";
import { getClientDb } from "@/lib/firebase-client";
import { BRAND_GRADIENT, LANGUAGES } from "@/lib/constants";
import { SessionMeta, SessionResponse, SessionReply, PresenceEntry } from "@/lib/types";

interface Props {
  roomCode: string;
  sessionId: string;
  isTeacher: boolean;
  myClientId: string;
  myName: string;
  myLang: string;
  onExit: () => void;
}

export default function DiscussionSession({
  roomCode,
  sessionId,
  isTeacher,
  myClientId,
  myName,
  myLang,
  onExit,
}: Props) {
  const [meta, setMeta] = useState<SessionMeta | null>(null);
  const [responses, setResponses] = useState<SessionResponse[]>([]);
  const [presence, setPresence] = useState<Record<string, PresenceEntry>>({});
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState("");
  // 공개 화면 보기 모드: 나무(과일) ↔ 격자(다인원 가독 보장)
  const [closedView, setClosedView] = useState<"tree" | "grid">("tree");

  const basePath = `rooms/${roomCode}/sessions/${sessionId}`;

  // ── Meta listener ──
  useEffect(() => {
    const db = getClientDb();
    const metaRef = ref(db, `${basePath}/meta`);
    const cb = onValue(metaRef, (snap) => {
      setMeta(snap.val() as SessionMeta | null);
    });
    return () => off(metaRef, "value", cb);
  }, [basePath]);

  // ── Responses listener ──
  useEffect(() => {
    const db = getClientDb();
    const respRef = ref(db, `${basePath}/responses`);
    const cb = onValue(respRef, (snap) => {
      const val = snap.val() as Record<string, SessionResponse> | null;
      if (!val) {
        setResponses([]);
        return;
      }
      const list = Object.entries(val).map(([id, r]) => ({ ...r, id }));
      list.sort((a, b) => a.timestamp - b.timestamp);
      setResponses(list);
    });
    return () => off(respRef, "value", cb);
  }, [basePath]);

  // ── Presence listener (teacher + for stats) ──
  useEffect(() => {
    const db = getClientDb();
    const presRef = ref(db, `${basePath}/presence`);
    const cb = onValue(presRef, (snap) => {
      const val = (snap.val() as Record<string, PresenceEntry> | null) || {};
      setPresence(val);
    });
    return () => off(presRef, "value", cb);
  }, [basePath]);

  // ── Own presence: heartbeat + onDisconnect cleanup (students only) ──
  useEffect(() => {
    if (isTeacher) return;
    const db = getClientDb();
    const myRef = ref(db, `${basePath}/presence/${myClientId}`);
    const write = () =>
      set(myRef, {
        name: myName,
        lang: myLang,
        lastSeen: Date.now(),
        submitted: false,
      } satisfies PresenceEntry).catch(() => {});
    write();
    onDisconnect(myRef).remove().catch(() => {});
    const heartbeat = setInterval(() => {
      set(ref(db, `${basePath}/presence/${myClientId}/lastSeen`), Date.now()).catch(() => {});
    }, 15000);
    return () => clearInterval(heartbeat);
  }, [basePath, isTeacher, myClientId, myName, myLang]);

  // Has current student submitted?
  const myResponse = useMemo(
    () => responses.find((r) => r.authorClientId === myClientId),
    [responses, myClientId],
  );

  const isClosed = meta?.status === "closed";
  const live = !!meta?.liveReveal; // 활성 세션 중 실시간 공개 모드

  async function handleSubmit() {
    if (!draft.trim() || submitting || isClosed || isTeacher) return;
    setError("");
    setSubmitting(true);
    try {
      const text = draft.trim();
      const targets = (meta?.targetLangs || []).filter((l) => l !== myLang);
      let translations: Record<string, string> = { [myLang]: text };
      if (targets.length > 0) {
        try {
          const tres = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text,
              fromLang: myLang,
              targetLangs: targets,
              authorName: myName,
              isTeacher: false,
              paletteIdx: 0,
              roomCode,
              cardType: "comment",
            }),
          });
          const tdata = await tres.json();
          if (tdata.translations) translations = tdata.translations;
        } catch { /* fall back to original */ }
      }

      const db = getClientDb();
      const respRef = ref(db, `${basePath}/responses`);
      const newRef = push(respRef);
      const body: Omit<SessionResponse, "id"> = {
        authorName: myName,
        authorLang: myLang,
        authorClientId: myClientId,
        text,
        translations,
        timestamp: Date.now(),
      };
      await set(newRef, body);
      await set(ref(db, `${basePath}/presence/${myClientId}/submitted`), true);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "제출 실패");
    }
    setSubmitting(false);
  }

  // 현재 언어로 번역된 제목/본문 (없으면 원문)
  const displayTitle = meta?.titleTranslations?.[myLang] || meta?.title || "";
  const displayBody = meta?.bodyTextTranslations?.[myLang] || meta?.bodyText || "";

  async function handleClose() {
    if (!isTeacher || closing) return;
    if (!confirm("세션을 종료하면 학생이 더 이상 제출할 수 없고, 모든 응답이 공개됩니다. 계속할까요?"))
      return;
    setClosing(true);
    try {
      const db = getClientDb();
      await set(ref(db, `${basePath}/meta/status`), "closed");
      await set(ref(db, `${basePath}/meta/closedAt`), Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "종료 실패");
    }
    setClosing(false);
  }

  async function handleDeleteSession() {
    if (!isTeacher) return;
    if (!confirm("세션과 모든 응답을 영구 삭제합니다. 되돌릴 수 없습니다. 계속할까요?")) return;
    const db = getClientDb();
    await remove(ref(db, basePath));
    await set(ref(db, `rooms/${roomCode}/activeSession`), null);
    onExit();
  }

  if (!meta) {
    return (
      <div style={overlayStyle}>
        <div style={{ color: "#fff", fontSize: 14 }}>세션 로딩 중...</div>
      </div>
    );
  }

  // ═════════════════════════════ CLOSED: tree view ═════════════════════════════
  if (isClosed) {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 450,
        background: "#0F0C28",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        <div style={{
          flex: 1, minHeight: 0,
          background: "linear-gradient(180deg,#E8F5FF 0%,#FFF9E8 65%,#F0F7E8 100%)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          <ClosedHeader
            title={displayTitle}
            bodyText={displayBody}
            count={responses.length}
            isTeacher={isTeacher}
            onExit={onExit}
            onDelete={handleDeleteSession}
            view={closedView}
            onToggleView={() => setClosedView((v) => (v === "tree" ? "grid" : "tree"))}
          />

          {responses.length === 0 ? (
            <div style={{ textAlign: "center", color: "#6B7280", padding: "60px 0", fontSize: 14 }}>
              제출된 응답이 없습니다.
            </div>
          ) : closedView === "tree" ? (
            <FruitTree
              question={displayTitle}
              responses={responses}
              myLang={myLang}
            />
          ) : (
            <ResponseGrid
              responses={responses}
              myLang={myLang}
              basePath={basePath}
              myClientId={myClientId}
              myName={myName}
              targetLangs={meta?.targetLangs || []}
            />
          )}
        </div>
      </div>
    );
  }

  // ═════════════════════════════ ACTIVE — teacher panel ═════════════════════════════
  if (isTeacher) {
    const connected = Object.entries(presence).filter(
      ([, p]) => Date.now() - p.lastSeen < 45000,
    );
    const submittedCount = responses.length;

    return (
      <div style={overlayStyle}>
        <div style={{
          width: "100%", maxWidth: 780, maxHeight: "90vh",
          background: "#fff", borderRadius: 20, overflow: "hidden",
          boxShadow: "0 32px 80px rgba(0,0,0,0.3)",
          display: "flex", flexDirection: "column",
        }}>
          {/* Header */}
          <div style={{
            padding: "18px 22px", background: BRAND_GRADIENT, color: "#fff",
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <div style={{
              padding: "3px 8px", background: "rgba(255,255,255,0.25)",
              borderRadius: 8, fontSize: 10, fontWeight: 800, letterSpacing: 0.5,
            }}>
              LIVE
            </div>
            <div style={{ fontWeight: 800, fontSize: 16, flex: 1 }}>{displayTitle}</div>
            <button
              onClick={onExit}
              title="최소화"
              style={{
                background: "rgba(255,255,255,0.2)", border: "none", color: "#fff",
                width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16,
              }}
            >—</button>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 22px" }}>
            {displayBody && (
              <div style={{
                fontSize: 13, color: "#4B5563", marginBottom: 14,
                whiteSpace: "pre-wrap", lineHeight: 1.5,
              }}>
                {displayBody}
              </div>
            )}
            {meta.imageUrl && (
              <img src={meta.imageUrl} alt="" style={{
                width: "100%", borderRadius: 12, marginBottom: 16,
                border: "1px solid #E5E7EB",
              }} />
            )}

            {/* Stats */}
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <StatBox label="접속 중" value={connected.length} color="#10B981" />
              <StatBox label="제출" value={submittedCount} color="#F59E0B" />
              <StatBox
                label="제출률"
                value={connected.length > 0 ? `${Math.round((submittedCount / connected.length) * 100)}%` : "—"}
                color="#F59E0B"
              />
            </div>

            {/* Submitter list */}
            <div style={{ fontSize: 11, fontWeight: 800, color: "#9CA3AF", marginBottom: 8 }}>
              제출 현황
            </div>
            {connected.length === 0 && responses.length === 0 ? (
              <div style={{ fontSize: 13, color: "#9CA3AF", padding: "16px 0", textAlign: "center" }}>
                아직 접속한 학생이 없습니다.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {connected.map(([cid, p]) => {
                  const submitted = responses.some((r) => r.authorClientId === cid);
                  return (
                    <div key={cid} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "8px 12px", background: submitted ? "#ECFDF5" : "#F9FAFB",
                      borderRadius: 8, border: `1px solid ${submitted ? "#A7F3D0" : "#E5E7EB"}`,
                    }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: submitted ? "#10B981" : "#D1D5DB",
                      }} />
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", flex: 1 }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: 11, color: submitted ? "#059669" : "#9CA3AF", fontWeight: 700 }}>
                        {submitted ? "✓ 제출" : "대기"}
                      </div>
                    </div>
                  );
                })}
                {/* Submitters who are no longer "connected" (left page after submitting) */}
                {responses
                  .filter((r) => !connected.some(([cid]) => cid === r.authorClientId))
                  .map((r) => (
                    <div key={r.id} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "8px 12px", background: "#ECFDF5",
                      borderRadius: 8, border: "1px solid #A7F3D0",
                    }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981" }} />
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", flex: 1 }}>
                        {r.authorName}
                      </div>
                      <div style={{ fontSize: 11, color: "#059669", fontWeight: 700 }}>✓ 제출</div>
                    </div>
                  ))}
              </div>
            )}

            {live && responses.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#9CA3AF", marginBottom: 8 }}>
                  실시간 의견 ({responses.length})
                </div>
                <ResponseGrid
                  responses={responses}
                  myLang={myLang}
                  basePath={basePath}
                  myClientId={myClientId}
                  myName={myName}
                  targetLangs={meta?.targetLangs || []}
                />
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div style={{
            padding: "14px 22px", borderTop: "1px solid #F3F4F6",
            display: "flex", gap: 10,
          }}>
            <button
              onClick={handleDeleteSession}
              style={{
                padding: "12px 16px", borderRadius: 10, fontSize: 13,
                background: "#FEF2F2", color: "#B91C1C", fontWeight: 700,
                border: "1px solid #FECACA", cursor: "pointer",
              }}
            >
              🗑 취소
            </button>
            <button
              onClick={handleClose}
              disabled={closing}
              style={{
                flex: 1, padding: "12px 16px", borderRadius: 10, fontSize: 14,
                background: closing ? "#9CA3AF" : BRAND_GRADIENT,
                color: "#fff", fontWeight: 800, border: "none",
                cursor: closing ? "wait" : "pointer",
                boxShadow: "0 4px 16px rgba(245,158,11,0.4)",
              }}
            >
              {closing ? "종료 중..." : `🏁 세션 종료 · 응답 공개 (${submittedCount})`}
            </button>
          </div>
          {error && (
            <div style={{
              padding: "8px 22px", background: "#FEF2F2", color: "#991B1B",
              fontSize: 12, borderTop: "1px solid #FECACA",
            }}>{error}</div>
          )}
        </div>
      </div>
    );
  }

  // ═════════════════════════════ ACTIVE — student view ═════════════════════════════
  const hasSubmitted = !!myResponse;
  // 실시간 집계 — 많은 친구가 참여 중임이 학생에게도 보이게 (텍스트는 종료 전 비공개 유지)
  const liveConnected = Object.values(presence).filter(
    (p) => Date.now() - p.lastSeen < 45000,
  ).length;
  const liveSubmitted = responses.length;

  return (
    <div style={overlayStyle}>
      <div style={{
        width: "100%", maxWidth: 560, maxHeight: "90vh",
        background: "#fff", borderRadius: 20, overflow: "hidden",
        boxShadow: "0 32px 80px rgba(0,0,0,0.3)",
        display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{
          padding: "18px 22px", background: BRAND_GRADIENT, color: "#fff",
        }}>
          <div style={{
            display: "inline-block",
            padding: "3px 8px", background: "rgba(255,255,255,0.25)",
            borderRadius: 8, fontSize: 10, fontWeight: 800, letterSpacing: 0.5,
            marginBottom: 8,
          }}>
            💭 의견 나누기
          </div>
          <div style={{ fontWeight: 800, fontSize: 18, lineHeight: 1.35 }}>{displayTitle}</div>
          {/* 실시간 참여 집계 — 많은 친구가 응답해도 참여가 보이게 */}
          <div style={{
            marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap",
          }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "4px 10px", background: "rgba(255,255,255,0.22)",
              borderRadius: 999, fontSize: 12, fontWeight: 800,
            }}>🐝 지금 {liveConnected}명 접속</span>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "4px 10px", background: "rgba(255,255,255,0.22)",
              borderRadius: 999, fontSize: 12, fontWeight: 800,
            }}>✍️ {liveSubmitted}명 생각 나눔</span>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px" }}>
          {displayBody && (
            <div style={{
              fontSize: 14, color: "#4B5563", marginBottom: 14,
              whiteSpace: "pre-wrap", lineHeight: 1.55,
            }}>
              {displayBody}
            </div>
          )}
          {meta.imageUrl && (
            <img src={meta.imageUrl} alt="" style={{
              width: "100%", borderRadius: 12, marginBottom: 16,
              border: "1px solid #E5E7EB",
            }} />
          )}

          {hasSubmitted ? (
            <div style={{
              padding: "18px 16px", background: "#ECFDF5",
              border: "1px solid #A7F3D0", borderRadius: 12, textAlign: "center",
            }}>
              <div style={{ fontSize: 26, marginBottom: 6 }}>✅</div>
              <div style={{ fontWeight: 800, color: "#065F46", fontSize: 15, marginBottom: 8 }}>
                제출 완료!
              </div>
              <div style={{ fontSize: 12, color: "#047857", marginBottom: 14 }}>
                {live
                  ? "친구들의 생각이 아래에 실시간으로 올라와요."
                  : "선생님이 세션을 종료하면 모두의 의견을 볼 수 있어요."}
              </div>
              <div style={{
                background: "#fff", padding: "10px 12px", borderRadius: 8,
                fontSize: 13, color: "#111827", textAlign: "left", lineHeight: 1.5,
                border: "1px solid #D1FAE5",
              }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#6B7280", marginBottom: 4 }}>
                  내 응답
                </div>
                {myResponse.text}
              </div>
            </div>
          ) : (
            <>
              <label style={{ fontSize: 12, fontWeight: 800, color: "#374151", marginBottom: 6, display: "block" }}>
                내 생각 ({myName})
              </label>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="자유롭게 생각을 적어보세요..."
                rows={5}
                autoFocus
                style={{
                  width: "100%", padding: "12px 14px", borderRadius: 12,
                  border: "2px solid #E5E7EB", fontSize: 14, color: "#111827",
                  background: "#F9FAFB", outline: "none", boxSizing: "border-box",
                  resize: "vertical", fontFamily: "inherit", lineHeight: 1.5,
                }}
                onFocus={(e) => { e.target.style.borderColor = "#F59E0B"; e.target.style.background = "#fff"; }}
                onBlur={(e) => { e.target.style.borderColor = "#E5E7EB"; e.target.style.background = "#F9FAFB"; }}
              />
              {error && (
                <div style={{
                  marginTop: 10, padding: "8px 12px", background: "#FEF2F2",
                  color: "#991B1B", fontSize: 12, borderRadius: 6,
                  borderLeft: "3px solid #EF4444",
                }}>{error}</div>
              )}
            </>
          )}

          {live && hasSubmitted && responses.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#6B7280", marginBottom: 8 }}>
                친구들의 생각 (실시간)
              </div>
              <ResponseGrid
                responses={responses}
                myLang={myLang}
                basePath={basePath}
                myClientId={myClientId}
                myName={myName}
                targetLangs={meta?.targetLangs || []}
              />
            </div>
          )}
        </div>

        {!hasSubmitted && (
          <div style={{
            padding: "14px 22px", borderTop: "1px solid #F3F4F6",
            display: "flex", gap: 10,
          }}>
            <button
              onClick={handleSubmit}
              disabled={!draft.trim() || submitting}
              style={{
                flex: 1, padding: "13px 0", borderRadius: 12, fontSize: 14,
                background: !draft.trim() || submitting ? "#F3F4F6" : BRAND_GRADIENT,
                color: !draft.trim() || submitting ? "#D1D5DB" : "#fff",
                fontWeight: 800, border: "none",
                cursor: !draft.trim() || submitting ? "not-allowed" : "pointer",
                boxShadow: !draft.trim() || submitting ? "none" : "0 4px 16px rgba(245,158,11,0.4)",
              }}
            >
              {submitting ? "제출 중..." : "📨 제출하기"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════ Subcomponents ═════════════════════════════

function StatBox({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{
      flex: 1, padding: "10px 12px", borderRadius: 10,
      background: `${color}15`, border: `1px solid ${color}40`,
    }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: color, letterSpacing: 0.3 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color: "#111827", marginTop: 2 }}>
        {value}
      </div>
    </div>
  );
}

const CARD_COLORS = [
  "#FEF3C7", "#DBEAFE", "#FCE7F3", "#D1FAE5", "#EDE9FE",
  "#FEE2E2", "#FFEDD5", "#E0F2FE", "#F3E8FF", "#FEF9C3",
];

const REACTIONS = ["👍", "❤️", "😮", "👏"];

function ResponseCard({
  resp, idx, myLang, basePath, myClientId, myName, targetLangs,
}: {
  resp: SessionResponse;
  idx: number;
  myLang: string;
  basePath: string;
  myClientId: string;
  myName: string;
  targetLangs: string[];
}) {
  const bg = CARD_COLORS[idx % CARD_COLORS.length];
  const text = resp.translations?.[myLang] || resp.text;

  const [showComposer, setShowComposer] = useState(false);
  const [replyDraft, setReplyDraft] = useState("");
  const [sending, setSending] = useState(false);

  // roomCode 는 basePath = rooms/{roomCode}/sessions/{sessionId} 에서 추출
  const roomCode = basePath.split("/")[1] || "";

  // 반응 집계: emoji → count
  const reactionCounts: Record<string, number> = {};
  if (resp.reactions) {
    for (const emoji of Object.values(resp.reactions)) {
      reactionCounts[emoji] = (reactionCounts[emoji] || 0) + 1;
    }
  }
  const myReaction = resp.reactions?.[myClientId];

  function toggleReaction(emoji: string) {
    const db = getClientDb();
    const myRef = ref(db, `${basePath}/responses/${resp.id}/reactions/${myClientId}`);
    if (myReaction === emoji) {
      remove(myRef).catch(() => {});
    } else {
      set(myRef, emoji).catch(() => {});
    }
  }

  // 답글 목록 (timestamp 정렬)
  const replyList: SessionReply[] = resp.replies
    ? Object.values(resp.replies).sort((a, b) => a.timestamp - b.timestamp)
    : [];

  async function sendReply() {
    const t = replyDraft.trim();
    if (!t || sending) return;
    setSending(true);
    try {
      const targets = targetLangs.filter((l) => l !== myLang);
      let translations: Record<string, string> = { [myLang]: t };
      if (targets.length > 0) {
        try {
          const tres = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: t,
              fromLang: myLang,
              targetLangs: targets,
              authorName: myName,
              isTeacher: false,
              paletteIdx: 0,
              roomCode,
              cardType: "comment",
            }),
          });
          const tdata = await tres.json();
          if (tdata.translations) translations = tdata.translations;
        } catch { /* fall back to original */ }
      }
      const db = getClientDb();
      const newRef = push(ref(db, `${basePath}/responses/${resp.id}/replies`));
      await set(newRef, {
        authorName: myName,
        authorLang: myLang,
        authorClientId: myClientId,
        text: t,
        translations,
        timestamp: Date.now(),
      } satisfies SessionReply);
      setReplyDraft("");
    } catch { /* ignore */ }
    setSending(false);
  }

  return (
    <div style={{
      background: bg, borderRadius: 18, padding: "12px 13px 10px",
      border: "1px solid rgba(0,0,0,0.06)",
      boxShadow: "0 6px 14px rgba(0,0,0,0.12)",
      display: "flex", flexDirection: "column", gap: 6,
    }}>
      <div style={{
        fontSize: 13, color: "#111827", lineHeight: 1.45,
        whiteSpace: "pre-wrap", wordBreak: "break-word",
      }}>
        {text}
      </div>
      <div style={{
        fontSize: 10, fontWeight: 800, color: "#6B7280",
        borderTop: "1px dashed rgba(0,0,0,0.12)", paddingTop: 5,
      }}>
        — {resp.authorName}
      </div>

      {/* 반응 이모지 행 */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {REACTIONS.map((emoji) => {
          const count = reactionCounts[emoji] || 0;
          const mine = myReaction === emoji;
          return (
            <button
              key={emoji}
              onClick={() => toggleReaction(emoji)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 3,
                padding: "2px 7px", borderRadius: 999, cursor: "pointer",
                fontSize: 12, lineHeight: 1.4,
                background: mine ? "rgba(245,158,11,0.22)" : "rgba(255,255,255,0.65)",
                border: mine ? "1px solid #F59E0B" : "1px solid rgba(0,0,0,0.08)",
                fontWeight: mine ? 800 : 600,
                color: "#374151",
              }}
            >
              <span>{emoji}</span>
              {count > 0 && (
                <span style={{ fontSize: 10, fontWeight: 800, color: "#6B7280" }}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* 답글 목록 */}
      {replyList.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 2 }}>
          {replyList.map((rep, ri) => (
            <div key={ri} style={{
              fontSize: 11, color: "#4B5563", lineHeight: 1.4,
              wordBreak: "break-word",
            }}>
              {rep.translations?.[myLang] || rep.text}
              <span style={{ color: "#9CA3AF", fontWeight: 700 }}> — {rep.authorName}</span>
            </div>
          ))}
        </div>
      )}

      {/* 답글 토글 + 작성 */}
      {!showComposer ? (
        <button
          onClick={() => setShowComposer(true)}
          style={{
            alignSelf: "flex-start", background: "transparent", border: "none",
            color: "#6B7280", fontSize: 11, fontWeight: 800, cursor: "pointer",
            padding: "1px 0",
          }}
        >💬 답글</button>
      ) : (
        <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
          <input
            value={replyDraft}
            onChange={(e) => setReplyDraft(e.target.value)}
            placeholder="답글..."
            onKeyDown={(e) => { if (e.key === "Enter") sendReply(); }}
            style={{
              flex: 1, minWidth: 0, padding: "5px 8px", borderRadius: 8,
              border: "1px solid rgba(0,0,0,0.12)", fontSize: 12,
              background: "rgba(255,255,255,0.85)", color: "#111827",
              outline: "none",
            }}
          />
          <button
            onClick={sendReply}
            disabled={!replyDraft.trim() || sending}
            style={{
              padding: "5px 9px", borderRadius: 8, fontSize: 11, fontWeight: 800,
              border: "none", whiteSpace: "nowrap",
              background: !replyDraft.trim() || sending ? "#E5E7EB" : "#F59E0B",
              color: !replyDraft.trim() || sending ? "#9CA3AF" : "#fff",
              cursor: !replyDraft.trim() || sending ? "not-allowed" : "pointer",
            }}
          >{sending ? "..." : "답글"}</button>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════ 🍎 Fruit shapes (v2 reveal) ═════════════════════════════
type FruitKind = {
  id: string; bg: string; edge: string; shine: string; stem: string; leaf: string;
  w: number; h: number;
  path: (s: { bg: string; edge: string; stem: string }) => React.ReactElement;
};

const FRUIT_KINDS: FruitKind[] = [
  { id: "apple",  bg: "#EF4444", edge: "#B91C1C", shine: "#FCA5A5", stem: "#78350F", leaf: "#16A34A",
    w: 72, h: 78,
    path: (s) => <ellipse cx="36" cy="42" rx="30" ry="30" fill={s.bg}/>,
  },
  { id: "peach",  bg: "#FDBA74", edge: "#C2410C", shine: "#FED7AA", stem: "#78350F", leaf: "#22C55E",
    w: 70, h: 74,
    path: (s) => (<g>
      <ellipse cx="36" cy="44" rx="28" ry="28" fill={s.bg}/>
      <path d="M36 16 Q30 30 36 44" stroke={s.edge} strokeWidth="1.5" fill="none" opacity="0.4"/>
    </g>),
  },
  { id: "grape",  bg: "#8B5CF6", edge: "#5B21B6", shine: "#C4B5FD", stem: "#78350F", leaf: "#16A34A",
    w: 74, h: 82,
    path: (s) => (<g>
      <circle cx="28" cy="36" r="11" fill={s.bg}/>
      <circle cx="44" cy="36" r="11" fill={s.bg}/>
      <circle cx="36" cy="50" r="11" fill={s.bg}/>
      <circle cx="22" cy="52" r="10" fill={s.edge}/>
      <circle cx="50" cy="52" r="10" fill={s.edge}/>
      <circle cx="36" cy="64" r="10" fill={s.bg}/>
    </g>),
  },
  { id: "lemon",  bg: "#FDE047", edge: "#CA8A04", shine: "#FEF08A", stem: "#78350F", leaf: "#84CC16",
    w: 76, h: 70,
    path: (s) => (<g>
      <ellipse cx="36" cy="42" rx="32" ry="26" fill={s.bg}/>
      <ellipse cx="4"  cy="42" rx="5" ry="3" fill={s.edge}/>
      <ellipse cx="68" cy="42" rx="5" ry="3" fill={s.edge}/>
    </g>),
  },
  { id: "berry",  bg: "#3B82F6", edge: "#1E40AF", shine: "#93C5FD", stem: "#78350F", leaf: "#22C55E",
    w: 68, h: 72,
    path: (s) => (<g>
      <circle cx="36" cy="42" r="28" fill={s.bg}/>
      <path d="M26 30 L36 24 L46 30" stroke={s.edge} strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <path d="M30 26 L36 18 L42 26" stroke={s.edge} strokeWidth="2"   fill="none" strokeLinecap="round" opacity="0.6"/>
    </g>),
  },
  { id: "cherry", bg: "#DC2626", edge: "#7F1D1D", shine: "#FCA5A5", stem: "#78350F", leaf: "#16A34A",
    w: 78, h: 84,
    path: (s) => (<g>
      <circle cx="22" cy="56" r="16" fill={s.bg}/>
      <circle cx="52" cy="56" r="16" fill={s.bg}/>
      <path d="M22 40 Q32 16 40 14" stroke={s.stem} strokeWidth="3" fill="none" strokeLinecap="round"/>
      <path d="M52 40 Q42 16 40 14" stroke={s.stem} strokeWidth="3" fill="none" strokeLinecap="round"/>
    </g>),
  },
];

function Fruit({ kind, scale = 1 }: { kind: FruitKind; scale?: number }) {
  const { w, h, bg, edge, shine, stem, leaf, path } = kind;
  const W = w * scale, H = h * scale;
  return (
    <svg viewBox={`0 0 ${w} ${h + 14}`} width={W} height={H + 14 * scale} style={{ display: "block", overflow: "visible" }}>
      <ellipse cx={w / 2} cy={h + 8} rx={w * 0.32} ry={4} fill="#000" opacity="0.12"/>
      <path d={`M${w / 2} 14 Q${w / 2 - 2} 8 ${w / 2 + 1} 2`} stroke={stem} strokeWidth="3.5" fill="none" strokeLinecap="round"/>
      <g transform={`translate(${w / 2 + 2} 6) rotate(30)`}>
        <path d="M0 0 Q10 -2 14 6 Q8 8 0 0 Z" fill={leaf}/>
      </g>
      <g transform="translate(0 8)">
        {path({ bg, edge, stem })}
        <ellipse cx={w / 2} cy={h / 2 + 10} rx={w * 0.38} ry={5} fill={edge} opacity="0.15"/>
        <ellipse cx={w * 0.38} cy={h * 0.35} rx={w * 0.12} ry={h * 0.16} fill={shine} opacity="0.75"/>
        <circle cx={w * 0.28} cy={h * 0.26} r={2} fill="#fff" opacity="0.9"/>
      </g>
    </svg>
  );
}

function RevealConfetti() {
  const pieces = useMemo(() => {
    const arr: { id: number; left: number; delay: number; dur: number; size: number; color: string }[] = [];
    for (let i = 0; i < 22; i++) {
      arr.push({
        id: i,
        left: (i * 37 + 11) % 100,
        delay: (i * 0.11) % 2.2,
        dur: 2.6 + ((i * 0.19) % 1.4),
        size: 10 + ((i * 7) % 12),
        color: ["#F59E0B", "#F472B6", "#34D399", "#60A5FA", "#FCD34D", "#FB923C"][i % 6],
      });
    }
    return arr;
  }, []);
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5, overflow: "hidden" }}>
      {pieces.map((p) => (
        <div key={p.id} style={{
          position: "absolute", left: `${p.left}%`, top: -30,
          width: p.size, height: p.size, borderRadius: "50%", background: p.color,
          animation: `revealFall ${p.dur}s ease-in ${p.delay}s 1 both`,
        }}/>
      ))}
    </div>
  );
}

function FruitDetailModal({
  resp, kind, myLang, onClose,
}: {
  resp: SessionResponse; kind: FruitKind; myLang: string; onClose: () => void;
}) {
  const native = resp.text;
  const translated = resp.translations?.[myLang] || native;
  const sameLang = resp.authorLang === myLang;
  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute", inset: 0, zIndex: 70,
        background: "rgba(17,24,39,0.55)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24, animation: "fadeIn 0.2s",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 28, maxWidth: 440, width: "100%",
          overflow: "hidden", boxShadow: "0 40px 80px rgba(0,0,0,0.4)",
          animation: "fruitBloom 0.35s cubic-bezier(.17,.89,.32,1.28)",
        }}
      >
        <div style={{
          background: `radial-gradient(circle at 50% 40%, ${kind.shine} 0%, ${kind.bg} 55%, ${kind.edge} 100%)`,
          padding: "26px 20px 20px", display: "flex", justifyContent: "center",
          position: "relative",
        }}>
          <div style={{ position: "absolute", top: 14, left: 30, fontSize: 22 }}>✨</div>
          <div style={{ position: "absolute", top: 30, right: 28, fontSize: 18 }}>⭐</div>
          <div style={{ position: "absolute", bottom: 14, left: 40, fontSize: 14 }}>🌟</div>
          <Fruit kind={kind} scale={1.8}/>
        </div>
        <div style={{ padding: "18px 22px 22px" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10, marginBottom: 14,
            paddingBottom: 14, borderBottom: "1px dashed #E5E7EB",
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14,
              background: "#FEF3C7", display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 22, border: "2px solid #FDE68A",
            }}>{LANGUAGES[resp.authorLang]?.flag || "🌐"}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#1F2937" }}>
                {resp.authorName}
              </div>
              <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 700 }}>
                {LANGUAGES[resp.authorLang]?.label || resp.authorLang}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 17, fontWeight: 600, color: "#1F2937", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {translated}
          </div>
          {!sameLang && (
            <div style={{
              marginTop: 12, padding: "10px 14px",
              background: "#FFFBEB", border: "1px dashed #FDE68A",
              borderRadius: 12, fontSize: 13, color: "#92400E",
              fontStyle: "italic", lineHeight: 1.55,
            }}>
              &quot;{native}&quot;
            </div>
          )}
          <button
            onClick={onClose}
            style={{
              width: "100%", marginTop: 14, minHeight: 52, borderRadius: 16,
              background: "linear-gradient(135deg, #F59E0B, #D97706)",
              color: "#fff", fontSize: 16, fontWeight: 900, border: "none",
              cursor: "pointer", boxShadow: "0 8px 20px rgba(245,158,11,0.4)",
            }}
          >🐝 닫기</button>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════ 🌳 FruitTree ═════════════════════════════
function FruitTree({
  question, responses, myLang,
}: {
  question: string; responses: SessionResponse[]; myLang: string;
}) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const n = responses.length;
  // 인원이 늘어도 빈 수관 안에서 겹치지 않도록 링 수를 동적으로 늘린다.
  const ringCount = n <= 6 ? 1 : n <= 14 ? 2 : n <= 24 ? 3 : 4;
  const perRing = Math.ceil(n / ringCount);
  // 과일 크기는 인원이 많을수록 줄이되 하한을 둔다.
  const fruitScale = n <= 8 ? 1.05 : n <= 16 ? 0.9 : n <= 26 ? 0.76 : 0.64;
  const labelMax = n <= 10 ? 120 : n <= 20 ? 96 : 78;
  const labelFont = n <= 16 ? 11 : 10;
  // tree-bg.png 의 빈 수관(열린 타원)에 맞춘 배치 중심/반지름 (컨테이너 % 기준)
  const CX = 50, CY = 36, RX = 30, RY = 21;

  return (
    <div style={{
      position: "relative",
      flex: 1, minHeight: 0,
      width: "100%",
      overflow: "hidden",
    }}>
      {/* 🌳 Landscape tree background image (was inline SVG) */}
      <img
        src="/discussion/tree-bg.png"
        alt=""
        aria-hidden="true"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          objectFit: "cover", zIndex: 0,
        }}
      />

      {/* 🎉 Confetti burst on reveal */}
      <RevealConfetti />

      {/* 🍎 Fruits — elliptical spread, tap to expand */}
      {responses.map((r, i) => {
        const ringIdx = Math.min(Math.floor(i / perRing), ringCount - 1);
        const posInRing = i % perRing;
        const itemsInRing = Math.min(perRing, n - ringIdx * perRing);
        const frac = ringCount === 1 ? 0.6 : (ringIdx + 1) / ringCount;
        const angleStep = (Math.PI * 2) / Math.max(itemsInRing, 1);
        const angle = posInRing * angleStep - Math.PI / 2 + (ringIdx % 2) * (angleStep / 2);
        const cx = CX + Math.cos(angle) * RX * frac;
        const cy = CY + Math.sin(angle) * RY * frac;
        const kind = FRUIT_KINDS[i % FRUIT_KINDS.length];

        return (
          <button
            key={r.id}
            onClick={() => setSelectedIdx(i)}
            aria-label={`${r.authorName} 응답 펼치기`}
            style={{
              position: "absolute",
              left: `${cx}%`,
              top: `${cy}%`,
              transform: "translate(-50%, -50%)",
              zIndex: 2,
              animation: `fruitPop 0.45s cubic-bezier(.17,.89,.32,1.28) ${i * 0.04}s both`,
              background: "transparent", border: "none", padding: 0, cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.25))",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "translate(-50%, -55%) scale(1.08)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "translate(-50%, -50%) scale(1)")}
          >
            <Fruit kind={kind} scale={fruitScale} />
            <div style={{
              background: "rgba(255,255,255,0.95)", color: "#1F2937",
              padding: "3px 10px", borderRadius: 999, fontSize: labelFont, fontWeight: 800,
              boxShadow: "0 2px 6px rgba(0,0,0,0.15)", whiteSpace: "nowrap",
              maxWidth: labelMax, overflow: "hidden", textOverflow: "ellipsis",
            }}>{r.authorName}</div>
          </button>
        );
      })}

      {/* Tap-to-expand modal */}
      {selectedIdx !== null && responses[selectedIdx] && (
        <FruitDetailModal
          resp={responses[selectedIdx]}
          kind={FRUIT_KINDS[selectedIdx % FRUIT_KINDS.length]}
          myLang={myLang}
          onClose={() => setSelectedIdx(null)}
        />
      )}

      {/* ❓ 질문 — 과일이 차지하는 수관 아래(나무 밑동) 쪽에 배치해 겹침 방지 */}
      <div style={{
        position: "absolute",
        left: "50%",
        top: "85%",
        transform: "translate(-50%, -50%)",
        zIndex: 3,
        background: "rgba(255,255,255,0.96)",
        borderRadius: 18,
        padding: "10px 20px",
        boxShadow: "0 12px 30px rgba(0,0,0,0.22), 0 0 0 4px rgba(245,158,11,0.18)",
        maxWidth: 340,
        minWidth: 200,
        textAlign: "center",
        border: "3px solid #F59E0B",
      }}>
        <div style={{
          fontSize: 10, fontWeight: 900, color: "#F59E0B",
          letterSpacing: 1.2, marginBottom: 3,
        }}>
          ❓ 질문
        </div>
        <div style={{
          fontSize: 16, fontWeight: 900, color: "#111827", lineHeight: 1.3,
        }}>
          {question}
        </div>
      </div>

      <style jsx global>{`
        @keyframes fruitPop {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
          100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes revealFall {
          0%   { transform: translateY(-20px) rotate(0deg);   opacity: 0; }
          15%  { opacity: 1; }
          100% { transform: translateY(90vh) rotate(540deg);  opacity: 0; }
        }
        @keyframes fruitBloom {
          0%   { transform: scale(0.3); opacity: 0; }
          100% { transform: scale(1);   opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// 다인원 응답을 한눈에 — 과일나무 대신 격자 카드로 보는 모드 (가독 보장).
function ResponseGrid({
  responses, myLang, basePath, myClientId, myName, targetLangs,
}: {
  responses: SessionResponse[];
  myLang: string;
  basePath: string;
  myClientId: string;
  myName: string;
  targetLangs: string[];
}) {
  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 18px 28px" }}>
      <div style={{
        display: "grid", gap: 12,
        gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
        maxWidth: 1100, margin: "0 auto",
      }}>
        {responses.map((r, i) => (
          <ResponseCard
            key={r.id}
            resp={r}
            idx={i}
            myLang={myLang}
            basePath={basePath}
            myClientId={myClientId}
            myName={myName}
            targetLangs={targetLangs}
          />
        ))}
      </div>
    </div>
  );
}

function ClosedHeader({
  title, bodyText, count, isTeacher, onExit, onDelete, view, onToggleView,
}: {
  title: string; bodyText: string; count: number; isTeacher: boolean;
  onExit: () => void; onDelete: () => void;
  view: "tree" | "grid"; onToggleView: () => void;
}) {
  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 10, flexShrink: 0,
      padding: "14px 20px", background: BRAND_GRADIENT, color: "#fff",
      display: "flex", alignItems: "center", gap: 12,
      boxShadow: "0 4px 18px rgba(0,0,0,0.18)",
    }}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          padding: "3px 8px", background: "rgba(255,255,255,0.25)",
          borderRadius: 8, fontSize: 10, fontWeight: 800, letterSpacing: 0.5,
          whiteSpace: "nowrap", flexShrink: 0,
        }}>
          🏁 {count}개 응답
        </div>
        <div style={{
          fontWeight: 800, fontSize: 16, lineHeight: 1.3,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>{title}</div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          onClick={onToggleView}
          title={view === "tree" ? "격자로 보기" : "나무로 보기"}
          style={{
            background: "rgba(255,255,255,0.2)", border: "none", color: "#fff",
            height: 34, padding: "0 12px", borderRadius: 8, cursor: "pointer",
            fontSize: 13, fontWeight: 800, whiteSpace: "nowrap",
          }}
        >{view === "tree" ? "▦ 격자" : "🍎 나무"}</button>
        {isTeacher && (
          <button
            onClick={onDelete}
            title="삭제"
            style={{
              background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)",
              color: "#fff", width: 34, height: 34, borderRadius: 8,
              cursor: "pointer", fontSize: 14,
            }}
          >🗑</button>
        )}
        <button
          onClick={onExit}
          title="닫기"
          style={{
            background: "rgba(255,255,255,0.2)", border: "none", color: "#fff",
            width: 34, height: 34, borderRadius: 8, cursor: "pointer", fontSize: 16,
          }}
        >✕</button>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(9,7,30,0.82)",
  backdropFilter: "blur(8px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 450,
  padding: 16,
};
