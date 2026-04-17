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
import { BRAND_GRADIENT } from "@/lib/constants";
import { SessionMeta, SessionResponse, PresenceEntry } from "@/lib/types";

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
      <div style={{ ...overlayStyle, overflowY: "auto", padding: "24px 16px" }}>
        <div style={{
          maxWidth: 1100, margin: "0 auto",
          background: "linear-gradient(180deg,#E8F5FF 0%,#FFF9E8 65%,#F0F7E8 100%)",
          borderRadius: 20, overflow: "hidden",
          boxShadow: "0 32px 80px rgba(0,0,0,0.3)",
        }}>
          <ClosedHeader
            title={displayTitle}
            bodyText={displayBody}
            count={responses.length}
            isTeacher={isTeacher}
            onExit={onExit}
            onDelete={handleDeleteSession}
          />

          {responses.length === 0 ? (
            <div style={{ textAlign: "center", color: "#6B7280", padding: "60px 0", fontSize: 14 }}>
              제출된 응답이 없습니다.
            </div>
          ) : (
            <FruitTree
              question={displayTitle}
              responses={responses}
              myLang={myLang}
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
              <StatBox label="제출" value={submittedCount} color="#5B57F5" />
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
                boxShadow: "0 4px 16px rgba(91,87,245,0.4)",
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
                선생님이 세션을 종료하면 모두의 의견을 볼 수 있어요.
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
                onFocus={(e) => { e.target.style.borderColor = "#5B57F5"; e.target.style.background = "#fff"; }}
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
                boxShadow: !draft.trim() || submitting ? "none" : "0 4px 16px rgba(91,87,245,0.4)",
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

function ResponseCard({ resp, idx, myLang }: { resp: SessionResponse; idx: number; myLang: string }) {
  const bg = CARD_COLORS[idx % CARD_COLORS.length];
  const text = resp.translations?.[myLang] || resp.text;
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
    </div>
  );
}

// ═════════════════════════════ 🌳 FruitTree ═════════════════════════════
function FruitTree({
  question, responses, myLang,
}: {
  question: string; responses: SessionResponse[]; myLang: string;
}) {
  const n = responses.length;
  // Ring configuration based on count
  const ringCount = n <= 6 ? 1 : n <= 14 ? 2 : 3;
  const perRing = Math.ceil(n / ringCount);
  const ringRadii = [30, 42, 52]; // % of container

  // Cap card width so more responses = narrower cards
  const cardWidth = n <= 6 ? 170 : n <= 12 ? 150 : 130;

  return (
    <div style={{
      position: "relative",
      width: "100%",
      minHeight: 720,
      padding: "24px 16px 40px",
      overflow: "hidden",
    }}>
      {/* 🌳 Tree SVG background */}
      <svg
        viewBox="0 0 800 720"
        preserveAspectRatio="xMidYMid slice"
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          zIndex: 0,
        }}
        aria-hidden="true"
      >
        {/* Ground */}
        <ellipse cx="400" cy="700" rx="360" ry="34" fill="#A4D68B" opacity="0.55" />
        {/* Trunk */}
        <path
          d="M378 700 Q370 550 390 420 Q398 360 410 420 Q430 550 422 700 Z"
          fill="#8B5A3C"
        />
        {/* Canopy — layered blobs for fluffy look */}
        <g>
          <circle cx="400" cy="330" r="250" fill="#7AB96A" />
          <circle cx="230" cy="360" r="170" fill="#86C87A" />
          <circle cx="570" cy="360" r="170" fill="#86C87A" />
          <circle cx="310" cy="200" r="150" fill="#92D387" />
          <circle cx="490" cy="200" r="150" fill="#92D387" />
          <circle cx="400" cy="130" r="130" fill="#9EDD92" />
          <circle cx="180" cy="270" r="90" fill="#86C87A" />
          <circle cx="620" cy="270" r="90" fill="#86C87A" />
        </g>
        {/* Highlights */}
        <g opacity="0.55">
          <circle cx="340" cy="180" r="48" fill="#B7E8A9" />
          <circle cx="260" cy="300" r="38" fill="#B7E8A9" />
          <circle cx="480" cy="250" r="34" fill="#B7E8A9" />
          <circle cx="560" cy="180" r="32" fill="#B7E8A9" />
        </g>
      </svg>

      {/* 🍎 Fruits (responses) — positioned around center */}
      {responses.map((r, i) => {
        const ringIdx = Math.min(Math.floor(i / perRing), ringCount - 1);
        const posInRing = i % perRing;
        const itemsInRing = Math.min(perRing, n - ringIdx * perRing);
        // Offset alternate rings by half-angle so they don't line up
        const angleOffset = ringIdx * (Math.PI / itemsInRing);
        const angle = ((posInRing + 0.5) / itemsInRing) * Math.PI * 2
          - Math.PI / 2 + angleOffset;
        const radius = ringRadii[ringIdx];
        const cx = 50 + Math.cos(angle) * radius;
        const cy = 46 + Math.sin(angle) * radius * 0.78;

        return (
          <div
            key={r.id}
            style={{
              position: "absolute",
              left: `${cx}%`,
              top: `${cy}%`,
              transform: "translate(-50%, -50%)",
              width: cardWidth,
              maxWidth: "44%",
              zIndex: 2,
              animation: `fruitPop 0.45s cubic-bezier(.17,.89,.32,1.28) ${i * 0.05}s both`,
            }}
          >
            <ResponseCard resp={r} idx={i} myLang={myLang} />
          </div>
        );
      })}

      {/* ❓ Center question */}
      <div style={{
        position: "absolute",
        left: "50%",
        top: "46%",
        transform: "translate(-50%, -50%)",
        zIndex: 3,
        background: "#fff",
        borderRadius: 24,
        padding: "20px 24px",
        boxShadow: "0 18px 44px rgba(0,0,0,0.22), 0 0 0 4px rgba(91,87,245,0.15)",
        maxWidth: 300,
        minWidth: 220,
        textAlign: "center",
        border: "3px solid #5B57F5",
      }}>
        <div style={{
          fontSize: 10, fontWeight: 900, color: "#5B57F5",
          letterSpacing: 1.2, marginBottom: 8,
        }}>
          ❓ 질문
        </div>
        <div style={{
          fontSize: 17, fontWeight: 900, color: "#111827", lineHeight: 1.35,
        }}>
          {question}
        </div>
      </div>

      <style jsx>{`
        @keyframes fruitPop {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
          100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </div>
  );
}

function ClosedHeader({
  title, bodyText, count, isTeacher, onExit, onDelete,
}: {
  title: string; bodyText: string; count: number; isTeacher: boolean;
  onExit: () => void; onDelete: () => void;
}) {
  return (
    <div style={{
      padding: "20px 24px 18px", background: BRAND_GRADIENT, color: "#fff",
      display: "flex", alignItems: "flex-start", gap: 12,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{
          display: "inline-block",
          padding: "3px 8px", background: "rgba(255,255,255,0.25)",
          borderRadius: 8, fontSize: 10, fontWeight: 800, letterSpacing: 0.5,
          marginBottom: 8,
        }}>
          🏁 세션 종료 · {count}개 응답
        </div>
        <div style={{ fontWeight: 800, fontSize: 20, lineHeight: 1.3 }}>{title}</div>
        {bodyText && (
          <div style={{
            fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 6,
            whiteSpace: "pre-wrap", lineHeight: 1.5,
          }}>
            {bodyText}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
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
